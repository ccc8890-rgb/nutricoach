import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function CoachPage({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return <main className={classes('coach-page', className)} {...props}>{children}</main>
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={classes('coach-page-header', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="coach-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="coach-page-description">{description}</p>}
      </div>
      {actions && <div className="coach-page-actions">{actions}</div>}
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={classes('coach-section-header', className)}>
      <div className="min-w-0">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Surface({
  level = 'base',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { level?: 'base' | 'raised' | 'quiet' }) {
  return <div className={classes('coach-surface', `coach-surface--${level}`, className)} {...props} />
}

export function Metric({
  label,
  value,
  unit,
  trend,
  detail,
  className,
}: {
  label: string
  value: ReactNode
  unit?: string
  trend?: ReactNode
  detail?: ReactNode
  className?: string
}) {
  return (
    <div className={classes('coach-metric', className)}>
      <p className="coach-metric__label">{label}</p>
      <div className="coach-metric__value font-data">
        {value}{unit && <span>{unit}</span>}
      </div>
      {(trend || detail) && <div className="coach-metric__detail">{trend}{detail}</div>}
    </div>
  )
}

export function StatusBadge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}) {
  return <span className={classes('coach-status', `coach-status--${tone}`, className)} {...props} />
}

export function IconButton({
  label,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={classes('coach-icon-button', className)}
      {...props}
    />
  )
}
