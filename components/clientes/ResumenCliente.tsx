'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { CheckIn, PlanEntrenamiento, PlanNutricion, SeguimientoPeso } from '@/types'

type Tab = 'resumen' | 'nutricion' | 'entrenamiento' | 'seguimiento' | 'comunicacion' | 'perfil'
type Aviso = { nivel: 'alto' | 'medio'; texto: string; detalle?: string; tab?: Tab; href?: string }

type ClienteResumen = {
  peso_inicial?: number | null
  onboarding_completado?: boolean | null
  revisado_por_coach?: boolean | null
  fecha_proxima_revision?: string | null
  fecha_fin_membresia?: string | null
}

const DIA_MS = 86_400_000
const dias = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / DIA_MS)

export function avisosCliente(p: { id: string; cliente: ClienteResumen; dietaActiva?: PlanNutricion; entrenoActivo?: PlanEntrenamiento; checkins: CheckIn[]; noLeidosChat: number }): Aviso[] {
  const { id, cliente, dietaActiva, entrenoActivo, checkins, noLeidosChat } = p
  const out: Aviso[] = []
  if (cliente.revisado_por_coach === false) out.push({ nivel: 'alto', texto: 'Plan inicial pendiente de tu revisión', href: `/clientes/${id}/revisar-plan` })
  else if (!dietaActiva) out.push({ nivel: 'alto', texto: 'Sin dieta activa', href: `/clientes/${id}/revisar-plan` })
  if (!entrenoActivo) out.push({ nivel: 'medio', texto: 'Sin plan de entrenamiento activo', tab: 'entrenamiento' })
  if (cliente.onboarding_completado === false) out.push({ nivel: 'medio', texto: 'No ha completado el onboarding', tab: 'perfil' })

  const ultimo = checkins[0]
  if (!ultimo) out.push({ nivel: 'medio', texto: 'Todavía no ha hecho ningún check-in', tab: 'seguimiento' })
  else {
    const d = -dias(ultimo.fecha)
    if (d > 9) out.push({ nivel: d > 16 ? 'alto' : 'medio', texto: `Último check-in hace ${d} días`, detalle: 'Lo normal es semanal', tab: 'seguimiento' })
  }
  const sinRespuesta = checkins.slice(0, 4).filter(c => !c.nota_coach).length
  if (sinRespuesta > 0) out.push({ nivel: 'medio', texto: `${sinRespuesta} check-in${sinRespuesta > 1 ? 's' : ''} reciente${sinRespuesta > 1 ? 's' : ''} sin tu respuesta`, tab: 'seguimiento' })
  if (noLeidosChat > 0) out.push({ nivel: 'medio', texto: `${noLeidosChat} mensaje${noLeidosChat > 1 ? 's' : ''} sin leer`, tab: 'comunicacion' })

  if (cliente.fecha_proxima_revision) {
    const d = dias(cliente.fecha_proxima_revision)
    if (d < 0) out.push({ nivel: 'alto', texto: `Revisión de plan vencida hace ${-d} días`, tab: 'perfil' })
    else if (d <= 7) out.push({ nivel: 'medio', texto: d === 0 ? 'Revisión de plan hoy' : `Revisión de plan en ${d} días`, tab: 'perfil' })
  }
  if (cliente.fecha_fin_membresia) {
    const d = dias(cliente.fecha_fin_membresia)
    if (d < 0) out.push({ nivel: 'alto', texto: `Membresía caducada hace ${-d} días`, tab: 'perfil' })
    else if (d <= 14) out.push({ nivel: 'medio', texto: `La membresía caduca en ${d} días`, tab: 'perfil' })
  }
  return out.sort((a, b) => Number(b.nivel === 'alto') - Number(a.nivel === 'alto'))
}

function Delta({ valor, unidad = '', invertido = false }: { valor: number; unidad?: string; invertido?: boolean }) {
  if (Math.abs(valor) < 0.05) return <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: 'var(--text-muted)' }}><Minus size={11} /> igual</span>
  const sube = valor > 0
  const bueno = invertido ? !sube : sube
  const Icon = sube ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color: bueno ? 'var(--success)' : 'var(--warning)' }}>
      <Icon size={12} /> {sube ? '+' : ''}{Math.round(valor * 10) / 10}{unidad}
    </span>
  )
}

