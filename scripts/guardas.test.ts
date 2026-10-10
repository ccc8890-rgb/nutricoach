import assert from 'node:assert/strict'
import { ritmosDesdeVdot } from '../lib/entrenos/ritmos'
import { MAX_DECISIONES_IA, proponeSubirCarga, ritmosEnTexto, tipoDeSesion, validarDecisionesIA, type DecisionIA } from '../lib/rendimiento/guardas'
import type { EstadoAtleta } from '../lib/rendimiento/estado'
import type { PropuestaRegla } from '../lib/rendimiento/reglas'

const estado = (o: Partial<EstadoAtleta> = {}): EstadoAtleta => ({
  hoy: '2026-10-10', carreras6sem: 12, fcUmbral: 177, vdot: 45, ritmos: null, carga: null,
  intensidad: { minutos: 300, pctSuave: 70, pctMedia: 20, pctDura: 10, valoracion: 'mejorable' }, intensidadPrevia: { minutos: 0, pctSuave: 0, pctMedia: 0, pctDura: 0, valoracion: 'sin_datos' },
  limitesFc: null, deriva: { media: null, n: 0 }, eficiencia: { ultimas3: null, previas3: null }, fuerza28d: 0, fuerzaEnPlan: 0, carrerasPorSemana: 3, kmPorSemana: 30, minutosCarreraPorSemana: 180,
  ejecucion: { repsEvaluadas: 0, repsLentas: 0, sesionesEvaluadas: 0, sesionesSaltadas: 0 }, diasCompeticion: null, alertas: [], ...o,
})
const dec = (o: Partial<DecisionIA> = {}): DecisionIA => ({ sesion: 'general', cambio: 'Mantener la estructura de la semana y revisar el sábado', razon: 'Los datos son estables y no hay motivo para tocar el plan.', evidencia: 'criterio de entrenador (sin cita)', confianza: 0.6, ...o })
const regla = (o: Partial<PropuestaRegla> = {}): PropuestaRegla => ({ regla: 'x', sesion: 'general', cambio: 'c'.repeat(30), razon: 'r'.repeat(30), riesgo: 'bajo', dois: [], datos: 1, persistencia: 1, prioridad: 3, ...o })

// Tipos de sesión por nombre.
assert.equal(tipoDeSesion('Carrera: Series Cortas en Descarga (lunes)'), 'calidad')
assert.equal(tipoDeSesion('Carrera: Tempo Run en Descarga'), 'calidad')
assert.equal(tipoDeSesion('Carrera: Tirada Larga Aeróbica Z2 (sábado)'), 'rodaje')
assert.equal(tipoDeSesion('Híbrida A: SkiErg + Fuerza de Espalda'), 'fuerza')
assert.equal(tipoDeSesion('general'), 'general')

// Detección de «sube la carga» (y su negación).
assert.equal(proponeSubirCarga('Subir el volumen de la tirada larga un 10 %'), true)
assert.equal(proponeSubirCarga('Añadir una serie más de 400 m'), true)
assert.equal(proponeSubirCarga('No aumentar el volumen esta semana'), false)
assert.equal(proponeSubirCarga('Mantener los 20 minutos de tempo en el rango 4:55-5:05'), false)
assert.equal(proponeSubirCarga('Evitar subir el kilometraje hasta que baje la fatiga'), false)

// Una métrica que no encaja con la sesión se quita, la decisión se conserva con aviso.
const serie = validarDecisionesIA([dec({ sesion: 'Carrera: Series Cortas', cambio: 'Respetar el rango 4:15-4:30/km en las 7 repeticiones', metrica_objetivo: 'pct_suave' })], estado(), [])
assert.equal(serie.aceptadas.length, 1)
assert.equal(serie.aceptadas[0].metrica_objetivo, undefined)
assert.ok(serie.aceptadas[0].avisos[0].includes('no encaja'))
// En un rodaje sí encaja.
assert.equal(validarDecisionesIA([dec({ sesion: 'Tirada Larga Z2', metrica_objetivo: 'deriva' })], estado(), []).aceptadas[0].metrica_objetivo, 'deriva')

