'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle, Warning } from '@phosphor-icons/react'

export const DASHBOARD_MUTED = 'color-mix(in srgb, var(--text) 66%, transparent)'
export const DASHBOARD_SECONDARY = 'color-mix(in srgb, var(--text) 84%, transparent)'

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error ?? `Error ${res.status}`)
  }
  return data as T
}

export function formatEuro(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(date: string | null | undefined) {
  if (!date) return 'Sin fecha'
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 rounded-xl skeleton" />
      ))}
    </div>
  )
}
export function SectionHeader({
  icon: Icon,
  title,
  meta,
  href,
  linkLabel = 'Ver',
}: {
  icon: React.ElementType
  title: string
  meta?: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon size={16} weight="fill" style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>{title}</h2>
        {meta && <span className="text-xs" style={{ color: DASHBOARD_MUTED }}>{meta}</span>}
      </div>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: DASHBOARD_MUTED }}>
          {linkLabel} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  )
}

export function EmptyState({ title, actionHref, actionLabel }: { title: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="rounded-xl border px-4 py-6 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
      <CheckCircle size={20} weight="fill" className="mx-auto mb-2" style={{ color: 'var(--success)' }} />
      <p className="text-sm font-medium" style={{ color: DASHBOARD_SECONDARY }}>{title}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--text)' }}>
          {actionLabel} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border px-4 py-5" style={{ borderColor: 'var(--error)', background: 'var(--error-bg)' }}>
      <div className="flex items-start gap-3">
        <Warning size={18} weight="fill" className="mt-0.5 flex-shrink-0" style={{ color: 'var(--error)' }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--error)' }}>{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs font-semibold active:scale-95"
            style={{ color: 'var(--text)' }}
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  )
}
