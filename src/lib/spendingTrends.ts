import {
  buildMerchantDisplayLookup,
  groupAmountsByNormalizedMerchant,
  resolveMerchantDisplay,
} from '@/lib/merchant'

export type TrendExpense = {
  amount: number
  category: string
  expense_date: string
  merchant: string | null
  normalized_merchant: string | null
}

export type SpendingTrendInsight = {
  id: string
  kind: 'category' | 'merchant'
  category: string
  /** Raw merchant label for UI; null for category insights. */
  merchant: string | null
  normalized_merchant: string | null
  title: string
  detail: string
  valueLabel: string
}

export type SpendingTrendContext = {
  isHolidayWeek: boolean
  holidayName?: string
}

export type SpendingTrendResult = {
  context: SpendingTrendContext
  insights: SpendingTrendInsight[]
}

type TrendInsightDisplayRule = {
  type: 'monthlyIncrease'
  changeAmount: number
  changeRatio: number | null
}

type SpendingTrendInsightWithDisplayRule = SpendingTrendInsight & {
  displayRule?: TrendInsightDisplayRule
}

const fixedHolidayDates = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 12, day: 25, name: 'Christmas Day' },
  { month: 12, day: 26, name: 'Boxing Day' },
]

const lowValueHolidayChangeRatio = 0.1

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
})

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

function getWeekStart(date: Date) {
  const weekStart = new Date(date)
  const day = weekStart.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  weekStart.setDate(weekStart.getDate() + mondayOffset)

  return weekStart
}

function getHolidayContext(date: Date): SpendingTrendContext {
  const weekStart = getWeekStart(date)

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const weekDate = new Date(weekStart)
    weekDate.setDate(weekStart.getDate() + dayOffset)

    const holiday = fixedHolidayDates.find(
      (fixedHoliday) =>
        fixedHoliday.month === weekDate.getMonth() + 1 &&
        fixedHoliday.day === weekDate.getDate()
    )

    if (holiday) {
      return {
        isHolidayWeek: true,
        holidayName: holiday.name,
      }
    }
  }

  return { isHolidayWeek: false }
}

function daysBetween(start: Date, end: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay)
}

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount)
}

function getMonthlyCategoryTotals(expenses: TrendExpense[]) {
  return expenses.reduce<Record<string, Record<string, number>>>(
    (totals, expense) => {
      const parsedDate = parseExpenseDate(expense.expense_date)

      if (!parsedDate) {
        return totals
      }

      const monthKey = toMonthKey(parsedDate)
      totals[monthKey] = totals[monthKey] ?? {}
      totals[monthKey][expense.category] =
        (totals[monthKey][expense.category] ?? 0) + expense.amount

      return totals
    },
    {}
  )
}

function getMonthlyMerchantTotals(expenses: TrendExpense[]) {
  return expenses.reduce<Record<string, Record<string, number>>>(
    (totals, expense) => {
      const parsedDate = parseExpenseDate(expense.expense_date)

      if (!parsedDate || !expense.normalized_merchant) {
        return totals
      }

      const monthKey = toMonthKey(parsedDate)
      totals[monthKey] = totals[monthKey] ?? {}
      totals[monthKey][expense.normalized_merchant] =
        (totals[monthKey][expense.normalized_merchant] ?? 0) + expense.amount

      return totals
    },
    {}
  )
}

function toSpendingTrendInsight(
  insight: SpendingTrendInsightWithDisplayRule
): SpendingTrendInsight {
  return {
    id: insight.id,
    kind: insight.kind,
    category: insight.category,
    merchant: insight.merchant,
    normalized_merchant: insight.normalized_merchant,
    title: insight.title,
    detail: insight.detail,
    valueLabel: insight.valueLabel,
  }
}

function formatInsightsForContext(
  insights: SpendingTrendInsightWithDisplayRule[],
  context: SpendingTrendContext
): SpendingTrendInsight[] {
  if (!context.isHolidayWeek) {
    return insights.map(toSpendingTrendInsight)
  }

  const holidayPeriod = context.holidayName
    ? `${context.holidayName} period`
    : 'holiday period'

  return insights.flatMap((insight) => {
    if (insight.displayRule?.type !== 'monthlyIncrease') {
      return [toSpendingTrendInsight(insight)]
    }

    if (
      insight.displayRule.changeRatio !== null &&
      insight.displayRule.changeRatio < lowValueHolidayChangeRatio
    ) {
      return []
    }

    const subject =
      insight.kind === 'merchant' && insight.merchant
        ? insight.merchant
        : insight.category

    return [
      {
        ...toSpendingTrendInsight(insight),
        title: 'Higher holiday-period spend',
        detail: `${subject} spending was higher recently (${holidayPeriod}).`,
        valueLabel: formatCurrency(insight.displayRule.changeAmount),
      },
    ]
  })
}

