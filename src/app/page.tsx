'use client'

import { useEffect, useState, startTransition } from 'react'
import { supabase } from '@/lib/supabase'

type Expense = {
  id: string
  amount: number
  category: string
  note: string
  created_at: string
}

type Category = {
  id: number
  name: string
  created_at: string
}

const inputClass =
  'w-full rounded border border-gray-200 bg-white p-2 text-gray-900 placeholder:text-gray-400'

export default function Home() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingNames, setEditingNames] = useState<Record<number, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showCategories, setShowCategories] = useState(false)


  console.log(categories)
  async function fetchCategories() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('id', { ascending: true })

    if (error) {
      setSaveError(error.message)
      return
    }

    const rows = (data as Category[]) || []
    setCategories(rows)
    setEditingNames(
      Object.fromEntries(rows.map((c) => [c.id, c.name]))
    )
  }

  async function fetchExpenses() {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setSaveError(error.message)
      return
    }

    setExpenses((data as Expense[]) || [])
  }

  async function addExpense() {
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
        category: selected.name,
        note: note.trim(),
      })
      .select()
      .single()

    if (error) {
      setSaveError(error.message)
      return
    }

    setAmount('')
    setNote('')
    await fetchExpenses()
  }

  async function addCategory() {
    const name = newCategoryName.trim()
    if (!name) return

    setSaveError(null)

    const { data, error } = await supabase
      .from('categories')
      .insert({ name })
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
    const name = editingNames[id]?.trim()
    if (!name) {
      setSaveError('Category name cannot be empty.')
      return
    }

    setSaveError(null)

    const { error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', id)

    if (error) {
      setSaveError(error.message)
      return
    }

    await fetchCategories()
    await fetchExpenses()
  }

  async function deleteCategory(id: number) {
    if (categories.length <= 1) {
      setSaveError('You need at least one category.')
      return
    }

    setSaveError(null)

    const { error } = await supabase.from('categories').delete().eq('id', id)

    if (error) {
      setSaveError(error.message)
      return
    }

    if (categoryId === String(id)) {
      setCategoryId('')
    }

    await fetchCategories()
  }

  useEffect(() => {
    startTransition(() => {
      void Promise.all([fetchExpenses(), fetchCategories()])
    })
  }, [])

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <main className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Finance Tracker</h1>
        <button
          type="button"
          onClick={() => setShowCategories((open) => !open)}
          className="rounded-lg p-2 text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
          aria-label={showCategories ? 'Close categories' : 'Manage categories'}
        >
          {showCategories ? (
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
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          ) : (
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
              <path d="M3 7V5a2 2 0 0 1 2-2h3.17a2 2 0 0 1 1.41.59l1.83 1.83A2 2 0 0 0 12.83 6H19a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            </svg>
          )}
        </button>
      </div>

      {showCategories ? (
      <section className="space-y-3 rounded-xl bg-gray-100 p-4 text-gray-900">
        <h2 className="text-lg font-semibold text-gray-900">Manage categories</h2>

        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="flex gap-2">
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
            </li>
          ))}
        </ul>

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
      ) : (
      <>
      <div className="bg-gray-100 p-4 rounded-xl space-y-2">
        <input
          className={inputClass}
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <select
          className={inputClass}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
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

      <div className="text-xl font-semibold">
        Total: £{total.toFixed(2)}
      </div>

      <div className="space-y-2">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="border p-3 rounded-xl"
          >
            <div className="font-semibold">£{expense.amount}</div>

            <div>{expense.category}</div>

            <div className="text-sm text-gray-500">{expense.note}</div>
          </div>
        ))}
      </div>
      </>
      )}
    </main>
  )
}
