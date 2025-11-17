-- Enable pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- Edge function function hooks (http calls originate from Supabase Edge Runtime)
-- We'll create a queue table to buffer Strava events from webhook to processing cron
create table if not exists public.strava_events (
  id uuid primary key default gen_random_uuid(),
  object_id bigint not null,
  object_type text not null,
  aspect_type text not null,
  owner_id bigint,
  event_time bigint not null,
  payload jsonb not null,
  status text default 'queued',
  created_at timestamptz default now()
);

alter table public.strava_events enable row level security;

create policy if not exists "service can insert events" on public.strava_events
  for insert to authenticated using (true) with check (true);

-- Indexes
create index if not exists idx_strava_events_time on public.strava_events (event_time);
create index if not exists idx_strava_events_status on public.strava_events (status);
