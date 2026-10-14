import type { ReactNode } from 'react'

export type EditorialMastheadProps = {
  index: string
  eyebrow: string
  title: ReactNode
  meta?: ReactNode
  aside?: ReactNode
  className?: string
}

export default function EditorialMasthead({ index, eyebrow, title, meta, aside, className = '' }: EditorialMastheadProps) {
  return (
    <header className={`editorial-masthead ${className}`.trim()}>
      <div className="editorial-masthead__register" aria-hidden="true">{index}</div>
      <div className="editorial-masthead__body">
        <p className="editorial-kicker">{eyebrow}</p>
        <h1 className="editorial-masthead__title">{title}</h1>
        {meta ? <div className="editorial-masthead__meta">{meta}</div> : null}
      </div>
      {aside ? <aside className="editorial-masthead__aside">{aside}</aside> : null}
    </header>
  )
}
