'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import {
  Brain,
  Command,
  Database,
  MagnifyingGlass,
  Pulse,
  SquaresFour,
} from '@phosphor-icons/react'

type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
type PhosphorIcon = ComponentType<{ size?: number; weight?: IconWeight; className?: string; style?: CSSProperties }>
type WorkspaceItem = { href: string; label: string; exact?: boolean }
type WorkspaceMode = {
  key: string
  label: string
  hint: string
  href: string
  exact?: boolean
  icon: PhosphorIcon
  items: WorkspaceItem[]
}

const MODES: WorkspaceMode[] = [
  {
    key: 'operate',
    label: 'Operate',
    hint: 'Decidir hoy',
    href: '/entrenos',
    exact: true,
    icon: Pulse,
    items: [
      { href: '/entrenos', label: 'Command', exact: true },
      { href: '/entrenos/brain-ia', label: 'AI Review' },
    ],
  },
  {
    key: 'plan',
    label: 'Plan',
    hint: 'Crear y ajustar',
    href: '/entrenos/nueva',
    icon: SquaresFour,
    items: [
      { href: '/entrenos/nueva', label: 'Builder' },
      { href: '/entrenos/generar-ia', label: 'Plan IA' },
    ],
  },
  {
    key: 'library',
    label: 'Library',
    hint: 'Activos',
    href: '/entrenos/plantillas',
    icon: Database,
    items: [
      { href: '/entrenos/plantillas', label: 'Planes' },
      { href: '/entrenos/ejercicios', label: 'Ejercicios' },
    ],
  },
  {
    key: 'brain',
    label: 'Brain',
    hint: 'IA y evidencia',
    href: '/entrenos/brain-ia',
    icon: Brain,
    items: [
      { href: '/entrenos/brain-ia', label: 'Bandeja IA' },
    ],
  },
]

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href
  return pathname.startsWith(href)
}

function getCurrentMode(pathname: string) {
  return MODES.find(mode => mode.items.some(item => isActive(pathname, item.href, item.exact))) ?? MODES[0]
}

export default function TrainingWorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const currentMode = getCurrentMode(pathname)

  return (
    <section className="min-h-[100dvh] overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div
        className="sticky top-0 z-20 border-b px-4 py-3 sm:px-5 lg:px-6"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <div className="mr-auto flex w-full max-w-[1500px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="hidden h-11 w-11 items-center justify-center rounded-2xl border sm:flex"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
            >
              <Command size={20} weight="duotone" style={{ color: 'var(--text)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                Training Workspace
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl" style={{ color: 'var(--text)' }}>
                  {currentMode.label}
                </h1>
                <span
                  className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
                >
                  {currentMode.hint}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(260px,420px)_auto] xl:min-w-[720px]">
            <div
              className="flex h-11 items-center gap-2 rounded-2xl border px-3"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <MagnifyingGlass size={16} style={{ color: 'var(--text-muted)' }} />
              <span className="min-w-0 flex-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                Buscar cliente, plan, ejercicio o decisión IA
              </span>
              <span className="hidden rounded-lg border px-1.5 py-0.5 text-[10px] font-semibold sm:inline" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                global
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatusPill label="Riesgo" value="live" tone="alert" />
              <StatusPill label="IA" value="review" tone="warn" />
              <StatusPill label="Sesiones" value="hoy" tone="ok" />
            </div>
          </div>
        </div>

        <div className="mr-auto mt-3 flex w-full max-w-[1500px] gap-2 overflow-x-auto pb-1 lg:hidden">
          {MODES.map(mode => {
            const active = currentMode.key === mode.key
            const Icon = mode.icon
            return (
              <Link
                key={mode.key}
                href={mode.href}
                className="flex min-w-[132px] items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition-transform active:scale-[0.98]"
                style={{
                  borderColor: active ? 'var(--border-strong)' : 'var(--border)',
                  background: active ? 'var(--text)' : 'var(--surface)',
                  color: active ? 'var(--bg)' : 'var(--text-secondary)',
                }}
              >
                <Icon size={17} weight={active ? 'fill' : 'regular'} />
                <span>{mode.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="mr-auto w-full max-w-[1500px]">
        {children}
      </div>
    </section>
  )
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: 'alert' | 'warn' | 'ok' }) {
  const color = tone === 'alert'
    ? 'var(--semantic-alert)'
    : tone === 'warn'
      ? 'var(--semantic-warn)'
      : 'var(--semantic-active)'

  return (
    <div className="rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="mt-0.5 text-xs font-semibold" style={{ color }}>{value}</p>
    </div>
  )
}
