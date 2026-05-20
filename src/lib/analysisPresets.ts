export type AnalysisPresetId = 'essentials' | 'lifestyle'

export type AnalysisPreference =
  | { type: 'preset'; presetId: AnalysisPresetId }
  | { type: 'categories'; categories: string[] }

export type AnalysisCategory =
  | string
  | {
      name: string
      category_group?: string | null
    }

export type TrendInsightWithCategory = {
  kind?: 'category' | 'merchant'
  category: string
  title: string
}

export const analysisPresets: {
  id: AnalysisPresetId
  label: string
  description: string
  keywords: string[]
}[] = [
  {
    id: 'essentials',
    label: 'Essentials',
    description: 'Settings essentials group',
    keywords: ['rent', 'bill', 'bills', 'utility', 'utilities', 'grocery', 'groceries'],
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    description: 'Settings non-essential group',
    keywords: ['social', 'hobby', 'hobbies', 'entertainment', 'cinema', 'games'],
  },
]

const presetIds = new Set(analysisPresets.map((preset) => preset.id))

function normalizeCategoryName(category: string) {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function getCategoryName(category: AnalysisCategory) {
  return typeof category === 'string' ? category : category.name
}

function getCategoryGroup(category: AnalysisCategory) {
  return typeof category === 'string' ? null : category.category_group
}

export function mapCategoryToPresetIds(category: AnalysisCategory): AnalysisPresetId[] {
  const normalizedCategory = normalizeCategoryName(getCategoryName(category))
  const categoryGroup = getCategoryGroup(category)

  if (!normalizedCategory) {
    return []
  }

  const matchedPresets = analysisPresets
    .filter((preset) =>
      preset.keywords.some((keyword) =>
        normalizedCategory.includes(normalizeCategoryName(keyword))
      )
    )
    .map((preset) => preset.id)

  const groupPreset =
    categoryGroup === 'essential'
      ? 'essentials'
      : categoryGroup === 'non_essential'
        ? 'lifestyle'
        : null

  return groupPreset
    ? Array.from(new Set<AnalysisPresetId>([groupPreset, ...matchedPresets]))
    : matchedPresets
}

export function getPresetCategories(
  categories: AnalysisCategory[],
  presetId: AnalysisPresetId
) {
  return categories
    .filter((category) => mapCategoryToPresetIds(category).includes(presetId))
    .map(getCategoryName)
}

export function parseAnalysisPreference(
  value: unknown
): AnalysisPreference | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const preference = value as Partial<AnalysisPreference>

  if (
    preference.type === 'preset' &&
    typeof preference.presetId === 'string' &&
    presetIds.has(preference.presetId as AnalysisPresetId)
  ) {
    return {
      type: 'preset',
      presetId: preference.presetId as AnalysisPresetId,
    }
  }

  if (preference.type === 'categories' && Array.isArray(preference.categories)) {
    const categories = preference.categories.filter(
      (category): category is string =>
        typeof category === 'string' && category.trim().length > 0
    )

    return categories.length ? { type: 'categories', categories } : null
  }

  return null
}

export function getSelectedInsightCategories(
  categories: AnalysisCategory[],
  preference: AnalysisPreference | null
) {
  if (!preference) {
    return null
  }

  if (preference.type === 'preset') {
    return new Set(getPresetCategories(categories, preference.presetId))
  }

  const categoryNames = new Set(categories.map(getCategoryName))
  return new Set(
    preference.categories.filter((category) => categoryNames.has(category))
  )
}

export function filterInsightsByPreference<T extends TrendInsightWithCategory>(
  insights: T[],
  categories: AnalysisCategory[],
  preference: AnalysisPreference | null
) {
  const selectedCategories = getSelectedInsightCategories(categories, preference)
  const filteredInsights = selectedCategories
    ? insights.filter(
        (insight) =>
          insight.kind === 'merchant' || selectedCategories.has(insight.category)
      )
    : insights

  const seenTitles = new Set<string>()

  return filteredInsights.filter((insight) => {
    if (seenTitles.has(insight.title)) {
      return false
    }

    seenTitles.add(insight.title)
    return true
  })
}
