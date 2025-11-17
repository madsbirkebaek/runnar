---
globs: docs/**/*.sql
alwaysApply: true
---

Write Supabase SQL to be idempotent: use create table if not exists, drop policy if exists before create policy, create index if not exists, and create extension if not exists pgcrypto.