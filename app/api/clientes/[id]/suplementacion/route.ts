import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { faseEnFecha } from '@/lib/nutricion/competicion'
import { DIAS_SEMANA } from '@/lib/nutricion/comidas-dia'
import { clasificarDiaNutricional } from '@/lib/periodizacion/dia-entreno-nutricion'
import { recomendarSuplementos, type ContextoSuplementos, type Recomendacion } from '@/lib/nutricion/suplementos'

type Ambito = 'sesion' | 'diaria' | 'carrera'
type Estado = 'propuesta' | 'aprobada' | 'descartada'
type Decision = { suplemento_id: string; ambito: Ambito; estado: Estado; dosis?: string; timing?: string; notas?: string }
type DecisionGuardada = { suplemento_id: string; ambito: Ambito; estado: Estado; dosis: string | null; timing: string | null; notas: string | null }

function esDecision(body: unknown): body is Decision {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  const datos = body as Record<string, unknown>
  return typeof datos.suplemento_id === 'string' && datos.suplemento_id.trim().length > 0 && datos.suplemento_id.length <= 300
    && ['sesion', 'diaria', 'carrera'].includes(datos.ambito as string)
    && ['propuesta', 'aprobada', 'descartada'].includes(datos.estado as string)
    && ['dosis', 'timing', 'notas'].every(campo => datos[campo] === undefined || (typeof datos[campo] === 'string' && datos[campo].length <= 300))
}

