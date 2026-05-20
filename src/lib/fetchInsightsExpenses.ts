import type { SupabaseClient } from '@supabase/supabase-js'
import type { InsightsExpense } from '@/lib/insightsAnalytics'
import { getInsightsLookbackStartDate } from '@/lib/insightsAnalytics'

const defaultLookbackDays = 90

export async function fetchInsightsExpenses(
  supabase: SupabaseClient,
  days = defaultLookbackDays
) {
  const startDate = getInsightsLookbackStartDate(days)

  const { data, error } = await supabase
    .from('expenses')
    .select('amount, category, expense_date, merchant, normalized_merchant')
    .gte('expense_date', startDate)
    .order('expense_date', { ascending: false })

  return {
    expenses: (data as InsightsExpense[] | null) ?? [],
    error,
  }
}
