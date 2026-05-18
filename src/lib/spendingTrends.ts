export type TrendExpense = {
  amount: number
  category: string
  expense_date: string
}

export type SpendingTrendInsight = {
  id: string
  category: string
  title: string
  detail: string
  valueLabel: string
}

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

export function buildSpendingTrendInsights(
  expenses: TrendExpense[],
  today = new Date()
): SpendingTrendInsight[] {
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
    return []
  }

  const insights: SpendingTrendInsight[] = []
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
      category,
      title: 'Highest recent spend',
      detail: `${category} is a top category over the last 30 days.`,
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
      increase: total - (previousMonthTotals[category] ?? 0),
    }))
    .filter((item) => item.increase > 0)
    .sort((a, b) => b.increase - a.increase)

  monthlyIncreases.forEach((increase) => {
    insights.push({
      id: `biggest-monthly-increase:${increase.category}`,
      category: increase.category,
      title: 'Biggest monthly increase',
      detail: `${increase.category} is up compared with last month.`,
      valueLabel: `+${formatCurrency(increase.increase)}`,
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
      category: frequentCategory.category,
      title: 'Most regular category',
      detail: `${frequentCategory.category} appears most consistently in your history.`,
      valueLabel: `${frequentCategory.count} entries`,
    })
  }

  return insights
}
