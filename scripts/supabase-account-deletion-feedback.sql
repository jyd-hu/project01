-- Run once in Supabase: SQL Editor → New query → Paste → Run.
-- Stores churn feedback when users delete their account (survives auth user deletion).

create table if not exists public.account_deletion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reason text not null check (reason in ('not_using', 'missing_features', 'privacy', 'other')),
  other_reason text,
  created_at timestamptz not null default now()
);

create index if not exists account_deletion_feedback_created_idx
  on public.account_deletion_feedback (created_at desc);

alter table public.account_deletion_feedback enable row level security;
