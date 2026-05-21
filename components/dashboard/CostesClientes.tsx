'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShoppingCart, ArrowRight, Warning } from '@phosphor-icons/react'
import type { CosteCliente } from '@/app/api/dashboard/costes-clientes/route'

export default function CostesClientes() {
  const [costes, setCostes] = useState<CosteCliente[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/costes-clientes')
      .then(r => r.json())
      .then(data => setCostes(data.costes ?? []))
      .finally(() => setLoading(false))
  }, [])

  const totalSemanalPromedio =
    costes.length > 0
      ? Math.round((costes.reduce((sum, c) => sum + c.coste_semanal_min, 0) / costes.length) * 100) / 100
      : 0

  const clientesSinPrecio = costes.filter(c => c.ingredientes_sin_precio > 0).length

  if (loading) {
    return (
      <div className="card-glass mb-4">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart size={16} weight="fill" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Coste semanal por cliente</h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-8 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!costes.length) return null

  return (
    <div className="card-glass mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} weight="fill" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Coste semanal por cliente</h2>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Promedio: <strong style={{ color: 'var(--text)' }}>{totalSemanalPromedio}€/semana</strong>
        </span>
      </div>

      {clientesSinPrecio > 0 && (
        <div className="flex items-center gap-1.5 text-xs mb-3 px-2 py-1.5 rounded-lg"
          style={{ background: 'rgba(234,179,8,0.1)', color: '#ca8a04' }}>
          <Warning size={12} weight="fill" />
          {clientesSinPrecio} cliente{clientesSinPrecio > 1 ? 's' : ''} con ingredientes sin precio —{' '}
          <Link href="/precios/escandallo" className="underline">completar precios</Link>
        </div>
      )}

      <div className="space-y-1.5">
        {costes.map(c => {
          const cobertura = c.total_ingredientes > 0
            ? Math.round(((c.total_ingredientes - c.ingredientes_sin_precio) / c.total_ingredientes) * 100)
            : 0
          const tieneCoste = c.coste_semanal_min > 0

          return (
            <Link
              key={c.cliente_id}
              href={`/clientes/${c.cliente_id}`}
              className="flex items-center justify-between px-3 py-2 rounded-lg transition-colors"
              style={{ background: 'var(--surface-raised)' }}
            >
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block" style={{ color: 'var(--text)' }}>
                  {c.nombre}
                </span>
                {c.plan_nombre && (
                  <span className="text-xs truncate block" style={{ color: 'var(--text-muted)' }}>
                    {c.plan_nombre}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 ml-3 shrink-0">
                {tieneCoste ? (
                  <div className="text-right">
                    <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                      {c.coste_semanal_min}€
                    </span>
                    {c.coste_semanal_max > c.coste_semanal_min && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        –{c.coste_semanal_max}€
                      </span>
                    )}
                    <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>
                      {c.coste_diario}€/día
                    </span>
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin datos</span>
                )}

                {c.ingredientes_sin_precio > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(234,179,8,0.15)', color: '#ca8a04' }}>
                    {cobertura}%
                  </span>
                )}

                <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
