-- Run in Supabase SQL Editor after creating public.categories.
-- Allows the browser anon key to manage categories (dev / solo use).

alter table public.categories enable row level security;

drop policy if exists "categories_anon_select" on public.categories;
drop policy if exists "categories_anon_insert" on public.categories;
drop policy if exists "categories_anon_update" on public.categories;
drop policy if exists "categories_anon_delete" on public.categories;

create policy "categories_anon_select"
  on public.categories
  for select
  to anon, authenticated
  using (true);

create policy "categories_anon_insert"
  on public.categories
  for insert
  to anon, authenticated
  with check (true);

create policy "categories_anon_update"
  on public.categories
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "categories_anon_delete"
  on public.categories
  for delete
  to anon, authenticated
  using (true);
