'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Plus } from '@/components/icons/lucide'

type Cuentas = { nueva: number | null; en_agente: number | null; segunda: number | null }

type Vista = { href: string; label: string; clave?: keyof Cuentas; activa: (pathname: string, fase: string) => boolean }

const GRUPOS: { titulo: string; vistas: Vista[] }[] = [
  {
    titulo: 'Recetario',
    vistas: [{ href: '/recetas', label: 'Biblioteca', activa: p => p === '/recetas' }],
  },
  {
    titulo: 'Revisar',
    // Circuito: Carlos revisa lo nuevo → el agente lo revisa → Carlos hace la 2ª revisión. Reportadas, fotos y calidad son filtros dentro de cada lista.
    vistas: [
      { href: '/recetas/revisar?fase=nueva', label: 'Por revisar', clave: 'nueva', activa: (p, f) => p === '/recetas/revisar' && f === 'nueva' },
      { href: '/recetas/revisar?fase=en_agente', label: 'Con el agente', clave: 'en_agente', activa: (p, f) => p === '/recetas/revisar' && f === 'en_agente' },
      { href: '/recetas/revisar?fase=segunda', label: '2ª revisión', clave: 'segunda', activa: (p, f) => p === '/recetas/revisar' && f === 'segunda' },
    ],
  },
  {
    titulo: 'Ampliar',
    vistas: [
      { href: '/recetas/cobertura', label: 'Cobertura', activa: p => p === '/recetas/cobertura' },
    ],
  },
]

/**
 * Cabecera única del espacio «Recetario»: biblioteca y todo el trabajo de revisión en un solo sitio,
 * ordenado como se trabaja: consultar → revisar → calidad → ampliar.
 */
export default function CabeceraRevision() {
  const pathname = usePathname()
  const faseUrl = useSearchParams().get('fase')
  const fase = faseUrl === 'en_agente' || faseUrl === 'segunda' ? faseUrl : 'nueva'
  const [cuentas, setCuentas] = useState<Cuentas>({ nueva: null, en_agente: null, segunda: null })

  useEffect(() => {
    let vivo = true
    const cargar = () => {
      fetch('/api/recetas/revisar?tarea=cola&page=1&pageSize=1', { cache: 'no-store' })
        .then(r => r.json()).then(j => { if (vivo && j.counts?.fases) setCuentas({ nueva: j.counts.fases.nueva ?? 0, en_agente: j.counts.fases.en_agente ?? 0, segunda: j.counts.fases.segunda ?? 0 }) }).catch(() => null)
    }
    cargar()
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { vivo = false; document.removeEventListener('visibilitychange', alVolver) }
  }, [pathname, fase])

  return (
    <div className="coach-review-header border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <nav className="mx-auto flex max-w-7xl items-end gap-x-6 gap-y-1 overflow-x-auto px-4" aria-label="Espacio del recetario">
        {GRUPOS.map(g => (
          <div key={g.titulo} className="flex shrink-0 flex-col">
            <span className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{g.titulo}</span>
            <div className="flex gap-1">
              {g.vistas.map(v => {
                const activa = v.activa(pathname, fase)
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
        <Link href="/recetas/nueva" className="mb-1.5 ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--bg)' }}><Plus size={15} />Nueva receta</Link>
      </nav>
    </div>
  )
}
