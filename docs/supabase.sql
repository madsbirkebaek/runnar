-- Auth: enabled by Supabase

-- Extensions
create extension if not exists pgcrypto;

-- Store Strava tokens per user (secure with RLS)
create table if not exists public.strava_tokens (
  user_id uuid references auth.users(id) on delete cascade,
  athlete_id bigint,
  access_token text,
  refresh_token text,
  expires_at bigint,
  inserted_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  primary key (user_id)
);

alter table public.strava_tokens enable row level security;

drop policy if exists "users can manage own tokens" on public.strava_tokens;
create policy "users can manage own tokens" on public.strava_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Indexes
create index if not exists idx_strava_tokens_user on public.strava_tokens(user_id);

-- Update timestamp trigger
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_strava_tokens_updated on public.strava_tokens;
create trigger trg_strava_tokens_updated before update on public.strava_tokens
for each row execute function public.set_updated_at();

-- Optional: user profile
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users can manage own profile" on public.profiles;
create policy "users can manage own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Races discovery
create table if not exists public.races (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  country text,
  distance_km numeric not null,
  date date,
  url text,
  created_at timestamptz default now()
);

alter table public.races enable row level security;
-- Public read discovery
drop policy if exists "public read races" on public.races;
create policy "public read races" on public.races for select using (true);

create index if not exists idx_races_date on public.races(date);
create index if not exists idx_races_country on public.races(country);

-- User race calendar
create table if not exists public.user_races (
  user_id uuid references auth.users(id) on delete cascade,
  race_id uuid references public.races(id) on delete cascade,
  goal_time_min int,
  note text,
  created_at timestamptz default now(),
  primary key (user_id, race_id)
);

alter table public.user_races enable row level security;

drop policy if exists "users manage own user_races" on public.user_races;
create policy "users manage own user_races" on public.user_races
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_user_races_user on public.user_races(user_id);


-- Plans stored per user
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  start_date date,
  -- denormalized summary columns for fast reads
  plan_title text,
  plan_description text,
  distance_label text,
  distance_km numeric,
  race_date date,
  target_time_sec int,
  target_pace_sec int,
  data jsonb not null,
  created_at timestamp with time zone default now()
);

alter table public.plans enable row level security;

drop policy if exists "users manage own plans" on public.plans;
create policy "users manage own plans" on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_plans_user on public.plans(user_id);
create index if not exists idx_plans_created on public.plans(created_at);
create index if not exists idx_plans_race_date on public.plans(race_date);

-- Add columns if missing (safe to re-run)
alter table public.plans add column if not exists plan_title text;
alter table public.plans add column if not exists plan_description text;
alter table public.plans add column if not exists distance_label text;
alter table public.plans add column if not exists distance_km numeric;
alter table public.plans add column if not exists race_date date;
alter table public.plans add column if not exists target_time_sec int;
alter table public.plans add column if not exists target_pace_sec int;

-- Backfill from data JSON if present and columns are null
update public.plans
set plan_title = coalesce(plan_title, data->'meta'->>'plan_title'),
    plan_description = coalesce(plan_description, data->'meta'->>'plan_description')
where (plan_title is null or plan_description is null) and data is not null;

update public.plans
set distance_label = coalesce(distance_label, data->'goal'->>'distance_label'),
    distance_km = coalesce(distance_km, nullif(data->'goal'->>'distance_km','')::numeric),
    race_date = coalesce(race_date, (data->'goal'->>'race_date')::date)
where (distance_label is null or distance_km is null or race_date is null) and data is not null;

-- helper: parse hh:mm:ss or mm:ss to seconds inline
update public.plans
set target_time_sec = coalesce(
  target_time_sec,
  case
    when (data->'goal'->>'target_time') is null then null
    else (
      case
        when array_length(regexp_split_to_array(data->'goal'->>'target_time', ':'),1) = 3 then
          (split_part(data->'goal'->>'target_time',':',1))::int*3600 + (split_part(data->'goal'->>'target_time',':',2))::int*60 + (split_part(data->'goal'->>'target_time',':',3))::int
        when array_length(regexp_split_to_array(data->'goal'->>'target_time', ':'),1) = 2 then
          (split_part(data->'goal'->>'target_time',':',1))::int*60 + (split_part(data->'goal'->>'target_time',':',2))::int
        else null
      end
    )
)
where target_time_sec is null;

update public.plans
set target_pace_sec = coalesce(
  target_pace_sec,
  case
    when (data->'goal'->>'target_pace') is null then null
    else (
      case
        when array_length(regexp_split_to_array(data->'goal'->>'target_pace', ':'),1) >= 2 then
          (split_part(data->'goal'->>'target_pace',':',1))::int*60 + (split_part(data->'goal'->>'target_pace',':',2))::int
        else null
      end
    )
)
where target_pace_sec is null;

-- Settings per user
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  units text default 'metric',
  weekly_days int,
  weekly_time_min int,
  prs jsonb,
  injuries text,
  preferences text,
  day_map jsonb,
  updated_at timestamp with time zone default now()
);

alter table public.settings enable row level security;

drop policy if exists "users manage own settings" on public.settings;
create policy "users manage own settings" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_settings_user on public.settings(user_id);

drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated before update on public.settings
for each row execute function public.set_updated_at();

-- Add active flags for plans
alter table public.plans add column if not exists is_active boolean default false;
alter table public.plans add column if not exists active_at timestamptz;

-- Create index on (user_id, is_active) after column exists
create index if not exists idx_plans_user_active on public.plans(user_id, is_active);

-- Backfill active plan per user if none marked
update public.plans p
set is_active = true, active_at = coalesce(p.active_at, p.created_at)
from (
  select user_id, max(created_at) as maxc
  from public.plans
  group by user_id
) t
where p.user_id = t.user_id and p.created_at = t.maxc
  and not exists (select 1 from public.plans q where q.user_id = p.user_id and q.is_active = true);

-- Service tokens for integrations (service-mode, no user OAuth)
create table if not exists public.service_tokens (
  provider text primary key,
  access_token text,
  refresh_token text,
  expires_at bigint,
  updated_at timestamptz default now()
);

alter table public.service_tokens enable row level security;

-- Deny all to anon/authenticated; service role bypasses RLS
drop policy if exists "deny all service_tokens" on public.service_tokens;
create policy "deny all service_tokens" on public.service_tokens for all using (false) with check (false);


