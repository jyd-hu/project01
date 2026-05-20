function toDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPeriodStart(today: Date, days: number) {
  const start = new Date(today)
  start.setDate(today.getDate() - days)
  return start
}

function firstDayOfPreviousMonth(today: Date) {
  return new Date(today.getFullYear(), today.getMonth() - 1, 1)
}

/** Inclusive analysis window for core insights. */
export function getInsightsPeriodBounds(days: number, today = new Date()) {
  return {
    startDate: toDateString(getPeriodStart(today, days)),
    endDate: toDateString(today),
    days,
  }
}

/** Earliest fetch date when optional month-over-month comparison is requested. */
export function getComparisonFetchStartDate(days: number, today = new Date()) {
  const periodStart = getPeriodStart(today, days)
  const previousMonthStart = firstDayOfPreviousMonth(today)

  const fetchStart =
    periodStart.getTime() < previousMonthStart.getTime()
      ? periodStart
      : previousMonthStart

  return toDateString(fetchStart)
}
