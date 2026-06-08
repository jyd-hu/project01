import { NextResponse } from 'next/server'
import {
  buildCompactAiPayload,
  generateAiInsightSummary,
  getOpenAiModel,
  hashAiInputPayload,
  isOpenAiConfigured,
  type AiInsightApiResponse,
  type AiInsightSummary,
} from '@/lib/aiInsights'
import { getCachedAiSummary, storeAiSummary } from '@/lib/aiInsightsCache'
import { fetchInsightsExpenses } from '@/lib/fetchInsightsExpenses'
import { computeExtendedInsightsAnalytics } from '@/lib/insightsExtended'
import {
  getExtendedFetchStartDate,
  getInsightsPeriodBounds,
} from '@/lib/insightsDates'
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

function toApiResponse(
  id: string,
  summary: AiInsightSummary,
  cached: boolean
): AiInsightApiResponse {
  return { id, cached, ...summary }
}

// AI summary route — only called when the user clicks "Generate AI insight".
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
  const today = new Date()
  const { startDate, endDate } = getInsightsPeriodBounds(days, today)

  // Step 1: deterministic analytics (source of truth).
  const fetchStartDate = getExtendedFetchStartDate(days, today)
  const { expenses, error: fetchError } = await fetchInsightsExpenses(supabase, {
    startDate: fetchStartDate,
    endDate,
  })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const analytics = computeExtendedInsightsAnalytics(expenses, { days, today })
  const compactPayload = buildCompactAiPayload(analytics)
  const inputHash = hashAiInputPayload(compactPayload)

  // Step 2: Supabase cache lookup — skip OpenAI when a matching summary exists.
  const cachedRow = await getCachedAiSummary(supabase, {
    userId: user.id,
    periodStart: startDate,
    periodEnd: endDate,
    inputHash,
  })

  if (cachedRow) {
    return NextResponse.json(
      toApiResponse(cachedRow.id, cachedRow.summary_json, true)
    )
  }

  if (!isOpenAiConfigured()) {
    return NextResponse.json(
      {
        error: 'not_configured',
        message: 'AI insights are not configured yet.',
      },
      { status: 503 }
    )
  }

  // Step 3: OpenAI generation — only on cache miss and when configured.
  try {
    const summary = await generateAiInsightSummary(compactPayload)
    const stored = await storeAiSummary(supabase, {
      userId: user.id,
      periodStart: startDate,
      periodEnd: endDate,
      inputHash,
      summary,
      modelUsed: getOpenAiModel(),
    })

    if (!stored) {
      return NextResponse.json(
        { error: 'cache_write_failed', message: 'AI insight could not be saved.' },
        { status: 500 }
      )
    }

    return NextResponse.json(toApiResponse(stored.id, stored.summary_json, false))
  } catch {
    return NextResponse.json(
      {
        error: 'generation_failed',
        message: 'AI insight could not be generated right now.',
      },
      { status: 502 }
    )
  }
}
