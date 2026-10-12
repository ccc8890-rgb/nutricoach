'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, CircleNotch } from '@phosphor-icons/react'
import { useToast } from '@/components/ui/Toast'
import { emitPortalFeedback } from '@/lib/cliente/portal-feedback'
import { MARCAS } from '@/lib/entrenos/marcas'

/** «Mis marcas» (Ajustes → Perfil): opcional. Ayuda a que los pesos del plan partan de lo que el atleta ya mueve en lugar de una estimación. */
export default function MisMarcas() {
  const { addToast } = useToast()
  const [valores, setValores] = useState<Record<string, string>>({})
  const [original, setOriginal] = useState<Record<string, string>>({})
  const [existe, setExiste] = useState(true)
  const [cargado, setCargado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    fetch('/api/cliente/marcas').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return
      const v: Record<string, string> = {}
      for (const m of MARCAS) if (d.marcas?.[m.clave] != null) v[m.clave] = String(d.marcas[m.clave])
      setValores(v); setOriginal(v); setExiste(d.existe !== false)
    }).catch(() => {}).finally(() => setCargado(true))
  }, [])

  if (!cargado || !existe) return null
  const cambiado = MARCAS.some(m => (valores[m.clave] ?? '') !== (original[m.clave] ?? ''))

  async function guardar() {
    setGuardando(true)
    try {
      const marcas: Record<string, string | null> = {}
      for (const m of MARCAS) if ((valores[m.clave] ?? '') !== (original[m.clave] ?? '')) marcas[m.clave] = valores[m.clave]?.trim() ? valores[m.clave] : null
      const res = await fetch('/api/cliente/marcas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marcas }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { emitPortalFeedback(addToast, { type: 'error', title: d.error ?? 'No se pudieron guardar las marcas' }); return }
      setOriginal({ ...valores })
      emitPortalFeedback(addToast, { type: 'success', title: 'Marcas guardadas', importance: 'important' })
    } finally { setGuardando(false) }
  }

  return (
    <section className="settings-panel settings-console__section">
      <h2 className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>Mis marcas</h2>
      <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
        Opcional. El peso con el que haces 5 repeticiones buenas. Si lo sabes, tu plan parte de ahí en vez de una estimación.
      </p>
      {MARCAS.map((m, i) => (
        <label key={m.clave} className="technical-row settings-data-row" style={{ gridTemplateColumns: '2.8rem minmax(0, 1fr) auto' }}>
          <span className="technical-row__index">{String(i + 1).padStart(2, '0')}</span>
          <span className="technical-row__content" style={{ padding: '0.8rem 1rem' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{m.etiqueta}</span>
          </span>
          <span className="technical-row__action">
            <input
              inputMode="decimal"
              className="input editorial-field text-right"
              style={{ width: '5.5rem' }}
              placeholder="—"
              aria-label={m.etiqueta}
              value={valores[m.clave] ?? ''}
              onChange={e => setValores(v => ({ ...v, [m.clave]: e.target.value.replace(/[^\d.,]/g, '') }))}
            />
            <span className="ml-1.5 text-[11px] w-7" style={{ color: 'var(--text-muted)' }}>{m.unidad}</span>
          </span>
        </label>
      ))}
      <button className="btn btn-primary w-full justify-center rounded-xl mt-3 cursor-pointer" onClick={guardar} disabled={guardando || !cambiado}>
        {guardando ? <CircleNotch size={16} className="animate-spin" /> : <CheckCircle size={16} />}
        {guardando ? 'Guardando…' : 'Guardar marcas'}
      </button>
    </section>
  )
}
