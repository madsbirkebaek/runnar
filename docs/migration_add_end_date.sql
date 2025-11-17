-- Migration: Add end_date column to plans table
-- Run this in your Supabase SQL editor

-- Add end_date column if it doesn't exist
alter table public.plans add column if not exists end_date date;

-- Optional: Backfill end_date from race_date if end_date is null but race_date exists
update public.plans
set end_date = race_date
where end_date is null and race_date is not null;