// Analítica del onboarding (analisis_valores: { vitamina_d, ferritina } en ng/mL); solo valores numéricos válidos
function analiticaDe(valores: unknown): ContextoSuplementos['analitica'] {
  if (!valores || typeof valores !== 'object') return undefined
  const v = valores as Record<string, unknown>
  const num = (x: unknown) => { const n = typeof x === 'string' ? Number(x.replace(',', '.')) : typeof x === 'number' ? x : NaN; return Number.isFinite(n) && n > 0 ? n : undefined }
  const vitamina_d_ngml = num(v.vitamina_d)
  const ferritina_ngml = num(v.ferritina)
  return vitamina_d_ngml === undefined && ferritina_ngml === undefined ? undefined : { vitamina_d_ngml, ferritina_ngml }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { data: { user }, error: authError } = await createApiSupabase(request).auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const db = createServiceSupabase()
    const acceso = await autorizarCoachCliente(db, { userId: user.id, clienteId: id })
    if (!acceso.ok) return NextResponse.json({ error: acceso.mensaje }, { status: acceso.status })

    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const limite = new Date(`${hoy}T00:00:00Z`)
    limite.setUTCDate(limite.getUTCDate() - 10)
    const [clienteRes, pesoRes, competicionRes, planRes, onboardingRes] = await Promise.all([
      db.from('clientes').select('objetivo,peso_inicial,edad,sexo').eq('id', id).single(),
      db.from('checkins').select('peso').eq('cliente_id', id).not('peso', 'is', null).order('fecha', { ascending: false }).limit(1).maybeSingle(),
      db.from('competiciones').select('disciplina,fecha_competicion,tiempo_objetivo_min').eq('cliente_id', id).eq('activo', true).gte('fecha_competicion', limite.toISOString().slice(0, 10)).order('fecha_competicion', { ascending: true }).limit(1).maybeSingle(),
      db.from('planes_entrenamiento').select('id').eq('cliente_id', id).eq('activo', true).limit(1).maybeSingle(),
      db.from('onboarding_perfil_profundo').select('hora_entreno,condiciones_salud,analisis_valores').eq('cliente_id', id).maybeSingle(),
    ])
    if (clienteRes.error || pesoRes.error || competicionRes.error || planRes.error || onboardingRes.error || !clienteRes.data) throw new Error('Error al consultar contexto de suplementacion')
    const peso = Number(pesoRes.data?.peso ?? clienteRes.data.peso_inicial)
    if (!Number.isFinite(peso) || peso <= 0) return NextResponse.json({ error: 'Falta un peso valido para calcular las dosis' }, { status: 422 })

    const dia = DIAS_SEMANA[(new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7]
    const sesionesRes = planRes.data
      ? await db.from('sesiones_entrenamiento').select('nombre,duracion_estimada_min').eq('plan_id', planRes.data.id).eq('dia_semana', dia)
      : null
    if (sesionesRes?.error) throw new Error('Error al consultar sesiones')
    const prioridad = { entreno_hibrido: 3, entreno_cardio: 2, entreno_fuerza: 1, descanso_activo: 0, descanso_total: 0 }
    const sesion = (sesionesRes?.data ?? []).slice().sort((a, b) => {
      const tipoA = clasificarDiaNutricional(a.nombre, true)
      const tipoB = clasificarDiaNutricional(b.nombre, true)
      return prioridad[tipoB] - prioridad[tipoA] || (b.duracion_estimada_min ?? 0) - (a.duracion_estimada_min ?? 0)
    })[0]
    const tipo = sesion ? clasificarDiaNutricional(sesion.nombre, true) : null
    const sexo = clienteRes.data.sexo
    const ctx: ContextoSuplementos = {
      peso_kg: peso,
      ...(sexo === 'hombre' || sexo === 'mujer' || sexo === 'otro' ? { sexo } : {}),
      edad: clienteRes.data.edad ?? undefined,
      objetivo: clienteRes.data.objetivo ?? undefined,
      disciplina: competicionRes.data?.disciplina ?? undefined,
      duracion_prueba_min: competicionRes.data?.tiempo_objetivo_min ?? undefined,
      fase_competicion: competicionRes.data ? faseEnFecha(competicionRes.data.fecha_competicion, hoy, competicionRes.data.disciplina) : undefined,
      duracion_min: sesion?.duracion_estimada_min ?? undefined,
      tipo_sesion: tipo === 'entreno_hibrido' ? 'hibrido' : tipo === 'entreno_cardio' ? 'cardio' : tipo === 'entreno_fuerza' ? 'fuerza' : undefined,
      hora_inicio: onboardingRes.data?.hora_entreno ?? undefined,
      condiciones: onboardingRes.data?.condiciones_salud ? [onboardingRes.data.condiciones_salud] : undefined,
      analitica: analiticaDe(onboardingRes.data?.analisis_valores),
    }
    const guardadasRes = await db.from('suplementacion_cliente')
      .select('suplemento_id,ambito,estado,dosis,timing,notas').eq('cliente_id', id)
    if (guardadasRes.error) throw new Error('Error al consultar decisiones de suplementacion')
    const guardadas = new Map((guardadasRes.data as DecisionGuardada[]).map(fila => [`${fila.ambito}:${fila.suplemento_id}`, fila]))
    const propuestas = recomendarSuplementos(ctx)
    const fusionar = (ambito: Ambito, recomendaciones: Recomendacion[]) => recomendaciones.map(recomendacion => {
      const guardada = guardadas.get(`${ambito}:${recomendacion.id}`)
      return {
        ...recomendacion,
        estado: guardada?.estado ?? 'propuesta',
        notas: guardada?.notas ?? null,
        dosis: guardada?.dosis ?? recomendacion.dosis,
        timing: guardada?.timing ?? recomendacion.timing,
      }
    })
    return NextResponse.json({
      sesion: fusionar('sesion', propuestas.sesion),
      diaria: fusionar('diaria', propuestas.diaria),
      carrera: fusionar('carrera', propuestas.carrera),
      avisos: propuestas.avisos,
      ctx,
    })
  } catch (error) {
    console.error('Error GET /api/clientes/[id]/suplementacion:', error)
    return NextResponse.json({ error: 'Error al obtener suplementacion' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { data: { user }, error: authError } = await createApiSupabase(request).auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const db = createServiceSupabase()
    const acceso = await autorizarCoachCliente(db, { userId: user.id, clienteId: id })
    if (!acceso.ok) return NextResponse.json({ error: acceso.mensaje }, { status: acceso.status })

    const body: unknown = await request.json().catch(() => null)
    if (!esDecision(body)) return NextResponse.json({ error: 'Datos de suplementacion invalidos' }, { status: 400 })
    const { suplemento_id, ambito, estado, dosis, timing, notas } = body
    const { data, error } = await db.from('suplementacion_cliente').upsert({
      cliente_id: id,
      suplemento_id,
      ambito,
      estado,
      ...(dosis !== undefined ? { dosis } : {}),
      ...(timing !== undefined ? { timing } : {}),
      ...(notas !== undefined ? { notas } : {}),
      decidido_por: estado === 'propuesta' ? null : user.id,
      decidido_at: estado === 'propuesta' ? null : new Date().toISOString(),
    }, { onConflict: 'cliente_id,suplemento_id,ambito' }).select('suplemento_id,ambito,estado,dosis,timing,notas').single()
    if (error) throw new Error('Error al guardar decision de suplementacion')
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error PATCH /api/clientes/[id]/suplementacion:', error)
    return NextResponse.json({ error: 'Error al guardar suplementacion' }, { status: 500 })
  }
}
