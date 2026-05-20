import type { InsightsExpense } from '@/lib/insightsTypes'

export type MonthOverMonthDriver = {
  change_pct: number | null
  contribution: number | null
}

export type MonthOverMonthCategoryDriver = MonthOverMonthDriver & {
  name: string
}

export type MonthOverMonthMerchantDriver = MonthOverMonthDriver & {
  normalized_merchant: string
}

export type MonthOverMonthComparison = {
  period: {
    current_month: string
    previous_month: string
  }
  total_change_pct: number | null
  drivers: {
    categories: MonthOverMonthCategoryDriver[]
    merchants: MonthOverMonthMerchantDriver[]
  }
}

const minDrivers = 2
const maxDrivers = 3

function parseExpenseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function roundCurrency(amount: number) {
  return Math.round(amount * 100) / 100
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10
}

function getMonthTotals(
  expenses: InsightsExpense[],
  monthKey: string,
  getKey: (expense: InsightsExpense) => string | null
) {
  return expenses.reduce<Record<string, number>>((totals, expense) => {
    const parsedDate = parseExpenseDate(expense.expense_date)

    if (!parsedDate || toMonthKey(parsedDate) !== monthKey) {
      return totals
    }

    const key = getKey(expense)

    if (!key) {
      return totals
    }

    totals[key] = (totals[key] ?? 0) + expense.amount
    return totals
  }, {})
}

function sumTotals(totals: Record<string, number>) {
  return Object.values(totals).reduce((sum, total) => sum + total, 0)
}

type ChangeDriverCandidate = {
  key: string
  change: number
  change_pct: number | null
  contribution: number | null
}

function pickTopChangeDrivers(
  currentTotals: Record<string, number>,
  previousTotals: Record<string, number>,
  totalChange: number
): ChangeDriverCandidate[] {
  if (totalChange === 0) {
    return []
  }

  const keys = new Set([
    ...Object.keys(currentTotals),
    ...Object.keys(previousTotals),
  ])

  const drivers = [...keys]
    .map((key) => {
      const currentTotal = roundCurrency(currentTotals[key] ?? 0)
      const previousTotal = roundCurrency(previousTotals[key] ?? 0)
      const change = roundCurrency(currentTotal - previousTotal)

      return {
        key,
        change_pct:
          previousTotal > 0
            ? roundPercent((change / previousTotal) * 100)
            : null,
        contribution:
          totalChange !== 0
            ? roundPercent((change / totalChange) * 100)
            : null,
        change,
      }
    })
    .filter(
      (driver) =>
        driver.change !== 0 &&
        Math.sign(driver.change) === Math.sign(totalChange)
    )
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  const count =
    drivers.length >= minDrivers
      ? Math.min(maxDrivers, drivers.length)
      : drivers.length

  return drivers.slice(0, count)
}

/** Optional calendar month-over-month comparison (not part of core insights). */
export function computeMonthOverMonthComparison(
  expenses: InsightsExpense[],
  today = new Date()
): MonthOverMonthComparison {
  const currentMonthKey = toMonthKey(today)
  const previousMonthKey = toMonthKey(addMonths(today, -1))

  const currentCategoryTotals = getMonthTotals(
    expenses,
    currentMonthKey,
    (expense) => expense.category
  )
  const previousCategoryTotals = getMonthTotals(
    expenses,
    previousMonthKey,
    (expense) => expense.category
  )
  const currentMerchantTotals = getMonthTotals(
    expenses,
    currentMonthKey,
    (expense) => expense.normalized_merchant
  )
  const previousMerchantTotals = getMonthTotals(
    expenses,
    previousMonthKey,
    (expense) => expense.normalized_merchant
  )

  const currentTotal = roundCurrency(sumTotals(currentCategoryTotals))
  const previousTotal = roundCurrency(sumTotals(previousCategoryTotals))
  const totalChange = roundCurrency(currentTotal - previousTotal)

  const categoryChangeDrivers = pickTopChangeDrivers(
    currentCategoryTotals,
    previousCategoryTotals,
    totalChange
  )
  const merchantChangeDrivers = pickTopChangeDrivers(
    currentMerchantTotals,
    previousMerchantTotals,
    totalChange
  )

  return {
    period: {
      current_month: currentMonthKey,
      previous_month: previousMonthKey,
    },
    total_change_pct:
      previousTotal > 0
        ? roundPercent((totalChange / previousTotal) * 100)
        : null,
    drivers: {
      categories: categoryChangeDrivers.map((driver) => ({
        name: driver.key,
        change_pct: driver.change_pct,
        contribution: driver.contribution,
      })),
      merchants: merchantChangeDrivers.map((driver) => ({
        normalized_merchant: driver.key,
        change_pct: driver.change_pct,
        contribution: driver.contribution,
      })),
    },
  }
}
