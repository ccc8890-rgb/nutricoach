'use client'

import { useState } from 'react'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import MicronutrientesPortal from '@/components/PortalCliente/MicronutrientesPortal'

// Informe de micronutrientes del plan activo (media diaria) para el coach; carga al abrir.
export default function MicronutrientesCoach({ clienteId }: { clienteId: string }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <button className="w-full flex items-center justify-between px-4 py-3" onClick={() => setAbierto(a => !a)}>
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
          <Activity size={16} style={{ color: 'var(--accent)' }} /> Micronutrientes del plan
        </span>
        {abierto ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
      </button>
      {abierto && (
        <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <MicronutrientesPortal clienteId={clienteId} />
          <p className="text-xs pt-2" style={{ color: 'var(--text-muted)' }}>Media diaria del plan activo frente a los objetivos del perfil del cliente.</p>
        </div>
      )}
    </div>
  )
}
