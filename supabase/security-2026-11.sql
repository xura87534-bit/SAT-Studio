-- Security update (Nov 2026). Safe to run more than once: SQL Editor -> New query -> paste -> Run.

-- 1. Size caps so one account can't fill the database with huge blobs.
--    NOT VALID = existing rows are left alone; every new insert/update is checked.
alter table public.docs drop constraint if exists docs_data_size;
alter table public.docs add constraint docs_data_size check (pg_column_size(data) <= 2000000) not valid;
alter table public.docs drop constraint if exists docs_id_len;
alter table public.docs add constraint docs_id_len check (char_length(id) <= 200) not valid;
alter table public.students drop constraint if exists students_data_size;
alter table public.students add constraint students_data_size check (pg_column_size(data) <= 20000) not valid;

-- 2. Cap on documents per student (stops row-spam).
create or replace function public.docs_row_cap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.docs where user_id = new.user_id) >= 2000 then
    raise exception 'Too many saved items for this account';
  end if;
  return new;
end;
$$;
drop trigger if exists docs_row_cap on public.docs;
create trigger docs_row_cap before insert on public.docs for each row execute function public.docs_row_cap();

-- 3. Claude allowance: per-user limit plus a site-wide daily ceiling.
--    Returns 'ok', 'user' (this user is out) or 'global' (site is out). Old 1-arg version removed.
drop function if exists public.use_ai_credit(int);
drop function if exists public.use_ai_credit(int, int);
create or replace function public.use_ai_credit(p_limit int, p_global int default 3000) returns text
language plpgsql security definer set search_path = '' as $$
declare n int; total int;
begin
  if auth.uid() is null then return 'user'; end if;
  select coalesce(sum(calls), 0) into total from public.ai_usage where day = current_date;
  if total >= p_global then return 'global'; end if;
  insert into public.ai_usage (user_id, day, calls) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into n;
  return case when n <= p_limit then 'ok' else 'user' end;
end;
$$;
revoke all on function public.use_ai_credit(int, int) from public, anon;
grant execute on function public.use_ai_credit(int, int) to authenticated;
create index if not exists ai_usage_day on public.ai_usage (day);

-- 4. Admin list and helpers: nobody but the SQL editor can touch them.
revoke all on table public.admins from anon, authenticated;
revoke all on table public.ai_usage from anon, authenticated;
revoke all on function public.docs_row_cap() from public, anon, authenticated;
