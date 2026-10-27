'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { resumenParametros, type Tecnica } from '@/lib/tecnicas'

const mono = { fontFamily: 'var(--font-mono, monospace)' } as const

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="py-4" style={{ borderTop: '1px solid var(--border)' }}>
      <h2 className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ ...mono, color: 'var(--text-muted)' }}>{titulo}</h2>
      <div className="text-base leading-relaxed whitespace-pre-line" style={{ color: 'var(--text)' }}>{children}</div>
    </section>
  )
}

type Uso = { id: string; nombre: string; tipo_contenido: string | null }

export default function TecnicaFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [t, setT] = useState<Tecnica | null>(null)
  const [usos, setUsos] = useState<Uso[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/tecnicas/${id}`).then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error ?? 'No se pudo cargar'); return }
      setT(d.tecnica); setUsos(d.usada_en ?? [])
    }).catch(() => setError('No se pudo cargar'))
  }, [id])

  async function borrar() {
    if (!window.confirm('¿Borrar esta técnica? Se quitará de las recetas que la usan.')) return
    const r = await fetch(`/api/tecnicas/${id}`, { method: 'DELETE' })
    if (r.ok) router.push('/recetas/tecnicas'); else setError('No se pudo borrar')
  }

  if (error) return <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
  if (!t) return <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
  const resumen = resumenParametros(t.parametros)

  return (
    <article className="mx-auto max-w-2xl p-4 pb-24">
      <div className="flex items-center justify-between mb-4 text-sm">
        <Link href="/recetas/tecnicas" style={{ color: 'var(--text-secondary)' }}>← Técnicas</Link>
        <div className="flex gap-4">
          <Link href={`/recetas/tecnicas/${id}/editar`} style={{ color: 'var(--text)' }}>Editar</Link>
          <button onClick={borrar} style={{ color: 'var(--text-muted)' }}>Borrar</button>
        </div>
      </div>
      {t.familia && <p className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ ...mono, color: 'var(--text-muted)' }}>{t.familia}</p>}
      <h1 className="text-3xl font-light mb-1" style={{ color: 'var(--text)' }}>{t.nombre}</h1>
      {resumen && <p className="text-sm mb-3" style={{ ...mono, color: 'var(--text-secondary)' }}>{resumen}</p>}
      {t.estado !== 'aprobada' && <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{t.estado === 'en_revision' ? 'En revisión' : 'Descartada'}</p>}
      {t.descripcion && <Seccion titulo="Qué es">{t.descripcion}</Seccion>}
      {t.principio && <Seccion titulo="Principio">{t.principio}</Seccion>}
      {t.parametros.equipo && <Seccion titulo="Equipo">{t.parametros.equipo}</Seccion>}
      {t.pasos && <Seccion titulo="Paso a paso">{t.pasos}</Seccion>}
      {t.errores_tipicos && <Seccion titulo="Errores típicos">{t.errores_tipicos}</Seccion>}
      {t.variantes && <Seccion titulo="Variantes">{t.variantes}</Seccion>}
      {t.seguridad && <Seccion titulo="Seguridad">{t.seguridad}</Seccion>}
      {(t.origen || t.url_origen || t.autor_original) && (
        <Seccion titulo="Origen y fuente">
          {[t.origen, t.autor_original].filter(Boolean).join(' · ')}
          {t.url_origen && <>{'\n'}<a href={t.url_origen} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-4">{t.url_origen}</a></>}
        </Seccion>
      )}
      {usos.length > 0 && (
        <Seccion titulo="Se usa en">
          <ul className="space-y-1">{usos.map(u => <li key={u.id}><Link href={`/recetas/${u.id}`} className="underline decoration-dotted underline-offset-4">{u.nombre}</Link></li>)}</ul>
        </Seccion>
      )}
    </article>
  )
}
