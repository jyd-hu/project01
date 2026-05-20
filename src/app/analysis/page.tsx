'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  type AnalysisCategory,
  analysisPresets,
  filterInsightsByPreference,
  getPresetCategories,
  parseAnalysisPreference,
  type AnalysisPreference,
  type AnalysisPresetId,
} from '@/lib/analysisPresets'
import {
  buildSpendingTrendInsights,
  type TrendExpense,
} from '@/lib/spendingTrends'
import { buildMerchantCategoriesLookup } from '@/lib/merchant'
import { supabase } from '@/lib/supabase'

type Category = {
  id: number
  name: string
  category_group: string | null
}

type PreferenceOption = 'all' | `preset:${AnalysisPresetId}` | 'categories'

const categoryGroups = [
  { value: 'essential', label: 'Essential' },
  { value: 'non_essential', label: 'Non-essential' },
]

const inputClass =
  'w-full rounded border border-gray-200 bg-white p-2 text-gray-900 placeholder:text-gray-400'

function getPreferenceOption(preference: AnalysisPreference | null): PreferenceOption {
  if (!preference) {
    return 'all'
  }

  if (preference.type === 'preset') {
    return `preset:${preference.presetId}`
  }

  return 'categories'
}

function getPreferenceLabel(preference: AnalysisPreference | null) {
  if (!preference) {
    return 'All categories'
  }

  if (preference.type === 'preset') {
    return (
      analysisPresets.find((preset) => preset.id === preference.presetId)?.label ??
      'Preset'
    )
  }

  return 'Custom'
}

