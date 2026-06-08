/** Shared onboarding option values and defaults. */

export type MainGoal =
  | 'understand_spending'
  | 'reduce_spending'
  | 'stick_to_budget'
  | 'build_habits'
  | 'track_expenses'

export type SpendingStyle =
  | 'mostly_planned'
  | 'sometimes_impulsive'
  | 'lose_track'
  | 'not_sure'

export const MAIN_GOAL_OPTIONS: { value: MainGoal; label: string }[] = [
  { value: 'understand_spending', label: 'Understand my spending' },
  { value: 'reduce_spending', label: 'Reduce unnecessary spending' },
  { value: 'stick_to_budget', label: 'Stick to a budget' },
  { value: 'build_habits', label: 'Build better habits' },
  { value: 'track_expenses', label: 'Just track expenses for now' },
]

export const SPENDING_STYLE_OPTIONS: { value: SpendingStyle; label: string }[] =
  [
    { value: 'mostly_planned', label: 'Mostly planned' },
    { value: 'sometimes_impulsive', label: 'Sometimes impulsive' },
    { value: 'lose_track', label: 'I lose track easily' },
    { value: 'not_sure', label: 'Not sure yet' },
  ]

export const DEFAULT_CATEGORY_NAMES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Rent',
  'Entertainment',
  'Travel',
  'Health',
  'Subscriptions',
  'Other',
] as const

/** Categories treated as essential when seeding from onboarding. */
export const ESSENTIAL_CATEGORY_NAMES = new Set([
  'Food',
  'Transport',
  'Bills',
  'Rent',
  'Health',
])

export type OnboardingFormData = {
  displayName: string
  mainGoals: MainGoal[]
  spendingStyle: SpendingStyle | null
  categories: string[]
  wantsBudgets: boolean | null
  budgets: Record<string, string>
}

export function createInitialOnboardingData(): OnboardingFormData {
  return {
    displayName: '',
    mainGoals: [],
    spendingStyle: null,
    categories: [...DEFAULT_CATEGORY_NAMES],
    wantsBudgets: null,
    budgets: {},
  }
}

export type OnboardingStepId =
  | 'name'
  | 'goal'
  | 'style'
  | 'categories'
  | 'budgetChoice'
  | 'budgets'

export function getOnboardingSteps(
  wantsBudgets: boolean | null,
  hasCategories: boolean
): OnboardingStepId[] {
  const steps: OnboardingStepId[] = ['name', 'goal', 'style', 'categories']

  if (!hasCategories) {
    return steps
  }

  steps.push('budgetChoice')

  if (wantsBudgets === true) {
    steps.push('budgets')
  }

  return steps
}
