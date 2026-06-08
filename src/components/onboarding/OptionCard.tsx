type OptionCardProps = {
  label: string
  selected: boolean
  onToggle: () => void
  multi?: boolean
}

export function OptionCard({
  label,
  selected,
  onToggle,
  multi = false,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`w-full rounded-xl border p-3 text-left text-sm font-medium transition-colors ${
        selected
          ? 'border-black bg-gray-900 text-white'
          : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            selected ? 'border-white bg-white' : 'border-gray-300 bg-white'
          }`}
          aria-hidden
        >
          {selected ? (
            <span
              className={`h-2 w-2 rounded-full ${multi ? 'bg-black' : 'bg-black'}`}
            />
          ) : null}
        </span>
        {label}
      </span>
    </button>
  )
}