export default function AnalysisPage() {
  const router = useRouter()
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [expenses, setExpenses] = useState<TrendExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [savedPreference, setSavedPreference] =
    useState<AnalysisPreference | null>(null)
  const [preferenceOption, setPreferenceOption] =
    useState<PreferenceOption>('all')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function fetchAnalysisData() {
    const [categoriesResult, expensesResult] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name, category_group')
        .order('category_group', { ascending: true })
        .order('display_order', { ascending: true })
        .order('id', { ascending: true }),
      supabase
        .from('expenses')
        .select('amount, category, expense_date, merchant, normalized_merchant')
        .order('expense_date', { ascending: false }),
    ])

    if (categoriesResult.error) {
      setError(categoriesResult.error.message)
      return
    }

    if (expensesResult.error) {
      setError(expensesResult.error.message)
      return
    }

    setCategories((categoriesResult.data as Category[]) ?? [])
    setExpenses((expensesResult.data as TrendExpense[]) ?? [])
  }

  function applyPreferenceToForm(preference: AnalysisPreference | null) {
    setSavedPreference(preference)
    setPreferenceOption(getPreferenceOption(preference))
    setSelectedCategories(
      preference?.type === 'categories' ? preference.categories : []
    )
  }

  function getDraftPreference(): AnalysisPreference | null {
    if (preferenceOption === 'all') {
      return null
    }

    if (preferenceOption === 'categories') {
      return selectedCategories.length
        ? { type: 'categories', categories: selectedCategories }
        : null
    }

    return {
      type: 'preset',
      presetId: preferenceOption.replace('preset:', '') as AnalysisPresetId,
    }
  }

  async function savePreference() {
    if (!user) {
      router.replace('/login')
      return
    }

    const nextPreference = getDraftPreference()
    setSaving(true)
    setError(null)

    const { data, error } = await supabase.auth.updateUser({
      data: {
        analysis_preference: nextPreference,
      },
    })

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setUser(data.user)
    applyPreferenceToForm(nextPreference)
  }

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        setError(error.message)
        setAuthLoading(false)
        return
      }

      if (!data.session) {
        router.replace('/login')
        setAuthLoading(false)
        return
      }

      const preference = parseAnalysisPreference(
        data.session.user.user_metadata.analysis_preference
      )

      setUser(data.session.user)
      applyPreferenceToForm(preference)
      setAuthLoading(false)

      startTransition(() => {
        void fetchAnalysisData()
      })
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      if (!session) {
        setUser(null)
        router.replace('/login')
        return
      }

      setUser(session.user)
    })

    void loadSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  const analysisCategories: AnalysisCategory[] = useMemo(
    () =>
      categories.map((category) => ({
        name: category.name,
        category_group: category.category_group,
      })),
    [categories]
  )
  const groupedCategories = categoryGroups.map((group) => ({
    ...group,
    categories: categories.filter((category) =>
      group.value === 'non_essential'
        ? category.category_group === 'non_essential'
        : category.category_group !== 'non_essential'
    ),
  }))
  const draftPreference = getDraftPreference()
  const merchantCategories = useMemo(
    () => buildMerchantCategoriesLookup(expenses),
    [expenses]
  )
  const trendResult = useMemo(
    () => buildSpendingTrendInsights(expenses),
    [expenses]
  )
  const holidayContext = trendResult.context
  const trendInsights = trendResult.insights
  const filteredInsights = useMemo(
    () =>
      filterInsightsByPreference(
        trendInsights,
        analysisCategories,
        draftPreference,
        merchantCategories
      ),
    [analysisCategories, draftPreference, merchantCategories, trendInsights]
  )
  const selectedPresetId =
    draftPreference?.type === 'preset' ? draftPreference.presetId : null
  const presetCategoryMatches = selectedPresetId
    ? getPresetCategories(analysisCategories, selectedPresetId)
    : []

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
          href="/"
          className="rounded-lg p-2 text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
          aria-label="Back to expenses"
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
        <h1 className="text-xl font-semibold">Analysis</h1>
      </div>

      <section className="space-y-3 rounded-xl bg-gray-100 p-4 text-gray-900">
        <div>
          <h2 className="text-lg font-semibold">Spending trends</h2>
          <p className="text-sm text-gray-500">
            Trends are calculated across all spending, then filtered by your
            analysis preference.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">
            Analysis preset
          </span>
          <select
            className={inputClass}
            value={preferenceOption}
            onChange={(event) => {
              const nextOption = event.target.value as PreferenceOption
              setPreferenceOption(nextOption)

              if (nextOption !== 'categories') {
                setSelectedCategories([])
              }
            }}
          >
            <option value="all">All categories</option>
            {analysisPresets.map((preset) => (
              <option key={preset.id} value={`preset:${preset.id}`}>
                {preset.label} ({preset.description})
              </option>
            ))}
            <option value="categories">Custom</option>
          </select>
        </label>

        {preferenceOption === 'categories' ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Categories</p>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-3">
              {categories.length ? (
                groupedCategories.map((group) => (
                  <div key={group.value} className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500">
                      {group.label}
                    </h3>
                    {group.categories.length ? (
                      group.categories.map((category) => (
                        <label
                          key={category.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(category.name)}
                            onChange={(event) => {
                              setSelectedCategories((current) =>
                                event.target.checked
                                  ? [...current, category.name]
                                  : current.filter(
                                      (name) => name !== category.name
                                    )
                              )
                            }}
                          />
                          <span>{category.name}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">None</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No categories yet.</p>
              )}
            </div>
          </div>
        ) : null}

        {selectedPresetId ? (
          <p className="text-sm text-gray-500">
            {presetCategoryMatches.length
              ? `Matching categories: ${presetCategoryMatches.join(', ')}`
              : 'No categories currently match this preset.'}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void savePreference()}
          disabled={saving}
          className="w-full rounded bg-black p-2 text-white disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save preference'}
        </button>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">
            {getPreferenceLabel(draftPreference)} insights
          </h2>
          <p className="text-sm text-gray-500">
            Saved preference: {getPreferenceLabel(savedPreference)}
          </p>
          {holidayContext.isHolidayWeek ? (
            <p className="text-sm text-gray-500">
              Holiday context:{' '}
              {holidayContext.holidayName
                ? `${holidayContext.holidayName} week`
                : 'holiday week'}
              . Comparisons are softened for this period.
            </p>
          ) : null}
        </div>

        {filteredInsights.length ? (
          <div className="space-y-2">
            {filteredInsights.map((insight) => (
              <article key={insight.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{insight.title}</h3>
                    <p className="text-sm text-gray-500">{insight.detail}</p>
                  </div>
                  <span className="shrink-0 font-semibold">
                    {insight.valueLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-gray-500">
                  {insight.kind === 'merchant'
                    ? insight.merchant
                    : insight.category}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">
            No matching trend insights yet.
          </div>
        )}
      </section>
    </main>
  )
}
