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

export default function Home() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

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
    if (!amount.trim() || !category.trim()) return

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
        category: category.trim(),
        note: note.trim(),
      })
      .select()
      .single()

    if (error) {
      setSaveError(error.message)
      return
    }

    setAmount('')
    setCategory('')
    setNote('')
    await fetchExpenses()
  }

  useEffect(() => {
    startTransition(() => {
      void fetchExpenses()
    })
  }, [])

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <main className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-3xl font-bold">Finance Tracker</h1>

      <div className="bg-gray-100 p-4 rounded-xl space-y-2">
        <input
          className="w-full rounded border border-gray-200 bg-white p-2 text-gray-900 placeholder:text-gray-400"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          className="w-full rounded border border-gray-200 bg-white p-2 text-gray-900 placeholder:text-gray-400"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        <input
          className="w-full rounded border border-gray-200 bg-white p-2 text-gray-900 placeholder:text-gray-400"
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
            <div className="font-semibold">
              £{expense.amount}
            </div>

            <div>{expense.category}</div>

            <div className="text-sm text-gray-500">
              {expense.note}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

