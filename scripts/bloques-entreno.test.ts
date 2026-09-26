import assert from 'node:assert/strict'
import {
  siguienteFaseBloque,
  calcularEstadoBloque,
  clasificarTipoSesion,
  calcularBloqueInfo,
  DIAS_SEMANA_ORDEN,
  DIAS_SEMANA_ABREVIATURA,
} from '../lib/entrenos/bloques'

// --- siguienteFaseBloque: rotación fija Base -> Fuerza -> Resistencia -> Deload -> Base ---
assert.equal(siguienteFaseBloque(null), 'Base')
assert.equal(siguienteFaseBloque(undefined), 'Base')
assert.equal(siguienteFaseBloque('Base'), 'Fuerza')
assert.equal(siguienteFaseBloque('Fuerza'), 'Resistencia')
assert.equal(siguienteFaseBloque('Resistencia'), 'Deload')
assert.equal(siguienteFaseBloque('Deload'), 'Base')

// --- calcularEstadoBloque: semana 1 el día de inicio ---
const inicio = '2026-09-01'
const bloqueDia0 = calcularEstadoBloque(inicio, 4, new Date('2026-09-01T12:00:00Z'))
assert.equal(bloqueDia0.semanaActual, 1)
assert.equal(bloqueDia0.semanasTotales, 4)
assert.equal(bloqueDia0.terminado, false)

// --- semana 2 tras 7 días ---
const bloqueSemana2 = calcularEstadoBloque(inicio, 4, new Date('2026-09-08T12:00:00Z'))
assert.equal(bloqueSemana2.semanaActual, 2)

// --- terminado tras las 4 semanas completas ---
const bloqueTerminado = calcularEstadoBloque(inicio, 4, new Date('2026-09-29T12:00:00Z'))
assert.equal(bloqueTerminado.terminado, true)
assert.equal(bloqueTerminado.diasRestantes, 0)
// nunca debe pasarse de semanasTotales aunque hayan pasado muchas más semanas
assert.equal(bloqueTerminado.semanaActual, 4)

// --- reloj/fecha de inicio en el futuro respecto a fechaRef: no debe dar negativos ni NaN ---
const bloqueFuturo = calcularEstadoBloque('2099-01-01', 4, new Date('2026-09-01T12:00:00Z'))
assert.equal(bloqueFuturo.semanaActual, 1)
assert.equal(Number.isNaN(bloqueFuturo.diasRestantes), false)
assert.ok(bloqueFuturo.diasRestantes >= 0)

// --- calcularEstadoBloque: comparación por día completo, no por horas ---
// Bug real de revisión: un plan creado a las 20:00 comparado con "ahora" a
// las 10:00 exactamente 7 días después daba diasTranscurridos=6 (semana 1)
// en vez de 7 (semana 2), porque restaba timestamps crudos en vez de
// truncar ambas fechas a medianoche primero.
const bloqueHoraTardia = calcularEstadoBloque('2026-09-01T20:00:00Z', 4, new Date('2026-09-08T10:00:00Z'))
assert.equal(bloqueHoraTardia.semanaActual, 2, 'debe contar por día de calendario, no por diferencia exacta de horas')

// --- clasificarTipoSesion ---
assert.equal(clasificarTipoSesion(['fuerza', 'fuerza', 'funcional']), 'hibrido')
assert.equal(clasificarTipoSesion(['cardio', 'cardio', 'cardio']), 'carrera')
assert.equal(clasificarTipoSesion(['fuerza', 'cardio']), 'mixto')
// sesión sin ejercicios vinculados: no debe dividir por cero ni lanzar
assert.equal(clasificarTipoSesion([]), 'mixto')
// Bug real de revisión: sesión híbrida típica (2 estaciones cardio + 3
// ejercicios de fuerza/funcional) daba 'mixto' en vez de 'hibrido' porque
// el umbral 0.6/0.2 dejaba una franja intermedia demasiado ancha.
assert.equal(clasificarTipoSesion(['cardio', 'cardio', 'fuerza', 'fuerza', 'funcional']), 'hibrido')

// --- calcularBloqueInfo: helper compartido para no duplicar el cálculo en cada API ---
assert.equal(calcularBloqueInfo('2026-09-01', 4, null), null)
assert.equal(calcularBloqueInfo('2026-09-01', null, 'Base'), null)
const bloqueInfo = calcularBloqueInfo('2026-09-01', 4, 'Fuerza', new Date('2026-09-08T12:00:00Z'))
assert.deepEqual(bloqueInfo, { fase: 'Fuerza', semana_actual: 2, semanas_totales: 4 })

// --- DIAS_SEMANA_ABREVIATURA[DIAS_SEMANA_ORDEN[dia]] debe dar la letra correcta ---
// Bug real encontrado en revisión: /cliente/mes usaba un array de cabeceras
// domingo-primero (['D','L','M','X','J','V','S']) indexado con un orden
// lunes-primero, desplazando cada columna del calendario un día.
const letraEsperadaPorDia: Record<string, string> = {
  Lunes: 'L', Martes: 'M', Miércoles: 'X', Jueves: 'J', Viernes: 'V', Sábado: 'S', Domingo: 'D',
}
for (const [dia, letra] of Object.entries(letraEsperadaPorDia)) {
  assert.equal(DIAS_SEMANA_ABREVIATURA[DIAS_SEMANA_ORDEN[dia]], letra, `${dia} debería mapear a "${letra}"`)
}

console.log('OK — bloques-entreno')
