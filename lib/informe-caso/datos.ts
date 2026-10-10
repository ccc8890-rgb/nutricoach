// lib/informe-caso/datos.ts
// Reúne, solo en lectura, lo que necesita el informe del caso. Lo que no existe queda en null: nunca se rellena con ceros.
import type { SupabaseClient } from '@supabase/supabase-js'
import { construirContextoRendimiento } from '@/lib/rendimiento/contexto'
import type { EstadoAtleta } from '@/lib/rendimiento/estado'
import type { AlertaRendimiento } from '@/lib/rendimiento/alertas'
import { calcularEstadoBloque } from '@/lib/entrenos/bloques'
import type { PayloadPlanEntrenoIA } from '@/lib/entrenos/planificar-con-ia'
import type { DatosInforme } from './construir'

/** Un análisis de hace más tiempo ya no describe al atleta: no manda en el informe. */
export const DIAS_ANALISIS_VIGENTE = 14
export const desdeAnalisisVigente = (hoy: Date): string => new Date(hoy.getTime() - DIAS_ANALISIS_VIGENTE * 86_400_000).toISOString()

export function atletaDesdeEstado(e: EstadoAtleta, alertas: AlertaRendimiento[], hayDatos: boolean): DatosInforme['atleta'] {
  // «Evaluadas» son las sesiones de calidad hechas con ritmos que se pueden medir; «saltadas», las previstas que no se hicieron.
  const hechas = e.ejecucion?.sesionesHechas ?? e.ejecucion?.sesionesEvaluadas ?? 0
  const previstas = e.ejecucion?.sesionesPrevistas ?? hechas + (e.ejecucion?.sesionesSaltadas ?? 0)
  return {
    hayDatos,
    minutosCarreraSemana: e.minutosCarreraPorSemana > 0 ? e.minutosCarreraPorSemana : null,
    salidasSemana: e.carrerasPorSemana > 0 ? e.carrerasPorSemana : null,
    pctSuave: e.intensidad && e.intensidad.valoracion !== 'sin_datos' ? e.intensidad.pctSuave : null,
    forma: e.carga ? Math.round(e.carga.ctl * 10) / 10 : null,
    fatiga: e.carga ? Math.round(e.carga.atl * 10) / 10 : null,
    frescura: e.carga ? Math.round(e.carga.tsb * 10) / 10 : null,
    sesionesConRitmoPrevistas: previstas > 0 ? previstas : null,
    sesionesConRitmoHechas: previstas > 0 ? hechas : null,
    retorno: !!e.retorno,
    vdot: e.vdot ?? null,
    fuerzaRegistrada: e.fuerza28d ?? 0,
    fuerzaEnPlan: e.fuerzaEnPlan ?? 0,
    alertasAltas: alertas.filter(a => a.gravedad === 'alta').map(a => a.texto),
  }
}

export async function reunirDatosInforme(db: SupabaseClient, clienteId: string, hoy: Date = new Date()): Promise<DatosInforme | null> {
  const { data: cli } = await db.from('clientes').select('id, profiles:profiles!profile_id(nombre, apellidos)').eq('id', clienteId).maybeSingle()
  if (!cli) return null
  const perfil = (cli as { profiles?: { nombre?: string; apellidos?: string } | null }).profiles
  const nombre = `${perfil?.nombre ?? ''} ${perfil?.apellidos ?? ''}`.trim()

  const ctx = await construirContextoRendimiento(db, clienteId, hoy.toISOString().slice(0, 10))

  const { data: plan } = await db.from('planes_entrenamiento').select('nombre, created_at, duracion_semanas').eq('cliente_id', clienteId).eq('activo', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
  let planInfo: DatosInforme['plan'] = null
  if (plan) {
    const b = plan.duracion_semanas ? calcularEstadoBloque(plan.created_at as string, plan.duracion_semanas as number, hoy) : null
    planInfo = { nombre: plan.nombre as string, semanaActual: b?.semanaActual ?? null, semanasTotales: b?.semanasTotales ?? null, diasRestantes: b?.diasRestantes ?? null }
  }

  const { data: an } = await db.from('agente_tareas').select('payload').eq('cliente_id', clienteId).eq('tipo', 'analisis_rendimiento').in('estado', ['pendiente', 'en_revision', 'aprobado', 'aplicado', 'modificado']).gte('created_at', desdeAnalisisVigente(hoy)).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const { data: pr } = await db.from('agente_tareas').select('payload').eq('cliente_id', clienteId).eq('tipo', 'plan_entreno_ia').in('estado', ['pendiente', 'en_revision']).order('created_at', { ascending: false }).limit(1).maybeSingle()

  return {
    nombre,
    atleta: atletaDesdeEstado(ctx.estado, ctx.alertas, ctx.hayDatos),
    plan: planInfo,
    analisis: (an?.payload as DatosInforme['analisis']) ?? null,
    propuesta: (pr?.payload as PayloadPlanEntrenoIA) ?? null,
  }
}
