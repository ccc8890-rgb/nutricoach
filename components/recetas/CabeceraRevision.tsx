'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'

type Cuentas = { recetas: number | null; imagenes: number | null }

const VISTAS = [
  { href: '/recetas/revisar', label: 'Recetas', clave: 'recetas' as const },
  { href: '/recetas/imagenes', label: 'Imágenes', clave: 'imagenes' as const },
]

/**
 * Cabecera única del espacio de trabajo «Revisión»: recetas e imágenes son dos vistas de lo mismo (aprobar recetas).
 * Un solo «volver» (al recetario) y pestañas que reemplazan la entrada del historial en vez de apilarla.
 */
export default function CabeceraRevision() {
  const pathname = usePathname()
  const [cuentas, setCuentas] = useState<Cuentas>({ recetas: null, imagenes: null })

  useEffect(() => {
    let vivo = true
    const cargar = () => {
      fetch('/api/recetas/revisar?tarea=pendientes&page=1&pageSize=1', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (vivo && j.counts) setCuentas(c => ({ ...c, recetas: (j.counts.pendientes ?? 0) + (j.counts.corregir ?? 0) })) }).catch(() => null)
      fetch('/api/recetas/imagenes?filtro=pendientes&limit=200', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (vivo && j.stats) setCuentas(c => ({ ...c, imagenes: j.stats.pendientes ?? 0 })) }).catch(() => null)
    }
    cargar()
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { vivo = false; document.removeEventListener('visibilitychange', alVolver) }
  }, [pathname])

  return (
    <div className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 pt-3">
        <Link href="/recetas" aria-label="Volver al recetario" className="rounded-lg p-1.5" style={{ color: 'var(--text-secondary)' }}><ArrowLeft size={18} /></Link>
        <h1 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Revisión de recetas</h1>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-1 px-4" aria-label="Vistas de revisión">
        {VISTAS.map(v => {
          const activa = pathname === v.href
          const n = cuentas[v.clave]
          return (
            <Link key={v.href} href={v.href} replace className="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors" style={{ borderColor: activa ? 'var(--primary)' : 'transparent', color: activa ? 'var(--text)' : 'var(--text-muted)' }}>
              {v.label}{n !== null && n > 0 && <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: activa ? 'var(--primary-bg)' : 'var(--surface)', color: activa ? 'var(--primary)' : 'var(--text-secondary)' }}>{n}</span>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
