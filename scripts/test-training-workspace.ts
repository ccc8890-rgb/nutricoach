import assert from 'node:assert/strict'
import {
  calcularEjercicioQuality,
  calcularPlantillaQuality,
  crearDecisionSummary,
  crearSesionGuidance,
  crearTrainingRoomSummary,
} from '../lib/training/workspace'
import type { CommandCenterRow } from '../lib/training/command-center'

const plantillaCompleta = calcularPlantillaQuality({
  sesionesCount: 4,
  ejerciciosCount: 22,
  duracionSemanas: 8,
  sportModality: 'hyrox',
  tier: 'elite',
  progresionCount: 8,
})
assert.equal(plantillaCompleta.status, 'top')
assert.equal(plantillaCompleta.score, 100)
assert.deepEqual(plantillaCompleta.gaps, [])

const plantillaIncompleta = calcularPlantillaQuality({
  sesionesCount: 0,
  ejerciciosCount: 0,
  duracionSemanas: null,
  sportModality: null,
  tier: null,
  progresionCount: 0,
})
assert.equal(plantillaIncompleta.status, 'incompleta')
assert.ok(plantillaIncompleta.score < 50)
assert.ok(plantillaIncompleta.gaps.includes('Sin sesiones'))
assert.ok(plantillaIncompleta.gaps.includes('Sin modalidad'))

const ejercicioCompleto = calcularEjercicioQuality({
  foto_url: 'https://example.com/front-squat.jpg',
  video_url: 'https://example.com/front-squat.mp4',
  dificultad_nivel: 4,
  equipamiento: ['Barra'],
  musculos_secundarios: ['Core', 'Espalda alta'],
})
assert.equal(ejercicioCompleto.status, 'completo')
assert.equal(ejercicioCompleto.score, 100)

const ejercicioSinMedia = calcularEjercicioQuality({
  foto_url: null,
  video_url: null,
  dificultad_nivel: null,
  equipamiento: [],
  musculos_secundarios: [],
})
assert.equal(ejercicioSinMedia.status, 'basico')
assert.ok(ejercicioSinMedia.gaps.includes('Sin vídeo'))
assert.ok(ejercicioSinMedia.gaps.includes('Sin equipamiento'))

const clienteFatiga: CommandCenterRow = {
  cliente_id: 'c1',
  plan_id: 'p1',
  nombre: 'Carlos',
  apellidos: 'Casanova',
  plan_nombre: 'Hyrox Base',
  sesiones_objetivo: 4,
  sesiones_7d: 6,
  sesiones_28d: 20,
  rpe_media_7d: 9.1,
  pr_count_7d: 0,
  ultima_fecha: '2026-06-01',
  dots: [true, true, true, true, true, true, false],
  tareas_pendientes: [{ id: 't1', tipo: 'training_brain', prioridad: 1, propuesta: 'Bajar volumen 20%' }],
  flags_altas: 1,
  estado: 'fatiga',
  tono: 'critico',
  prioridad_score: 500,
  requiere_accion: true,
  accion_principal: 'Revisar carga',
  razon: 'RPE medio alto.',
  adherencia_7d_pct: 150,
  carga_score: 546,
}

const summary = crearTrainingRoomSummary(clienteFatiga)
assert.equal(summary.riskLevel, 'alto')
assert.equal(summary.primaryFocus, 'Controlar fatiga')
assert.ok(summary.evidence.some(item => item.includes('RPE')))
assert.ok(summary.coachActions.includes('Revisar volumen e intensidad de la próxima sesión'))

const guidance = crearSesionGuidance({
  nombre: 'Fuerza tren inferior',
  planNombre: 'Hyrox Base',
  ejerciciosCount: 5,
  totalSets: 18,
  hasContextoIa: true,
  hasMedia: true,
})
assert.equal(guidance.mode, 'guiada')
assert.equal(guidance.objective, 'Ejecutar con control y registrar datos útiles')
assert.ok(guidance.coachNote.includes('IA'))
assert.ok(guidance.clientSteps.includes('Revisa el objetivo antes de empezar'))

const decision = crearDecisionSummary({
  prioridad: 2,
  tipo: 'alerta_riesgo_entreno',
  senalesCount: 3,
  ajustesCount: 2,
  evidenciaCount: 1,
})
assert.equal(decision.risk, 'alto')
assert.equal(decision.intent, 'Intervenir antes de la próxima sesión')
assert.ok(decision.checklist.includes('Revisar señales y evidencia'))

console.log('training workspace tests passed')