export function buildSpendingTrendInsights(
  expenses: TrendExpense[],
  today = new Date()
): SpendingTrendResult {
  const context = getHolidayContext(today)
  const datedExpenses = expenses
    .map((expense) => ({
      ...expense,
      parsedDate: parseExpenseDate(expense.expense_date),
    }))
    .filter(
      (expense): expense is TrendExpense & { parsedDate: Date } =>
        expense.parsedDate !== null
    )

  if (!datedExpenses.length) {
    return {
      context,
      insights: [],
    }
  }

  const insights: SpendingTrendInsightWithDisplayRule[] = []
  const merchantDisplayLookup = buildMerchantDisplayLookup(datedExpenses)
  const last30DayStart = new Date(today)
  last30DayStart.setDate(today.getDate() - 30)

  const last30DayTotals = datedExpenses.reduce<Record<string, number>>(
    (totals, expense) => {
      if (expense.parsedDate < last30DayStart || expense.parsedDate > today) {
        return totals
      }

      totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount
      return totals
    },
    {}
  )
  const recentCategoryTotals = Object.entries(last30DayTotals).sort(
    (a, b) => b[1] - a[1]
  )

  recentCategoryTotals.forEach(([category, total]) => {
    insights.push({
      id: `top-recent-category:${category}`,
      kind: 'category',
      category,
      merchant: null,
      normalized_merchant: null,
      title: 'Highest recent spend',
      detail: `${category} is a top category over the last 30 days.`,
      valueLabel: formatCurrency(total),
    })
  })

  const last30DayMerchantTotals = groupAmountsByNormalizedMerchant(
    datedExpenses.filter(
      (expense) =>
        expense.parsedDate >= last30DayStart && expense.parsedDate <= today
    )
  )
  const recentMerchantTotals = Object.entries(last30DayMerchantTotals).sort(
    (a, b) => b[1] - a[1]
  )

  recentMerchantTotals.forEach(([normalized_merchant, total]) => {
    const merchant = resolveMerchantDisplay(
      merchantDisplayLookup,
      normalized_merchant
    )

    insights.push({
      id: `top-recent-merchant:${normalized_merchant}`,
      kind: 'merchant',
      category: '',
      merchant,
      normalized_merchant,
      title: 'Highest recent merchant spend',
      detail: `${merchant} is a top merchant over the last 30 days.`,
      valueLabel: formatCurrency(total),
    })
  })

  const monthlyTotals = getMonthlyCategoryTotals(datedExpenses)
  const currentMonthKey = toMonthKey(today)
  const previousMonthKey = toMonthKey(addMonths(today, -1))
  const currentMonthTotals = monthlyTotals[currentMonthKey] ?? {}
  const previousMonthTotals = monthlyTotals[previousMonthKey] ?? {}
  const monthlyIncreases = Object.entries(currentMonthTotals)
    .map(([category, total]) => ({
      category,
      previousTotal: previousMonthTotals[category] ?? 0,
      increase: total - (previousMonthTotals[category] ?? 0),
    }))
    .filter((item) => item.increase > 0)
    .sort((a, b) => b.increase - a.increase)

  monthlyIncreases.forEach((increase) => {
    insights.push({
      id: `biggest-monthly-increase:${increase.category}`,
      kind: 'category',
      category: increase.category,
      merchant: null,
      normalized_merchant: null,
      title: 'Biggest monthly increase',
      detail: `${increase.category} is up compared with last month.`,
      valueLabel: `+${formatCurrency(increase.increase)}`,
      displayRule: {
        type: 'monthlyIncrease',
        changeAmount: increase.increase,
        changeRatio:
          increase.previousTotal > 0
            ? increase.increase / increase.previousTotal
            : null,
      },
    })
  })

  const monthlyMerchantTotals = getMonthlyMerchantTotals(datedExpenses)
  const currentMonthMerchantTotals = monthlyMerchantTotals[currentMonthKey] ?? {}
  const previousMonthMerchantTotals =
    monthlyMerchantTotals[previousMonthKey] ?? {}
  const monthlyMerchantIncreases = Object.entries(currentMonthMerchantTotals)
    .map(([normalized_merchant, total]) => ({
      normalized_merchant,
      previousTotal: previousMonthMerchantTotals[normalized_merchant] ?? 0,
      increase: total - (previousMonthMerchantTotals[normalized_merchant] ?? 0),
    }))
    .filter((item) => item.increase > 0)
    .sort((a, b) => b.increase - a.increase)

  monthlyMerchantIncreases.forEach((increase) => {
    const merchant = resolveMerchantDisplay(
      merchantDisplayLookup,
      increase.normalized_merchant
    )

    insights.push({
      id: `biggest-monthly-merchant-increase:${increase.normalized_merchant}`,
      kind: 'merchant',
      category: '',
      merchant,
      normalized_merchant: increase.normalized_merchant,
      title: 'Biggest monthly merchant increase',
      detail: `${merchant} is up compared with last month.`,
      valueLabel: `+${formatCurrency(increase.increase)}`,
      displayRule: {
        type: 'monthlyIncrease',
        changeAmount: increase.increase,
        changeRatio:
          increase.previousTotal > 0
            ? increase.increase / increase.previousTotal
            : null,
      },
    })
  })

  const categoryDates = datedExpenses.reduce<Record<string, Date[]>>(
    (dates, expense) => {
      dates[expense.category] = [...(dates[expense.category] ?? []), expense.parsedDate]
      return dates
    },
    {}
  )
  const frequentCategory = Object.entries(categoryDates)
    .map(([category, dates]) => {
      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime())
      const firstDate = sortedDates[0]
      const lastDate = sortedDates.at(-1)
      const activeDays =
        firstDate && lastDate ? Math.max(daysBetween(firstDate, lastDate), 1) : 1

      return {
        category,
        count: dates.length,
        averageDaysBetween: activeDays / Math.max(dates.length - 1, 1),
      }
    })
    .filter((item) => item.count >= 3)
    .sort((a, b) => a.averageDaysBetween - b.averageDaysBetween)[0]

  if (frequentCategory) {
    insights.push({
      id: 'frequent-category',
      kind: 'category',
      category: frequentCategory.category,
      merchant: null,
      normalized_merchant: null,
      title: 'Most regular category',
      detail: `${frequentCategory.category} appears most consistently in your history.`,
      valueLabel: `${frequentCategory.count} entries`,
    })
  }

  const merchantDates = datedExpenses.reduce<Record<string, Date[]>>(
    (dates, expense) => {
      if (!expense.normalized_merchant) {
        return dates
      }

      dates[expense.normalized_merchant] = [
        ...(dates[expense.normalized_merchant] ?? []),
        expense.parsedDate,
      ]
      return dates
    },
    {}
  )
  const frequentMerchant = Object.entries(merchantDates)
    .map(([normalized_merchant, dates]) => {
      const sortedDates = [...dates].sort((a, b) => a.getTime() - b.getTime())
      const firstDate = sortedDates[0]
      const lastDate = sortedDates.at(-1)
      const activeDays =
        firstDate && lastDate ? Math.max(daysBetween(firstDate, lastDate), 1) : 1

      return {
        normalized_merchant,
        count: dates.length,
        averageDaysBetween: activeDays / Math.max(dates.length - 1, 1),
      }
    })
    .filter((item) => item.count >= 3)
    .sort((a, b) => a.averageDaysBetween - b.averageDaysBetween)[0]

  if (frequentMerchant) {
    const merchant = resolveMerchantDisplay(
      merchantDisplayLookup,
      frequentMerchant.normalized_merchant
    )

    insights.push({
      id: 'frequent-merchant',
      kind: 'merchant',
      category: '',
      merchant,
      normalized_merchant: frequentMerchant.normalized_merchant,
      title: 'Most regular merchant',
      detail: `${merchant} appears most consistently in your history.`,
      valueLabel: `${frequentMerchant.count} entries`,
    })
  }

  return {
    context,
    insights: formatInsightsForContext(insights, context),
  }
}
