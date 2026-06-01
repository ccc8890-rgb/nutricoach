'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Brain, Dumbbell, FilePlus2, LayoutDashboard, Library, Sparkles } from 'lucide-react'

const SECTIONS = [
  {
    label: 'Operativa',
    hint: 'Qué requiere atención',
    items: [
      { href: '/entrenos', label: 'Command Center', icon: LayoutDashboard, exact: true },
      { href: '/entrenos/brain-ia', label: 'AI Review', icon: Brain },
    ],
  },
  {
    label: 'Planificación',
    hint: 'Crear y ajustar planes',
    items: [
      { href: '/entrenos/nueva', label: 'Crear plan', icon: FilePlus2 },
      { href: '/entrenos/generar-ia', label: 'Plan con IA', icon: Sparkles },
    ],
  },
  {
    label: 'Biblioteca',
    hint: 'Assets reutilizables',
    items: [
      { href: '/entrenos/plantillas', label: 'Plan Library', icon: Library },
      { href: '/entrenos/ejercicios', label: 'Exercise Library', icon: Dumbbell },
    ],
  },
]

export default function TrainingSubNav() {
  const pathname = usePathname()

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="hidden lg:flex flex-col flex-shrink-0 training-subnav"
      style={{
        width: 172,
        background: 'linear-gradient(180deg, var(--surface), var(--bg-subtle))',
        borderRight: '1px solid var(--border)',
        padding: '14px 10px',
        animation: 'slideInLeft 0.22s ease-out',
      }}
      aria-label="Navegación de entrenamiento"
    >
      <div style={{ padding: '0 8px 12px' }}>
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)' }}
          >
            <Dumbbell size={14} style={{ color: 'var(--semantic-active)' }} />
          </div>
          <div className="min-w-0">
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>
              Training OS
            </p>
            <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Decision console
            </p>
          </div>
        </div>
      </div>

      {SECTIONS.map(section => (
        <div key={section.label} style={{ marginBottom: 10 }}>
          <div style={{ padding: '8px 8px 5px', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {section.label}
          </div>
          <p style={{ padding: '0 8px 5px', fontSize: 10, lineHeight: 1.25, color: 'var(--text-muted)' }}>
            {section.hint}
          </p>
          {section.items.map(item => {
            const active = isActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 9px',
                  margin: '1px 0',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: active ? 650 : 500,
                  color: active ? 'var(--text)' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'var(--border-strong)' : 'transparent'}`,
                  background: active ? 'var(--bg)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'color 0.18s var(--ease-out-strong), background 0.18s var(--ease-out-strong), border-color 0.18s var(--ease-out-strong), transform 0.18s var(--ease-out-strong)',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: -10,
                      width: 2,
                      height: 18,
                      borderRadius: 999,
                      background: 'var(--semantic-active)',
                    }}
                  />
                )}
                <item.icon size={14} style={{ color: active ? 'var(--semantic-active)' : 'var(--text-muted)' }} />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
