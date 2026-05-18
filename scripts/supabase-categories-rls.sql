-- Run in Supabase SQL Editor after creating public.categories.
-- Adds per-user ownership to public.categories and restricts access with RLS.

alter table public.categories
  add column if not exists monthly_budget numeric not null default 0;

alter table public.categories
  add column if not exists category_group text not null default 'essential';

alter table public.categories
  add column if not exists display_order integer;

alter table public.categories
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists categories_user_id_idx
  on public.categories (user_id);

alter table public.categories
  drop constraint if exists categories_category_group_valid;

alter table public.categories
  add constraint categories_category_group_valid
  check (category_group in ('essential', 'non_essential'));

with ordered_categories as (
  select
    id,
    row_number() over (
      partition by user_id, category_group
      order by id
    ) as next_display_order
  from public.categories
)
update public.categories c
set display_order = ordered_categories.next_display_order
from ordered_categories
where c.id = ordered_categories.id
  and c.display_order is null;

alter table public.categories
  alter column display_order set default 0,
  alter column display_order set not null;

create index if not exists categories_user_group_order_idx
  on public.categories (user_id, category_group, display_order, id);

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

create or replace function public.update_category(
  category_id integer,
  category_name text,
  category_group_value text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  old_name text;
  old_group text;
  next_name text := btrim(category_name);
  next_group text := coalesce(nullif(btrim(category_group_value), ''), 'essential');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if next_name is null or next_name = '' then
    raise exception 'Category name cannot be empty.';
  end if;

  if next_group not in ('essential', 'non_essential') then
    raise exception 'Category group is invalid.';
  end if;

  select c.name, c.category_group
    into old_name, old_group
  from public.categories c
  where c.id = category_id
    and c.user_id = auth.uid();

  if old_name is null then
    raise exception 'Category not found.';
  end if;

  update public.categories
  set
    name = next_name,
    category_group = next_group,
    display_order = case
      when old_group is distinct from next_group then coalesce(
        (
          select max(display_order) + 1
          from public.categories
          where user_id = auth.uid()
            and category_group = next_group
        ),
        1
      )
      else display_order
    end
  where id = category_id
    and user_id = auth.uid();

  if old_name <> next_name then
    update public.expenses
    set category = next_name
    where user_id = auth.uid()
      and category = old_name;
  end if;
end;
$$;

revoke execute on function public.update_category(integer, text, text) from public;
grant execute on function public.update_category(integer, text, text) to authenticated;
