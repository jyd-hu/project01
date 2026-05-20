import {
  buildMerchantDisplayLookup,
  groupAmountsByNormalizedMerchant,
  resolveMerchantDisplay,
} from '@/lib/merchant'
import {
  buildSpendingTrendInsights,
  type SpendingTrendResult,
  type TrendExpense,
} from '@/lib/spendingTrends'
import {
  computeSpendingDrivers,
  type SpendingDriver,
  type SpendingDriverAnalytics,
} from '@/lib/spendingDrivers'

export type InsightsExpense = TrendExpense

export type InsightsAnalytics = {
  generatedAt: string
  period: {
    days: number
    startDate: string
    endDate: string
  }
  summary: {
    totalSpend: number
    transactionCount: number
    averageTransaction: number
  }
  topCategories: Array<{
    category: string
    total: number
    shareOfSpend: number
  }>
  topMerchants: Array<{
    normalized_merchant: string
    merchant: string
    total: number
    shareOfSpend: number
  }>
  monthlyTotals: Array<{
    month: string
    total: number
  }>
  driverPeriod: SpendingDriverAnalytics['period']
  driverTotals: SpendingDriverAnalytics['totals']
  categoryDrivers: SpendingDriver[]
  merchantDrivers: SpendingDriver[]
  trends: SpendingTrendResult
}

const defaultLookbackDays = 90

function parseExpenseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function toDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getPeriodStart(today: Date, days: number) {
  const start = new Date(today)
  start.setDate(today.getDate() - days)
  return start
}

function roundCurrency(amount: number) {
  return Math.round(amount * 100) / 100
}

export function computeInsightsAnalytics(
  expenses: InsightsExpense[],
  options?: { days?: number; today?: Date }
): InsightsAnalytics {
  const days = options?.days ?? defaultLookbackDays
  const today = options?.today ?? new Date()
  const periodStart = getPeriodStart(today, days)
  const startDate = toDateString(periodStart)
  const endDate = toDateString(today)

  const inPeriod = expenses.filter((expense) => {
    const parsedDate = parseExpenseDate(expense.expense_date)
    return parsedDate && parsedDate >= periodStart && parsedDate <= today
  })

  const totalSpend = roundCurrency(
    inPeriod.reduce((sum, expense) => sum + expense.amount, 0)
  )
  const transactionCount = inPeriod.length
  const averageTransaction =
    transactionCount > 0 ? roundCurrency(totalSpend / transactionCount) : 0

  const categoryTotals = inPeriod.reduce<Record<string, number>>(
    (totals, expense) => {
      totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount
      return totals
    },
    {}
  )

  const topCategories = Object.entries(categoryTotals)
    .map(([category, total]) => ({
      category,
      total: roundCurrency(total),
      shareOfSpend:
        totalSpend > 0 ? roundCurrency((total / totalSpend) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const merchantDisplayLookup = buildMerchantDisplayLookup(expenses)
  const merchantTotals = groupAmountsByNormalizedMerchant(inPeriod)
  const topMerchants = Object.entries(merchantTotals)
    .map(([normalized_merchant, total]) => ({
      normalized_merchant,
      merchant: resolveMerchantDisplay(merchantDisplayLookup, normalized_merchant),
      total: roundCurrency(total),
      shareOfSpend:
        totalSpend > 0 ? roundCurrency((total / totalSpend) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const monthlyTotals = inPeriod
    .reduce<Record<string, number>>((totals, expense) => {
      const parsedDate = parseExpenseDate(expense.expense_date)

      if (!parsedDate) {
        return totals
      }

      const monthKey = toMonthKey(parsedDate)
      totals[monthKey] = (totals[monthKey] ?? 0) + expense.amount
      return totals
    }, {})
  const monthlyTotalsList = Object.entries(monthlyTotals)
    .map(([month, total]) => ({
      month,
      total: roundCurrency(total),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const driverAnalytics = computeSpendingDrivers(expenses, today)

  return {
    generatedAt: today.toISOString(),
    period: { days, startDate, endDate },
    summary: {
      totalSpend,
      transactionCount,
      averageTransaction,
    },
    topCategories,
    topMerchants,
    monthlyTotals: monthlyTotalsList,
    driverPeriod: driverAnalytics.period,
    driverTotals: driverAnalytics.totals,
    categoryDrivers: driverAnalytics.categoryDrivers,
    merchantDrivers: driverAnalytics.merchantDrivers,
    trends: buildSpendingTrendInsights(inPeriod, today),
  }
}

export function getInsightsLookbackStartDate(days: number, today = new Date()) {
  return toDateString(getPeriodStart(today, days))
}
