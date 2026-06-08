import type { SupabaseClient } from '@supabase/supabase-js'

export type Profile = {
  user_id: string
  display_name: string | null
  onboarding_completed: boolean
  onboarding_completed_at: string | null
  main_goal: string[]
  spending_style: string | null
}

/** True when the user finished onboarding or has no profile row yet (legacy users get backfilled). */
export async function isOnboardingComplete(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return false
  }

  if (!data) {
    return false
  }

  return data.onboarding_completed === true
}
