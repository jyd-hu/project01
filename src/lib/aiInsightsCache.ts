import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiInsightSummary } from '@/lib/aiInsights'

export type CachedAiSummaryRow = {
  id: string
  user_id: string
  period_start: string
  period_end: string
  input_hash: string
  summary_json: AiInsightSummary
  model_used: string
  user_feedback: 'up' | 'down' | null
  created_at: string
}

type CacheLookupParams = {
  userId: string
  periodStart: string
  periodEnd: string
  inputHash: string
}

type StoreSummaryParams = CacheLookupParams & {
  summary: AiInsightSummary
  modelUsed: string
}

/** Reads a cached AI summary from Supabase before any OpenAI call. */
export async function getCachedAiSummary(
  supabase: SupabaseClient,
  params: CacheLookupParams
): Promise<CachedAiSummaryRow | null> {
  const { data, error } = await supabase
    .from('ai_insight_summaries')
    .select(
      'id, user_id, period_start, period_end, input_hash, summary_json, model_used, user_feedback, created_at'
    )
    .eq('user_id', params.userId)
    .eq('period_start', params.periodStart)
    .eq('period_end', params.periodEnd)
    .eq('input_hash', params.inputHash)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as CachedAiSummaryRow
}

/** Persists a freshly generated AI summary for future cache hits. */
export async function storeAiSummary(
  supabase: SupabaseClient,
  params: StoreSummaryParams
): Promise<CachedAiSummaryRow | null> {
  const { data, error } = await supabase
    .from('ai_insight_summaries')
    .upsert(
      {
        user_id: params.userId,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        input_hash: params.inputHash,
        summary_json: params.summary,
        model_used: params.modelUsed,
      },
      { onConflict: 'user_id,period_start,period_end,input_hash' }
    )
    .select(
      'id, user_id, period_start, period_end, input_hash, summary_json, model_used, user_feedback, created_at'
    )
    .single()

  if (error || !data) {
    // #region agent log
    fetch('http://127.0.0.1:7649/ingest/7bbc1a3b-7dcb-4e4d-a24e-d27ff37bea30',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec4b9f'},body:JSON.stringify({sessionId:'ec4b9f',location:'aiInsightsCache.ts:storeAiSummary',message:'storeAiSummary failed',data:{errorCode:error?.code??null,errorMessage:error?.message??null,errorDetails:error?.details??null,hint:error?.hint??null,hasData:Boolean(data)},timestamp:Date.now(),hypothesisId:'D',runId:'pre-fix'})}).catch(()=>{});
    // #endregion
    return null
  }

  return data as CachedAiSummaryRow
}

/** Stores thumbs up/down feedback on an existing cached summary row. */
export async function updateAiSummaryFeedback(
  supabase: SupabaseClient,
  summaryId: string,
  feedback: 'up' | 'down'
) {
  const { data, error } = await supabase
    .from('ai_insight_summaries')
    .update({ user_feedback: feedback })
    .eq('id', summaryId)
    .select('id, user_feedback')
    .single()

  if (error || !data) {
    return { ok: false as const, error: error?.message ?? 'Update failed' }
  }

  return { ok: true as const, id: data.id, user_feedback: data.user_feedback }
}
