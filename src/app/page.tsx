'use client'

import { useEffect, useRef, useState, startTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Expense = {
  id: string
  user_id: string
  amount: number
  merchant: string | null
  category: string
  note: string
  created_at: string
  expense_date: string
}

type Category = {
  id: number
  user_id: string
  name: string
  category_group: CategoryGroup
  display_order: number
  created_at: string
}

type ExpenseView = 'date' | 'category'
type CategoryGroup = 'essential' | 'non_essential'

const categoryGroups: { value: CategoryGroup; label: string }[] = [
  { value: 'essential', label: 'Essential' },
  { value: 'non_essential', label: 'Non-essential' },
]

const inputClass =
  'w-full rounded border border-gray-200 bg-white p-2 text-gray-900 placeholder:text-gray-400'

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function getTodayDateValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatExpenseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  if (!year || !month || !day) {
    return date
  }

  return dateFormatter.format(new Date(year, month - 1, day))
}

function parseExpenseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeCategoryGroup(group: string | null | undefined): CategoryGroup {
  return group === 'non_essential' ? 'non_essential' : 'essential'
}

function orderCategories(categories: Category[]) {
  return categoryGroups.flatMap((group) =>
    categories
      .filter((category) => category.category_group === group.value)
      .map((category, index) => ({
        ...category,
        display_order: index + 1,
      }))
  )
}

function reorderCategories(
  categories: Category[],
  draggedCategoryId: number,
  targetGroup: CategoryGroup,
  targetIndex: number
) {
  const draggedCategory = categories.find(
    (category) => category.id === draggedCategoryId
  )

  if (!draggedCategory) {
    return categories
  }

  const remainingCategories = categories.filter(
    (category) => category.id !== draggedCategoryId
  )
  const targetGroupCategories = remainingCategories.filter(
    (category) => category.category_group === targetGroup
  )
  const nextTargetIndex = Math.min(
    Math.max(targetIndex, 0),
    targetGroupCategories.length
  )
  const movedCategory = {
    ...draggedCategory,
    category_group: targetGroup,
  }
  const nextTargetGroupCategories = [
    ...targetGroupCategories.slice(0, nextTargetIndex),
    movedCategory,
    ...targetGroupCategories.slice(nextTargetIndex),
  ]

  return orderCategories(
    categoryGroups.flatMap((group) =>
      group.value === targetGroup
        ? nextTargetGroupCategories
        : remainingCategories.filter(
            (category) => category.category_group === group.value
          )
    )
  )
}

function getWeekStartDateValue(date: string) {
  const parsed = parseExpenseDate(date)

  if (!parsed) {
    return date
  }

  const day = parsed.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  parsed.setDate(parsed.getDate() + mondayOffset)

  return toDateValue(parsed)
}

function formatWeekRange(weekStart: string) {
  const start = parseExpenseDate(weekStart)

  if (!start) {
    return weekStart
  }

  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  return `${formatExpenseDate(toDateValue(start))} - ${formatExpenseDate(
    toDateValue(end)
  )}`
}

