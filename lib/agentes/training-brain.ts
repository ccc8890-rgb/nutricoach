// lib/agentes/training-brain.ts
// ================================================================
// TRAINING BRAIN — Análisis profundo con base de conocimiento
// Detecta: plateau de PRs, deriva de RPE, desequilibrios musculares.
// Consulta KB (230 papers) + DeepSeek → propuestas coach con citas.
// Corre en modo semanal cuando el cliente tiene plan activo.
// ================================================================

import { llamarDeepSeek, guardarTareaAgente } from './executor'
import { seleccionarProtocolos, formatearEvidenciaParaPrompt, type PerfilClienteKB } from '@/lib/knowledge-base'
import { createServiceSupabase } from '@/lib/supabase-server'
import type { FuenteCientifica } from './types'

function getLunesActual(): string {
  const hoy = new Date()
  const diff = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - diff)
  lunes.setHours(0, 0, 0, 0)
  return lunes.toISOString()
}

function getFechaHaceNDias(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

interface PRRow {
  ejercicio_id: string
  ejercicio_nombre: string
  peso_max_kg: number
  reps_en_pr: number
  fecha_pr: string
}

interface RegistroRow {
  fecha: string
  sets_ejecutados: Array<{ peso_kg?: number; reps?: number }>
  esfuerzo_percibido: number | null
  ejercicio: { nombre: string; grupo_muscular: string } | null
}

interface Signal {
  tipo: 'plateau_pr' | 'rpe_elevado' | 'desequilibrio_muscular'
  descripcion: string
  tags: string[]
}

export async function ejecutarTrainingBrain(clienteId: string): Promise<void> {
  const db = createServiceSupabase()

  // 1. Verificar plan activo
  const { data: plan } = await db
    .from('planes_entrenamiento')
    .select('id, nombre')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .single()

  if (!plan) return

  // 2. Evitar duplicado esta semana
  const lunesActual = getLunesActual()
  const { count: yaExiste } = await db
    .from('agente_tareas')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('tipo', 'training_brain')
    .gte('created_at', lunesActual)

  if (yaExiste && yaExiste > 0) return

  // 3. Cargar datos últimas 4 semanas
  const desde28d = getFechaHaceNDias(28)
  const desde14d = getFechaHaceNDias(14)

  const [{ data: registros28d }, { data: prsActuales }] = await Promise.all([
    db
      .from('registros_sets')
      .select('fecha, sets_ejecutados, esfuerzo_percibido, ejercicio:ejercicios(nombre, grupo_muscular)')
      .eq('cliente_id', clienteId)
      .gte('fecha', desde28d)
      .order('fecha', { ascending: false }),
    db
      .from('prs_por_ejercicio')
      .select('ejercicio_id, ejercicio_nombre, peso_max_kg, reps_en_pr, fecha_pr')
      .eq('cliente_id', clienteId)
      .order('fecha_pr', { ascending: false })
      .limit(20),
  ])

  const registros = (registros28d ?? []) as unknown as RegistroRow[]
  const prs = (prsActuales ?? []) as unknown as PRRow[]

  // Salir si no hay datos suficientes
  if (registros.length < 3) return

  // 4. Detectar señales
  const signals: Signal[] = []
  const hoy = new Date()

  // a) PR stagnation: PRs con fecha_pr > 21 días
  for (const pr of prs) {
    const diasSinPR = Math.floor(
      (hoy.getTime() - new Date(pr.fecha_pr).getTime()) / 86_400_000
    )
    if (diasSinPR >= 21) {
      signals.push({
        tipo: 'plateau_pr',
        descripcion: `${pr.ejercicio_nombre}: sin nuevo PR hace ${diasSinPR} días (último: ${pr.peso_max_kg}kg × ${pr.reps_en_pr} reps)`,
        tags: ['plateau', 'estancamiento', 'progresion'],
      })
    }
  }

  // b) RPE drift
  const registros14d = registros.filter(r => r.fecha >= desde14d)
  const registros14_28d = registros.filter(r => r.fecha < desde14d)

  const rpeRecienteArr = registros14d
    .map(r => r.esfuerzo_percibido)
    .filter((v): v is number => v !== null && v !== undefined)
  const rpeAnteriorArr = registros14_28d
    .map(r => r.esfuerzo_percibido)
    .filter((v): v is number => v !== null && v !== undefined)

  const avgRpeReciente = rpeRecienteArr.length > 0
    ? rpeRecienteArr.reduce((a, b) => a + b, 0) / rpeRecienteArr.length
    : null
  const avgRpeAnterior = rpeAnteriorArr.length > 0
    ? rpeAnteriorArr.reduce((a, b) => a + b, 0) / rpeAnteriorArr.length
    : null

  if (avgRpeReciente !== null) {
    if (avgRpeReciente >= 8.5) {
      signals.push({
        tipo: 'rpe_elevado',
        descripcion: `RPE medio últimas 2 semanas: ${avgRpeReciente.toFixed(1)}${avgRpeAnterior !== null ? ` (anterior: ${avgRpeAnterior.toFixed(1)})` : ''} — posible acumulación de fatiga`,
        tags: ['fatiga', 'recuperacion', 'sobreentrenamiento', 'deload'],
      })
    } else if (avgRpeAnterior !== null && avgRpeReciente - avgRpeAnterior >= 1.2) {
      signals.push({
        tipo: 'rpe_elevado',
        descripcion: `Subida de RPE: ${avgRpeAnterior.toFixed(1)} → ${avgRpeReciente.toFixed(1)} en 2 semanas — señal de fatiga acumulada`,
        tags: ['fatiga', 'recuperacion', 'deload'],
      })
    }
  }

  // c) Desequilibrio muscular
  const gruposUltimas2Semanas = new Set<string>()
  const gruposUltimas4Semanas = new Set<string>()

  for (const r of registros) {
    const ej = r.ejercicio as unknown as { grupo_muscular?: string } | null
    const gm = ej?.grupo_muscular
    if (!gm) continue
    if (r.fecha >= desde14d) gruposUltimas2Semanas.add(gm)
    gruposUltimas4Semanas.add(gm)
  }

  for (const grupo of gruposUltimas4Semanas) {
    if (!gruposUltimas2Semanas.has(grupo)) {
      signals.push({
        tipo: 'desequilibrio_muscular',
        descripcion: `${grupo}: no entrenado en las últimas 2 semanas pero activo en las anteriores`,
        tags: ['equilibrio_muscular', 'planificacion', 'frecuencia'],
      })
    }
  }

  if (signals.length === 0) return

  // 5. Perfil cliente para KB
  const { data: perfil } = await db
    .from('perfil_entreno_cliente')
    .select('objetivo_especifico, sport_modality, nivel_experiencia')
    .eq('cliente_id', clienteId)
    .single()

  const { data: profileData } = await db
    .from('profiles')
    .select('nombre, apellidos')
    .eq('id', clienteId)
    .single()

  const nombre = [profileData?.nombre, profileData?.apellidos].filter(Boolean).join(' ') || 'el cliente'

  // 6. KB protocols
  const allTags = [...new Set(signals.flatMap(s => s.tags))]

  // Build PerfilClienteKB from available data
  const perfilKb: PerfilClienteKB = {
    objetivo: perfil?.objetivo_especifico ?? allTags.join(' '),
    tipo_entreno: perfil?.sport_modality ?? null,
  }

  const protocolos = await seleccionarProtocolos(db, perfilKb, 3)
  const evidenciaTexto = formatearEvidenciaParaPrompt(protocolos)

  // 7. DeepSeek
  const senalesTexto = signals.map(s => `- [${s.tipo}] ${s.descripcion}`).join('\n')
  const sesionesCount = new Set(registros.map(r => r.fecha)).size
  const gruposEntrenados = [...gruposUltimas2Semanas].join(', ') || 'ninguno registrado'

  const systemPrompt = `Eres el Training Brain de NutriCoach — un sistema de análisis de entrenamiento científico.
Analiza los datos del cliente y genera propuestas precisas para el coach basadas en evidencia.
Responde SIEMPRE en JSON válido.`

  const userPrompt = `CLIENTE: ${nombre}
PLAN ACTIVO: ${plan.nombre}
PERÍODO: últimas 4 semanas
SESIONES REALIZADAS: ${sesionesCount}
GRUPOS MUSCULARES ÚLTIMAS 2 SEM: ${gruposEntrenados}

SEÑALES DETECTADAS:
${senalesTexto}

${evidenciaTexto ? evidenciaTexto + '\n' : ''}
Genera un análisis en JSON:
{
  "propuesta": "qué hacer esta semana con el plan (máx 3 frases, concreto y accionable)",
  "razonamiento": "análisis de las señales detectadas (máx 100 palabras)",
  "logros": ["logro positivo 1"],
  "advertencias": ["advertencia concreta si aplica"],
  "ajustes_plan": ["ajuste técnico 1"],
  "citas_papers": ["cita paper breve 1"],
  "prioridad": 7,
  "score_confianza": 0.8
}`

  let raw: string
  try {
    raw = await llamarDeepSeek(systemPrompt, userPrompt, 0.35)
  } catch {
    return
  }

  let parsed: {
    propuesta: string
    razonamiento?: string
    logros?: string[]
    advertencias?: string[]
    ajustes_plan?: string[]
    citas_papers?: string[]
    prioridad?: number
    score_confianza?: number
  }
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return
    try { parsed = JSON.parse(match[0]) } catch { return }
  }

  if (!parsed.propuesta) return

  // 8. Fuentes — convertir strings a FuenteCientifica[]
  const toFuente = (ref: string): FuenteCientifica => {
    // Formato esperado: "Autor et al. (año) Título — Conclusión"
    const yearMatch = ref.match(/\((\d{4})\)/)
    const año = yearMatch ? parseInt(yearMatch[1]) : 2020
    const parts = ref.split('—')
    return {
      autores: ref.split('(')[0].trim(),
      año,
      titulo: parts[0]?.trim() ?? ref,
      conclusión: parts[1]?.trim() ?? '',
    }
  }

  const fuentesKbRefs = protocolos.flatMap(p => p.referencias).slice(0, 4)
  const fuentesIaRefs = (parsed.citas_papers ?? []).slice(0, 2)
  const allRefs = [...new Set([...fuentesIaRefs, ...fuentesKbRefs])]
  const fuentes: FuenteCientifica[] = allRefs.map(toFuente)

  await guardarTareaAgente('director', {
    tipo: 'training_brain',
    propuesta: parsed.propuesta,
    razonamiento: parsed.razonamiento ?? '',
    payload: {
      senales: signals.map(s => ({ tipo: s.tipo, descripcion: s.descripcion })),
      sesiones_28d: sesionesCount,
      rpe_reciente: avgRpeReciente,
      rpe_anterior: avgRpeAnterior,
      grupos_musculares_2sem: [...gruposUltimas2Semanas],
      logros: parsed.logros ?? [],
      advertencias: parsed.advertencias ?? [],
      ajustes_plan: parsed.ajustes_plan ?? [],
      protocolos_kb: protocolos.map(p => p.titulo),
    },
    fuentes,
    prioridad: Number(parsed.prioridad ?? 7),
    score_confianza: Number(parsed.score_confianza ?? 0.75),
    requiere_aprobacion: true,
  }, clienteId)
}
