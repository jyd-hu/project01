import { getInsightsPeriodBounds } from '@/lib/insightsDates'
import type { InsightsExpense } from '@/lib/insightsTypes'

export type InsightsCategoryDriver = {
  name: string
  spend: number
  contribution: number
}

export type InsightsMerchantDriver = {
  normalized_merchant: string
  spend: number
  contribution: number
}

export type InsightsCoreResponse = {
  period: {
    startDate: string
    endDate: string
    days: number
  }
  totals: {
    spend: number
    transaction_count: number
  }
  drivers: {
    categories: InsightsCategoryDriver[]
    merchants: InsightsMerchantDriver[]
  }
  patterns: {
    monthly_totals: Record<string, number>
    day_of_week_totals: Record<string, number>
  }
}

const defaultLookbackDays = 30
const maxDrivers = 5

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

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function sumByKey(
  expenses: InsightsExpense[],
  getKey: (expense: InsightsExpense) => string | null
) {
  return expenses.reduce<Record<string, number>>((totals, expense) => {
    const key = getKey(expense)

    if (!key) {
      return totals
    }

    totals[key] = roundCurrency((totals[key] ?? 0) + expense.amount)
    return totals
  }, {})
}

function topContributionDrivers<T>(
  totals: Record<string, number>,
  totalSpend: number,
  toDriver: (key: string, spend: number, contribution: number) => T
): T[] {
  return Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxDrivers)
    .map(([key, spend]) => {
      const contribution =
        totalSpend > 0 ? roundPercent((spend / totalSpend) * 100) : 0

      return toDriver(key, spend, contribution)
    })
}

function buildTimePatterns(expenses: InsightsExpense[]) {
  const monthly_totals: Record<string, number> = {}
  const day_of_week_totals: Record<string, number> = {}

  for (const expense of expenses) {
    const parsedDate = parseExpenseDate(expense.expense_date)

    if (!parsedDate) {
      continue
    }

    const monthKey = toMonthKey(parsedDate)
    monthly_totals[monthKey] = roundCurrency(
      (monthly_totals[monthKey] ?? 0) + expense.amount
    )

    const dayKey = String(parsedDate.getDay())
    day_of_week_totals[dayKey] = roundCurrency(
      (day_of_week_totals[dayKey] ?? 0) + expense.amount
    )
  }

  return { monthly_totals, day_of_week_totals }
}

/** Single source of truth for core period insights (no month-over-month). */
export function computeInsightsAnalytics(
  expenses: InsightsExpense[],
  options?: { days?: number; today?: Date }
): InsightsCoreResponse {
  const days = options?.days ?? defaultLookbackDays
  const today = options?.today ?? new Date()
  const period = getInsightsPeriodBounds(days, today)

  const periodExpenses = expenses.filter(
    (expense) =>
      expense.expense_date >= period.startDate &&
      expense.expense_date <= period.endDate
  )

  const spend = roundCurrency(
    periodExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  )
  const transaction_count = periodExpenses.length

  const categoryTotals = sumByKey(periodExpenses, (expense) => expense.category)
  const merchantTotals = sumByKey(
    periodExpenses,
    (expense) => expense.normalized_merchant
  )

  const categories = topContributionDrivers(
    categoryTotals,
    spend,
    (name, amount, contribution) => ({ name, spend: amount, contribution })
  )

  const merchants = topContributionDrivers(
    merchantTotals,
    spend,
    (normalized_merchant, amount, contribution) => ({
      normalized_merchant,
      spend: amount,
      contribution,
    })
  )

  return {
    period,
    totals: { spend, transaction_count },
    drivers: { categories, merchants },
    patterns: buildTimePatterns(periodExpenses),
  }
}
