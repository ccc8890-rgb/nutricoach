export type ProgressInstrumentProps = {
  label: string
  value: number
  max: number
  unit?: string
  detail?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}

export default function ProgressInstrument({ label, value, max, unit = '', detail, tone = 'neutral' }: ProgressInstrumentProps) {
  const safeMax = max > 0 ? max : 1
  const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100))
  return (
    <div className={`progress-instrument is-${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="progress-instrument__header">
        <span>{label}</span>
        <output>{Math.round(value)}{unit}</output>
      </div>
      <div className="progress-instrument__track"><span style={{ transform: `scaleX(${percentage / 100})` }} /></div>
      {detail ? <small>{detail}</small> : null}
    </div>
  )
}
