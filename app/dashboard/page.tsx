'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Accesos from '@/components/dashboard/Accesos'
import DetalleColapsable from '@/components/dashboard/DetalleColapsable'
import HoyCards from '@/components/dashboard/HoyCards'
import NumerosClave from '@/components/dashboard/NumerosClave'
import { DASHBOARD_MUTED, ErrorState, fetchJson } from '@/components/dashboard/comun'
import { resumirHoy } from '@/lib/dashboard/hoy'
import type { CommandData, CosteCliente, NegocioData } from '@/lib/dashboard/tipos'
import './dashboard.css'

export default function DashboardPage() {
  const [command, setCommand] = useState<CommandData | null>(null)
  const [costes, setCostes] = useState<CosteCliente[]>([])
  const [negocio, setNegocio] = useState<NegocioData | null>(null)
  const [commandLoading, setCommandLoading] = useState(true)
  const [negocioLoading, setNegocioLoading] = useState(true)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [negocioError, setNegocioError] = useState<string | null>(null)

  const loadCommand = useCallback(async () => {
    setCommandLoading(true)
    setCommandError(null)
    try {
      const [commandData, costesData] = await Promise.all([
        fetchJson<CommandData>('/api/dashboard/command-center'),
        fetchJson<{ costes: CosteCliente[] }>('/api/dashboard/costes-clientes').catch(() => ({ costes: [] })),
      ])
      setCommand(commandData)
      setCostes(costesData.costes ?? [])
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : 'No se pudo cargar el panel')
    } finally {
      setCommandLoading(false)
    }
  }, [])

  const loadNegocio = useCallback(async () => {
    setNegocioLoading(true)
    setNegocioError(null)
    try {
      setNegocio(await fetchJson<NegocioData>('/api/dashboard/negocio'))
    } catch (error) {
      setNegocioError(error instanceof Error ? error.message : 'No se pudo cargar negocio')
    } finally {
      setNegocioLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCommand()
    loadNegocio()
  }, [loadCommand, loadNegocio])

  const resumen = useMemo(() => (command ? resumirHoy(command) : null), [command])
  const totalPendiente = resumen ? resumen.tarjetas.reduce((sum, t) => sum + t.total, 0) : 0
  const fecha = useMemo(() => (
    new Date().toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })
  ), [])

  return (
    <main className="coach-dashboard-shell flex-1 px-4 py-6 sm:px-6 sm:py-9 lg:px-10 lg:py-12">
      <div className="coach-dashboard mx-auto max-w-6xl space-y-7">
        <header className="coach-dashboard-hero">
          <p className="coach-dashboard-eyebrow mb-3 text-xs capitalize" style={{ color: DASHBOARD_MUTED }}>{fecha}</p>
          <h1 className="coach-dashboard-title text-3xl font-semibold tracking-[-0.04em] sm:text-4xl" style={{ color: 'var(--text)' }}>
            {commandLoading || !resumen ? 'Hoy' : totalPendiente > 0 ? `Hoy tienes ${totalPendiente} ${totalPendiente === 1 ? 'cosa' : 'cosas'} por revisar` : 'Hoy, todo al día'}
          </h1>
          <p className="coach-dashboard-intro mt-3 max-w-xl text-sm" style={{ color: DASHBOARD_MUTED }}>
            Prioridades, actividad y salud del negocio en una sola lectura.
          </p>
        </header>

        {commandError ? <ErrorState message={commandError} onRetry={loadCommand} /> : <HoyCards resumen={resumen} loading={commandLoading} />}

        <NumerosClave
          operacion={command?.operacion ?? null}
          negocio={negocio}
          loading={commandLoading || negocioLoading}
          negocioError={negocioError}
          onRetry={loadNegocio}
        />

        <Accesos />

        <DetalleColapsable command={command} costes={costes} negocio={negocio} loading={commandLoading} />

        {command?.timestamp && (
          <p className="pb-4 text-center text-[10px]" style={{ color: DASHBOARD_MUTED }}>
            Actualizado {new Date(command.timestamp).toLocaleString('es-ES')}
          </p>
        )}
      </div>
    </main>
  )
}