function Sparkline({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null
  const min = Math.min(...valores), max = Math.max(...valores), rango = max - min || 1
  const pts = valores.map((v, i) => `${(i / (valores.length - 1)) * 100},${28 - ((v - min) / rango) * 24}`).join(' ')
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-8" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export type { Aviso }

export function AvisosCliente({ avisos, onTab }: { avisos: Aviso[]; onTab: (t: Tab) => void }) {
  const [abierto, setAbierto] = useState(false)
  if (avisos.length === 0) return null
  const hayAlto = avisos.some(a => a.nivel === 'alto')
  const color = hayAlto ? 'var(--error)' : 'var(--warning)'
  const cls = 'w-full flex items-start gap-2 rounded-xl px-3 py-2 text-left'
  const estilo = { background: 'var(--bg)', border: '1px solid var(--border)' }

  return (
    <div className="mb-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button type="button" onClick={() => setAbierto(v => !v)} aria-expanded={abierto} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left">
        <AlertTriangle size={14} className="flex-shrink-0" style={{ color }} />
        <span className="flex-1 min-w-0 truncate text-sm" style={{ color: 'var(--text)' }}>
          <span className="font-semibold">{avisos.length} {avisos.length === 1 ? 'aviso' : 'avisos'}</span>
          {!abierto && <span style={{ color: 'var(--text-secondary)' }}> · {avisos[0].texto}</span>}
        </span>
        <ChevronDown size={14} className="flex-shrink-0 transition-transform" style={{ color: 'var(--text-muted)', transform: abierto ? 'rotate(180deg)' : undefined }} />
      </button>
      {abierto && (
        <ul className="space-y-1.5 px-3 pb-3">
          {avisos.map((a, i) => {
            const cuerpo = (
              <>
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: a.nivel === 'alto' ? 'var(--error)' : 'var(--warning)' }} />
                <span className="flex-1 min-w-0 text-sm" style={{ color: 'var(--text)' }}>
                  {a.texto}{a.detalle && <span className="text-xs" style={{ color: 'var(--text-muted)' }}> · {a.detalle}</span>}
                </span>
                {(a.tab || a.href) && <ChevronRight size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />}
              </>
            )
            return (
              <li key={i}>
                {a.href ? <a href={a.href} className={cls} style={estilo}>{cuerpo}</a>
                  : a.tab ? <button type="button" className={cls} style={estilo} onClick={() => onTab(a.tab!)}>{cuerpo}</button>
                  : <div className={cls} style={estilo}>{cuerpo}</div>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function ResumenCliente({ cliente, checkins, seguimiento }: {
  cliente: ClienteResumen; checkins: CheckIn[]; seguimiento: SeguimientoPeso[]
}) {
  // Peso: seguimiento viene del más reciente al más antiguo
  const pesos = seguimiento.filter(s => s.peso != null).map(s => Number(s.peso)).reverse()
  const pesoActual = pesos.at(-1) ?? cliente.peso_inicial ?? null
  const pesoPrevio = pesos.length > 1 ? pesos.at(-2)! : null
  const desdeInicio = pesoActual != null && cliente.peso_inicial ? pesoActual - Number(cliente.peso_inicial) : null

  const [ult, prev] = checkins
  const metricas = ult ? ([['Adherencia', ult.adherencia, prev?.adherencia], ['Energía', ult.energia, prev?.energia], ['Sueño', ult.sueno, prev?.sueno]] as const).filter(([, v]) => v != null) : []

  return (
    <div>
      <section className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Evolución</p>
        {pesoActual == null && metricas.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aún no hay datos de peso ni de check-ins.</p>
        ) : (
          <div className="space-y-4">
            {pesoActual != null && (
              <div>
                <div className="flex items-end justify-between gap-3">
                  <p className="text-2xl font-bold font-data" style={{ color: 'var(--text)' }}>{pesoActual}<span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>kg</span></p>
                  <div className="text-right space-y-0.5">
                    {pesoPrevio != null && <div><Delta valor={pesoActual - pesoPrevio} unidad=" kg" invertido /> <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>vs anterior</span></div>}
                    {desdeInicio != null && <div><Delta valor={desdeInicio} unidad=" kg" invertido /> <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>desde inicio</span></div>}
                  </div>
                </div>
                <Sparkline valores={pesos} />
              </div>
            )}
            {metricas.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {metricas.map(([nombre, v, antes]) => (
                  <div key={nombre} className="rounded-xl p-2.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{nombre}</p>
                    <p className="text-lg font-bold font-data" style={{ color: 'var(--text)' }}>{v}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/10</span></p>
                    {antes != null && <Delta valor={Number(v) - Number(antes)} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
