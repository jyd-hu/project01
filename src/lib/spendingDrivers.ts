import {
  buildMerchantDisplayLookup,
  resolveMerchantDisplay,
} from '@/lib/merchant'

export type DriverExpense = {
  amount: number
  category: string
  expense_date: string
  merchant: string | null
  normalized_merchant: string | null
}

export type SpendingDriver = {
  /** UI label (category name or raw merchant). */
  name: string
  normalized_merchant: string | null
  currentTotal: number
  previousTotal: number
  change: number
  percentChange: number | null
  contributionToTotalChange: number | null
}

export type SpendingDriverAnalytics = {
  period: {
    currentMonth: string
    previousMonth: string
  }
  totals: {
    current: number
    previous: number
    change: number
    percentChange: number | null
  }
  categoryDrivers: SpendingDriver[]
  merchantDrivers: SpendingDriver[]
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
  expenses: DriverExpense[],
  monthKey: string,
  getKey: (expense: DriverExpense) => string | null
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

function pickTopDrivers(
  currentTotals: Record<string, number>,
  previousTotals: Record<string, number>,
  totalChange: number,
  resolveDisplayName?: (key: string) => string
): SpendingDriver[] {
  if (totalChange === 0) {
    return []
  }

  const keys = new Set([
    ...Object.keys(currentTotals),
    ...Object.keys(previousTotals),
  ])

  const drivers = [...keys]
    .map((name) => {
      const currentTotal = roundCurrency(currentTotals[name] ?? 0)
      const previousTotal = roundCurrency(previousTotals[name] ?? 0)
      const change = roundCurrency(currentTotal - previousTotal)

      return {
        name: resolveDisplayName ? resolveDisplayName(name) : name,
        normalized_merchant: resolveDisplayName ? name : null,
        currentTotal,
        previousTotal,
        change,
        percentChange:
          previousTotal > 0
            ? roundPercent((change / previousTotal) * 100)
            : null,
        contributionToTotalChange:
          totalChange !== 0
            ? roundPercent((change / totalChange) * 100)
            : null,
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

export function computeSpendingDrivers(
  expenses: DriverExpense[],
  today = new Date()
): SpendingDriverAnalytics {
  const merchantDisplayLookup = buildMerchantDisplayLookup(expenses)
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
    (expense) => expense.normalized_merchant ?? null
  )
  const previousMerchantTotals = getMonthTotals(
    expenses,
    previousMonthKey,
    (expense) => expense.normalized_merchant ?? null
  )

  const currentTotal = roundCurrency(sumTotals(currentCategoryTotals))
  const previousTotal = roundCurrency(sumTotals(previousCategoryTotals))
  const totalChange = roundCurrency(currentTotal - previousTotal)

  return {
    period: {
      currentMonth: currentMonthKey,
      previousMonth: previousMonthKey,
    },
    totals: {
      current: currentTotal,
      previous: previousTotal,
      change: totalChange,
      percentChange:
        previousTotal > 0
          ? roundPercent((totalChange / previousTotal) * 100)
          : null,
    },
    categoryDrivers: pickTopDrivers(
      currentCategoryTotals,
      previousCategoryTotals,
      totalChange
    ),
    merchantDrivers: pickTopDrivers(
      currentMerchantTotals,
      previousMerchantTotals,
      totalChange,
      (normalized_merchant) =>
        resolveMerchantDisplay(merchantDisplayLookup, normalized_merchant)
    ),
  }
}
