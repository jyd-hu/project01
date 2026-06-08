import { createHash } from 'node:crypto'
import OpenAI from 'openai'
import type { ExtendedInsightsResponse } from '@/lib/insightsExtended'

/** Compact aggregated payload sent to OpenAI — no raw rows or full notes. */
export type CompactAiPayload = {
  period: {
    startDate: string
    endDate: string
    days: number
  }
  total_spend: number
  transaction_count: number
  spend_change_vs_previous: {
    amount: number
    pct: number | null
  }
  transaction_count_change: number
  avg_transaction_size: number
  avg_transaction_size_change_pct: number | null
  top_category_drivers: Array<{
    name: string
    spend: number
    contribution_pct: number
  }>
  top_merchant_drivers: Array<{
    merchant: string
    spend: number
    contribution_pct: number
  }>
  top_category_increases: Array<{
    name: string
    change_amount: number
    change_pct: number | null
  }>
  top_category_decreases: Array<{
    name: string
    change_amount: number
    change_pct: number | null
  }>
  top_merchant_increases: Array<{
    merchant: string
    change_amount: number
    change_pct: number | null
  }>
  top_merchant_decreases: Array<{
    merchant: string
    change_amount: number
    change_pct: number | null
  }>
  weekday_weekend_split: {
    weekday_spend_pct: number
    weekend_spend_pct: number
  }
  note_themes: string[]
}

export type AiInsightSeverity = 'low' | 'medium' | 'high'

/** Structured AI output shape returned to the client. */
export type AiInsightSummary = {
  headline: string
  summary: string
  keyDrivers: string[]
  suggestedActions: string[]
  caveats: string[]
  severity: AiInsightSeverity
}

export type AiInsightApiResponse = AiInsightSummary & {
  id: string
  cached: boolean
}

const defaultModel = 'gpt-4o-mini'
const maxOutputTokens = 350
const maxDrivers = 3

const aiOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'headline',
    'summary',
    'keyDrivers',
    'suggestedActions',
    'caveats',
    'severity',
  ],
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    keyDrivers: {
      type: 'array',
      items: { type: 'string' },
      maxItems: maxDrivers,
    },
    suggestedActions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: maxDrivers,
    },
    caveats: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 2,
    },
    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
} as const

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

function trimWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.slice(0, maxWords).join(' ')
}

function trimSentences(text: string, maxSentences: number) {
  const parts = text.match(/[^.!?]+[.!?]?/g) ?? [text]
  return parts.slice(0, maxSentences).join(' ').trim()
}

function trimList(items: string[], maxItems: number) {
  return items.map((item) => item.trim()).filter(Boolean).slice(0, maxItems)
}

function isSeverity(value: string): value is AiInsightSeverity {
  return value === 'low' || value === 'medium' || value === 'high'
}

/** Builds the compact analytics JSON that OpenAI is allowed to interpret. */
export function buildCompactAiPayload(
  analytics: ExtendedInsightsResponse
): CompactAiPayload {
  const comparison = analytics.period_comparison

  return {
    period: analytics.period,
    total_spend: analytics.totals.spend,
    transaction_count: analytics.totals.transaction_count,
    spend_change_vs_previous: {
      amount: comparison.spend_change_amount,
      pct: comparison.spend_change_pct,
    },
    transaction_count_change: comparison.transaction_count_change,
    avg_transaction_size: comparison.avg_transaction_size,
    avg_transaction_size_change_pct: comparison.avg_transaction_size_change_pct,
    top_category_drivers: analytics.drivers.categories
      .slice(0, maxDrivers)
      .map((driver) => ({
        name: driver.name,
        spend: driver.spend,
        contribution_pct: driver.contribution,
      })),
    top_merchant_drivers: analytics.drivers.merchants
      .slice(0, maxDrivers)
      .map((driver) => ({
        merchant: driver.normalized_merchant,
        spend: driver.spend,
        contribution_pct: driver.contribution,
      })),
    top_category_increases: comparison.top_category_increases.map((driver) => ({
      name: driver.name,
      change_amount: driver.change_amount,
      change_pct: driver.change_pct,
    })),
    top_category_decreases: comparison.top_category_decreases.map((driver) => ({
      name: driver.name,
      change_amount: driver.change_amount,
      change_pct: driver.change_pct,
    })),
    top_merchant_increases: comparison.top_merchant_increases.map((driver) => ({
      merchant: driver.name,
      change_amount: driver.change_amount,
      change_pct: driver.change_pct,
    })),
    top_merchant_decreases: comparison.top_merchant_decreases.map((driver) => ({
      merchant: driver.name,
      change_amount: driver.change_amount,
      change_pct: driver.change_pct,
    })),
    weekday_weekend_split: {
      weekday_spend_pct: analytics.weekday_weekend.weekday_spend_pct,
      weekend_spend_pct: analytics.weekday_weekend.weekend_spend_pct,
    },
    note_themes: analytics.note_themes.map((theme) => theme.keyword),
  }
}

