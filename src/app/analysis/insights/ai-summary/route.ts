import { randomUUID } from 'node:crypto'
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
  cached: boolean,
  persisted = true
): AiInsightApiResponse {
  return { id, cached, persisted, ...summary }
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
    // #region agent log
    fetch('http://127.0.0.1:7649/ingest/7bbc1a3b-7dcb-4e4d-a24e-d27ff37bea30',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec4b9f'},body:JSON.stringify({sessionId:'ec4b9f',location:'ai-summary/route.ts:not_configured',message:'OpenAI not configured',data:{days},timestamp:Date.now(),hypothesisId:'C',runId:'pre-fix'})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7649/ingest/7bbc1a3b-7dcb-4e4d-a24e-d27ff37bea30',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec4b9f'},body:JSON.stringify({sessionId:'ec4b9f',location:'ai-summary/route.ts:generate_start',message:'Starting OpenAI generation',data:{days,inputHash,model:getOpenAiModel(),expenseCount:expenses.length},timestamp:Date.now(),hypothesisId:'A',runId:'pre-fix'})}).catch(()=>{});
    // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7649/ingest/7bbc1a3b-7dcb-4e4d-a24e-d27ff37bea30',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec4b9f'},body:JSON.stringify({sessionId:'ec4b9f',location:'ai-summary/route.ts:cache_write_degraded',message:'Returning summary without cache persist',data:{days,inputHash,headline:summary.headline},timestamp:Date.now(),hypothesisId:'D',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        toApiResponse(randomUUID(), summary, false, false)
      )
    }

    return NextResponse.json(toApiResponse(stored.id, stored.summary_json, false))
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    const errName = error instanceof Error ? error.name : 'unknown'
    // #region agent log
    fetch('http://127.0.0.1:7649/ingest/7bbc1a3b-7dcb-4e4d-a24e-d27ff37bea30',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec4b9f'},body:JSON.stringify({sessionId:'ec4b9f',location:'ai-summary/route.ts:generation_failed',message:'Generation catch block',data:{errMsg,errName,days},timestamp:Date.now(),hypothesisId:'A',runId:'pre-fix'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      {
        error: 'generation_failed',
        message: 'AI insight could not be generated right now.',
      },
      { status: 502 }
    )
  }
}
