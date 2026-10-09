'use client'

import { Barbell, ChartLineUp, ChatCircleDots, ClipboardText, ForkKnife, ShoppingCart } from '@phosphor-icons/react'
import EditorialMasthead from './EditorialMasthead'
import ProgressInstrument from './ProgressInstrument'
import TechnicalReadout from './TechnicalReadout'
import TimelineSequence from './TimelineSequence'

type HoyDestination = 'dieta' | 'entreno' | 'progreso' | 'checkin' | 'compra' | 'chat'

export type HoyEditorialProps = {
  firstName: string
  calories: number
  meals: number
  weeklySessions: number
  weight?: number | null
  weightDelta?: number | null
  macros: Array<{ label: string; value: number; target: number; unit: string }>
  trainingName?: string | null
  hasPlan: boolean
  onNavigate: (destination: HoyDestination) => void
}

function Action({ label, icon: Icon, onClick }: { label: string; icon: typeof ClipboardText; onClick: () => void }) {
  return (
    <button type="button" className="editorial-action" onClick={onClick}>
      <Icon size={15} />
      <span>{label}</span>
      <span aria-hidden="true">↗</span>
    </button>
  )
}

export default function HoyEditorial({ firstName, calories, meals, weeklySessions, weight, weightDelta, macros, trainingName, hasPlan, onNavigate }: HoyEditorialProps) {
  if (!hasPlan) return null

  const sequence = [
    {
      id: 'nutrition', index: '01', label: 'Alimentación', title: `${meals} tomas programadas`, meta: `${Math.round(calories)} KCAL`,
      detail: 'Consulta cantidades, ingredientes y alternativas del plan.',
      action: <Action label="Abrir dieta" icon={ForkKnife} onClick={() => onNavigate('dieta')} />,
      active: true,
    },
    {
      id: 'training', index: '02', label: 'Entrenamiento', title: trainingName || 'Recuperación programada', meta: trainingName ? `${weeklySessions} SES / SEM` : 'REST',
      detail: trainingName ? 'Revisa la sesión técnica y registra cada bloque.' : 'Hoy no hay una sesión asignada.',
      action: trainingName ? <Action label="Abrir entreno" icon={Barbell} onClick={() => onNavigate('entreno')} /> : undefined,
    },
    {
      id: 'progress', index: '03', label: 'Seguimiento', title: weight ? `${weight} kg registrados` : 'Registrar referencia', meta: weightDelta == null ? 'BASE' : `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} KG`,
      detail: 'Peso, fotografías y evolución en una única lectura.',
      action: <Action label="Ver progreso" icon={ChartLineUp} onClick={() => onNavigate('progreso')} />,
    },
    {
      id: 'checkin', index: '04', label: 'Revisión', title: 'Check-in semanal', meta: 'STATUS / OPEN',
      detail: 'Registra adherencia, sensaciones y contexto para tu coach.',
      action: <Action label="Completar check-in" icon={ClipboardText} onClick={() => onNavigate('checkin')} />,
    },
  ]

  return (
    <div className="hoy-editorial">
      <EditorialMasthead
        index="01 / TODAY"
        eyebrow="Protocolo diario"
        title={<>{firstName},<br />cumple lo esencial.</>}
        aside={<TechnicalReadout label="Objetivo energético" value={Math.round(calories)} unit="kcal" detail="Plan activo de hoy" />}
      />
      <section className="hoy-editorial__instruments" aria-label="Objetivos de macronutrientes">
        <p className="editorial-kicker">Instrumentación / objetivos</p>
        {macros.map(macro => (
          <ProgressInstrument key={macro.label} label={macro.label} value={macro.value} max={macro.target} unit={macro.unit} detail={`${Math.round(macro.value)} de ${Math.round(macro.target)} ${macro.unit}`} />
        ))}
      </section>
      <div className="hoy-editorial__section-label"><span>Accesos rápidos</span><samp>02 TOOLS</samp></div>
      <nav className="hoy-editorial__utilities" aria-label="Accesos rápidos">
        <Action label="Lista de compra" icon={ShoppingCart} onClick={() => onNavigate('compra')} />
        <Action label="Chat con coach" icon={ChatCircleDots} onClick={() => onNavigate('chat')} />
      </nav>
      <div className="hoy-editorial__section-label"><span>Secuencia del día</span><samp>04 UNITS</samp></div>
      <TimelineSequence items={sequence} />
    </div>
  )
}
