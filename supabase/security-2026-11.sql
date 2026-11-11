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

-- 5. Admin = a specific account (user id), not just an email address.
--    Before: anyone who registered an admin email that hadn't signed up yet became admin
--    (email confirmation is off). Now existing admin accounts are pinned by id on this run;
--    email rows with no matching account grant nothing.
alter table public.admins add column if not exists user_id uuid references auth.users on delete cascade;
update public.admins a set user_id = u.id
  from auth.users u where a.user_id is null and lower(u.email) = lower(a.email);
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
-- To add an admin later (they must have signed in once first):
--   insert into public.admins (email, user_id) select email, id from auth.users where email = 'teacher@gmail.com';

-- 6. Keep the Students page numbers believable (a student could otherwise post a fake 1600 / 9999 tests).
create or replace function public.students_sanity() returns trigger
language plpgsql set search_path = '' as $$
declare d jsonb := new.data;
begin
  if jsonb_typeof(d) <> 'object' then raise exception 'bad student data'; end if;
  if char_length(coalesce(d->>'name', '')) > 80 then raise exception 'name too long'; end if;
  if coalesce((d->>'best')::numeric, 0) not between 0 and 1600
     or coalesce((d->>'tests')::numeric, 0) not between 0 and 100000
     or coalesce((d->>'full')::numeric, 0) > coalesce((d->>'tests')::numeric, 0)
     or coalesce((d->>'c')::numeric, 0) > coalesce((d->>'q')::numeric, 0)
     or coalesce((d->>'q')::numeric, 0) not between 0 and 10000000 then
    raise exception 'student stats out of range';
  end if;
  return new;
exception when invalid_text_representation then raise exception 'bad student data';
end;
$$;
drop trigger if exists students_sanity on public.students;
create trigger students_sanity before insert or update on public.students for each row execute function public.students_sanity();
revoke all on function public.students_sanity() from public, anon, authenticated;
