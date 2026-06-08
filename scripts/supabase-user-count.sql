-- Run once in Supabase: SQL Editor → New query → Paste → Run.
-- Exposes total auth user count to the login page via RPC.

create or replace function public.get_user_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint from auth.users;
$$;

revoke all on function public.get_user_count() from public;
grant execute on function public.get_user_count() to anon, authenticated;
