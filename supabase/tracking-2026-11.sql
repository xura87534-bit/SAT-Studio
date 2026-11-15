-- SAT Studio visitor counting (Nov 2026). Safe to run more than once: SQL Editor -> New query -> paste -> Run.
--
-- Counts what happens in the app without knowing who anyone is: each browser gets a random id,
-- and the app reports a handful of named events (visit, test started, test finished ...).
-- No names, emails or IP addresses are stored. Only admins can read the totals.

create table if not exists public.events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  day date not null default (now() at time zone 'Asia/Tashkent')::date,
  vid text not null,              -- random id kept in the visitor's browser
  name text not null,             -- which event
  src text,                       -- where the visit came from: instagram, telegram, direct ...
  extra text,                     -- small detail, e.g. which test
  signed_in boolean not null default false
);
alter table public.events enable row level security;
revoke all on table public.events from anon, authenticated;
create index if not exists events_day_name on public.events (day, name);
create index if not exists events_vid_day on public.events (vid, day);

-- The app calls this for every event. Anyone may call it, so it checks everything and caps volume.
create or replace function public.track(p_vid text, p_name text, p_src text default null, p_extra text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_day date := (now() at time zone 'Asia/Tashkent')::date;
begin
  if p_vid is null or p_vid !~ '^[a-z0-9]{8,32}$' then return; end if;
  if p_name not in ('landing', 'visit', 'quick_start', 'quick_done', 'test_start', 'test_done', 'signup', 'pricing_view', 'plan_click') then return; end if;
  if (select count(*) from public.events where vid = p_vid and day = v_day) >= 300 then return; end if;       -- one browser can't flood it
  if (select count(*) from public.events where day = v_day) >= 50000 then return; end if;                      -- nor can many
  insert into public.events (day, vid, name, src, extra, signed_in)
  values (v_day, p_vid, p_name, left(regexp_replace(lower(coalesce(p_src, '')), '[^a-z0-9._-]', '', 'g'), 40),
          left(regexp_replace(coalesce(p_extra, ''), '[^A-Za-z0-9._ -]', '', 'g'), 40), auth.uid() is not null);
end;
$$;
revoke all on function public.track(text, text, text, text) from public;
grant execute on function public.track(text, text, text, text) to anon, authenticated;

-- Admin: totals for the Students page.
create or replace function public.admin_stats(p_days int default 14) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_from date := (now() at time zone 'Asia/Tashkent')::date - (least(greatest(coalesce(p_days, 14), 1), 90) - 1);
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'days', coalesce((select jsonb_agg(x order by x.day desc) from (
      select e.day,
        count(distinct e.vid) filter (where e.name in ('visit', 'landing')) as visitors,
        count(distinct e.vid) filter (where e.name = 'visit') as opened_app,
        count(distinct e.vid) filter (where e.name in ('quick_start', 'test_start')) as started,
        count(distinct e.vid) filter (where e.name in ('quick_done', 'test_done')) as finished,
        count(*) filter (where e.name = 'test_done') as tests_done,
        count(*) filter (where e.name = 'signup') as signups,
        count(distinct e.vid) filter (where e.name = 'pricing_view') as saw_pricing,
        count(distinct e.vid) filter (where e.name = 'plan_click') as clicked_plan
      from public.events e where e.day >= v_from group by e.day) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(s order by s.visitors desc) from (
      select coalesce(nullif(e.src, ''), 'direct') as src, count(distinct e.vid) as visitors
      from public.events e where e.day >= v_from and e.name in ('visit', 'landing') group by 1) s), '[]'::jsonb),
    'total', (select jsonb_build_object(
        'visitors', count(distinct e.vid) filter (where e.name in ('visit', 'landing')),
        'opened_app', count(distinct e.vid) filter (where e.name = 'visit'),
        'started', count(distinct e.vid) filter (where e.name in ('quick_start', 'test_start')),
        'finished', count(distinct e.vid) filter (where e.name in ('quick_done', 'test_done')),
        'finished_test', count(distinct e.vid) filter (where e.name = 'test_done'),
        'signups', count(*) filter (where e.name = 'signup'),
        'returned', (select count(*) from (select vid from public.events where day >= v_from and name = 'visit' group by vid having count(distinct day) >= 2) r))
      from public.events e where e.day >= v_from)
  );
end;
$$;
revoke all on function public.admin_stats(int) from public, anon;
grant execute on function public.admin_stats(int) to authenticated;
