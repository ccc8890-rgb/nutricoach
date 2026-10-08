import type { ReactNode } from 'react'

export type TimelineItem = {
  id: string
  index: string
  label: string
  title: ReactNode
  meta?: ReactNode
  detail?: ReactNode
  action?: ReactNode
  active?: boolean
}

export default function TimelineSequence({ items, ariaLabel = 'Secuencia del día' }: { items: TimelineItem[]; ariaLabel?: string }) {
  return (
    <section className="timeline-sequence" aria-label={ariaLabel}>
      {items.map(item => (
        <div key={item.id} className={`timeline-sequence__item ${item.active ? 'is-active' : ''}`}>
          <div className="timeline-sequence__marker"><span>{item.index}</span></div>
          <div className="timeline-sequence__content">
            <p className="editorial-kicker">{item.label}</p>
            <h3>{item.title}</h3>
            {item.detail ? <div className="timeline-sequence__detail">{item.detail}</div> : null}
          </div>
          {item.meta ? <samp className="timeline-sequence__meta">{item.meta}</samp> : null}
          {item.action ? <div className="timeline-sequence__action">{item.action}</div> : null}
        </div>
      ))}
    </section>
  )
}
