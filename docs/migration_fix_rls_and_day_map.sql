-- Migration: Fix RLS policies and add missing day_map column
-- Run this in your Supabase SQL editor

-- 1. Add day_map column to settings table if it doesn't exist
alter table public.settings add column if not exists day_map jsonb;

-- 2. Update RLS policies to allow access without authentication
-- Since we're not using authentication anymore, we need to allow all operations

-- For plans table: Allow all operations (no auth check)
drop policy if exists "users manage own plans" on public.plans;
create policy "allow all plans" on public.plans
  for all using (true) with check (true);

-- For settings table: Allow all operations (no auth check)
drop policy if exists "users manage own settings" on public.settings;
create policy "allow all settings" on public.settings
  for all using (true) with check (true);

-- Optional: If you want to keep RLS enabled but allow the default user ID
-- Uncomment these instead of the above policies:
-- drop policy if exists "users manage own plans" on public.plans;
-- create policy "allow default user plans" on public.plans
--   for all using (user_id = '00000000-0000-0000-0000-000000000000'::uuid) 
--   with check (user_id = '00000000-0000-0000-0000-000000000000'::uuid);
--
-- drop policy if exists "users manage own settings" on public.settings;
-- create policy "allow default user settings" on public.settings
--   for all using (user_id = '00000000-0000-0000-0000-000000000000'::uuid) 
--   with check (user_id = '00000000-0000-0000-0000-000000000000'::uuid);

