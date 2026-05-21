'use client'

interface Props {
  currentStep: number
  totalSteps: number
}

export default function OnboardingProgress({ currentStep, totalSteps }: Props) {
  const pct = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 0
  return (
    <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-elevated)' }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: 'var(--accent)',
          transition: 'width 0.4s cubic-bezier(0.23,1,0.32,1)',
        }}
      />
    </div>
  )
}
