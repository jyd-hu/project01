import type { SupabaseClient } from '@supabase/supabase-js'
import type { InsightsExpense } from '@/lib/insightsTypes'

const defaultRowLimit = 1000

export type FetchInsightsExpensesParams = {
  startDate: string
  endDate: string
  limit?: number
}

/** Loads expense rows for insights; date bounds are applied in Postgres. */
export async function fetchInsightsExpenses(
  supabase: SupabaseClient,
  { startDate, endDate, limit = defaultRowLimit }: FetchInsightsExpensesParams
) {
  const { data, error } = await supabase
    .from('expenses')
    .select('amount, normalized_merchant, category, expense_date')
    .gte('expense_date', startDate)
    .lte('expense_date', endDate)
    .order('expense_date', { ascending: false })
    .limit(limit)

  return {
    expenses: (data as InsightsExpense[] | null) ?? [],
    error,
  }
}
