'use client'

import { FormEvent, useMemo, useState } from 'react'

const inputClass =
  'w-full rounded border border-gray-200 bg-white p-2 text-gray-900 placeholder:text-gray-400'

type CategorySelectorProps = {
  defaultOptions: readonly string[]
  selectedCategories: string[]
  onChange: (categories: string[]) => void
}

export function CategorySelector({
  defaultOptions,
  selectedCategories,
  onChange,
}: CategorySelectorProps) {
  const [customName, setCustomName] = useState('')
  const selectedSet = new Set(
    selectedCategories.map((name) => name.toLowerCase())
  )

  const allOptions = useMemo(() => {
    const names = new Map<string, string>()

    for (const name of defaultOptions) {
      names.set(name.toLowerCase(), name)
    }

    for (const name of selectedCategories) {
      names.set(name.toLowerCase(), name)
    }

    return [...names.values()].sort((a, b) => a.localeCompare(b))
  }, [defaultOptions, selectedCategories])

  function toggleCategory(name: string) {
    const key = name.toLowerCase()

    if (selectedSet.has(key)) {
      onChange(selectedCategories.filter((item) => item.toLowerCase() !== key))
      return
    }

    onChange([...selectedCategories, name])
  }

  function addCustomCategory(event: FormEvent) {
    event.preventDefault()

    const name = customName.trim()
    if (!name) return

    if (selectedSet.has(name.toLowerCase())) {
      setCustomName('')
      return
    }

    onChange([...selectedCategories, name])
    setCustomName('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {allOptions.map((name) => {
          const selected = selectedSet.has(name.toLowerCase())

          return (
            <button
              key={name}
              type="button"
              onClick={() => toggleCategory(name)}
              aria-pressed={selected}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                selected
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {name}
            </button>
          )
        })}
      </div>

      <form className="flex gap-2" onSubmit={addCustomCategory}>
        <input
          className={inputClass}
          value={customName}
          onChange={(event) => setCustomName(event.target.value)}
          placeholder="Add custom category"
          aria-label="Custom category name"
        />
        <button
          type="submit"
          className="shrink-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium"
        >
          Add
        </button>
      </form>
    </div>
  )
}
