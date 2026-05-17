'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Category = {
  id: number
  name: string
  monthly_budget?: number | null
}

type Expense = {
  amount: number
  category: string
}

const categoryColors = [
  { label: '#fde68a', fill: '#fef3c7' },
  { label: '#bfdbfe', fill: '#dbeafe' },
  { label: '#bbf7d0', fill: '#dcfce7' },
  { label: '#fecdd3', fill: '#ffe4e6' },
  { label: '#ddd6fe', fill: '#ede9fe' },
  { label: '#fed7aa', fill: '#ffedd5' },
]

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getCurrentMonthRange() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)

  return {
    start: toDateValue(start),
    nextMonth: toDateValue(nextMonth),
  }
}

function getOrdinalSuffix(day: number) {
  if (day >= 11 && day <= 13) {
    return 'th'
  }

  const lastDigit = day % 10

  if (lastDigit === 1) return 'st'
  if (lastDigit === 2) return 'nd'
  if (lastDigit === 3) return 'rd'

  return 'th'
}

function formatTodayDate(date: Date) {
  const day = date.getDate()
  const month = date.toLocaleString('en-GB', { month: 'long' })

  return `${day}${getOrdinalSuffix(day)} ${month}`
}

function getMonthProgress(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  const elapsed = date.getTime() - start.getTime()
  const duration = nextMonth.getTime() - start.getTime()

  return Math.min(Math.max((elapsed / duration) * 100, 0), 100)
}

export default function BudgetsPage() {
  const router = useRouter()
  const [authLoading, setAuthLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [budgetInputs, setBudgetInputs] = useState<Record<number, string>>({})
  const [monthlySpendByCategory, setMonthlySpendByCategory] = useState<
    Record<string, number>
  >({})
  const [editMode, setEditMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [today, setToday] = useState<Date | null>(null)

  async function fetchCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, monthly_budget')
      .order('id', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }

    const rows = (data as Category[]) || []
    setCategories(rows)
    setBudgetInputs(
      Object.fromEntries(
        rows.map((category) => [
          category.id,
          String(category.monthly_budget ?? 0),
        ])
      )
    )
  }

  async function fetchMonthlyExpenses() {
    const { start, nextMonth } = getCurrentMonthRange()
    const { data, error } = await supabase
      .from('expenses')
      .select('amount, category')
      .gte('expense_date', start)
      .lt('expense_date', nextMonth)

    if (error) {
      setError(error.message)
      return
    }

    const spendByCategory = ((data as Expense[]) || []).reduce<
      Record<string, number>
    >((totals, expense) => {
      totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount
      return totals
    }, {})

    setMonthlySpendByCategory(spendByCategory)
  }

  async function saveBudgets() {
    const updates = categories.map((category) => ({
      id: category.id,
      monthlyBudget: Number(budgetInputs[category.id]),
    }))

    if (
      updates.some(
        (update) =>
          !Number.isFinite(update.monthlyBudget) || update.monthlyBudget < 0
      )
    ) {
      setError('Enter a valid budget amount.')
      return
    }

    setError(null)

    const results = await Promise.all(
      updates.map((update) =>
        supabase
          .from('categories')
          .update({ monthly_budget: update.monthlyBudget })
          .eq('id', update.id)
      )
    )
    const failedUpdate = results.find((result) => result.error)

    if (failedUpdate?.error) {
      setError(failedUpdate.error.message)
      return
    }

    await fetchCategories()
    setEditMode(false)
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

      setAuthLoading(false)
      setToday(new Date())

      startTransition(() => {
        void Promise.all([fetchCategories(), fetchMonthlyExpenses()])
      })
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      if (!session) {
        router.replace('/login')
      }
    })

    void loadSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  if (authLoading) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    )
  }

  const todayLabel = today ? formatTodayDate(today) : 'Today'
  const monthProgress = today ? getMonthProgress(today).toFixed(4) : '0'

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
        <h1 className="text-xl font-semibold">Budgets</h1>
      </div>

      <section className="overflow-hidden rounded-xl bg-gray-100 text-gray-900">
        <div className="h-1 bg-gray-200">
          <div
            className="h-full bg-gray-500"
            style={{ width: `${monthProgress}%` }}
          />
        </div>

        <div className="space-y-3 p-4">
          <p className="text-center text-2xl font-bold">{todayLabel}</p>

          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Monthly budgets</h2>
              <p className="text-sm text-gray-500">
                Each category starts with a monthly budget of £0
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (editMode) {
                  void saveBudgets()
                  return
                }

                setEditMode(true)
              }}
              className="rounded-lg p-1.5 text-gray-900 hover:bg-gray-200"
              aria-label={editMode ? 'Done editing budgets' : 'Edit budgets'}
            >
              {editMode ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              )}
            </button>
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            {categories.map((category, index) => {
              const budget = category.monthly_budget ?? 0
              const inputBudget = Number(budgetInputs[category.id])
              const weeklyBudget = Number.isFinite(inputBudget)
                ? (inputBudget * 12) / 52
                : 0
              const spent = monthlySpendByCategory[category.name] ?? 0
              const spentPercent =
                budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
              const remainingBudget = budget - spent
              const isOverBudget = remainingBudget < 0
              const color = categoryColors[index % categoryColors.length]

              return (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3"
                  style={{
                    background: `linear-gradient(to right, ${color.fill} ${spentPercent}%, #ffffff ${spentPercent}%)`,
                  }}
                >
                  <span
                    className="rounded-full px-2 py-1 text-sm font-medium text-gray-900"
                    style={{ backgroundColor: color.label }}
                  >
                    {category.name}
                  </span>
                  {editMode ? (
                    <div className="flex flex-col items-end gap-1">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="w-24 rounded border border-gray-200 bg-white p-2 text-right text-gray-900"
                        value={budgetInputs[category.id] ?? '0'}
                        onChange={(e) =>
                          setBudgetInputs((current) => ({
                            ...current,
                            [category.id]: e.target.value,
                          }))
                        }
                      />
                      <p className="text-xs text-gray-600">
                        ≈ £{weeklyBudget.toFixed(2)} weekly
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end">
                      <span
                        className={`font-semibold ${
                          isOverBudget ? 'text-red-600' : ''
                        }`}
                      >
                        £{remainingBudget.toFixed(2)} left
                      </span>
                      <span className="text-xs text-gray-500">
                        of £{budget.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}
