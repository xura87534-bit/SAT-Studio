supabase/schema.sql-- SAT Studio database. Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Each student's tests, unfinished sessions and settings (one row per app document).
create table if not exists public.docs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.docs enable row level security;
drop policy if exists "own docs" on public.docs;
create policy "own docs" on public.docs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Teachers/admins: add emails here (see README). No policies, so only the SQL editor can change it.
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email'));
$$;

-- One summary row per student for the Students page.
create table if not exists public.students (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.students enable row level security;
drop policy if exists "read own or admin" on public.students;
create policy "read own or admin" on public.students for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "write own" on public.students;
create policy "write own" on public.students for insert with check (user_id = auth.uid());
drop policy if exists "update own" on public.students;
create policy "update own" on public.students for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Daily Claude allowance per user, checked by /api/claude.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  calls int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;

create or replace function public.use_ai_credit(p_limit int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then return false; end if;
  insert into public.ai_usage (user_id, day, calls) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into n;
  return n <= p_limit;
end;
$$;
revoke all on function public.use_ai_credit(int) from public, anon;
grant execute on function public.use_ai_credit(int) to authenticated;
