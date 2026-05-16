-- Run this in Supabase: SQL Editor → New query → Paste → Run.
-- Allows the browser anon key to SELECT and INSERT on public.expenses.
-- Replace with auth-scoped policies (e.g. auth.uid()) before production.

alter table public.expenses enable row level security;

drop policy if exists "expenses_anon_select" on public.expenses;
drop policy if exists "expenses_anon_insert" on public.expenses;
drop policy if exists "expenses_anon_update" on public.expenses;
drop policy if exists "expenses_anon_delete" on public.expenses;

create policy "expenses_anon_select"
  on public.expenses
  for select
  to anon, authenticated
  using (true);

create policy "expenses_anon_insert"
  on public.expenses
  for insert
  to anon, authenticated
  with check (true);

create policy "expenses_anon_update"
  on public.expenses
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "expenses_anon_delete"
  on public.expenses
  for delete
  to anon, authenticated
  using (true);
