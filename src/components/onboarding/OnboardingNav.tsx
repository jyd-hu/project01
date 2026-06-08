type OnboardingNavProps = {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  isSubmitting?: boolean
  showBack?: boolean
}

export function OnboardingNav({
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  isSubmitting = false,
  showBack = true,
}: OnboardingNavProps) {
  return (
    <div className="flex gap-3 pt-2">
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 rounded border border-gray-300 bg-white p-2.5 text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>
      ) : null}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || isSubmitting}
        className="flex-1 rounded bg-black p-2.5 text-white disabled:cursor-not-allowed disabled:bg-gray-500"
      >
        {isSubmitting ? 'Saving...' : nextLabel}
      </button>
    </div>
  )
}
