'use client'

interface Props {
  currentStep: number
  totalSteps: number
  labels: string[]
}

export default function OnboardingProgress({ currentStep, totalSteps, labels }: Props) {
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        {labels.map((label, i) => (
          <div key={i} className="flex flex-col items-center" style={{ width: `${100 / totalSteps}%` }}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                i < currentStep
                  ? 'bg-[var(--primary)] text-white'
                  : i === currentStep
                  ? 'bg-[var(--primary)] text-white ring-4 ring-[var(--primary)]/30'
                  : 'bg-[var(--border)] text-[var(--text-muted)]'
              }`}
            >
              {i < currentStep ? '✓' : i + 1}
            </div>
            <span className={`text-xs mt-1 text-center hidden sm:block ${i === currentStep ? 'text-[var(--primary)] font-medium' : 'text-[var(--text-muted)]'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-1 bg-[var(--border)] rounded-full">
        <div
          className="absolute top-0 left-0 h-1 bg-[var(--primary)] rounded-full transition-all duration-500"
          style={{ width: `${(currentStep / (totalSteps - 1)) * 100}%` }}
        />
      </div>
    </div>
  )
}
