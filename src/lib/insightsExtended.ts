import { getInsightsPeriodBounds } from '@/lib/insightsDates'
import {
  computeInsightsAnalytics,
  type InsightsCoreResponse,
} from '@/lib/insightsAnalytics'
import { computePeriodComparison, type PeriodComparison } from '@/lib/insightsPeriodComparison'
import { extractNoteThemes, type NoteTheme } from '@/lib/insightsNoteThemes'
import type { InsightsExpense } from '@/lib/insightsTypes'

export type WeekdayWeekendSplit = {
  weekday_spend: number
  weekend_spend: number
  weekday_transaction_count: number
  weekend_transaction_count: number
  weekday_spend_pct: number
  weekend_spend_pct: number
}

export type MerchantPattern = {
  normalized_merchant: string
  transaction_count: number
  total_spend: number
  avg_transaction_size: number
}

export type ExtendedInsightsResponse = InsightsCoreResponse & {
  period_comparison: PeriodComparison
  weekday_weekend: WeekdayWeekendSplit
  merchant_patterns: MerchantPattern[]
  note_themes: NoteTheme[]
}

const maxMerchantPatterns = 5

function parseExpenseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function roundCurrency(amount: number) {
  return Math.round(amount * 100) / 100
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10
}

function filterPeriodExpenses(
  expenses: InsightsExpense[],
  startDate: string,
  endDate: string
) {
  return expenses.filter(
    (expense) =>
      expense.expense_date >= startDate && expense.expense_date <= endDate
  )
}

/** Deterministic weekday (Mon–Fri) vs weekend (Sat–Sun) split for the current period. */
function computeWeekdayWeekendSplit(
  expenses: InsightsExpense[],
  startDate: string,
  endDate: string
): WeekdayWeekendSplit {
  const periodExpenses = filterPeriodExpenses(expenses, startDate, endDate)

  let weekday_spend = 0
  let weekend_spend = 0
  let weekday_transaction_count = 0
  let weekend_transaction_count = 0

  for (const expense of periodExpenses) {
    const parsed = parseExpenseDate(expense.expense_date)
    const day = parsed?.getDay()

    if (day === undefined || day === null) {
      continue
    }

    const isWeekend = day === 0 || day === 6

    if (isWeekend) {
      weekend_spend += expense.amount
      weekend_transaction_count += 1
    } else {
      weekday_spend += expense.amount
      weekday_transaction_count += 1
    }
  }

  weekday_spend = roundCurrency(weekday_spend)
  weekend_spend = roundCurrency(weekend_spend)
  const totalSpend = weekday_spend + weekend_spend

  return {
    weekday_spend,
    weekend_spend,
    weekday_transaction_count,
    weekend_transaction_count,
    weekday_spend_pct:
      totalSpend > 0 ? roundPercent((weekday_spend / totalSpend) * 100) : 0,
    weekend_spend_pct:
      totalSpend > 0 ? roundPercent((weekend_spend / totalSpend) * 100) : 0,
  }
}

/** Merchants with repeated visits — useful behavioural patterns, computed deterministically. */
function computeMerchantPatterns(
  expenses: InsightsExpense[],
  startDate: string,
  endDate: string
): MerchantPattern[] {
  const periodExpenses = filterPeriodExpenses(expenses, startDate, endDate)
  const byMerchant = new Map<string, { count: number; spend: number }>()

  for (const expense of periodExpenses) {
    const merchant = expense.normalized_merchant

    if (!merchant) {
      continue
    }

    const current = byMerchant.get(merchant) ?? { count: 0, spend: 0 }
    current.count += 1
    current.spend = roundCurrency(current.spend + expense.amount)
    byMerchant.set(merchant, current)
  }

  return [...byMerchant.entries()]
    .filter(([, stats]) => stats.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || b[1].spend - a[1].spend)
    .slice(0, maxMerchantPatterns)
    .map(([normalized_merchant, stats]) => ({
      normalized_merchant,
      transaction_count: stats.count,
      total_spend: stats.spend,
      avg_transaction_size: roundCurrency(stats.spend / stats.count),
    }))
}

/**
 * Extended deterministic analytics: core insights plus period comparison,
 * weekday/weekend split, merchant patterns, and note themes.
 */
export function computeExtendedInsightsAnalytics(
  expenses: InsightsExpense[],
  options?: { days?: number; today?: Date }
): ExtendedInsightsResponse {
  const days = options?.days ?? 30
  const today = options?.today ?? new Date()
  const core = computeInsightsAnalytics(expenses, { days, today })
  const period = getInsightsPeriodBounds(days, today)
  const periodExpenses = filterPeriodExpenses(
    expenses,
    period.startDate,
    period.endDate
  )

  return {
    ...core,
    period_comparison: computePeriodComparison(expenses, days, today),
    weekday_weekend: computeWeekdayWeekendSplit(
      expenses,
      period.startDate,
      period.endDate
    ),
    merchant_patterns: computeMerchantPatterns(
      expenses,
      period.startDate,
      period.endDate
    ),
    note_themes: extractNoteThemes(periodExpenses),
  }
}
