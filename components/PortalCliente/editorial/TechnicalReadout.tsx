import type { ReactNode } from 'react'

export type TechnicalReadoutProps = {
  label: string
  value: ReactNode
  unit?: string
  detail?: ReactNode
  className?: string
}

export default function TechnicalReadout({ label, value, unit, detail, className = '' }: TechnicalReadoutProps) {
  return (
    <dl className={`technical-readout ${className}`.trim()}>
      <dt>{label}</dt>
      <dd><data>{value}</data>{unit ? <span>{unit}</span> : null}</dd>
      {detail ? <div className="technical-readout__detail">{detail}</div> : null}
    </dl>
  )
}
