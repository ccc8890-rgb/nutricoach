import type { ReactNode } from 'react'

export type TechnicalRowProps = {
  index: ReactNode
  interactiveIndex?: boolean
  label: ReactNode
  meta?: ReactNode
  detail?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
}

export default function TechnicalRow({ index, interactiveIndex = false, label, meta, detail, action, children, className = '' }: TechnicalRowProps) {
  return (
    <article className={`technical-row ${className}`.trim()}>
      <div className={`technical-row__index ${interactiveIndex ? 'is-interactive' : ''}`.trim()} aria-hidden={interactiveIndex ? undefined : true}>{index}</div>
      <div className="technical-row__content">
        <div className="technical-row__heading">
          <div>
            <h3>{label}</h3>
            {detail ? <div className="technical-row__detail">{detail}</div> : null}
          </div>
          {meta ? <samp className="technical-row__meta">{meta}</samp> : null}
        </div>
        {children}
      </div>
      {action ? <div className="technical-row__action">{action}</div> : null}
    </article>
  )
}
