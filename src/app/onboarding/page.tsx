'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { BudgetInputs } from '@/components/onboarding/BudgetInputs'
import { CategorySelector } from '@/components/onboarding/CategorySelector'
import { OnboardingNav } from '@/components/onboarding/OnboardingNav'
import { OnboardingProgressBar } from '@/components/onboarding/OnboardingProgressBar'
import { OnboardingStepContainer } from '@/components/onboarding/OnboardingStepContainer'
import { OptionCard } from '@/components/onboarding/OptionCard'
import {
  createInitialOnboardingData,
  DEFAULT_CATEGORY_NAMES,
  getOnboardingSteps,
  MAIN_GOAL_OPTIONS,
  SPENDING_STYLE_OPTIONS,
  type OnboardingFormData,
  type OnboardingStepId,
  type SpendingStyle,
} from '@/lib/onboarding'
import { supabase } from '@/lib/supabase'
import { getProfilesSetupErrorMessage } from '@/lib/profileErrors'

const inputClass =
  'w-full rounded border border-gray-200 bg-white p-2 text-gray-900 placeholder:text-gray-400'

export default function OnboardingPage() {
  const router = useRouter()
  const [authLoading, setAuthLoading] = useState(true)
  const [form, setForm] = useState<OnboardingFormData>(createInitialOnboardingData)
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hasCategories = form.categories.length > 0

  const steps = useMemo(
    () => getOnboardingSteps(form.wantsBudgets, hasCategories),
    [form.wantsBudgets, hasCategories]
  )
  const currentStep = steps[stepIndex] ?? 'name'
  const totalSteps = steps.length

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const { data, error: sessionError } = await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError || !data.session) {
        router.replace('/login')
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .limit(1)

      if (!mounted) return

      setSetupError(getProfilesSetupErrorMessage(profileError?.message))
      setAuthLoading(false)
    }

    void loadSession()

    return () => {
      mounted = false
    }
  }, [router])

  function updateForm(patch: Partial<OnboardingFormData>) {
    setForm((current) => ({ ...current, ...patch }))
    setError(null)
  }

  function goBack() {
    if (stepIndex === 0) return
    setStepIndex((index) => index - 1)
    setError(null)
  }

  function goNext() {
    const validationError = validateStep(currentStep, form)
    if (validationError) {
      setError(validationError)
      return
    }

    if (currentStep === 'categories' && !hasCategories) {
      void completeOnboarding(form)
      return
    }

    if (currentStep === 'budgetChoice' && form.wantsBudgets === false) {
      void completeOnboarding(form)
      return
    }

    if (stepIndex >= steps.length - 1) {
      void completeOnboarding(form)
      return
    }

    setStepIndex((index) => index + 1)
    setError(null)
  }

  async function exitToLogin() {
    setError(null)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function completeOnboarding(data: OnboardingFormData) {
    const validationError = validateAll(data)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)

    const budgets: Record<string, number> = {}

    for (const category of data.categories) {
      const raw = data.budgets[category]?.trim()
      if (!raw) continue

      const amount = Number(raw)
      if (!Number.isFinite(amount) || amount <= 0) {
        setIsSubmitting(false)
        setError(`Enter a positive budget for ${category}.`)
        return
      }

      budgets[category] = amount
    }

    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: data.displayName.trim(),
          mainGoals: data.mainGoals,
          spendingStyle: data.spendingStyle,
          categories: data.categories,
          budgets,
        }),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        setError(
          getProfilesSetupErrorMessage(payload.error) ??
            payload.error ??
            'Unable to save onboarding.'
        )
        setIsSubmitting(false)
        return
      }

      router.replace('/')
    } catch {
      setError('Unable to save onboarding.')
      setIsSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col p-4">
      <div className="mb-6 space-y-3">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void exitToLogin()}
            disabled={isSubmitting}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            Exit to login
          </button>
        </div>
        <OnboardingProgressBar
          currentStep={stepIndex + 1}
          totalSteps={totalSteps}
        />
      </div>

      <div className="flex-1 rounded-xl bg-gray-100 p-4 text-gray-900">
        {setupError ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {setupError}
          </p>
        ) : null}

        {renderStep(currentStep, form, updateForm)}

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <OnboardingNav
          showBack={stepIndex > 0}
          onBack={goBack}
          onNext={goNext}
          nextLabel={
            currentStep === 'budgets' ||
            (currentStep === 'categories' && !hasCategories) ||
            (currentStep === 'budgetChoice' && form.wantsBudgets === false)
              ? 'Finish'
              : 'Next'
          }
          nextDisabled={
            isNextDisabled(currentStep, form, isSubmitting) || setupError !== null
          }
          isSubmitting={isSubmitting}
        />
      </div>
    </main>
  )
}

