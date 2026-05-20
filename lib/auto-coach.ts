// lib/auto-coach.ts
// ═══════════════════════════════════════════════════════════════
// AutoCoach — Motor de análisis proactivo de clientes.
// Analiza check-ins, peso, adherencia, energía, sueño y genera
// recomendaciones automáticas basadas en reglas heurísticas + IA.
//
// Gap #6 RESUELTO: Feedback loop → integración con periodización.
//   - Alerta de estancamiento + buena adherencia → dispara refeed programado
//   - Alerta de pérdida rápida → revisa si ajuste calórico es necesario
//   - Alerta de fatiga/energía baja → dispara evaluarCheckin()
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// AutoCoach — Motor de análisis proactivo de clientes.
// Analiza check-ins, peso, adherencia, energía, sueño y genera
// recomendaciones automáticas basadas en reglas heurísticas + IA.
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase'
import type { RecomendacionAutoCoach, AnalisisAutoCoach, AutoCoachDashboard, TipoRecomendacion, NivelUrgencia } from '@/types'

// ── Helpers ─────────────────────────────────────────────────

type ClientRow = {
  id: string
  profile_id: string
  peso_inicial?: number
  objetivo?: string
  profile?: { nombre?: string }
}

type CheckinRow = {
  fecha: string
  peso?: number
  adherencia?: number
  energia?: number
  sueno?: number
  notas?: string
}

type PesoRow = {
  fecha: string
  peso: number
}

/** Formatea fecha a ISO local */
function hoyLocal(): string {
  return new Date().toISOString().split('T')[0]
}

function diasDesde(fecha: string): number {
  const f = new Date(fecha + 'T00:00:00')
  return Math.floor((Date.now() - f.getTime()) / (1000 * 60 * 60 * 24))
}

