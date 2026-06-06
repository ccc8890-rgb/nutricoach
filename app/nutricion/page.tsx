import Link from 'next/link'
import { Activity, ChefHat, ClipboardList, ShoppingCart, Store, Utensils } from 'lucide-react'

const accesos = [
  {
    href: '/dietas',
    label: 'Planes activos',
    detail: 'Dietas en curso, ajustes y revisión por cliente.',
    icon: Utensils,
  },
  {
    href: '/dietas/plantillas',
    label: 'Plantillas',
    detail: 'Bases reutilizables para montar planes rápido.',
    icon: ClipboardList,
  },
  {
    href: '/recetas',
    label: 'Recetario',
    detail: 'Recetas, alimentos, cobertura, imágenes y revisión.',
    icon: ChefHat,
  },
  {
    href: '/compra',
    label: 'Lista compra',
    detail: 'Compra semanal conectada al plan nutricional.',
    icon: ShoppingCart,
  },
  {
    href: '/precios',
    label: 'Precios',
    detail: 'Productos, supermercados y referencias de coste.',
    icon: Store,
  },
  {
    href: '/precios/rentabilidad',
    label: 'Rentabilidad',
    detail: 'Coste, margen y control económico por cliente.',
    icon: Activity,
  },
]

export default function NutricionDashboardPage() {
  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
            Nutrición
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: 'var(--text)' }}>
            Panel operativo del módulo
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Vista rápida para entrar en planes, recetario, compra y costes sin volver al dashboard general.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accesos.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border p-4 transition-transform active:scale-[0.99]"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)', color: 'var(--text)' }}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {item.label}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {item.detail}
                    </span>
                  </span>
                </div>
              </Link>
            )
          })}
        </section>
      </div>
    </div>
  )
}