function renderStep(
  step: OnboardingStepId,
  form: OnboardingFormData,
  updateForm: (patch: Partial<OnboardingFormData>) => void
) {
  switch (step) {
    case 'name':
      return (
        <OnboardingStepContainer
          stepKey="name"
          title="What should we call you?"
          subtitle="We will use this across the app."
        >
          <input
            className={inputClass}
            value={form.displayName}
            onChange={(event) => updateForm({ displayName: event.target.value })}
            placeholder="Your name"
            autoFocus
            aria-label="Display name"
          />
        </OnboardingStepContainer>
      )

    case 'goal':
      return (
        <OnboardingStepContainer
          stepKey="goal"
          title="What do you want help with?"
          subtitle="Pick one or more."
        >
          <div className="space-y-2">
            {MAIN_GOAL_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                label={option.label}
                selected={form.mainGoals.includes(option.value)}
                multi
                onToggle={() => {
                  const selected = form.mainGoals.includes(option.value)
                  updateForm({
                    mainGoals: selected
                      ? form.mainGoals.filter((goal) => goal !== option.value)
                      : [...form.mainGoals, option.value],
                  })
                }}
              />
            ))}
          </div>
        </OnboardingStepContainer>
      )

    case 'style':
      return (
        <OnboardingStepContainer
          stepKey="style"
          title="How do you usually spend?"
        >
          <div className="space-y-2">
            {SPENDING_STYLE_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                label={option.label}
                selected={form.spendingStyle === option.value}
                onToggle={() =>
                  updateForm({ spendingStyle: option.value as SpendingStyle })
                }
              />
            ))}
          </div>
        </OnboardingStepContainer>
      )

    case 'categories':
      return (
        <OnboardingStepContainer
          stepKey="categories"
          title="Which spending categories do you want to track?"
          subtitle="Select the ones that fit you, or skip and set them up later."
        >
          <CategorySelector
            defaultOptions={DEFAULT_CATEGORY_NAMES}
            selectedCategories={form.categories}
            onChange={(categories) => updateForm({ categories })}
          />
          <OptionCard
            label="Skip for now"
            selected={form.categories.length === 0}
            onToggle={() => updateForm({ categories: [] })}
          />
        </OnboardingStepContainer>
      )

    case 'budgetChoice':
      return (
        <OnboardingStepContainer
          stepKey="budgetChoice"
          title="Do you want to set budgets now?"
        >
          <div className="space-y-2">
            <OptionCard
              label="Yes, set monthly budgets"
              selected={form.wantsBudgets === true}
              onToggle={() => updateForm({ wantsBudgets: true })}
            />
            <OptionCard
              label="Skip for now"
              selected={form.wantsBudgets === false}
              onToggle={() => updateForm({ wantsBudgets: false })}
            />
          </div>
        </OnboardingStepContainer>
      )

    case 'budgets':
      return (
        <OnboardingStepContainer
          stepKey="budgets"
          title="Set monthly budgets"
          subtitle="Only for the categories you selected."
        >
          <BudgetInputs
            categories={form.categories}
            budgets={form.budgets}
            onChange={(budgets) => updateForm({ budgets })}
          />
        </OnboardingStepContainer>
      )
  }
}

function validateStep(step: OnboardingStepId, form: OnboardingFormData) {
  switch (step) {
    case 'name':
      return form.displayName.trim() ? null : 'Enter your name.'
    case 'goal':
      return form.mainGoals.length > 0 ? null : 'Pick at least one goal.'
    case 'style':
      return form.spendingStyle ? null : 'Pick a spending style.'
    case 'categories':
      return null
    case 'budgetChoice':
      return form.wantsBudgets === null
        ? 'Choose whether to set budgets.'
        : null
    case 'budgets':
      return null
    default:
      return null
  }
}

function validateAll(form: OnboardingFormData) {
  if (!form.displayName.trim()) return 'Enter your name.'
  if (form.mainGoals.length === 0) return 'Pick at least one goal.'
  if (!form.spendingStyle) return 'Pick a spending style.'
  if (form.categories.length > 0 && form.wantsBudgets === null) {
    return 'Choose whether to set budgets.'
  }
  return null
}

function isNextDisabled(
  step: OnboardingStepId,
  form: OnboardingFormData,
  isSubmitting: boolean
) {
  if (isSubmitting) return true
  return validateStep(step, form) !== null
}