/** Cache key derived from compact deterministic analytics — changes when inputs change. */
export function hashAiInputPayload(payload: CompactAiPayload) {
  return createHash('sha256').update(stableStringify(payload)).digest('hex')
}

function buildAiPrompt(payload: CompactAiPayload) {
  return [
    'You interpret personal spending analytics JSON for a finance tracker.',
    'Rules:',
    '- Use ONLY the provided JSON numbers and labels.',
    '- Do NOT invent totals, trends, or comparisons.',
    '- Do NOT give investment, tax, or legal advice.',
    '- Focus on practical spending behaviour.',
    '- Be specific; avoid generic tips.',
    '- headline: max 12 words.',
    '- summary: max 2 sentences.',
    '- keyDrivers: max 3 short bullets.',
    '- suggestedActions: max 3 practical behaviour tips.',
    '- caveats: max 2 short limitations.',
    '- severity: low, medium, or high based on magnitude of spend shifts.',
    '',
    'Analytics JSON:',
    JSON.stringify(payload),
  ].join('\n')
}

/** Validates and trims model output to the required response limits. */
export function parseAiInsightSummary(raw: unknown): AiInsightSummary | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const data = raw as Record<string, unknown>

  if (
    typeof data.headline !== 'string' ||
    typeof data.summary !== 'string' ||
    !Array.isArray(data.keyDrivers) ||
    !Array.isArray(data.suggestedActions) ||
    !Array.isArray(data.caveats) ||
    typeof data.severity !== 'string' ||
    !isSeverity(data.severity)
  ) {
    return null
  }

  return {
    headline: trimWords(data.headline, 12),
    summary: trimSentences(data.summary, 2),
    keyDrivers: trimList(
      data.keyDrivers.filter((item): item is string => typeof item === 'string'),
      maxDrivers
    ),
    suggestedActions: trimList(
      data.suggestedActions.filter(
        (item): item is string => typeof item === 'string'
      ),
      maxDrivers
    ),
    caveats: trimList(
      data.caveats.filter((item): item is string => typeof item === 'string'),
      2
    ),
    severity: data.severity,
  }
}

export function getOpenAiModel() {
  return process.env.OPENAI_MODEL?.trim() || defaultModel
}

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

/** Calls OpenAI with the compact payload — only invoked on explicit user request. */
export async function generateAiInsightSummary(
  payload: CompactAiPayload
): Promise<AiInsightSummary> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('OPENAI_NOT_CONFIGURED')
  }

  const client = new OpenAI({ apiKey })
  const model = getOpenAiModel()

  const response = await client.chat.completions.create({
    model,
    max_tokens: maxOutputTokens,
    temperature: 0.3,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'ai_insight_summary',
        strict: true,
        schema: aiOutputSchema,
      },
    },
    messages: [
      {
        role: 'system',
        content:
          'You explain spending patterns from structured analytics JSON only.',
      },
      { role: 'user', content: buildAiPrompt(payload) },
    ],
  })

  const content = response.choices[0]?.message?.content

  if (!content) {
    throw new Error('OPENAI_EMPTY_RESPONSE')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('OPENAI_INVALID_JSON')
  }

  const summary = parseAiInsightSummary(parsed)

  if (!summary) {
    throw new Error('OPENAI_INVALID_SHAPE')
  }

  return summary
}
