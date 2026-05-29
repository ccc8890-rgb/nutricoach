import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { getSummaryLast7d } from '@/lib/integraciones/normalizer'

const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions'

async function generarTextoDeepSeek(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

  const res = await fetch(DEEPSEEK_API, {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content: 'Eres el asistente de un coach de fitness de alto rendimiento. Generas textos de contexto cortos, directos y motivantes para atletas. Sin emojis. Máximo 3 frases.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!res.ok) throw new Error(`DeepSeek error ${res.status}`)
  const data = await res.json()
  return (data.choices?.[0]?.message?.content ?? '').trim()
}

export async function POST(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let body: { sesion_id: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { sesion_id } = body
  if (!sesion_id) return NextResponse.json({ error: 'sesion_id requerido' }, { status: 400 })

  const admin = createServiceSupabase()

  const { data: sesion } = await admin
    .from('sesiones_entrenamiento')
    .select(`
      id, nombre, instruccion_coach, dia_semana,
      plan:planes_entrenamiento!inner(cliente_id, nombre),
      ejercicios:sesion_ejercicios(
        id, instruccion_ejercicio,
        ejercicio:ejercicios(nombre, grupo_muscular, tipo)
      )
    `)
    .eq('id', sesion_id)
    .single()

  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  const plan = Array.isArray(sesion.plan) ? sesion.plan[0] : sesion.plan
  const cliente_id: string = (plan as { cliente_id: string }).cliente_id

  const { data: perfil } = await admin
    .from('perfil_entreno_cliente')
    .select('sport_modality, objetivo_especifico, patron_lesiones, rm_sentadilla_kg, rm_banca_kg, ftp_watts, vo2max_estimado')
    .eq('cliente_id', cliente_id)
    .single()

  let actividadStr = ''
  try {
    const actividad = await getSummaryLast7d(admin, cliente_id)
    if (actividad?.tiene_datos) {
      const bb = actividad.body_battery_media !== null ? `Body Battery ${actividad.body_battery_media.toFixed(0)}/100` : null
      const tr = actividad.training_readiness_media !== null ? `Training Readiness ${actividad.training_readiness_media.toFixed(0)}/100` : null
      if (bb || tr) actividadStr = [bb, tr].filter(Boolean).join(', ')
    }
  } catch { /* sin datos wearable */ }

  const modalidad = perfil?.sport_modality ?? 'fitness'
  const objetivo = perfil?.objetivo_especifico ?? ''
  const lesiones = Array.isArray(perfil?.patron_lesiones) && perfil.patron_lesiones.length > 0
    ? `Lesiones previas: ${perfil.patron_lesiones.map((l: { zona: string }) => l.zona).join(', ')}.`
    : ''
  const atletaCtx = [
    `Modalidad: ${modalidad}.`,
    objetivo ? `Objetivo: ${objetivo}.` : '',
    lesiones,
    actividadStr ? `Estado hoy — ${actividadStr}.` : '',
  ].filter(Boolean).join(' ')

  type EjercicioSesionRaw = {
    id: string
    instruccion_ejercicio: string | null
    ejercicio: { nombre: string; grupo_muscular: string; tipo: string } | null
  }
  const ejerciciosRaw = (sesion.ejercicios ?? []) as unknown as EjercicioSesionRaw[]

  const notaCoach = sesion.instruccion_coach ?? ''
  const ejerciciosLista = ejerciciosRaw
    .map(e => e.ejercicio?.nombre ?? '')
    .filter(Boolean)
    .join(', ')

  const promptSesion = `
Atleta: ${atletaCtx}
Sesión: "${sesion.nombre}" (${sesion.dia_semana ?? 'día libre'}).
Ejercicios: ${ejerciciosLista}.
${notaCoach ? `Intención del coach: "${notaCoach}".` : ''}
Genera el contexto de la sesión: qué busca esta sesión, por qué estos ejercicios hoy, qué actitud tener. Máximo 2-3 frases. Sin emojis.`

  let contextoSesion = ''
  try {
    contextoSesion = await generarTextoDeepSeek(promptSesion)
  } catch (err) {
    console.error('[generar-contexto] sesión error:', err)
  }

  const contextosEjercicios: Array<{ id: string; contexto: string }> = []

  for (const ej of ejerciciosRaw) {
    if (!ej.ejercicio) continue
    const promptEj = `
Atleta: ${atletaCtx}
Ejercicio: "${ej.ejercicio.nombre}" (${ej.ejercicio.grupo_muscular}, ${ej.ejercicio.tipo}).
${ej.instruccion_ejercicio ? `Nota del coach: "${ej.instruccion_ejercicio}".` : ''}
Genera 1-2 frases explicando qué busca este ejercicio específicamente para este atleta. Sin emojis.`

    try {
      const texto = await generarTextoDeepSeek(promptEj)
      contextosEjercicios.push({ id: ej.id, contexto: texto })
    } catch {
      // skip this exercise
    }
  }

  if (contextoSesion) {
    await admin
      .from('sesiones_entrenamiento')
      .update({ contexto_ia: contextoSesion })
      .eq('id', sesion_id)
  }

  for (const { id, contexto } of contextosEjercicios) {
    await admin
      .from('sesion_ejercicios')
      .update({ contexto_ia: contexto })
      .eq('id', id)
  }

  return NextResponse.json({
    ok: true,
    contexto_sesion: contextoSesion,
    contextos_ejercicios: contextosEjercicios,
  })
}
