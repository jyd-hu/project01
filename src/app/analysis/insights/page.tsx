'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useEffect, useState } from 'react'
import type { AiInsightApiResponse } from '@/lib/aiInsights'
import type { ExtendedInsightsResponse } from '@/lib/insightsExtended'
import { supabase } from '@/lib/supabase'

const defaultDays = 30

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

function formatPct(value: number | null) {
  if (value === null) {
    return 'n/a'
  }

  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value}%`
}

function severityClass(severity: AiInsightApiResponse['severity']) {
  if (severity === 'high') {
    return 'text-red-700'
  }

  if (severity === 'medium') {
    return 'text-amber-700'
  }

  return 'text-gray-600'
}

export default function InsightsPage() {
  const router = useRouter()
  const [authLoading, setAuthLoading] = useState(true)
  const [analytics, setAnalytics] = useState<ExtendedInsightsResponse | null>(
    null
  )
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  const [aiSummary, setAiSummary] = useState<AiInsightApiResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [feedbackSaving, setFeedbackSaving] = useState(false)

  async function fetchDeterministicInsights() {
    setAnalyticsLoading(true)
    setAnalyticsError(null)

    const response = await fetch(`/api/insights?days=${defaultDays}&extended=1`)

    if (response.status === 401) {
      router.replace('/login')
      return
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      setAnalyticsError(payload?.error ?? 'Could not load insights.')
      setAnalyticsLoading(false)
      return
    }

    const data = (await response.json()) as ExtendedInsightsResponse
    setAnalytics(data)
    setAnalyticsLoading(false)
  }

  async function generateAiInsight() {
    setAiLoading(true)
    setAiError(null)
    setFeedback(null)

    const response = await fetch(
      `/analysis/insights/ai-summary?days=${defaultDays}`
    )
    const payload = (await response.json().catch(() => null)) as
      | AiInsightApiResponse
      | { error?: string; message?: string }
      | null

    setAiLoading(false)

    // #region agent log
    fetch('http://127.0.0.1:7649/ingest/7bbc1a3b-7dcb-4e4d-a24e-d27ff37bea30',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ec4b9f'},body:JSON.stringify({sessionId:'ec4b9f',location:'insights/page.tsx:generateAiInsight',message:'AI summary client response',data:{status:response.status,ok:response.ok,hasPayload:Boolean(payload),payloadKeys:payload&&typeof payload==='object'?Object.keys(payload):[],error:payload&&'error'in payload?(payload as {error?:string}).error:null,message:payload&&'message'in payload?(payload as {message?:string}).message:null,hasHeadline:Boolean(payload&&'headline'in payload)},timestamp:Date.now(),hypothesisId:'E',runId:'pre-fix'})}).catch(()=>{});
    // #endregion

    if (!response.ok) {
      if (payload && 'message' in payload && payload.message) {
        setAiError(payload.message)
        return
      }

      setAiError('AI insight could not be generated right now.')
      return
    }

    if (!payload || !('headline' in payload)) {
      setAiError('AI insight could not be generated right now.')
      return
    }

    setAiSummary(payload)
  }

  async function submitFeedback(nextFeedback: 'up' | 'down') {
    if (!aiSummary?.id || feedbackSaving) {
      return
    }

    setFeedbackSaving(true)

    const response = await fetch('/analysis/insights/ai-summary/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: aiSummary.id, feedback: nextFeedback }),
    })

    setFeedbackSaving(false)

    if (response.ok) {
      setFeedback(nextFeedback)
    }
  }

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) {
        return
      }

      if (error) {
        setAnalyticsError(error.message)
        setAuthLoading(false)
        return
      }

      if (!data.session) {
        router.replace('/login')
        setAuthLoading(false)
        return
      }

      setAuthLoading(false)

      startTransition(() => {
        void fetchDeterministicInsights()
      })
    }

    void loadSession()

    return () => {
      mounted = false
    }
  }, [router])

  if (authLoading) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Link
          href="/analysis"
          className="rounded-lg p-2 text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
          aria-label="Back to analysis"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold">Insights</h1>
        <span className="w-10" aria-hidden />
      </div>

      <section className="space-y-3 rounded-xl bg-gray-100 p-4 text-gray-900">
        <div>
          <h2 className="text-lg font-semibold">Period overview</h2>
          <p className="text-sm text-gray-500">
            Deterministic analytics for the last {defaultDays} days.
          </p>
        </div>

        {analyticsLoading ? (
          <p className="text-sm text-gray-500">Loading analytics...</p>
        ) : null}

        {analyticsError ? (
          <p className="text-sm text-red-600" role="alert">
            {analyticsError}
          </p>
        ) : null}

        {analytics ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Total spend:</span>{' '}
              {currencyFormatter.format(analytics.totals.spend)}
            </p>
            <p>
              <span className="font-medium">Transactions:</span>{' '}
              {analytics.totals.transaction_count}
            </p>
            <p>
              <span className="font-medium">Vs previous period:</span>{' '}
              {formatPct(analytics.period_comparison.spend_change_pct)} (
              {currencyFormatter.format(
                analytics.period_comparison.spend_change_amount
              )}
              )
            </p>
            <p>
              <span className="font-medium">Avg transaction:</span>{' '}
              {currencyFormatter.format(
                analytics.period_comparison.avg_transaction_size
              )}{' '}
              ({formatPct(
                analytics.period_comparison.avg_transaction_size_change_pct
              )}
              )
            </p>
            <p>
              <span className="font-medium">Weekday vs weekend:</span>{' '}
              {analytics.weekday_weekend.weekday_spend_pct}% weekday /{' '}
              {analytics.weekday_weekend.weekend_spend_pct}% weekend
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 text-gray-900">
        <div>
          <h2 className="text-lg font-semibold">AI insight</h2>
          <p className="text-sm text-gray-500">
            Generated on demand. Uses cached summaries when available.
          </p>
        </div>

        {!aiSummary ? (
          <button
            type="button"
            onClick={() => void generateAiInsight()}
            disabled={aiLoading || analyticsLoading}
            className="w-full rounded bg-black p-2 text-white disabled:opacity-60"
          >
            {aiLoading ? 'Generating...' : 'Generate AI insight'}
          </button>
        ) : null}

        {aiError ? (
          <p className="text-sm text-red-600" role="alert">
            {aiError}
          </p>
        ) : null}

        {aiSummary ? (
          <article className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{aiSummary.headline}</h3>
              <span
                className={`shrink-0 text-xs font-medium uppercase ${severityClass(aiSummary.severity)}`}
              >
                {aiSummary.severity}
              </span>
            </div>

            <p className="text-sm text-gray-700">{aiSummary.summary}</p>

            {aiSummary.keyDrivers.length ? (
              <div>
                <h4 className="text-sm font-medium">Key drivers</h4>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {aiSummary.keyDrivers.map((driver) => (
                    <li key={driver}>{driver}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {aiSummary.suggestedActions.length ? (
              <div>
                <h4 className="text-sm font-medium">Suggested actions</h4>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {aiSummary.suggestedActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {aiSummary.caveats.length ? (
              <div>
                <h4 className="text-sm font-medium">Caveats</h4>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-500">
                  {aiSummary.caveats.map((caveat) => (
                    <li key={caveat}>{caveat}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-500">
                {aiSummary.cached
                  ? 'Loaded from cache'
                  : aiSummary.persisted === false
                    ? 'Freshly generated (cache unavailable)'
                    : 'Freshly generated'}
              </p>
              {aiSummary.persisted !== false ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Helpful"
                  disabled={feedbackSaving}
                  onClick={() => void submitFeedback('up')}
                  className={`rounded border px-2 py-1 text-sm ${
                    feedback === 'up'
                      ? 'border-green-600 text-green-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  👍
                </button>
                <button
                  type="button"
                  aria-label="Not helpful"
                  disabled={feedbackSaving}
                  onClick={() => void submitFeedback('down')}
                  className={`rounded border px-2 py-1 text-sm ${
                    feedback === 'down'
                      ? 'border-red-600 text-red-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  👎
                </button>
              </div>
              ) : null}
            </div>
          </article>
        ) : null}
      </section>
    </main>
  )
}
