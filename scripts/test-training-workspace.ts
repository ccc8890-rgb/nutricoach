import assert from 'node:assert/strict'
import {
  calcularEjercicioQuality,
  calcularPlantillaQuality,
  crearCoachDeskPlan,
  crearDecisionSummary,
  crearDecisionTrace,
  crearTrainingCockpitCards,
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

const traceMensaje = crearDecisionTrace({
  tipo: 'alerta_riesgo_entreno',
  estado: 'pendiente',
  prioridad: 2,
  senalesCount: 3,
  ajustesCount: 1,
  advertenciasCount: 1,
  logrosCount: 0,
  evidenciaCount: 2,
  hasMensajeCliente: true,
  hasAutoApplyPayload: false,
})
assert.equal(traceMensaje.applicationMode, 'mensaje')
assert.equal(traceMensaje.applicationLabel, 'Envía mensaje al cliente al aprobar')
assert.ok(traceMensaje.impactLabel.includes('Impacto alto'))
assert.ok(traceMensaje.traceItems.includes('2 fuentes científicas'))

const traceAuto = crearDecisionTrace({
  tipo: 'ajuste_nutricion_carga',
  estado: 'pendiente',
  prioridad: 5,
  senalesCount: 2,
  ajustesCount: 2,
  advertenciasCount: 0,
  logrosCount: 0,
  evidenciaCount: 1,
  hasMensajeCliente: false,
  hasAutoApplyPayload: true,
})
assert.equal(traceAuto.applicationMode, 'auto')
assert.equal(traceAuto.applicationLabel, 'Puede aplicar ajuste al aprobar')
assert.equal(traceAuto.coachNextAction, 'Aprobar solo si los números encajan con el contexto actual')

const traceAutoSinPayload = crearDecisionTrace({
  tipo: 'ajuste_nutricion_carga',
  estado: 'pendiente',
  prioridad: 5,
  senalesCount: 2,
  ajustesCount: 1,
  advertenciasCount: 0,
  logrosCount: 0,
  evidenciaCount: 1,
  hasMensajeCliente: false,
  hasAutoApplyPayload: false,
})
assert.equal(traceAutoSinPayload.applicationMode, 'manual')
assert.equal(traceAutoSinPayload.applicationLabel, 'Requiere edición manual del plan')

const traceManual = crearDecisionTrace({
  tipo: 'training_brain',
  estado: 'pendiente',
  prioridad: 6,
  senalesCount: 1,
  ajustesCount: 1,
  advertenciasCount: 0,
  logrosCount: 1,
  evidenciaCount: 0,
  hasMensajeCliente: false,
  hasAutoApplyPayload: false,
})
assert.equal(traceManual.applicationMode, 'manual')
assert.equal(traceManual.applicationLabel, 'Requiere edición manual del plan')
assert.ok(traceManual.traceItems.includes('Sin evidencia adjunta'))

const coachDesk = crearCoachDeskPlan({
  estado: 'ajustar',
  hasPlan: true,
  hasPerfil: false,
  accionesCount: 2,
  fuentesExternasCount: 0,
})
assert.equal(coachDesk.phase, 'Decisión')
assert.equal(coachDesk.primaryAction, 'Revisar IA')
assert.ok(coachDesk.blockers.includes('Completar perfil atleta'))

const cockpit = crearTrainingCockpitCards({
  hasPlan: true,
  hasPerfil: false,
  tareasPendientesCount: 2,
  adherenciaPct: 62,
  sesiones7d: 2,
  sesionesObjetivo: 4,
})
assert.equal(cockpit.length, 4)
assert.equal(cockpit[0].label, 'Plan')
assert.equal(cockpit[0].tone, 'ok')
assert.equal(cockpit[1].label, 'Perfil')
assert.equal(cockpit[1].tone, 'warn')
assert.equal(cockpit[2].label, 'IA')
assert.equal(cockpit[2].value, '2 pendientes')
assert.equal(cockpit[2].tone, 'warn')
assert.equal(cockpit[3].label, 'Adherencia')
assert.equal(cockpit[3].tone, 'warn')

const cockpitSinPlan = crearTrainingCockpitCards({
  hasPlan: false,
  hasPerfil: false,
  tareasPendientesCount: 0,
  adherenciaPct: null,
  sesiones7d: 0,
  sesionesObjetivo: null,
})
assert.equal(cockpitSinPlan[0].tone, 'alert')
assert.equal(cockpitSinPlan[0].action, 'Crear plan')
assert.equal(cockpitSinPlan[3].value, 'Sin objetivo')

console.log('training workspace tests passed')
