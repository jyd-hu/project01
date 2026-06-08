type OnboardingProgressBarProps = {
  currentStep: number
  totalSteps: number
}

export function OnboardingProgressBar({
  currentStep,
  totalSteps,
}: OnboardingProgressBarProps) {
  const progress = Math.min(
    100,
    Math.max(0, (currentStep / totalSteps) * 100)
  )

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Step ${currentStep} of ${totalSteps}`}
    >
      <div
        className="h-full rounded-full bg-black transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
