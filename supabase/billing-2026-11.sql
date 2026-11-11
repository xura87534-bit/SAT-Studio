-- SAT Studio billing (Nov 2026). Safe to run more than once: SQL Editor -> New query -> paste -> Run.
-- Run after schema.sql and security-2026-11.sql.
--
-- How it works: a student presses "I've paid" on the Billing page, which files a payment request.
-- You check that the money arrived, then approve it on the Students page; that extends their Pro time.
-- Students can never write to these tables directly: every change goes through the functions below.

-- 1. Who has Pro, and until when.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  paid_until timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "read own or admin" on public.subscriptions;
create policy "read own or admin" on public.subscriptions for select
  using (user_id = auth.uid() or public.is_admin());
revoke all on table public.subscriptions from anon, authenticated;
grant select on table public.subscriptions to authenticated;

-- 2. Payment requests and their outcome (also your sales ledger).
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  email text,
  plan text not null,
  months int not null check (months between 1 and 24),
  amount int not null check (amount between 0 and 100000000),
  note text check (char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
alter table public.payments enable row level security;
drop policy if exists "read own or admin" on public.payments;
create policy "read own or admin" on public.payments for select
  using (user_id = auth.uid() or public.is_admin());
revoke all on table public.payments from anon, authenticated;
grant select on table public.payments to authenticated;
create index if not exists payments_status on public.payments (status, created_at desc);
create index if not exists payments_user on public.payments (user_id, created_at desc);

-- 3. Is this account on Pro right now? Admins always are.
create or replace function public.plan_of(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when p_user is not null and (
      exists (select 1 from public.subscriptions s where s.user_id = p_user and s.paid_until > now())
      or exists (select 1 from public.admins a where a.user_id = p_user)
    ) then 'pro' else 'free' end;
$$;
revoke all on function public.plan_of(uuid) from public, anon, authenticated;

-- 4. What the app asks on load: my plan, when it ends, and my latest payment request.
create or replace function public.my_plan() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plan', public.plan_of(auth.uid()),
    'paid_until', (select s.paid_until from public.subscriptions s where s.user_id = auth.uid()),
    'last', (select jsonb_build_object('plan', p.plan, 'amount', p.amount, 'status', p.status, 'created_at', p.created_at)
             from public.payments p where p.user_id = auth.uid() order by p.created_at desc limit 1)
  );
$$;
revoke all on function public.my_plan() from public, anon;
grant execute on function public.my_plan() to authenticated;

-- 5. "I've paid": files one pending request per student (pressing again updates it).
--    The amount is what the student was shown; you confirm the real amount against your bank app.
create or replace function public.request_payment(p_plan text, p_amount int, p_note text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_months int; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  v_months := case p_plan when 'm1' then 1 when 'm3' then 3 when 'm6' then 6 else null end;
  if v_months is null then raise exception 'Unknown plan'; end if;
  if (select count(*) from public.payments where user_id = auth.uid() and created_at > now() - interval '1 day') >= 6 then
    raise exception 'Too many payment requests today. Message us instead.';
  end if;
  select id into v_id from public.payments where user_id = auth.uid() and status = 'pending' order by created_at desc limit 1;
  if v_id is not null then
    update public.payments set plan = p_plan, months = v_months,
      amount = least(greatest(coalesce(p_amount, 0), 0), 100000000), note = left(coalesce(p_note, ''), 300), created_at = now()
      where id = v_id;
  else
    insert into public.payments (user_id, email, plan, months, amount, note)
    values (auth.uid(), auth.jwt() ->> 'email', p_plan, v_months,
            least(greatest(coalesce(p_amount, 0), 0), 100000000), left(coalesce(p_note, ''), 300))
    returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$$;
revoke all on function public.request_payment(text, int, text) from public, anon;
grant execute on function public.request_payment(text, int, text) to authenticated;

-- 6. Admin: the payments list for the Students page (pending first).
create or replace function public.admin_payments() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(x) from (
        select p.id, p.email, p.plan, p.months, p.amount, p.note, p.status, p.created_at, p.decided_at,
               (select s.paid_until from public.subscriptions s where s.user_id = p.user_id) as paid_until
        from public.payments p order by (p.status = 'pending') desc, p.created_at desc limit 200) x), '[]'::jsonb),
    'active_pro', (select count(*) from public.subscriptions where paid_until > now()),
    'revenue_30d', (select coalesce(sum(amount), 0) from public.payments where status = 'approved' and decided_at > now() - interval '30 days'),
    'revenue_all', (select coalesce(sum(amount), 0) from public.payments where status = 'approved')
  );
