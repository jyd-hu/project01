import { getInsightsPeriodBounds, getPreviousPeriodBounds } from '@/lib/insightsDates'
import type { InsightsExpense } from '@/lib/insightsTypes'

export type PeriodDriverChange = {
  name: string
  current_spend: number
  previous_spend: number
  change_amount: number
  change_pct: number | null
}

export type PeriodComparison = {
  previous_period: {
    startDate: string
    endDate: string
  }
  spend_change_amount: number
  spend_change_pct: number | null
  transaction_count_change: number
  transaction_count_change_pct: number | null
  avg_transaction_size: number
  avg_transaction_size_previous: number
  avg_transaction_size_change_pct: number | null
  top_category_increases: PeriodDriverChange[]
  top_category_decreases: PeriodDriverChange[]
  top_merchant_increases: PeriodDriverChange[]
  top_merchant_decreases: PeriodDriverChange[]
}

const maxDriverChanges = 3

function roundCurrency(amount: number) {
  return Math.round(amount * 100) / 100
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10
}

function pctChange(current: number, previous: number) {
  if (previous === 0) {
    return null
  }

  return roundPercent(((current - previous) / previous) * 100)
}

function filterByPeriod(
  expenses: InsightsExpense[],
  startDate: string,
  endDate: string
) {
  return expenses.filter(
    (expense) =>
      expense.expense_date >= startDate && expense.expense_date <= endDate
  )
}

function sumSpend(expenses: InsightsExpense[]) {
  return roundCurrency(expenses.reduce((sum, expense) => sum + expense.amount, 0))
}

function totalsByKey(
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

function topDriverChanges(
  currentTotals: Record<string, number>,
  previousTotals: Record<string, number>,
  direction: 'increase' | 'decrease'
): PeriodDriverChange[] {
  const keys = new Set([
    ...Object.keys(currentTotals),
    ...Object.keys(previousTotals),
  ])

  return [...keys]
    .map((name) => {
      const current_spend = roundCurrency(currentTotals[name] ?? 0)
      const previous_spend = roundCurrency(previousTotals[name] ?? 0)
      const change_amount = roundCurrency(current_spend - previous_spend)

      return {
        name,
        current_spend,
        previous_spend,
        change_amount,
        change_pct: pctChange(current_spend, previous_spend),
      }
    })
    .filter((driver) =>
      direction === 'increase' ? driver.change_amount > 0 : driver.change_amount < 0
    )
    .sort((a, b) => Math.abs(b.change_amount) - Math.abs(a.change_amount))
    .slice(0, maxDriverChanges)
}

/** Deterministic same-length period-over-period comparison (not calendar month). */
export function computePeriodComparison(
  expenses: InsightsExpense[],
  days: number,
  today = new Date()
): PeriodComparison {
  const currentPeriod = getInsightsPeriodBounds(days, today)
  const previousPeriod = getPreviousPeriodBounds(days, today)

  const currentExpenses = filterByPeriod(
    expenses,
    currentPeriod.startDate,
    currentPeriod.endDate
  )
  const previousExpenses = filterByPeriod(
    expenses,
    previousPeriod.startDate,
    previousPeriod.endDate
  )

  const currentSpend = sumSpend(currentExpenses)
  const previousSpend = sumSpend(previousExpenses)
  const spend_change_amount = roundCurrency(currentSpend - previousSpend)

  const currentCount = currentExpenses.length
  const previousCount = previousExpenses.length
  const transaction_count_change = currentCount - previousCount

  const avg_transaction_size =
    currentCount > 0 ? roundCurrency(currentSpend / currentCount) : 0
  const avg_transaction_size_previous =
    previousCount > 0 ? roundCurrency(previousSpend / previousCount) : 0

  const currentCategoryTotals = totalsByKey(currentExpenses, (e) => e.category)
  const previousCategoryTotals = totalsByKey(previousExpenses, (e) => e.category)
  const currentMerchantTotals = totalsByKey(
    currentExpenses,
    (e) => e.normalized_merchant
  )
  const previousMerchantTotals = totalsByKey(
    previousExpenses,
    (e) => e.normalized_merchant
  )

  return {
    previous_period: {
      startDate: previousPeriod.startDate,
      endDate: previousPeriod.endDate,
    },
    spend_change_amount,
    spend_change_pct: pctChange(currentSpend, previousSpend),
    transaction_count_change,
    transaction_count_change_pct: pctChange(currentCount, previousCount),
    avg_transaction_size,
    avg_transaction_size_previous,
    avg_transaction_size_change_pct: pctChange(
      avg_transaction_size,
      avg_transaction_size_previous
    ),
    top_category_increases: topDriverChanges(
      currentCategoryTotals,
      previousCategoryTotals,
      'increase'
    ),
    top_category_decreases: topDriverChanges(
      currentCategoryTotals,
      previousCategoryTotals,
      'decrease'
    ),
    top_merchant_increases: topDriverChanges(
      currentMerchantTotals,
      previousMerchantTotals,
      'increase'
    ),
    top_merchant_decreases: topDriverChanges(
      currentMerchantTotals,
      previousMerchantTotals,
      'decrease'
    ),
  }
}
