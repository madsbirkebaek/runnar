-- Migration: Remove foreign key constraints for user_id since we're not using authentication
-- Run this in your Supabase SQL editor

-- Remove foreign key constraint from plans table
alter table public.plans 
  drop constraint if exists plans_user_id_fkey;

-- Remove foreign key constraint from settings table
alter table public.settings 
  drop constraint if exists settings_user_id_fkey;

-- Optional: If you want to keep the constraints but allow NULL or specific values,
-- you could instead modify them, but removing is simpler for now.

