-- Add email column to profiles table if it doesn't exist
alter table public.profiles add column if not exists email text;

-- Update profiles table to ensure email is stored
-- This will be populated when user logs in via callback route

