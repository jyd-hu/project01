-- Run in Supabase SQL Editor after supabase-expenses-rls.sql.
-- Single source of truth: normalize_merchant_text() + expenses_normalize_merchant trigger.

create or replace function public.normalize_merchant_text(raw text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(
      regexp_replace(
        regexp_replace(
          lower(trim(coalesce(raw, ''))),
          '[^a-z0-9\s]',
          ' ',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

update public.expenses
set normalized_merchant = public.normalize_merchant_text(merchant)
where merchant is not null;

update public.expenses
set normalized_merchant = null
where merchant is null;

create or replace function public.expenses_set_normalized_merchant()
returns trigger
language plpgsql
as $$
begin
  new.normalized_merchant := public.normalize_merchant_text(new.merchant);
  return new;
end;
$$;

drop trigger if exists expenses_normalize_merchant on public.expenses;

create trigger expenses_normalize_merchant
  before insert or update of merchant on public.expenses
  for each row
  execute function public.expenses_set_normalized_merchant();

drop index if exists expenses_user_normalized_merchant_idx;

create index if not exists expenses_user_merchant_date_idx
  on public.expenses (user_id, normalized_merchant, expense_date);
