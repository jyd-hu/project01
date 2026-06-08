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

/** Same-length window immediately before the current insights period. */
export function getPreviousPeriodBounds(days: number, today = new Date()) {
  const currentStart = getPeriodStart(today, days)
  const previousEnd = new Date(currentStart)
  previousEnd.setDate(previousEnd.getDate() - 1)
  const previousStart = new Date(previousEnd)
  previousStart.setDate(previousStart.getDate() - days + 1)

  return {
    startDate: toDateString(previousStart),
    endDate: toDateString(previousEnd),
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

/** Earliest fetch date for period-over-period extended analytics. */
export function getExtendedFetchStartDate(days: number, today = new Date()) {
  const { startDate: previousStartDate } = getPreviousPeriodBounds(days, today)
  const currentStartDate = getInsightsPeriodBounds(days, today).startDate

  return previousStartDate < currentStartDate ? previousStartDate : currentStartDate
}