export default function Home() {
  const router = useRouter()
  const categoryDropHandled = useRef(false)
  const categoriesRef = useRef<Category[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingNames, setEditingNames] = useState<Record<number, string>>({})
  const [draggingCategoryId, setDraggingCategoryId] = useState<number | null>(
    null
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [expenseView, setExpenseView] = useState<ExpenseView>('date')
  const [editMode, setEditMode] = useState(false)
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editMerchant, setEditMerchant] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editDate, setEditDate] = useState('')
  const [showEditDatePicker, setShowEditDatePicker] = useState(false)
  const [lastDeletedExpense, setLastDeletedExpense] = useState<Expense | null>(
    null
  )
  async function fetchCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('category_group', { ascending: true })
      .order('display_order', { ascending: true })
      .order('id', { ascending: true })

    if (error) {
      setSaveError(error.message)
      return
    }

    const rows = ((data as Category[]) || []).map((category) => ({
      ...category,
      category_group: normalizeCategoryGroup(category.category_group),
    }))
    setCategories(rows)
    setEditingNames(
      Object.fromEntries(rows.map((c) => [c.id, c.name]))
    )
  }

  async function fetchExpenses() {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      setSaveError(error.message)
      return
    }

    setExpenses((data as Expense[]) || [])
  }

  async function addExpense() {
    if (!user) {
      router.replace('/login')
      return
    }

    const selected = categories.find((c) => String(c.id) === categoryId)
    if (!amount.trim() || !selected) {
      setSaveError('Enter an amount and select a category.')
      return
    }

    const parsed = Number(amount)
    if (!Number.isFinite(parsed)) {
      setSaveError('Enter a valid amount.')
      return
    }

    setSaveError(null)

    const { error } = await supabase
      .from('expenses')
      .insert({
        amount: parsed,
        merchant: merchant.trim() || null,
        category: selected.name,
        note: note.trim(),
        expense_date: getTodayDateValue(),
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      setSaveError(error.message)
      return
    }

    setLastDeletedExpense(null)
    setAmount('')
    setMerchant('')
    setNote('')
    await fetchExpenses()
  }

  async function addCategory() {
    if (!user) {
      router.replace('/login')
      return
    }

    const name = newCategoryName.trim()
    if (!name) return

    setSaveError(null)

    const displayOrder =
      Math.max(
        0,
        ...categories
          .filter((category) => category.category_group === 'essential')
          .map((category) => category.display_order)
      ) + 1

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        category_group: 'essential',
        display_order: displayOrder,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      setSaveError(error.message)
      return
    }

    const row = data as Category
    setNewCategoryName('')
    setCategoryId(String(row.id))
    await fetchCategories()
  }

  async function saveCategory(id: number) {
    if (!user) {
      router.replace('/login')
      return
    }

    const name = editingNames[id]?.trim()
    if (!name) {
      setSaveError('Category name cannot be empty.')
      return
    }
    const category = categories.find((item) => item.id === id)
    const group = category?.category_group ?? 'essential'

    setSaveError(null)

    const { error } = await supabase.rpc('update_category', {
      category_id: id,
      category_group_value: group,
      category_name: name,
    })

    if (error) {
      setSaveError(error.message)
      return
    }

    await fetchCategories()
    await fetchExpenses()
  }

  function dragCategoryOver(
    targetGroup: CategoryGroup,
    targetIndex: number
  ) {
    if (!draggingCategoryId) return

    setCategories((current) => {
      const nextCategories = reorderCategories(
        current,
        draggingCategoryId,
        targetGroup,
        targetIndex
      )
      categoriesRef.current = nextCategories
      return nextCategories
    })
  }

  function startCategoryDrag(categoryId: number) {
    categoryDropHandled.current = false
    setDraggingCategoryId(categoryId)
  }

  async function finishCategoryDrag() {
    categoryDropHandled.current = true
    await saveCategoryOrder()
  }

  async function saveCategoryOrder() {
    if (!user || !draggingCategoryId) {
      setDraggingCategoryId(null)
      return
    }

    setSaveError(null)

    const updates = categoriesRef.current.map((category) =>
      supabase
        .from('categories')
        .update({
          category_group: category.category_group,
          display_order: category.display_order,
        })
        .eq('id', category.id)
        .eq('user_id', user.id)
    )
    const results = await Promise.all(updates)
    const failedUpdate = results.find((result) => result.error)

    setDraggingCategoryId(null)

    if (failedUpdate?.error) {
      setSaveError(failedUpdate.error.message)
      await fetchCategories()
      return
    }

    await fetchCategories()
  }

  async function cancelCategoryDrag() {
    if (!draggingCategoryId || categoryDropHandled.current) return

    setDraggingCategoryId(null)
    await fetchCategories()
  }

  async function deleteCategory(id: number) {
    if (!user) {
      router.replace('/login')
      return
    }

    if (categories.length <= 1) {
      setSaveError('You need at least one category.')
      return
    }

    setSaveError(null)

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      setSaveError(error.message)
      return
    }

    if (categoryId === String(id)) {
      setCategoryId('')
    }

    await fetchCategories()
  }

  function exitEditMode() {
    setEditMode(false)
    clearSelectedExpense()
  }

  function clearSelectedExpense() {
    setSelectedExpenseId(null)
    setEditAmount('')
    setEditMerchant('')
    setEditCategoryId('')
    setEditNote('')
    setEditDate('')
    setShowEditDatePicker(false)
  }

  function selectExpenseForEdit(expense: Expense) {
    setSelectedExpenseId(expense.id)
    setEditAmount(String(expense.amount))
    setEditMerchant(expense.merchant ?? '')
    setEditNote(expense.note ?? '')
    setEditDate(expense.expense_date)
    setShowEditDatePicker(false)
    const cat = categories.find((c) => c.name === expense.category)
    setEditCategoryId(cat ? String(cat.id) : '')
  }

  async function saveExpense() {
    if (!selectedExpenseId) return

    const selected = categories.find((c) => String(c.id) === editCategoryId)
    if (!editAmount.trim() || !selected) {
      setSaveError('Enter an amount and select a category.')
      return
    }

    if (!editDate) {
      setSaveError('Select a date.')
      return
    }

    const parsed = Number(editAmount)
    if (!Number.isFinite(parsed)) {
      setSaveError('Enter a valid amount.')
      return
    }

    setSaveError(null)

    const { error } = await supabase
      .from('expenses')
      .update({
        amount: parsed,
        merchant: editMerchant.trim() || null,
        category: selected.name,
        note: editNote.trim(),
        expense_date: editDate,
      })
      .eq('id', selectedExpenseId)

    if (error) {
      setSaveError(error.message)
      return
    }

    setLastDeletedExpense(null)
    clearSelectedExpense()
    await fetchExpenses()
  }

  async function deleteExpense() {
    if (!selectedExpenseId) return

    const expenseToDelete = expenses.find(
      (expense) => expense.id === selectedExpenseId
    )
    if (!expenseToDelete) return

    setSaveError(null)

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', selectedExpenseId)

    if (error) {
      setSaveError(error.message)
      return
    }

    setLastDeletedExpense(expenseToDelete)
    clearSelectedExpense()
    await fetchExpenses()
  }

  async function undoDeleteExpense() {
    if (!lastDeletedExpense || !user) return

    setSaveError(null)

    const { error } = await supabase.from('expenses').insert({
      ...lastDeletedExpense,
      user_id: user.id,
    })

    if (error) {
      setSaveError(error.message)
      return
    }

    setLastDeletedExpense(null)
    await fetchExpenses()
  }

  useEffect(() => {
    let mounted = true

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        setSaveError(error.message)
        setAuthLoading(false)
        return
      }

      if (!data.session) {
        router.replace('/login')
        setAuthLoading(false)
        return
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!mounted) return

      if (userError || !userData.user) {
        setSaveError(userError?.message ?? 'Unable to load your user account.')
        setAuthLoading(false)
        return
      }

      setSession(data.session)
      setUser(userData.user)
      setAuthLoading(false)

      startTransition(() => {
        void Promise.all([fetchExpenses(), fetchCategories()])
      })
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return

      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (!nextSession) {
        router.replace('/login')
      }
    })

    void loadSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    categoriesRef.current = categories
  }, [categories])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (authLoading || !session) {
    return (
      <main className="mx-auto max-w-md p-4">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    )
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)
  const groupedExpenses = expenses.reduce<
    { date: string; items: Expense[] }[]
  >((groups, expense) => {
    const lastGroup = groups.at(-1)

    if (lastGroup?.date === expense.expense_date) {
      lastGroup.items.push(expense)
      return groups
    }

    groups.push({ date: expense.expense_date, items: [expense] })
    return groups
  }, [])
  const weeklyCategoryTotals = expenses.reduce<
    { weekStart: string; categories: { category: string; total: number }[] }[]
  >((weeks, expense) => {
    const weekStart = getWeekStartDateValue(expense.expense_date)
    let week = weeks.find((item) => item.weekStart === weekStart)

    if (!week) {
      week = { weekStart, categories: [] }
      weeks.push(week)
    }

    let category = week.categories.find(
      (item) => item.category === expense.category
    )

    if (!category) {
      category = { category: expense.category, total: 0 }
      week.categories.push(category)
    }

    category.total += expense.amount
    return weeks
  }, [])
  const groupedCategorySections = categoryGroups.map((group) => ({
    ...group,
    categories: categories.filter(
      (category) => category.category_group === group.value
    ),
  }))
  const renderCategoryOptions = () =>
    groupedCategorySections.map((group) =>
      group.categories.length ? (
        <optgroup key={group.value} label={group.label}>
          {group.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </optgroup>
      ) : null
    )

  return (
    <main className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/budgets"
          className="rounded-lg p-2 text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
          aria-label="View budgets"
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
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M7 7h10" />
            <path d="M7 12h10" />
            <path d="M7 17h6" />
          </svg>
        </Link>
        <button
          type="button"
          onClick={() => setShowCategories((open) => !open)}
          className="rounded-lg p-2 text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
          aria-label={showCategories ? 'Close settings' : 'Manage settings'}
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
            {showCategories ? (
              <>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </>
            ) : (
              <>
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 3.46l-.15.1a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0-3.46l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>

      {showCategories ? (
        <>
          <section className="space-y-3 rounded-xl bg-gray-100 p-4 text-gray-900">
            <h2 className="text-lg font-semibold text-gray-900">
              Manage categories
            </h2>

            <div className="space-y-4">
              {groupedCategorySections.map((group) => (
                <section
                  key={group.value}
                  className="space-y-2"
                  onDragOver={(e) => {
                    e.preventDefault()
                    dragCategoryOver(group.value, group.categories.length)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    void finishCategoryDrag()
                  }}
                >
                  <h3 className="text-sm font-semibold text-gray-600">
                    {group.label}
                  </h3>
                  {group.categories.length ? (
                    <ul className="space-y-2">
                      {group.categories.map((c, index) => (
                        <li
                          key={c.id}
                          className={`rounded-lg border border-gray-200 bg-white p-2 ${
                            draggingCategoryId === c.id ? 'opacity-60' : ''
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            dragCategoryOver(group.value, index)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            void finishCategoryDrag()
                          }}
                        >
                          <div className="flex gap-2">
                            <button
                              type="button"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move'
                                startCategoryDrag(c.id)
                              }}
                              onDragEnd={() => void cancelCategoryDrag()}
                              className="shrink-0 cursor-grab rounded border border-gray-300 bg-white px-2 py-2 text-gray-500 active:cursor-grabbing"
                              aria-label={`Drag ${c.name}`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <path d="M4 7h16" />
                                <path d="M4 12h16" />
                                <path d="M4 17h16" />
                              </svg>
                            </button>
                            <input
                              className={`${inputClass} flex-1`}
                              value={editingNames[c.id] ?? c.name}
                              onChange={(e) =>
                                setEditingNames((prev) => ({
                                  ...prev,
                                  [c.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() => void saveCategory(c.id)}
                              className="shrink-0 rounded bg-black px-3 py-2 text-sm text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteCategory(c.id)}
                              className="shrink-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div
                      className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500"
                      onDragOver={(e) => {
                        e.preventDefault()
                        dragCategoryOver(group.value, 0)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        void finishCategoryDrag()
                      }}
                    >
                      Drop categories here
                    </div>
                  )}
                </section>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                className={`${inputClass} flex-1`}
                placeholder="New category"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addCategory()
                }}
              />
              <button
                type="button"
                onClick={() => void addCategory()}
                className="shrink-0 rounded bg-black px-3 py-2 text-sm text-white"
              >
                Add
              </button>
            </div>
          </section>

          <section className="rounded-xl bg-gray-100 p-4">
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
            >
              Sign out
            </button>
          </section>
        </>
      ) : (
      <>
      <div className="bg-gray-100 p-4 rounded-xl space-y-2">
        <input
          className={inputClass}
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          className={inputClass}
          placeholder="Merchant (optional)"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
        />

        <select
          className={inputClass}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Select category</option>
          {renderCategoryOptions()}
        </select>

        <input
          className={inputClass}
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {saveError ? (
          <p className="text-sm text-red-600" role="alert">
            {saveError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void addExpense()}
          className="w-full bg-black text-white p-2 rounded"
        >
          Add Expense
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xl font-semibold">
          Total: £{total.toFixed(2)}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (expenseView === 'date') {
                exitEditMode()
                setExpenseView('category')
                return
              }

              setExpenseView('date')
            }}
            className="rounded-lg p-1.5 text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
            aria-label={
              expenseView === 'date'
                ? 'View expenses by category'
                : 'View expenses by date'
            }
            aria-pressed={expenseView === 'category'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              if (editMode) {
                exitEditMode()
                return
              }

              setExpenseView('date')
              setEditMode(true)
            }}
            className="rounded-lg p-1.5 text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
            aria-label={editMode ? 'Done editing expenses' : 'Edit expenses'}
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
      </div>

      {expenseView === 'date' && editMode && !selectedExpenseId ? (
        <p className="text-sm text-gray-500">Select an entry to edit</p>
      ) : null}

      {lastDeletedExpense ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900">
          <span>Expense deleted.</span>
          <button
            type="button"
            onClick={() => void undoDeleteExpense()}
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            Undo
          </button>
        </div>
      ) : null}

      {expenseView === 'date' ? (
        <div className="space-y-4">
          {groupedExpenses.map((group) => (
            <section key={group.date} className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500">
                {formatExpenseDate(group.date)}
              </h2>
              {group.items.map((expense) => {
                if (editMode && expense.id === selectedExpenseId) {
                  return (
                    <div
                      key={expense.id}
                      className="space-y-2 rounded-xl border p-3"
                      onClick={() => setShowEditDatePicker(false)}
                    >
                      <input
                        className={inputClass}
                        placeholder="Amount"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                      <input
                        className={inputClass}
                        placeholder="Merchant (optional)"
                        value={editMerchant}
                        onChange={(e) => setEditMerchant(e.target.value)}
                      />
                      <select
                        className={inputClass}
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
                      >
                        <option value="">Select category</option>
                        {renderCategoryOptions()}
                      </select>
                      <input
                        className={inputClass}
                        placeholder="Note"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                      />
                      <div className="flex items-end justify-between gap-2">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowEditDatePicker((open) => !open)
                            }}
                            className="rounded bg-gray-100 p-2 text-gray-900 hover:bg-gray-200"
                            aria-label="Change expense date"
                          >
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
                              <path d="M8 2v4" />
                              <path d="M16 2v4" />
                              <rect width="18" height="18" x="3" y="4" rx="2" />
                              <path d="M3 10h18" />
                            </svg>
                          </button>
                          {showEditDatePicker ? (
                            <div
                              className="absolute bottom-full left-0 mb-2 rounded-lg border bg-white p-2 shadow"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="date"
                                className="rounded border border-gray-200 bg-white p-2 text-sm text-gray-900"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void saveExpense()}
                            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteExpense()}
                            className="rounded bg-red-600 px-3 py-2 text-sm text-white"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={clearSelectedExpense}
                            className="rounded bg-gray-200 px-3 py-2 text-sm text-gray-900"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }

                const card = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold">£{expense.amount}</div>
                      {expense.merchant ? (
                        <div className="text-right text-sm text-gray-500">
                          {expense.merchant}
                        </div>
                      ) : null}
                    </div>
                    <div>{expense.category}</div>
                    <div className="text-sm text-gray-500">{expense.note}</div>
                  </>
                )

                if (editMode) {
                  return (
                    <button
                      key={expense.id}
                      type="button"
                      onClick={() => selectExpenseForEdit(expense)}
                      className="w-full rounded-xl border p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      {card}
                    </button>
                  )
                }

                return (
                  <div key={expense.id} className="rounded-xl border p-3">
                    {card}
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {weeklyCategoryTotals.map((week) => (
            <section key={week.weekStart} className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500">
                {formatWeekRange(week.weekStart)}
              </h2>
              <div className="space-y-2">
                {week.categories.map((category) => (
                  <div
                    key={category.category}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <span>{category.category}</span>
                    <span className="font-semibold">
                      £{category.total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      </>
      )}
    </main>
  )
}
