'use client'

const inputClass =
  'w-full rounded border border-gray-200 bg-white p-2 text-gray-900 placeholder:text-gray-400'

type BudgetInputsProps = {
  categories: string[]
  budgets: Record<string, string>
  onChange: (budgets: Record<string, string>) => void
}

export function BudgetInputs({
  categories,
  budgets,
  onChange,
}: BudgetInputsProps) {
  function updateBudget(category: string, value: string) {
    onChange({ ...budgets, [category]: value })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Optional — leave blank to skip a category.
      </p>
      <ul className="space-y-2">
        {categories.map((category) => (
          <li
            key={category}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3"
          >
            <span className="text-sm font-medium text-gray-900">{category}</span>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <span>£</span>
              <input
                className={`${inputClass} w-24`}
                inputMode="decimal"
                value={budgets[category] ?? ''}
                onChange={(event) => updateBudget(category, event.target.value)}
                placeholder="0"
                aria-label={`Monthly budget for ${category}`}
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
