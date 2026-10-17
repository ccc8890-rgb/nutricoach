'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'

type Cuentas = { porAprobar: number | null; reportadas: number | null; imagenes: number | null }

type Vista = { href: string; label: string; clave?: keyof Cuentas; activa: (pathname: string, tarea: string | null) => boolean }

const GRUPOS: { titulo: string; vistas: Vista[] }[] = [
  {
    titulo: 'Mejorar lo que hay',
    vistas: [
      { href: '/recetas/revisar', label: 'Por aprobar', clave: 'porAprobar', activa: (p, t) => p === '/recetas/revisar' && t !== 'corregir' },
      { href: '/recetas/revisar?tarea=corregir', label: 'Reportadas', clave: 'reportadas', activa: (p, t) => p === '/recetas/revisar' && t === 'corregir' },
      { href: '/recetas/imagenes', label: 'Imágenes', clave: 'imagenes', activa: p => p === '/recetas/imagenes' },
      { href: '/recetas/auditoria', label: 'Auditoría', activa: p => p === '/recetas/auditoria' },
    ],
  },
  {
    titulo: 'Completar lo que falta',
    vistas: [{ href: '/recetas/cobertura', label: 'Cobertura', activa: p => p === '/recetas/cobertura' }],
  },
]

/**
 * Cabecera única del espacio «Revisión»: todo el análisis del recetario en un solo sitio.
 * «Mejorar lo que hay» (aprobar, reportadas, fotos, ingredientes) y «Completar lo que falta» (cobertura).
 */
export default function CabeceraRevision() {
  const pathname = usePathname()
  const tarea = useSearchParams().get('tarea')
  const [cuentas, setCuentas] = useState<Cuentas>({ porAprobar: null, reportadas: null, imagenes: null })

  useEffect(() => {
    let vivo = true
    const cargar = () => {
      fetch('/api/recetas/revisar?tarea=pendientes&page=1&pageSize=1', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (vivo && j.counts) setCuentas(c => ({ ...c, porAprobar: j.counts.pendientes ?? 0, reportadas: j.counts.corregir ?? 0 })) }).catch(() => null)
      fetch('/api/recetas/imagenes?filtro=pendientes&limit=200', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (vivo && j.stats) setCuentas(c => ({ ...c, imagenes: j.stats.pendientes ?? 0 })) }).catch(() => null)
    }
    cargar()
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { vivo = false; document.removeEventListener('visibilitychange', alVolver) }
  }, [pathname, tarea])

  return (
    <div className="coach-review-header border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 pt-3">
        <Link href="/recetas" aria-label="Volver al recetario" className="rounded-lg p-1.5" style={{ color: 'var(--text-secondary)' }}><ArrowLeft size={18} /></Link>
        <h1 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Revisión de recetas</h1>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-x-6 gap-y-1 overflow-x-auto px-4" aria-label="Vistas de revisión">
        {GRUPOS.map(g => (
          <div key={g.titulo} className="flex shrink-0 flex-col">
            <span className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{g.titulo}</span>
            <div className="flex gap-1">
              {g.vistas.map(v => {
                const activa = v.activa(pathname, tarea)
                const n = v.clave ? cuentas[v.clave] : null
                return (
                  <Link key={v.href} href={v.href} className="-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors" style={{ borderColor: activa ? 'var(--primary)' : 'transparent', color: activa ? 'var(--text)' : 'var(--text-muted)' }}>
                    {v.label}{n !== null && n > 0 && <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: activa ? 'var(--primary-bg)' : 'var(--surface)', color: activa ? 'var(--primary)' : 'var(--text-secondary)' }}>{n}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}
