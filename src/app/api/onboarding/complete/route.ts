import { NextResponse } from 'next/server'
import {
  ESSENTIAL_CATEGORY_NAMES,
  type MainGoal,
  type SpendingStyle,
} from '@/lib/onboarding'
import { getProfilesSetupErrorMessage } from '@/lib/profileErrors'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type CompleteOnboardingBody = {
  displayName?: string
  mainGoals?: MainGoal[]
  spendingStyle?: SpendingStyle | null
  categories?: string[]
  budgets?: Record<string, number>
}

function normalizeCategoryName(name: string) {
  return name.trim()
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  let body: CompleteOnboardingBody

  try {
    body = (await request.json()) as CompleteOnboardingBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const displayName = body.displayName?.trim() ?? ''
  if (!displayName) {
    return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 })
  }

  const categories = (body.categories ?? [])
    .map(normalizeCategoryName)
    .filter(Boolean)

  const budgets = body.budgets ?? {}

  for (const [categoryName, amount] of Object.entries(budgets)) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: `Enter a positive budget for ${categoryName}.` },
        { status: 400 }
      )
    }
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .maybeSingle()

  const profilesSetupError = getProfilesSetupErrorMessage(
    existingProfileError?.message
  )
  if (profilesSetupError) {
    return NextResponse.json({ error: profilesSetupError }, { status: 503 })
  }

  if (existingProfile?.onboarding_completed) {
    return NextResponse.json({ ok: true })
  }

  const { data: existingCategories, error: existingCategoriesError } =
    await supabase.from('categories').select('id, name').eq('user_id', user.id)

  if (existingCategoriesError) {
    return NextResponse.json(
      { error: existingCategoriesError.message },
      { status: 500 }
    )
  }

  const existingNames = new Set(
    (existingCategories ?? []).map((row) => row.name.toLowerCase())
  )

  const categoriesToInsert = categories.filter(
    (name) => !existingNames.has(name.toLowerCase())
  )

  let essentialOrder = 1
  let nonEssentialOrder = 1

  const { data: orderRows } = await supabase
    .from('categories')
    .select('category_group, display_order')
    .eq('user_id', user.id)

  for (const row of orderRows ?? []) {
    if (row.category_group === 'non_essential') {
      nonEssentialOrder = Math.max(nonEssentialOrder, (row.display_order ?? 0) + 1)
    } else {
      essentialOrder = Math.max(essentialOrder, (row.display_order ?? 0) + 1)
    }
  }

  const categoryInserts = categoriesToInsert.map((name) => {
    const isEssential = ESSENTIAL_CATEGORY_NAMES.has(name)
    const displayOrder = isEssential ? essentialOrder++ : nonEssentialOrder++

    return {
      name,
      user_id: user.id,
      category_group: isEssential ? 'essential' : 'non_essential',
      display_order: displayOrder,
      monthly_budget: budgets[name] ?? 0,
    }
  })

  if (categoryInserts.length > 0) {
    const { error: insertError } = await supabase
      .from('categories')
      .insert(categoryInserts)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  const categoriesNeedingBudget = categories.filter(
    (name) => budgets[name] !== undefined && budgets[name] > 0
  )

  if (categoriesNeedingBudget.length > 0) {
    const { data: allCategories, error: fetchError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const categoryIdByName = new Map(
      (allCategories ?? []).map((row) => [row.name.toLowerCase(), row.id])
    )

    const budgetUpdates = categoriesNeedingBudget.flatMap((name) => {
      const id = categoryIdByName.get(name.toLowerCase())
      if (!id) return []

      return [
        supabase
          .from('categories')
          .update({ monthly_budget: budgets[name] })
          .eq('id', id)
          .eq('user_id', user.id),
      ]
    })

    const results = await Promise.all(budgetUpdates)
    const updateError = results.find((result) => result.error)?.error

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  const now = new Date().toISOString()
  const profilePayload = {
    user_id: user.id,
    display_name: displayName,
    onboarding_completed: true,
    onboarding_completed_at: now,
    main_goal: body.mainGoals ?? [],
    spending_style: body.spendingStyle ?? null,
    updated_at: now,
  }

  const { error: profileError } = existingProfile
    ? await supabase.from('profiles').update(profilePayload).eq('user_id', user.id)
    : await supabase.from('profiles').insert(profilePayload)

  if (profileError) {
    const profilesSetupError = getProfilesSetupErrorMessage(profileError.message)
    return NextResponse.json(
      { error: profilesSetupError ?? profileError.message },
      { status: profilesSetupError ? 503 : 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
