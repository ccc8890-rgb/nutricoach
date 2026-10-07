import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import type { SlotComida } from '@/lib/tipos-comida'

export const FRANJAS: SlotComida[] = ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena']
// Reparto orientativo del objetivo diario por franja; se renormaliza con las franjas que tenga el plan
export const REPARTO: Record<SlotComida, number> = { 'Desayuno': 0.25, 'Media mañana': 0.1, 'Comida': 0.35, 'Merienda': 0.1, 'Cena': 0.3 }

// Franjas que corresponden a «n comidas al día» del cliente (2-5); fuera de ese rango no impone nada
export function franjasDeComidasDia(n: number | null | undefined): SlotComida[] {
  const tabla: Record<number, SlotComida[]> = {
    2: ['Comida', 'Cena'], 3: ['Desayuno', 'Comida', 'Cena'], 4: ['Desayuno', 'Comida', 'Merienda', 'Cena'], 5: [...FRANJAS],
  }
  return n != null && tabla[n] ? tabla[n] : []
}

export async function franjasDelCliente(db: SupabaseClient, clienteId: string): Promise<SlotComida[]> {
  const { data } = await db.from('clientes').select('comidas_dia').eq('id', clienteId).maybeSingle()
  return franjasDeComidasDia(data?.comidas_dia)
}

export async function repartoFranja(db: SupabaseClient, planId: string, franja: SlotComida) {
  const { data } = await db.from('comidas').select('nombre').eq('plan_id', planId)
  const franjas = new Set([...(data ?? []).map(c => c.nombre), franja].filter(f => FRANJAS.includes(f as SlotComida)))
  const total = [...franjas].reduce((s, f) => s + REPARTO[f as SlotComida], 0)
  return REPARTO[franja] / total
}

type OnboardingFiltro = {
  restricciones?: string[] | null
  tiempo_cocina_min?: number | null
  objetivo?: string | null
  dias_entreno?: number | null
  alimentos_no_gustan?: unknown
  alimentos_evitar_extra?: unknown
  alimentos_base?: string[] | null
}
type PerfilFiltro = { condiciones_salud?: string | null; alimentos_evitar_extra?: unknown } | null

const RESTRICCION_INFERIDA_POR_PALABRA: Array<[string, string]> = [
  ['lactosa', 'sin lactosa'], ['lácteos', 'sin lactosa'], ['gluten', 'sin gluten'], ['celiac', 'sin gluten'],
  ['marisco', 'sin mariscos'], ['crustáceo', 'sin mariscos'],
]

// Mismo criterio que `generar-plan-inicial` (secciones 9b): evitar = 3 fuentes combinadas, y las
// restricciones clínicas en texto libre se traducen a la restricción estructurada equivalente.
export function construirFiltroCliente(onboarding: OnboardingFiltro, perfil: PerfilFiltro) {
  const aEvitar = [onboarding.alimentos_evitar_extra, perfil?.alimentos_evitar_extra, onboarding.alimentos_no_gustan]
    .flatMap(v => Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? v.split(',') : [])
    .map(s => String(s).trim())
    .filter(Boolean)
  const texto = [aEvitar.join(' '), perfil?.condiciones_salud ?? ''].join(' ').toLowerCase()
  const inferidas = RESTRICCION_INFERIDA_POR_PALABRA.filter(([p]) => texto.includes(p)).map(([, r]) => r)
  const condicion = (perfil?.condiciones_salud ?? '').toLowerCase()
  const restricciones = [...new Set([...(onboarding.restricciones ?? []), ...inferidas])]
  return {
    filtroCliente: {
      restricciones,
      alimentos_evitar_extra: aEvitar,
      tiempo_cocina_min: onboarding.tiempo_cocina_min,
      alimentos_base: onboarding.alimentos_base ?? null,
      condiciones_salud: perfil?.condiciones_salud ?? null,
    },
    tagsClinicos: {
      ...((condicion.includes('sop') || (onboarding.restricciones ?? []).includes('sop')) && { apto_sop: true as const }),
      ...((condicion.includes('hashimoto') || condicion.includes('hipotiroidismo')) && { apto_hashimoto: true as const }),
      ...((onboarding.objetivo === 'rendimiento' || (onboarding.dias_entreno ?? 0) >= 4) && { apto_rendimiento: true as const }),
    },
  }
}

export async function autorizarSemanaDieta(request: NextRequest, clienteId: string) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const admin = createServiceSupabase()
  const auth = await autorizarCoachCliente(admin, { userId: user.id, clienteId })
  if (!auth.ok) return { error: NextResponse.json({ error: auth.mensaje }, { status: auth.status }) }
  const { data: plan } = await admin.from('planes_nutricion')
    .select('id, nombre, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo')
    .eq('cliente_id', clienteId).eq('activo', true).maybeSingle()
  return { admin, plan }
}
