-- Run in Supabase: SQL Editor → New query → Paste → Run.
-- Stores cached AI insight summaries per user/period/input hash.

create table if not exists public.ai_insight_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  input_hash text not null,
  summary_json jsonb not null,
  model_used text not null,
  user_feedback text check (user_feedback in ('up', 'down')),
  created_at timestamptz not null default now(),
  unique (user_id, period_start, period_end, input_hash)
);

create index if not exists ai_insight_summaries_user_created_idx
  on public.ai_insight_summaries (user_id, created_at desc);

alter table public.ai_insight_summaries enable row level security;

drop policy if exists "ai_insight_summaries_select_own" on public.ai_insight_summaries;
drop policy if exists "ai_insight_summaries_insert_own" on public.ai_insight_summaries;
drop policy if exists "ai_insight_summaries_update_own" on public.ai_insight_summaries;

create policy "ai_insight_summaries_select_own"
  on public.ai_insight_summaries
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "ai_insight_summaries_insert_own"
  on public.ai_insight_summaries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ai_insight_summaries_update_own"
  on public.ai_insight_summaries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
