import type { SupabaseClient } from '@supabase/supabase-js'
import { indiceDiaDesdeTexto } from '@/lib/nutricion/comidas-dia'
import {
  calcularGapMicronutrientes, crearTotalesMicronutrientes, seleccionarMicronutrientesPrioritarios,
  type PerfilMicronutrientes, type TotalesMicronutrientes,
} from './gap-report'

type Micros = Partial<Record<'fibra' | 'azucares' | 'azucares_anyadidos' | 'sodio_mg' | 'calcio_mg' | 'hierro_mg' | 'magnesio_mg' | 'potasio_mg' | 'zinc_mg' | 'vitamina_d_ug' | 'vitamina_b12_ug' | 'saturados_g', number | null>>
export type ComidaMicros = { dia_semana?: string | null; comida_alimentos: { cantidad_gramos: number | null; alimento: Micros | null }[] | null }

const CAMPOS: [keyof TotalesMicronutrientes, keyof Micros][] = [
  ['fibra_g', 'fibra'], ['azucares_g', 'azucares'], ['azucares_anyadidos_g', 'azucares_anyadidos'], ['sodio_mg', 'sodio_mg'],
  ['calcio_mg', 'calcio_mg'], ['hierro_mg', 'hierro_mg'], ['magnesio_mg', 'magnesio_mg'], ['potasio_mg', 'potasio_mg'],
  ['zinc_mg', 'zinc_mg'], ['vitamina_d_ug', 'vitamina_d_ug'], ['vitamina_b12_ug', 'vitamina_b12_ug'], ['saturados_g', 'saturados_g'],
]

function sumar(destino: TotalesMicronutrientes, c: ComidaMicros) {
  for (const it of c.comida_alimentos ?? []) {
    if (!it.alimento) continue
    const factor = (it.cantidad_gramos ?? 0) / 100
    for (const [k, campo] of CAMPOS) destino[k] += (it.alimento[campo] ?? 0) * factor
  }
}

/**
 * Media DIARIA de micronutrientes del plan (los objetivos son diarios). Una comida sin día es recurrente y
 * cuenta en todos los días; la media se hace sobre los días que tienen comidas propias (o 1 si todo es recurrente).
 */
export function totalesDiariosMedios(comidas: ComidaMicros[]): TotalesMicronutrientes {
  const recurrentes = comidas.filter(c => !c.dia_semana?.trim())
  const porDia = new Map<number, ComidaMicros[]>()
  for (const c of comidas) {
    const i = indiceDiaDesdeTexto(c.dia_semana)
    if (i !== null) porDia.set(i, [...(porDia.get(i) ?? []), c])
  }
  const dias = porDia.size > 0 ? [...porDia.values()] : recurrentes.length > 0 ? [[]] : []
  const total = crearTotalesMicronutrientes()
  for (const delDia of dias) {
    const dia = crearTotalesMicronutrientes()
    for (const c of [...recurrentes, ...delDia]) sumar(dia, c)
    for (const [k] of CAMPOS) total[k] += dia[k]
  }
  if (dias.length > 1) for (const [k] of CAMPOS) total[k] /= dias.length
  return total
}

const SELECT_COMIDAS = 'dia_semana, comida_alimentos(cantidad_gramos, alimento:alimentos(fibra, azucares, azucares_anyadidos, sodio_mg, calcio_mg, hierro_mg, magnesio_mg, potasio_mg, zinc_mg, vitamina_d_ug, vitamina_b12_ug, saturados_g))'

/** Informe de micronutrientes de un plan, con el perfil del cliente (sexo, edad, objetivo, condiciones). */
export async function informeMicronutrientesPlan(db: SupabaseClient, plan: { id: string; nombre: string; cliente_id: string | null }) {
  let perfil: PerfilMicronutrientes | undefined
  if (plan.cliente_id) {
    const { data: c } = await db.from('clientes').select('sexo, edad, objetivo, restricciones_alimentarias').eq('id', plan.cliente_id).single()
    if (c) perfil = { sexo: c.sexo, edad: c.edad, objetivo: c.objetivo, condiciones: c.restricciones_alimentarias ? [c.restricciones_alimentarias] : null }
  }
  const { data: comidas } = await db.from('comidas').select(SELECT_COMIDAS).eq('plan_id', plan.id)
  const totales = totalesDiariosMedios((comidas ?? []) as unknown as ComidaMicros[])
  const nutrientes = calcularGapMicronutrientes(totales, perfil)
  const ok = nutrientes.filter(n => n.estado === 'ok').length
  return {
    plan_id: plan.id,
    plan_nombre: plan.nombre,
    totales,
    nutrientes,
    prioritarios: seleccionarMicronutrientesPrioritarios(nutrientes),
    perfil_aplicado: perfil ?? null,
    resumen: { ok, revisar: nutrientes.length - ok, score: Math.round((ok / nutrientes.length) * 100) },
  }
}
