import { NextResponse } from 'next/server'
import { fetchInsightsExpenses } from '@/lib/fetchInsightsExpenses'
import { computeInsightsAnalytics } from '@/lib/insightsAnalytics'
import {
  getComparisonFetchStartDate,
  getInsightsPeriodBounds,
} from '@/lib/insightsDates'
import { computeMonthOverMonthComparison } from '@/lib/insightsComparison'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const minDays = 7
const maxDays = 365
const defaultDays = 30

function parseDaysParam(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10)

  if (!Number.isFinite(parsed)) {
    return defaultDays
  }

  return Math.min(Math.max(parsed, minDays), maxDays)
}

// Future cache key: `insights:${userId}:${startDate}:${endDate}`

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseDaysParam(searchParams.get('days'))
  const includeComparison = searchParams.get('compare') === '1'
  const today = new Date()
  const { startDate, endDate } = getInsightsPeriodBounds(days, today)
  const fetchStartDate = includeComparison
    ? getComparisonFetchStartDate(days, today)
    : startDate

  const { expenses, error: fetchError } = await fetchInsightsExpenses(supabase, {
    startDate: fetchStartDate,
    endDate,
  })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const insights = computeInsightsAnalytics(expenses, { days, today })

  if (!includeComparison) {
    return NextResponse.json(insights)
  }

  return NextResponse.json({
    ...insights,
    comparison: computeMonthOverMonthComparison(expenses, today),
  })
}
