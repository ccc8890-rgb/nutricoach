// ================================================================
// AGENTE DE MOTIVACIÓN SEMANAL
// Genera un mensaje motivacional personalizado para el cliente
// basado en los últimos checkins y su objetivo.
// ================================================================

import { createServiceSupabase } from '@/lib/supabase-server'
import { llamarGemini, cargarContextoCliente, guardarTareaAgente } from './executor'
import type { TipoAgente, ResultadoAgente, FuenteCientifica } from './types'

// ── Semana actual (lunes 00:00) ───────────────────────────────
function obtenerLunesSemana(): Date {
  const ahora = new Date()
  const dia = ahora.getDay() // 0=domingo, 1=lunes...
  const diff = dia === 0 ? 6 : dia - 1 // días desde lunes
  const lunes = new Date(ahora)
  lunes.setDate(ahora.getDate() - diff)
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

// ── Número de semana ISO ──────────────────────────────────────
function obtenerNumeroSemana(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// ── Entry point ───────────────────────────────────────────────
export async function ejecutarAgenteMotivacion(clienteId: string): Promise<void> {
  const db = createServiceSupabase()
  const lunes = obtenerLunesSemana()

  // 1. Verificar si ya hay tarea de motivación esta semana
  const { count: tareasExistentes } = await db
    .from('agente_tareas')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('tipo', 'mensaje_motivacion')
    .gte('created_at', lunes.toISOString())

  if (tareasExistentes && tareasExistentes > 0) {
    // Ya se generó un mensaje esta semana
    return
  }

  // 2. Cargar contexto del cliente
  const contexto = await cargarContextoCliente(clienteId)
  if (!contexto) return

  const { cliente, checkins_recientes } = contexto

  // 3. Preparar datos para el prompt
  const objetivo = cliente.objetivo ?? 'mejorar su composición corporal'
  const ultimosCheckins = checkins_recientes.slice(0, 4)

  const checkinsTexto = ultimosCheckins
    .map(
      (c: { fecha_checkin: string; peso_kg?: number | null; adherencia_dieta?: number | null; nivel_energia?: number | null; calidad_sueno?: number | null; notas_cliente?: string | null }, i: number) =>
        `Checkin ${i + 1}: fecha=${c.fecha_checkin}, peso=${c.peso_kg ?? 'N/A'} kg, adherencia=${c.adherencia_dieta ?? 'N/A'}/10, energía=${c.nivel_energia ?? 'N/A'}/10, sueño=${c.calidad_sueno ?? 'N/A'}/10, notas="${c.notas_cliente ?? ''}"`
    )
    .join('\n')

  const userPrompt = `Cliente: ${cliente.nombre ?? ''} ${cliente.apellidos ?? ''}
Objetivo: ${objetivo}
Últimos checkins:
${checkinsTexto}

Genera un mensaje motivacional personalizado (máximo 3 frases) que:
- Mencione un logro concreto de la semana basado en los checkins
- Conecte con el objetivo del cliente
- Motive para la siguiente semana

Responde en JSON con los campos: propuesta (string), logros_detectados (array de strings), razonamiento (string).`

  const systemPrompt = `Eres el asistente de motivación de un coach de nutrición español. Generas mensajes de ánimo PERSONALES y CONCRETOS para clientes. Máximo 3 frases. Tono cálido, directo, sin clichés. Nunca uses frases genéricas como ¡Sigue así! sin contexto. Siempre menciona algo específico del progreso del cliente. Responde en JSON: {propuesta, logros_detectados, razonamiento}`

  // 4. Llamar a Gemini
  let respuestaRaw: string
  try {
    respuestaRaw = await llamarGemini(
      `${systemPrompt}\n\n${userPrompt}`,
      0.4
    )
  } catch {
    // Si falla la IA, no generamos nada
    return
  }

  // 5. Parsear respuesta
  let respuesta: { propuesta: string; logros_detectados: string[]; razonamiento: string }
  try {
    respuesta = JSON.parse(respuestaRaw)
  } catch {
    // Si no es JSON válido, intentar extraer con regex
    const match = respuestaRaw.match(/\{[\s\S]*\}/)
    if (!match) return
    try {
      respuesta = JSON.parse(match[0])
    } catch {
      return
    }
  }

  if (!respuesta.propuesta || !respuesta.logros_detectados) return

  // 6. Construir resultado
  const semanaNumero = obtenerNumeroSemana(new Date())

  const resultado: ResultadoAgente = {
    tipo: 'mensaje_motivacion',
    propuesta: respuesta.propuesta,
    razonamiento: respuesta.razonamiento ?? 'Mensaje generado automáticamente',
    payload: {
      logros_detectados: respuesta.logros_detectados,
      semana_numero: semanaNumero,
    },
    fuentes: [] as FuenteCientifica[],
    prioridad: 7,
    score_confianza: 0.7,
    requiere_aprobacion: true,
  }

  // 7. Guardar tarea
  await guardarTareaAgente('director' as TipoAgente, resultado, clienteId)
}
