// ================================================================
// AGENTE REVISOR SEMANAL — ENTRENAMIENTO
// Analiza la semana de entrenamiento del cliente:
// carga total (TLS), tendencia RPE, sesiones completadas vs planificadas.
// Propone ajustes al plan o mensajes al coach.
// Se ejecuta lunes (modo semanal).
// ================================================================

import { llamarGemini, guardarTareaAgente } from './executor'
import { obtenerPatronesRelevantes } from './aprendizaje-colectivo'
import { createServiceSupabase } from '@/lib/supabase-server'

function obtenerLunesPasado(): string {
  const hoy = new Date()
  const dia = hoy.getDay()
  const diff = dia === 0 ? 6 : dia - 1
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - diff - 7)  // semana anterior
  lunes.setHours(0, 0, 0, 0)
  return lunes.toISOString()
}

// Evita re-alertar "inactividad total" cada lunes mientras el coach no haya
// triado la alerta anterior. Solo suprime cuando la última tarea pendiente
// de este tipo también reportaba 0 sesiones (mismo fallo, sin resolver).
export function debeSuprimirPorInactividadRepetida(
  ultimaPendiente: { sesiones_realizadas?: number } | null | undefined
): boolean {
  return ultimaPendiente?.sesiones_realizadas === 0
}

function obtenerLunesActual(): string {
  const hoy = new Date()
  const dia = hoy.getDay()
  const diff = dia === 0 ? 6 : dia - 1
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - diff)
  lunes.setHours(0, 0, 0, 0)
  return lunes.toISOString()
}

