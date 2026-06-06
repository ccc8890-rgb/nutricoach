import Link from 'next/link'
import { Brain, ClipboardList, SlidersHorizontal } from 'lucide-react'

const accesos = [
  {
    href: '/coach/metodologia',
    label: 'Metodología',
    detail: 'Reglas de trabajo, criterio del coach y forma de decidir.',
    icon: SlidersHorizontal,
  },
  {
    href: '/conocimiento',
    label: 'Base de conocimiento',
    detail: 'Notas, evidencia, aprendizajes y contexto reutilizable.',
    icon: Brain,
  },
  {
    href: '/cuestionarios',
    label: 'Cuestionarios',
    detail: 'Formularios, respuestas y recogida estructurada de datos.',
    icon: ClipboardList,
  },
]

export default function SistemaDashboardPage() {
  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
            Sistema
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: 'var(--text)' }}>
            Método y conocimiento
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Entrada del módulo para mantener el criterio del coach, la base de conocimiento y los cuestionarios bajo control.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {accesos.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border p-4 transition-transform active:scale-[0.99]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)', color: 'var(--text)' }}
                >
                  <Icon size={18} />
                </span>
                <span className="mt-3 block text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {item.label}
                </span>
                <span className="mt-1 block text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {item.detail}
                </span>
              </Link>
            )
          })}
        </section>
      </div>
    </div>
  )
}
