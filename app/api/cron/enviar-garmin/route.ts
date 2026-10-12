import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { registrarCron } from '@/lib/sistema/registrar-cron'
import { enviarSesionAGarmin, ErrorGarmin } from '@/lib/integraciones/garmin-workouts'
import { zonasFcDesde } from '@/lib/entrenos/zonas-fc'
import { leerUmbrales } from '@/lib/rendimiento/garmin-entrenos'
import { finHorizonteEnvio, huellaPasos, planearEnvioGarmin } from '@/lib/entrenos/garmin-auto'
import { ocurrenciasDelDia, sumarDias, type Ajuste } from '@/lib/entrenos/calendario-ajustes'
import { plantillaActivaEn } from '@/lib/entrenos/ventana-plan'
import { semanaDeFecha } from '@/lib/entrenos/sesion-semana'
import { pasosDeLaSemana } from '@/lib/entrenos/progresion-semanal'
import { comprobarCoherenciaPlan } from '@/lib/entrenos/coherencia-plan'

export const maxDuration = 300

function fechaLocalISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Máximo de entrenos enviados por pasada, para no saturar Garmin ni agotar el tiempo. */
const MAX_ENVIOS = 30

function autorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7) === secreto
  return req.headers.get('x-cron-secret') === secreto
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceSupabase()
  const resumen = { clientes: 0, enviados: 0, al_dia: 0, limpiados: 0, errores: [] as string[] }

  const { data: conexiones } = await db
    .from('integraciones_cliente')
    .select('cliente_id')
    .eq('proveedor', 'garmin_connect')
    .eq('activa', true)

  for (const { cliente_id: clienteId } of conexiones ?? []) {
    if (resumen.enviados >= MAX_ENVIOS) break
    resumen.clientes++

    const { data: planes } = await db.from('planes_entrenamiento').select('id, created_at, duracion_semanas, progresion').eq('cliente_id', clienteId).eq('activo', true)
    const planIds = (planes ?? []).map(p => p.id as string)
    if (!planIds.length) continue

    const { data: perfil } = await db.from('perfil_entreno_cliente').select('vdot').eq('cliente_id', clienteId).maybeSingle()
    const vdot = perfil?.vdot ? Number(perfil.vdot) : null
    const techoFcE = zonasFcDesde(await leerUmbrales(db, clienteId))?.E?.max ?? null

    const { data: sesiones } = await db
      .from('sesiones_entrenamiento')
      .select('id, plan_id, nombre, dia_semana, pasos, garmin_workout_id, garmin_programado_fecha, garmin_fechas, garmin_pasos_hash, garmin_variantes')
      .in('plan_id', planIds)
      .not('pasos', 'is', null)

    // Sesiones que el coach movió o quitó en una fecha concreta del calendario: el envío sigue su fecha real.
    const { data: ajustesBD } = await db
      .from('calendario_entreno_ajustes')
      .select('id, sesion_id, tipo, fecha_origen, fecha')
      .in('plan_id', planIds)
    const ajustes = (ajustesBD ?? []) as Ajuste[]
    const hoy = fechaLocalISO()

    const fin = finHorizonteEnvio(hoy)
    const dias: string[] = []
    for (let f = hoy; f <= fin; f = sumarDias(f, 1)) dias.push(f)

    // Guardia diaria: lista de ejercicios, pasos del reloj y rondas de cada semana del bloque tienen que coincidir. Si no, el cron queda en error y se ve en «Estado del sistema».
    for (const plan of (planes ?? []).filter(p => p.progresion)) {
      const delPlan = (sesiones ?? []).filter(x => x.plan_id === plan.id)
      if (!delPlan.length) continue
      const { data: ejs } = await db.from('sesion_ejercicios').select('sesion_id, orden, bloque, series, repeticiones, peso_sugerido, encadenado, ejercicio:ejercicios(nombre, tipo)').in('sesion_id', delPlan.map(x => x.id))
      const porSesion = new Map<string, unknown[]>()
      for (const e of ejs ?? []) porSesion.set(e.sesion_id as string, [...(porSesion.get(e.sesion_id as string) ?? []), e])
      const problemas = comprobarCoherenciaPlan(plan as never, delPlan.map(x => ({ nombre: x.nombre, pasos: x.pasos, ejercicios: (porSesion.get(x.id) ?? []) as never })))
      for (const m of problemas.slice(0, 3)) resumen.errores.push(`coherencia: ${m}`)
    }

    for (const s of sesiones ?? []) {
      if (resumen.enviados >= MAX_ENVIOS) break
      // Fechas reales de la sesión: plantilla semanal dentro del bloque + lo movido, copiado o quitado en el calendario.
      const plan = (planes ?? []).find(p => p.id === s.plan_id)
      const activa = plan ? plantillaActivaEn(plan.created_at, plan.duracion_semanas as number | null) : () => true
      const delPlan = (sesiones ?? []).filter(x => x.plan_id === s.plan_id)
      const deseadas = dias.filter(f => ocurrenciasDelDia(f, delPlan, ajustes, activa(f)).some(o => o.sesion.id === s.id))
      const prog = plan ? semanaDeFecha(plan, hoy).prog : null
      // Con progresión semanal cada semana del bloque tiene sus pasos: un entreno de Garmin por (sesión, semana). Sin progresión, un solo entreno como siempre.
      if (!prog) {
        const decision = planearEnvioGarmin({ ...s, garmin_fechas: Array.isArray(s.garmin_fechas) ? s.garmin_fechas : [] }, huellaPasos(s.pasos, vdot, techoFcE), deseadas, hoy)
        if (decision.accion === 'nada') { resumen.al_dia++; continue }
        try {
          await enviarSesionAGarmin(db, s.id, undefined, { modo: decision.accion, fechas: decision.accion === 'borrar' ? [] : decision.fechas })
          resumen.enviados++
        } catch (e) {
          resumen.errores.push(`${s.nombre}: ${e instanceof ErrorGarmin ? e.mensaje : 'error inesperado'}`)
        }
        continue
      }
      const porSemana = new Map<number, string[]>()
      for (const f of deseadas) {
        const n = semanaDeFecha(plan!, f).n
        if (n) porSemana.set(n, [...(porSemana.get(n) ?? []), f])
      }
      const variantes = (s.garmin_variantes && typeof s.garmin_variantes === 'object' ? s.garmin_variantes : {}) as Record<string, { workout_id: string | null; fechas: string[]; hash: string | null }>
      // Entreno antiguo de la plantilla (antes de la progresión): se quita una vez.
      const trabajos: { modo: 'recrear' | 'anadir' | 'borrar'; fechas: string[]; variante?: { n: number; pasos: unknown } }[] = []
      if (s.garmin_workout_id) trabajos.push({ modo: 'borrar', fechas: [] })
      for (const [n, fechas] of porSemana) {
        const pasosN = pasosDeLaSemana(s.pasos, s.nombre, prog, n)
        if (!pasosN) continue
        const v = variantes[String(n)]
        const d = planearEnvioGarmin({ garmin_workout_id: v?.workout_id ?? null, garmin_programado_fecha: null, garmin_fechas: v?.fechas ?? [], garmin_pasos_hash: v?.hash ?? null }, huellaPasos(pasosN, vdot, techoFcE), fechas, hoy)
        if (d.accion === 'recrear' || d.accion === 'anadir') trabajos.push({ modo: d.accion, fechas: d.fechas, variante: { n, pasos: pasosN } })
      }
      // Semanas que ya no tienen fechas por delante: se quitan de Garmin.
      for (const [k, v] of Object.entries(variantes)) {
        if (v?.workout_id && !porSemana.has(Number(k))) trabajos.push({ modo: 'borrar', fechas: [], variante: { n: Number(k), pasos: s.pasos } })
      }
      if (!trabajos.length) { resumen.al_dia++; continue }
      for (const t of trabajos) {
        try {
          await enviarSesionAGarmin(db, s.id, undefined, t)
          resumen.enviados++
        } catch (e) {
          resumen.errores.push(`${s.nombre}${t.variante ? ` S${t.variante.n}` : ''}: ${e instanceof ErrorGarmin ? e.mensaje : 'error inesperado'}`)
        }
      }
    }

    // Entrenos de planes que ya no están activos (el coach cambió de plan): se quitan de Garmin para que no queden pasados ni repetidos.
    const { data: inactivos } = await db.from('planes_entrenamiento').select('id').eq('cliente_id', clienteId).eq('activo', false)
    const idsInactivos = (inactivos ?? []).map(p => p.id as string)
    if (idsInactivos.length) {
      const { data: viejas } = await db.from('sesiones_entrenamiento').select('id, nombre').in('plan_id', idsInactivos).not('garmin_workout_id', 'is', null).limit(MAX_ENVIOS)
      for (const v of viejas ?? []) {
        try {
          await enviarSesionAGarmin(db, v.id, undefined, { modo: 'borrar', fechas: [] })
          resumen.limpiados++
        } catch (e) {
          resumen.errores.push(`limpiar ${v.nombre}: ${e instanceof ErrorGarmin ? e.mensaje : 'error inesperado'}`)
        }
      }
    }
  }

  await registrarCron(db, 'enviar-garmin', resumen.errores.length, `${resumen.enviados} enviadas${resumen.limpiados ? `, ${resumen.limpiados} antiguas quitadas` : ''}${resumen.errores.length ? `; ${resumen.errores[0]}` : ''}`)
  return NextResponse.json(resumen)
}
