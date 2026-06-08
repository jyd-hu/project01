import type { ReactNode } from 'react'

type OnboardingStepContainerProps = {
  title: string
  subtitle?: string
  children: ReactNode
  stepKey: string
}

export function OnboardingStepContainer({
  title,
  subtitle,
  children,
  stepKey,
}: OnboardingStepContainerProps) {
  return (
    <section
      key={stepKey}
      className="onboarding-step space-y-4"
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle ? <p className="text-sm text-gray-600">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}
