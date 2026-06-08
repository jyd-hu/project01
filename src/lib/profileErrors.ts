/** Map Supabase/PostgREST errors about missing profiles table to a setup hint. */
export function getProfilesSetupErrorMessage(errorMessage: string | undefined) {
  if (!errorMessage) return null

  const normalized = errorMessage.toLowerCase()
  if (
    normalized.includes('public.profiles') ||
    normalized.includes("'profiles'") ||
    normalized.includes('schema cache')
  ) {
    return 'The profiles table is not set up yet. Run scripts/supabase-profiles.sql in the Supabase SQL Editor, then try again.'
  }

  return null
}