end;
$$;
revoke all on function public.admin_payments() from public, anon;
grant execute on function public.admin_payments() to authenticated;

-- 7. Admin: approve (adds the months on top of any time the student still has) or reject.
create or replace function public.admin_decide_payment(p_id uuid, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.payments; v_until timestamptz;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into r from public.payments where id = p_id for update;
  if r.id is null then raise exception 'No such payment'; end if;
  if r.status <> 'pending' then raise exception 'Already %', r.status; end if;
  update public.payments set status = case when p_approve then 'approved' else 'rejected' end,
    decided_at = now(), decided_by = auth.uid() where id = p_id;
  if p_approve then
    insert into public.subscriptions (user_id, paid_until)
    values (r.user_id, now() + make_interval(months => r.months))
    on conflict (user_id) do update
      set paid_until = greatest(public.subscriptions.paid_until, now()) + make_interval(months => r.months), updated_at = now()
    returning paid_until into v_until;
  end if;
  return jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end, 'paid_until', v_until);
end;
$$;
revoke all on function public.admin_decide_payment(uuid, boolean) from public, anon;
grant execute on function public.admin_decide_payment(uuid, boolean) to authenticated;

-- 8. Admin: give Pro by email without a request (cash, a gift, a prize, a refund reversal).
--    A negative number of days takes time away; the student must have signed in once.
create or replace function public.admin_grant_pro(p_email text, p_days int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_until timestamptz; v_days int := least(greatest(coalesce(p_days, 0), -3660), 3660);
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'No account with that email yet'; end if;
  insert into public.subscriptions (user_id, paid_until)
  values (v_user, now() + make_interval(days => v_days))
  on conflict (user_id) do update
    set paid_until = greatest(public.subscriptions.paid_until, now()) + make_interval(days => v_days), updated_at = now()
  returning paid_until into v_until;
  return jsonb_build_object('paid_until', v_until);
end;
$$;
revoke all on function public.admin_grant_pro(text, int) from public, anon;
grant execute on function public.admin_grant_pro(text, int) to authenticated;

-- 9. Claude allowance by plan. /api/claude calls this instead of use_ai_credit once this file has run.
--    Returns {"status": "ok" | "user" | "global", "plan": "free" | "pro", "limit": n}.
--    Limits are clamped here because signed-in users can call the function directly.
create or replace function public.use_ai_credit_plan(p_free int, p_pro int, p_global int default 3000) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int; total int; mine int;
  v_plan text := public.plan_of(auth.uid());
  v_limit int;
  v_global int := least(greatest(coalesce(p_global, 0), 0), 20000);
begin
  if auth.uid() is null then return jsonb_build_object('status', 'user', 'plan', 'free', 'limit', 0); end if;
  v_limit := case when v_plan = 'pro' then least(greatest(coalesce(p_pro, 0), 0), 500)
                  else least(greatest(coalesce(p_free, 0), 0), 50) end;
  select coalesce(calls, 0) into mine from public.ai_usage where user_id = auth.uid() and day = current_date;
  if coalesce(mine, 0) >= v_limit then return jsonb_build_object('status', 'user', 'plan', v_plan, 'limit', v_limit); end if;
  select coalesce(sum(calls), 0) into total from public.ai_usage where day = current_date;
  if total >= v_global then return jsonb_build_object('status', 'global', 'plan', v_plan, 'limit', v_limit); end if;
  insert into public.ai_usage (user_id, day, calls) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into n;
  return jsonb_build_object('status', case when n <= v_limit then 'ok' else 'user' end, 'plan', v_plan, 'limit', v_limit, 'used', n);
end;
$$;
revoke all on function public.use_ai_credit_plan(int, int, int) from public, anon;
grant execute on function public.use_ai_credit_plan(int, int, int) to authenticated;
