-- Run this in Supabase: SQL Editor → New query → Paste → Run.
-- Adds per-user ownership to public.expenses and restricts access with RLS.

alter table public.expenses
  add column if not exists expense_date date;

alter table public.expenses
  add column if not exists merchant text;

alter table public.expenses
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.expenses
set expense_date = created_at::date
where expense_date is null;

alter table public.expenses
  alter column expense_date set default current_date,
  alter column expense_date set not null;

alter table public.expenses enable row level security;

drop policy if exists "expenses_anon_select" on public.expenses;
drop policy if exists "expenses_anon_insert" on public.expenses;
drop policy if exists "expenses_anon_update" on public.expenses;
drop policy if exists "expenses_anon_delete" on public.expenses;
drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;

create policy "expenses_select_own"
  on public.expenses
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "expenses_insert_own"
  on public.expenses
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "expenses_update_own"
  on public.expenses
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "expenses_delete_own"
  on public.expenses
  for delete
  to authenticated
  using (auth.uid() = user_id);
