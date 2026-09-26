'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/recetas/revisar', label: 'Revisión' },
  { href: '/recetas/cola', label: 'Pendientes' },
  { href: '/recetas/imagenes', label: 'Imágenes' },
]

// Antes eran 3 entradas separadas en el menú principal. En el fondo son la
// misma tarea (recetas que necesitan atención antes de publicarse), así que
// aquí viven como pestañas dentro de una sola pantalla en vez de 3 enlaces
// distintos en el sidebar.
export default function RevisionTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b mb-4 -mt-1" style={{ borderColor: 'var(--border)' }}>
      {TABS.map(tab => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: active ? 'var(--primary)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