export async function ejecutarRevisorSemanalEntreno(clienteId: string): Promise<void> {
  const db = createServiceSupabase()

  // 1. Verificar plan activo
  const { data: plan } = await db
    .from('planes_entrenamiento')
    .select('id, nombre')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .single()

  if (!plan) return

  // 2. Evitar revisión duplicada esta semana
  const lunesActual = obtenerLunesActual()
  const { count: yaExiste } = await db
    .from('agente_tareas')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('tipo', 'revision_semanal_entreno')
    .gte('created_at', lunesActual)

  if (yaExiste && yaExiste > 0) return

  // 3. Datos de la semana anterior — sesiones de gimnasio registradas en la
  // app + actividad real detectada por wearable (Garmin/Strava). Antes solo
  // se contaba registros_sets: un cliente que corría o pedaleaba de verdad
  // con el reloj puesto, sin loguear sets de gimnasio, salía con
  // "0 sesiones, inactividad total" cada semana aunque sí entrenaba.
  const lunesPasado = obtenerLunesPasado()
  const [{ data: sesionesSemanaPasada }, { data: actividadWearableSemana }] = await Promise.all([
    db
      .from('registros_sets')
      .select('fecha, sets_ejecutados, duracion_sesion_s, esfuerzo_percibido, ejercicio:ejercicios(nombre, grupo_muscular)')
      .eq('cliente_id', clienteId)
      .gte('fecha', lunesPasado.split('T')[0])
      .lt('fecha', lunesActual.split('T')[0])
      .order('fecha', { ascending: true }),
    db
      .from('actividad_externa_cliente')
      .select('fecha, tipo_entreno, duracion_min, distancia_entreno_km')
      .eq('cliente_id', clienteId)
      .not('tipo_entreno', 'is', null)
      .gte('fecha', lunesPasado.split('T')[0])
      .lt('fecha', lunesActual.split('T')[0])
      .order('fecha', { ascending: true }),
  ])

  const sesiones = sesionesSemanaPasada ?? []
  const actividadWearable = actividadWearableSemana ?? []

  // 4. Calcular métricas
  const diasApp = new Set(sesiones.map(s => s.fecha))
  const diasWearable = new Set(actividadWearable.map(a => a.fecha))
  const sesionesRealizadas = new Set([...diasApp, ...diasWearable]).size
  const rpeValues = sesiones
    .map(s => s.esfuerzo_percibido)
    .filter((r): r is number => r !== null && r !== undefined)
  const rpeMedia = rpeValues.length > 0
    ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length
    : null

  // TLS = duracion_min × (rpe/10)² por sesión, acumulado semana
  const tlsSemana = sesiones.reduce((acc, s) => {
    const durMin = (s.duracion_sesion_s ?? 0) / 60
    const rpe = s.esfuerzo_percibido ?? 5
    return acc + durMin * Math.pow(rpe / 10, 2)
  }, 0)

  const { count: sesionesPlan } = await db
    .from('sesiones_entrenamiento')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', plan.id)
  const sesionesPlaneadas = sesionesPlan ?? 3
  const adherencia = sesionesRealizadas / sesionesPlaneadas

  // 5. Solo generar tarea si hay datos útiles o adherencia baja
  if (sesiones.length === 0 && adherencia > 0.7) return

  // Inactividad total repetida: si ya hay una alerta de "0 sesiones" pendiente
  // sin revisar por el coach, no generar otra idéntica cada lunes. El agente
  // volvía a proponer "contactar urgentemente" semana tras semana sin que el
  // coach hubiera tenido oportunidad de actuar sobre la anterior — puro ruido
  // en el inbox. Se libera en cuanto el coach marca la tarea previa como
  // revisada, o si vuelve a haber actividad real.
  if (sesionesRealizadas === 0) {
    const { data: pendientesInactividad } = await db
      .from('agente_tareas')
      .select('id, payload')
      .eq('cliente_id', clienteId)
      .eq('tipo', 'revision_semanal_entreno')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(1)
    const ultimaPayload = pendientesInactividad?.[0]?.payload as { sesiones_realizadas?: number } | null
    if (debeSuprimirPorInactividadRepetida(ultimaPayload)) return
  }

  // 6. Perfil cliente
  // Bug corregido (25-09-2026): `clienteId` es el id de `clientes`, no de
  // `profiles` — comparar `profiles.id` directamente contra él nunca
  // encontraba fila y el nombre caía siempre al genérico "el cliente".
  const { data: clienteConPerfil } = await db
    .from('clientes')
    .select('objetivo, profiles:profiles!profile_id(nombre, apellidos)')
    .eq('id', clienteId)
    .single()
  const perfil = clienteConPerfil?.profiles as { nombre?: string; apellidos?: string } | null

  const nombre = [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(' ') || 'el cliente'

  // Grupos musculares trabajados
  const gruposSet = new Set<string>()
  for (const s of sesiones) {
    const ej = s.ejercicio as unknown as { grupo_muscular?: string } | null
    if (ej?.grupo_muscular) gruposSet.add(ej.grupo_muscular)
  }

  const actividadWearableTexto = actividadWearable.length > 0
    ? actividadWearable
        .map(a => `${a.fecha}: ${a.tipo_entreno}${a.duracion_min ? ` (${a.duracion_min}min)` : ''}${a.distancia_entreno_km ? `, ${a.distancia_entreno_km}km` : ''}`)
        .join('; ')
    : null

  // Patrones agregados de todos los clientes (aprendizaje-colectivo.ts) —
  // antes solo alimentaban al revisor de nutrición; el de entreno nunca se
  // beneficiaba del conocimiento acumulado entre clientes.
  const patronesColectivos = await obtenerPatronesRelevantes(clienteConPerfil?.objetivo ?? 'rendimiento')

  const prompt = `Eres el revisor semanal de entrenamiento de NutriCoach.

CLIENTE: ${nombre}
PLAN ACTIVO: ${plan.nombre}

DATOS SEMANA ANTERIOR:
- Sesiones realizadas: ${sesionesRealizadas} de ${sesionesPlaneadas} planificadas
- Adherencia: ${(adherencia * 100).toFixed(0)}%
- RPE medio: ${rpeMedia !== null ? rpeMedia.toFixed(1) : 'sin datos'}
- TLS semana: ${tlsSemana.toFixed(0)} (Training Load Score)
- Grupos musculares: ${[...gruposSet].join(', ') || 'sin datos'}
- Actividad detectada por Garmin/Strava (no gimnasio): ${actividadWearableTexto ?? 'ninguna'}

INTERPRETACIÓN TLS:
- <50: semana muy ligera
- 50-150: carga moderada ideal
- 150-250: carga alta, vigilar recuperación
- >250: sobreentrenamiento potencial
${patronesColectivos}

Analiza y genera propuesta para el coach en JSON:
{
  "propuesta": "qué debería hacer el coach esta semana (mensaje al cliente o ajuste de plan, max 3 frases)",
  "razonamiento": "análisis de la semana (max 80 palabras)",
  "logros": ["logro 1", "logro 2"],
  "advertencias": ["advertencia si hay alguna"],
  "prioridad": 1-10,
  "score_confianza": 0-1
}`

  let raw: string
  try {
    raw = await llamarGemini(prompt, 0.35)
  } catch {
    return
  }

  let parsed: {
    propuesta: string
    razonamiento: string
    logros: string[]
    advertencias: string[]
    prioridad: number
    score_confianza: number
  }
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return
    try { parsed = JSON.parse(match[0]) } catch { return }
  }

  if (!parsed.propuesta) return

  await guardarTareaAgente('director', {
    tipo: 'revision_semanal_entreno',
    propuesta: parsed.propuesta,
    razonamiento: parsed.razonamiento ?? '',
    payload: {
      sesiones_realizadas: sesionesRealizadas,
      sesiones_planeadas: sesionesPlaneadas,
      adherencia_pct: Math.round(adherencia * 100),
      rpe_media: rpeMedia,
      tls_semana: Math.round(tlsSemana),
      logros: parsed.logros ?? [],
      advertencias: parsed.advertencias ?? [],
    },
    fuentes: [],
    prioridad: Number(parsed.prioridad ?? 6),
    score_confianza: Number(parsed.score_confianza ?? 0.7),
    requiere_aprobacion: true,
  }, clienteId)
}
