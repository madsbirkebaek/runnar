-- Migration: Add detailed metrics columns to activities table
-- Run this in Supabase SQL Editor if you get "column does not exist" errors

-- Add new columns if they don't exist (safe migration)
alter table public.activities add column if not exists average_heartrate numeric;
alter table public.activities add column if not exists max_heartrate numeric;
alter table public.activities add column if not exists average_speed_ms numeric;
alter table public.activities add column if not exists max_speed_ms numeric;
alter table public.activities add column if not exists elevation_gain numeric;
alter table public.activities add column if not exists calories integer;
alter table public.activities add column if not exists total_elevation_gain numeric;

-- Backfill from strava_data if columns are null
update public.activities
set 
  average_heartrate = coalesce(average_heartrate, (strava_data->>'average_heartrate')::numeric),
  max_heartrate = coalesce(max_heartrate, (strava_data->>'max_heartrate')::numeric),
  elevation_gain = coalesce(elevation_gain, (strava_data->>'total_elevation_gain')::numeric, (strava_data->>'elevation_gain')::numeric),
  total_elevation_gain = coalesce(total_elevation_gain, (strava_data->>'total_elevation_gain')::numeric, (strava_data->>'elevation_gain')::numeric),
  calories = coalesce(calories, (strava_data->>'calories')::integer),
  average_speed_ms = coalesce(average_speed_ms, (strava_data->>'average_speed')::numeric),
  max_speed_ms = coalesce(max_speed_ms, (strava_data->>'max_speed')::numeric)
where strava_data is not null;

