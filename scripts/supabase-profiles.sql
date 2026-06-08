-- User profiles for onboarding state and preferences.
-- Run in Supabase SQL Editor after auth.users exists.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  main_goal text[] not null default '{}',
  spending_style text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_onboarding_completed_idx
  on public.profiles (onboarding_completed);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Existing users should not be forced through onboarding.
insert into public.profiles (user_id, onboarding_completed, onboarding_completed_at)
select id, true, now()
from auth.users
on conflict (user_id) do nothing;