function generarId(): string {
  return `ac_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ── 1. Análisis heurístico por cliente ─────────────────────
// Evalúa datos objetivos y genera recomendaciones sin llamar a IA.

export async function analizarCliente(
  clienteId: string,
  coachId: string
): Promise<AnalisisAutoCoach | null> {
  // 1. Obtener datos del cliente
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, profile_id, peso_inicial, objetivo, profile!inner(nombre)')
    .eq('id', clienteId)
    .single()

  if (!cliente) return null

  const c = cliente as unknown as ClientRow
  const nombre = c.profile?.nombre ?? 'Cliente'

  // 2. Obtener check-ins últimos 30 días
  const fechaLimite = new Date()
  fechaLimite.setDate(fechaLimite.getDate() - 30)
  const fechaStr = fechaLimite.toISOString().split('T')[0]

  const { data: checkins } = await supabase
    .from('checkins')
    .select('fecha, peso, adherencia, energia, sueno, notas')
    .eq('cliente_id', clienteId)
    .gte('fecha', fechaStr)
    .order('fecha', { ascending: false })

  const checks = (checkins ?? []) as CheckinRow[]

  // 3. Obtener peso histórico
  const { data: pesos } = await supabase
    .from('seguimiento_peso')
    .select('fecha, peso')
    .eq('cliente_id', clienteId)
    .gte('fecha', fechaStr)
    .order('fecha', { ascending: false })

  const pesoHistory = (pesos ?? []) as PesoRow[]

  // 4. Obtener plan activo
  const { data: plan } = await supabase
    .from('planes_nutricion')
    .select('id, fecha_proxima_revision, activo')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .single()

  // 5. Calcular métricas
  const ultimoCheckin = checks[0]?.fecha ?? null
  const diasSinCheckin = ultimoCheckin ? diasDesde(ultimoCheckin) : 99

  const checksPeso = checks.filter(c => c.peso != null)
  const pesoActual = checksPeso[0]?.peso ?? c.peso_inicial
  const pesoAnterior = checksPeso.length > 1 ? checksPeso[1].peso : (pesoHistory.length > 0 ? pesoHistory[0].peso : c.peso_inicial)

  const adherencias = checks.filter(c => c.adherencia != null).map(c => c.adherencia!)
  const adherenciaMedia = adherencias.length > 0
    ? adherencias.reduce((s, v) => s + v, 0) / adherencias.length
    : 0

  const energias = checks.filter(c => c.energia != null).map(c => c.energia!)
  const energiaMedia = energias.length > 0
    ? energias.reduce((s, v) => s + v, 0) / energias.length
    : 0

  const suenos = checks.filter(c => c.sueno != null).map(c => c.sueno!)
  const suenoMedio = suenos.length > 0
    ? suenos.reduce((s, v) => s + v, 0) / suenos.length
    : 0

  // 6. Generar recomendaciones por reglas
  const recomendaciones: RecomendacionAutoCoach[] = []
  const ahora = new Date().toISOString()

  // ── Periodización: Evaluar si auto-coach dispara acciones ──
  // Gap #6: Feedback loop entre detecciones y periodización
  let accionPeriodizacion: string | null = null
  let accionPeriodizacionUrgencia: NivelUrgencia | null = null

  // 6a. Estancamiento + buena adherencia → evaluar refeed
  if (c.objetivo === 'perder_grasa' && pesoActual && pesoAnterior) {
    const diff = pesoAnterior - pesoActual
    const checksRecientes = checks.filter(c => diasDesde(c.fecha) <= 14)
    const semanasEnDeficit = Math.max(Math.floor(checksRecientes.length / 2), 0)

    if (diff < 0.3 && checksRecientes.length >= 2 && adherenciaMedia >= 7) {
      accionPeriodizacion = `🔁 REFEED PROGRAMADO: Cliente estancado ${semanasEnDeficit > 4 ? '>4 semanas' : semanasEnDeficit + ' semanas'} con adherencia ${adherenciaMedia.toFixed(1)}/10. Iniciar refeed 1 semana: kcal a mantenimiento, CHO +30%.`
      accionPeriodizacionUrgencia = 'critica'
    }
  }

  // 6b. Energía baja + déficit → evaluar ajuste calórico o revisión de distribución
  if (energiaMedia > 0 && energiaMedia < 4 && checks.length >= 2) {
    if (c.objetivo === 'perder_grasa' || c.objetivo === 'recomposicion') {
      accionPeriodizacion = accionPeriodizacion
        ? accionPeriodizacion + `\n⚠️ ENERGÍA BAJA (${energiaMedia.toFixed(1)}/10): Revisar si el déficit es excesivo. Considerar aumentar CHO en comidas pre-entreno.`
        : `⚠️ ENERGÍA BAJA: Revisar si el déficit es excesivo o la distribución de macros es inadecuada. Aumentar CHO en comidas pre-entreno si aplica.`
      accionPeriodizacionUrgencia = accionPeriodizacionUrgencia ?? 'alta'
    }
  }

  // 6c. Sueño bajo + fatiga → evaluar intervención de sueño
  if (suenoMedio > 0 && suenoMedio < 3 && checks.length >= 2) {
    accionPeriodizacion = accionPeriodizacion
      ? accionPeriodizacion + `\n🛌 INTERVENCIÓN SUEÑO: Sueño ${suenoMedio.toFixed(1)}/10. Evaluar cena (tryptophan, Mg), higiene de sueño.`
      : `🛌 INTERVENCIÓN SUEÑO: Sueño ${suenoMedio.toFixed(1)}/10. Priorizar higiene de sueño antes de ajustar calorías.`
    accionPeriodizacionUrgencia = accionPeriodizacionUrgencia ?? 'media'
  }

  // 6d. Pérdida rápida con energía baja → disparar aumento calórico
  if (pesoActual && pesoAnterior && c.objetivo === 'perder_grasa') {
    const diffSemanal = (pesoAnterior - pesoActual) / Math.max(checksPeso.length, 1) * 7
    if (diffSemanal > 1 && energiaMedia < 5) {
      accionPeriodizacion = accionPeriodizacion
        ? accionPeriodizacion + `\n📈 AJUSTE CALÓRICO: Pérdida rápida (${diffSemanal.toFixed(1)} kg/sem) + energía baja. Subir +200-300 kcal/día para estabilizar.`
        : `📈 AJUSTE CALÓRICO: Pérdida rápida (${diffSemanal.toFixed(1)} kg/sem) con energía baja (${energiaMedia.toFixed(1)}/10). Aumentar calorías +200-300 kcal/día.`
      accionPeriodizacionUrgencia = accionPeriodizacionUrgencia ?? 'alta'
    }
  }

  // Si hay acción de periodización, añadirla como primera recomendación
  if (accionPeriodizacion) {
    recomendaciones.push({
      id: generarId(),
      cliente_id: clienteId,
      cliente_nombre: nombre,
      tipo: 'periodizacion_ajuste',
      urgencia: accionPeriodizacionUrgencia ?? 'media',
      titulo: '🎯 Acción de periodización automática',
      descripcion: accionPeriodizacion,
      detalle_ia: '',
      sugerencia_accion: 'Revisar la acción sugerida y aplicarla en el plan del cliente. La periodización automática mejora resultados a largo plazo.',
      datos_contexto: {
        peso_actual: pesoActual,
        peso_anterior: pesoAnterior,
        adherencia_media: adherenciaMedia,
        energia_media: energiaMedia,
        sueno_medio: suenoMedio,
      },
      created_at: ahora,
    })
  }

  // 6e. Alerta de adherencia baja
  if (adherenciaMedia > 0 && adherenciaMedia < 5 && checks.length >= 2) {
    recomendaciones.push({
      id: generarId(),
      cliente_id: clienteId,
      cliente_nombre: nombre,
      tipo: 'alerta_adherencia',
      urgencia: 'alta',
      titulo: 'Adherencia baja',
      descripcion: `${nombre} tiene una adherencia media de ${adherenciaMedia.toFixed(1)}/10 en los últimos ${checks.length} check-ins.`,
      detalle_ia: '',
      sugerencia_accion: 'Revisar la dieta con el cliente. Preguntar qué dificultades encuentra y ajustar recetas o porciones.',
      datos_contexto: {
        peso_actual: pesoActual,
        peso_anterior: pesoAnterior,
        adherencia_media: adherenciaMedia,
        energia_media: energiaMedia,
        sueno_medio: suenoMedio,
        dias_sin_checkin: diasSinCheckin,
      },
      created_at: ahora,
    })
  }

  // 6b. Peso estancado (objetivo perder grasa, no baja en 2+ semanas)
  if (c.objetivo === 'perder_grasa' && pesoActual && pesoAnterior) {
    const diff = pesoAnterior - pesoActual
    const checksRecientes = checks.filter(c => diasDesde(c.fecha) <= 14)
    if (diff < 0.3 && checksRecientes.length >= 2 && adherenciaMedia >= 5) {
      recomendaciones.push({
        id: generarId(),
        cliente_id: clienteId,
        cliente_nombre: nombre,
        tipo: 'alerta_peso_estancado',
        urgencia: adherenciaMedia >= 7 ? 'critica' : 'alta',
        titulo: 'Peso estancado',
        descripcion: `${nombre} apenas ha variado (${diff.toFixed(1)} kg) en las últimas 2 semanas, con buena adherencia (${adherenciaMedia.toFixed(1)}/10).`,
        detalle_ia: '',
        sugerencia_accion: 'Ajustar ligeramente kcal (-150~200) o aumentar el déficit mediante más actividad física.',
        datos_contexto: {
          peso_actual: pesoActual,
          peso_anterior: pesoAnterior,
          adherencia_media: adherenciaMedia,
          energia_media: energiaMedia,
          sueno_medio: suenoMedio,
          tendencia_semanal: `cambio: ${diff.toFixed(1)} kg`,
        },
        created_at: ahora,
      })
    }
  }

  // 6c. Pérdida de peso muy rápida
  if (pesoActual && pesoAnterior && c.objetivo === 'perder_grasa') {
    const diffSemanal = (pesoAnterior - pesoActual) / Math.max(checksPeso.length, 1) * 7
    if (diffSemanal > 1) {
      recomendaciones.push({
        id: generarId(),
        cliente_id: clienteId,
        cliente_nombre: nombre,
        tipo: 'alerta_peso_rapido',
        urgencia: 'alta',
        titulo: 'Pérdida de peso muy rápida',
        descripcion: `${nombre} pierde ${diffSemanal.toFixed(1)} kg/semana, por encima del ritmo saludable (0.5-1 kg/semana).`,
        detalle_ia: '',
        sugerencia_accion: 'Aumentar ligeramente las calorías (+200~300 kcal/día) para estabilizar el ritmo de pérdida.',
        datos_contexto: {
          peso_actual: pesoActual,
          peso_anterior: pesoAnterior,
          tendencia_semanal: `pérdida: ${diffSemanal.toFixed(1)} kg/sem`,
        },
        created_at: ahora,
      })
    }
  }

  // 6d. Sueño bajo
  if (suenoMedio > 0 && suenoMedio < 4 && checks.length >= 2) {
    recomendaciones.push({
      id: generarId(),
      cliente_id: clienteId,
      cliente_nombre: nombre,
      tipo: 'alerta_sueno',
      urgencia: 'media',
      titulo: 'Calidad de sueño baja',
      descripcion: `${nombre} reporta sueño promedio de ${suenoMedio.toFixed(1)}/10. El sueño deficiente afecta la recuperación y adherencia.`,
      detalle_ia: '',
      sugerencia_accion: 'Preguntar por hábitos de sueño. Recomendar higiene del sueño: evitar pantallas 1h antes, cena ligera 2h antes.',
      datos_contexto: {
        sueno_medio: suenoMedio,
        adherencia_media: adherenciaMedia,
      },
      created_at: ahora,
    })
  }

  // 6e. Energía baja
  if (energiaMedia > 0 && energiaMedia < 4 && checks.length >= 2) {
    recomendaciones.push({
      id: generarId(),
      cliente_id: clienteId,
      cliente_nombre: nombre,
      tipo: 'alerta_energia',
      urgencia: 'media',
      titulo: 'Nivel de energía bajo',
      descripcion: `${nombre} reporta energía promedio de ${energiaMedia.toFixed(1)}/10. Podría indicar déficit calórico excesivo o mala distribución de macros.`,
      detalle_ia: '',
      sugerencia_accion: 'Revisar distribución de carbohidratos. Aumentar carbohidratos en comidas pre-entreno si aplica.',
      datos_contexto: {
        energia_media: energiaMedia,
        adherencia_media: adherenciaMedia,
      },
      created_at: ahora,
    })
  }

  // 6f. Sin check-in reciente
  if (diasSinCheckin >= 3) {
    recomendaciones.push({
      id: generarId(),
      cliente_id: clienteId,
      cliente_nombre: nombre,
      tipo: 'checkin_recordatorio',
      urgencia: diasSinCheckin >= 7 ? 'alta' : 'media',
      titulo: diasSinCheckin >= 7
        ? `Sin check-in desde hace ${diasSinCheckin} días`
        : `${diasSinCheckin} días sin check-in`,
      descripcion: `${nombre} no ha hecho check-in en ${diasSinCheckin} días.`,
      detalle_ia: '',
      sugerencia_accion: 'Enviar recordatorio al cliente. Si supera 7 días, contactar directamente.',
      datos_contexto: {
        dias_sin_checkin: diasSinCheckin,
        peso_actual: pesoActual,
      },
      created_at: ahora,
    })
  }

  // 6f2. Sin actividad en el portal
  const { data: clienteAcceso } = await supabase
    .from('clientes')
    .select('last_portal_access')
    .eq('id', clienteId)
    .single()
  const lastAccess = (clienteAcceso as { last_portal_access?: string } | null)?.last_portal_access
  const diasSinPortal = lastAccess ? diasDesde(lastAccess) : 99
  if (diasSinPortal >= 5) {
    recomendaciones.push({
      id: generarId(),
      cliente_id: clienteId,
      cliente_nombre: nombre,
      tipo: 'sin_actividad_portal',
      urgencia: diasSinPortal >= 10 ? 'alta' : 'media',
      titulo: `${diasSinPortal} días sin abrir la app`,
      descripcion: `${nombre} no ha accedido al portal desde hace ${diasSinPortal} días.`,
      detalle_ia: '',
      sugerencia_accion: 'Enviar mensaje de motivación. El cliente puede haberse desconectado del proceso.',
      datos_contexto: { dias_sin_portal: diasSinPortal },
      created_at: ahora,
    })
  }

  // 6f3. Sin registrar entreno (si tiene plan activo)
  const { data: planEntreno } = await supabase
    .from('planes_entrenamiento')
    .select('id')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .limit(1)
  if (planEntreno?.length) {
    const fechaLimiteEntreno = new Date()
    fechaLimiteEntreno.setDate(fechaLimiteEntreno.getDate() - 7)
    const { data: sesiones } = await supabase
      .from('registros_sets')
      .select('created_at')
      .eq('cliente_id', clienteId)
      .gte('created_at', fechaLimiteEntreno.toISOString())
      .limit(1)
    if (!sesiones?.length) {
      recomendaciones.push({
        id: generarId(),
        cliente_id: clienteId,
        cliente_nombre: nombre,
        tipo: 'sin_entreno',
        urgencia: 'media',
        titulo: 'Sin registrar entreno esta semana',
        descripcion: `${nombre} no ha registrado ninguna sesión de entrenamiento en los últimos 7 días.`,
        detalle_ia: '',
        sugerencia_accion: 'Verificar si el cliente tiene dificultades con los entrenamientos o necesita ajuste del plan.',
        datos_contexto: {},
        created_at: ahora,
      })
    }
  }

  // 6g. Feedback positivo
  const checksRecientesPositivos = checks.filter(c => diasDesde(c.fecha) <= 14)
  const checksBuenos = checksRecientesPositivos.filter(c =>
    (c.adherencia ?? 0) >= 7 && (c.energia ?? 0) >= 6
  )
  if (checksBuenos.length >= 2 && recomendaciones.length < 3) {
    recomendaciones.push({
      id: generarId(),
      cliente_id: clienteId,
      cliente_nombre: nombre,
      tipo: 'feedback_positivo',
      urgencia: 'baja',
      titulo: '¡Buen progreso!',
      descripcion: `${nombre} tiene buena adherencia (${adherenciaMedia.toFixed(1)}/10) y energía (${energiaMedia.toFixed(1)}/10).`,
      detalle_ia: '',
      sugerencia_accion: 'Enviar mensaje de ánimo al cliente. Reconocer su esfuerzo mejora la adherencia a largo plazo.',
      datos_contexto: {
        adherencia_media: adherenciaMedia,
        energia_media: energiaMedia,
      },
      created_at: ahora,
    })
  }

  // 6h. Revisión de plan pendiente
  if (plan && typeof plan === 'object' && 'fecha_proxima_revision' in plan) {
    const planObj = plan as { id: string; fecha_proxima_revision?: string; activo: boolean }
    if (planObj.fecha_proxima_revision) {
      const diasHastaRevision = diasDesde(planObj.fecha_proxima_revision) * -1
      if (diasHastaRevision <= 0) {
        recomendaciones.push({
          id: generarId(),
          cliente_id: clienteId,
          cliente_nombre: nombre,
          tipo: 'revision_plan',
          urgencia: 'media',
          titulo: 'Revisión de plan pendiente',
          descripcion: `El plan de ${nombre} debería haberse revisado el ${new Date(planObj.fecha_proxima_revision).toLocaleDateString('es-ES')}.`,
          detalle_ia: '',
          sugerencia_accion: 'Programar sesión de revisión con el cliente. Evaluar progreso y ajustar plan si es necesario.',
          datos_contexto: {
            peso_actual: pesoActual,
            peso_anterior: pesoAnterior,
          },
          created_at: ahora,
        })
      }
    }
  }

  const necesitaAtencion = recomendaciones.some(r => r.urgencia === 'critica' || r.urgencia === 'alta')

  return {
    cliente_id: clienteId,
    cliente_nombre: nombre,
    semanas_datos: Math.min(Math.ceil(checks.length / 2), 4),
    ultimo_checkin: ultimoCheckin,
    recomendaciones,
    resumen_ia: '',
    necesita_atencion: necesitaAtencion,
  }
}

// ── 2. Análisis de todos los clientes activos ──────────────

export async function analizarTodosClientes(
  coachId: string
): Promise<AutoCoachDashboard> {
  // Obtener clientes activos del coach
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, profile_id, peso_inicial, objetivo, profile!inner(nombre)')
    .eq('coach_id', coachId)
    .eq('activo', true)

  if (!clientes || clientes.length === 0) {
    return {
      total_clientes_activos: 0,
      clientes_con_alerta: 0,
      clientes_analizados: 0,
      recomendaciones_pendientes: 0,
      criticas: 0,
      por_tipo: {} as Record<TipoRecomendacion, number>,
      analisis: [],
    }
  }

  const resultados = await Promise.all(
    (clientes as unknown as ClientRow[]).map(c => analizarCliente(c.id, coachId))
  )

  const analisis = resultados.filter(Boolean) as AnalisisAutoCoach[]
  const todasLasRecos = analisis.flatMap(a => a.recomendaciones)

  const porTipo = {} as Record<TipoRecomendacion, number>
  for (const r of todasLasRecos) {
    porTipo[r.tipo] = (porTipo[r.tipo] ?? 0) + 1
  }

  return {
    total_clientes_activos: clientes.length,
    clientes_con_alerta: analisis.filter(a => a.necesita_atencion).length,
    clientes_analizados: analisis.length,
    recomendaciones_pendientes: todasLasRecos.length,
    criticas: todasLasRecos.filter(r => r.urgencia === 'critica').length,
    por_tipo: porTipo,
    analisis,
  }
}

// ── 3. Generar resumen IA con DeepSeek ─────────────────────

export async function generarResumenIA(
  dashboard: AutoCoachDashboard
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return ''

  try {
    const payload = {
      model: 'deepseek-chat',
      temperature: 0.5,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `Eres un coach nutricional experto en análisis de datos de clientes.
Genera un resumen ejecutivo MUY CONCISO (máximo 3 frases) en español.
Sé directo, sin adornos. Resalta lo más importante: alertas críticas, tendencias generales.`,
        },
        {
          role: 'user',
          content: `Resumen del análisis automático de ${dashboard.total_clientes_activos} clientes activos:
- ${dashboard.clientes_con_alerta} clientes requieren atención
- ${dashboard.recomendaciones_pendientes} recomendaciones activas
- ${dashboard.criticas} críticas
- Tipos de alertas: ${Object.entries(dashboard.por_tipo)
              .map(([tipo, count]) => `${tipo}: ${count}`)
              .join(', ')}`,
        },
      ],
    }

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) return ''
    const json = await res.json()
    return json.choices?.[0]?.message?.content?.trim() ?? ''
  } catch {
    return ''
  }
}
