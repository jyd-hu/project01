-- Run in Supabase SQL Editor after creating public.categories.
-- Adds per-user ownership to public.categories and restricts access with RLS.

alter table public.categories
  add column if not exists monthly_budget numeric not null default 0;

alter table public.categories
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists categories_user_id_idx
  on public.categories (user_id);

do $$
declare
  name_unique_constraint text;
begin
  select c.conname into name_unique_constraint
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid
    and a.attnum = c.conkey[1]
  where c.conrelid = 'public.categories'::regclass
    and c.contype = 'u'
    and array_length(c.conkey, 1) = 1
    and a.attname = 'name'
  limit 1;

  if name_unique_constraint is not null then
    execute format(
      'alter table public.categories drop constraint %I',
      name_unique_constraint
    );
  end if;
end $$;

create unique index if not exists categories_user_name_unique_idx
  on public.categories (user_id, lower(name));

alter table public.categories
  drop constraint if exists categories_user_id_required;

alter table public.categories
  add constraint categories_user_id_required check (user_id is not null) not valid;

alter table public.categories enable row level security;

drop policy if exists "categories_anon_select" on public.categories;
drop policy if exists "categories_anon_insert" on public.categories;
drop policy if exists "categories_anon_update" on public.categories;
drop policy if exists "categories_anon_delete" on public.categories;
drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;

create policy "categories_select_own"
  on public.categories
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "categories_insert_own"
  on public.categories
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "categories_update_own"
  on public.categories
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories_delete_own"
  on public.categories
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.rename_category(
  category_id integer,
  category_name text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  old_name text;
  next_name text := btrim(category_name);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if next_name is null or next_name = '' then
    raise exception 'Category name cannot be empty.';
  end if;

  select name into old_name
  from public.categories
  where id = category_id
    and user_id = auth.uid();

  if old_name is null then
    raise exception 'Category not found.';
  end if;

  if old_name = next_name then
    return;
  end if;

  update public.categories
  set name = next_name
  where id = category_id
    and user_id = auth.uid();

  update public.expenses
  set category = next_name
  where user_id = auth.uid()
    and category = old_name;
end;
$$;

revoke execute on function public.rename_category(integer, text) from public;
grant execute on function public.rename_category(integer, text) to authenticated;