// Con sobrecarga activa se descarta lo que sube carga, y se conserva lo demás.
const sobre = estado({ alertas: ['fatiga_alta'] })
const r1 = validarDecisionesIA([dec({ cambio: 'Subir el volumen de carrera un 10 % la próxima semana' }), dec({ cambio: 'Mantener las sesiones y dormir al menos 8 horas esta semana' })], sobre, [])
assert.equal(r1.aceptadas.length, 1)
assert.ok(r1.descartadas[0].motivo.includes('sobrecarga'))
// Con la métrica marcada como «que suba» también.
assert.equal(validarDecisionesIA([dec({ cambio: 'Más tiempo de calidad esta semana', metrica_objetivo: 'km_semana', direccion: 'sube' })], sobre, []).descartadas.length, 1)

// A menos de 14 días de una carrera no se sube carga.
assert.equal(validarDecisionesIA([dec({ cambio: 'Añadir una sesión de series más esta semana' })], estado({ diasCompeticion: 9 }), []).aceptadas.length, 0)

// Si el motor ya cubre la métrica, la decisión de la IA se descarta.
const dup = validarDecisionesIA([dec({ sesion: 'Rodaje', metrica_objetivo: 'pct_suave' })], estado(), [regla({ metrica_objetivo: 'pct_suave' })])
assert.equal(dup.aceptadas.length, 0)
assert.ok(dup.descartadas[0].motivo.includes('ya la cubre'))

// Textos vacíos o con valores sin calcular.
assert.equal(validarDecisionesIA([dec({ cambio: 'ok' }), dec({ cambio: 'Subir a NaN minutos el rodaje largo' })], estado(), []).aceptadas.length, 0)

// Tope de decisiones nuevas: se quedan las de más confianza.
const muchas = validarDecisionesIA([dec({ cambio: 'Primera decisión de ejemplo suficientemente larga', confianza: 0.4 }), dec({ cambio: 'Segunda decisión de ejemplo suficientemente larga', confianza: 0.9 }), dec({ cambio: 'Tercera decisión de ejemplo suficientemente larga', confianza: 0.7 })], estado(), [])
assert.equal(muchas.aceptadas.length, MAX_DECISIONES_IA)
assert.deepEqual(muchas.aceptadas.map(d => d.confianza), [0.9, 0.7])
assert.equal(muchas.descartadas.length, 1)

// Riesgo: con pasos nuevos es medio; sin pasos ni subida, bajo.
assert.equal(validarDecisionesIA([dec({ pasos: [{ tipo: 'trabajo' }], sesion_id: 'x' })], estado(), []).aceptadas[0].riesgo, 'medio')
assert.equal(validarDecisionesIA([dec()], estado(), []).aceptadas[0].riesgo, 'bajo')
// Ritmos escritos: se extraen y se validan contra el VDOT (R ≈ 3:52/km, E ≈ 5:54/km con VDOT 45).
assert.deepEqual(ritmosEnTexto('Rango 4:55-5:05/km y 20 min a las 10:30'), [295, 305])
assert.deepEqual(ritmosEnTexto('sin ritmos'), [])
const v45 = estado({ ritmos: ritmosDesdeVdot(45) })
assert.equal(validarDecisionesIA([dec({ cambio: 'Mantener el tempo en el rango 4:55-5:05/km los 20 minutos' })], v45, []).aceptadas.length, 1)
const imposible = validarDecisionesIA([dec({ cambio: 'Hacer las series a 3:10/km con recuperación corta entre repeticiones' })], v45, [])
assert.equal(imposible.aceptadas.length, 0)
assert.ok(imposible.descartadas[0].motivo.includes('imposible para su VDOT'))
assert.equal(validarDecisionesIA([dec({ cambio: 'Hacer el rodaje a 9:00/km caminando cuando haga falta' })], v45, []).aceptadas.length, 0, 'demasiado lento incluso para un rodaje')
// Sin VDOT no se puede comprobar: no se descarta por ritmo.
assert.equal(validarDecisionesIA([dec({ cambio: 'Hacer las series a 3:10/km con recuperación corta entre repeticiones' })], estado(), []).aceptadas.length, 1)
console.log('guardas.test OK')
