-- RealityCheck per-record sync tables.
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → paste → Run)
-- for the project referenced by REACT_APP_SUPABASE_URL.
--
-- Replaces the whole-state blob in `realitycheck_shared_state` (kept for the
-- app's one-time automatic migration — safe to drop after every device has
-- loaded the app once on the new version).
--
-- Trust model matches the existing blob table: the app talks to these tables
-- directly with the publishable (anon) key, no auth. RLS is enabled with
-- permissive policies so PostgREST allows anon access.

create table if not exists public.rc_projects (
  workspace  text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (workspace, id)
);

create table if not exists public.rc_schedules (
  workspace  text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (workspace, id)
);

create table if not exists public.rc_entries (
  workspace  text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (workspace, id)
);

create table if not exists public.rc_reports (
  workspace  text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (workspace, id)
);

create table if not exists public.rc_goals (
  workspace  text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (workspace, id)
);

-- Used by web push notifications (PWA phase); one row per subscribed browser.
create table if not exists public.rc_push_subscriptions (
  workspace  text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (workspace, id)
);

alter table public.rc_projects           enable row level security;
alter table public.rc_schedules          enable row level security;
alter table public.rc_entries            enable row level security;
alter table public.rc_reports            enable row level security;
alter table public.rc_goals              enable row level security;
alter table public.rc_push_subscriptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rc_projects','rc_schedules','rc_entries','rc_reports','rc_goals','rc_push_subscriptions'] loop
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'rc_anon_all'
    ) then
      execute format('create policy rc_anon_all on public.%I for all using (true) with check (true)', t);
    end if;
  end loop;
end $$;
