'use client'
import { useState } from 'react'
import { PLANES, PlanTipo } from '@/lib/stripe'

interface Props {
  open: boolean
  onClose: () => void
  clienteId?: string
  clienteEmail?: string
  clienteNombre?: string
}

export default function GenerarLinkPagoModal({ open, onClose, clienteId, clienteEmail, clienteNombre }: Props) {
  const [precio, setPrecio] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [email, setEmail] = useState(clienteEmail ?? '')
  const [loading, setLoading] = useState(false)
  const [linkGenerado, setLinkGenerado] = useState('')
  const [copiado, setCopiado] = useState(false)

  if (!open) return null

  function aplicarPlan(plan: PlanTipo) {
    setPrecio(String(PLANES[plan].precio_eur))
    setDescripcion(PLANES[plan].nombre + ' — ' + PLANES[plan].descripcion)
  }

  async function generar() {
    const precioNum = parseFloat(precio)
    if (!precioNum || precioNum <= 0) return alert('Introduce un precio válido')
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          precio_eur: precioNum,
          descripcion: descripcion || undefined,
          email_cliente: email || undefined,
        }),
      })
      if (!res.ok) { alert('Error ' + res.status + ' generando el link'); return }
      const data = await res.json()
      if (data.url) setLinkGenerado(data.url)
      else alert('Error generando el link')
    } finally {
      setLoading(false)
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(linkGenerado)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--surface)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Generar link de pago
          </h2>
          <button onClick={onClose} className="text-xl" style={{ color: 'var(--text-secondary)' }}>×</button>
        </div>

        {clienteNombre && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Para: <strong>{clienteNombre}</strong>
          </p>
        )}

        <div>
          <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Atajos de plan
          </p>
          <div className="flex gap-2">
            {(Object.keys(PLANES) as PlanTipo[]).map(p => (
              <button key={p} onClick={() => aplicarPlan(p)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg)' }}>
                {PLANES[p].nombre}<br />
                <span className="font-bold">{PLANES[p].precio_eur}€</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            Precio (€)
          </label>
          <input type="number" value={precio} onChange={e => setPrecio(e.target.value)}
            placeholder="Ej: 180" min="1"
            className="input w-full" autoComplete="off" />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            Descripción (opcional)
          </label>
          <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="Ej: Plan personalizado 3 meses"
            className="input w-full" autoComplete="off" />
        </div>

        {!clienteId && (
          <div>
            <label className="text-xs font-medium uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              Email del cliente (opcional)
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              className="input w-full" autoComplete="off" />
          </div>
        )}

        {linkGenerado ? (
          <div className="space-y-2">
            <input readOnly value={linkGenerado}
              className="input w-full text-xs" style={{ color: 'var(--text-secondary)' }} />
            <button onClick={copiar} className="btn-primary w-full">
              {copiado ? '✓ Copiado' : 'Copiar link'}
            </button>
          </div>
        ) : (
          <button onClick={generar} disabled={loading || !precio}
            className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Generando…' : 'Generar link'}
          </button>
        )}
      </div>
    </div>
  )
}
