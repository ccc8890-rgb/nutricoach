import assert from 'node:assert/strict'
import { crearBuilderLoadSummary, duplicarSesionBuilder, moverSesionBuilder } from '../lib/training/builder'

const sesiones = [
  {
    id: 's1',
    nombre: 'Fuerza A',
    dia_semana: 'Lunes',
    orden: 0,
    notas: '',
    expandida: false,
    ejercicios: [
      { id: 'e1', ejercicio_id: 'sq', ejercicio_nombre: 'Sentadilla', ejercicio_grupo: 'Pierna', ejercicio_tipo: 'fuerza', series: 4, repeticiones: '5', descanso_segundos: 150, peso_sugerido: 'RPE 8', notas: '', orden: 0 },
    ],
  },
  {
    id: 's2',
    nombre: 'Engine',
    dia_semana: 'Miércoles',
    orden: 1,
    notas: '',
    expandida: false,
    ejercicios: [],
  },
]

const duplicadas = duplicarSesionBuilder(sesiones, 's1', () => 'copy')
assert.equal(duplicadas.length, 3)
assert.equal(duplicadas[1].nombre, 'Fuerza A copia')
assert.equal(duplicadas[1].dia_semana, 'Martes')
assert.equal(duplicadas[1].orden, 1)
assert.equal(duplicadas[1].expandida, true)
assert.equal(duplicadas[1].ejercicios[0].id, 'copy-ej-0')
assert.equal(duplicadas[1].ejercicios[0].orden, 0)
assert.equal(duplicadas[2].orden, 2)

const movedDown = moverSesionBuilder(sesiones, 's1', 'down')
assert.equal(movedDown[0].id, 's2')
assert.equal(movedDown[0].orden, 0)
assert.equal(movedDown[1].id, 's1')
assert.equal(movedDown[1].orden, 1)

const movedUpAtTop = moverSesionBuilder(sesiones, 's1', 'up')
assert.deepEqual(movedUpAtTop.map(s => s.id), ['s1', 's2'])

const loadSummary = crearBuilderLoadSummary([
  {
    ...sesiones[0],
    ejercicios: [
      { id: 'e1', ejercicio_id: 'sq', ejercicio_nombre: 'Sentadilla', ejercicio_grupo: 'Pierna', ejercicio_tipo: 'fuerza', series: 5, repeticiones: '5', descanso_segundos: 180, peso_sugerido: 'RPE 8', notas: '', orden: 0 },
      { id: 'e2', ejercicio_id: 'bp', ejercicio_nombre: 'Press banca', ejercicio_grupo: 'Pecho', ejercicio_tipo: 'fuerza', series: 4, repeticiones: '6', descanso_segundos: 150, peso_sugerido: 'RPE 8', notas: '', orden: 1 },
    ],
  },
  {
    ...sesiones[1],
    ejercicios: [
      { id: 'e3', ejercicio_id: 'run', ejercicio_nombre: 'Intervalos', ejercicio_grupo: 'Cardio', ejercicio_tipo: 'cardio', series: 6, repeticiones: '400m', descanso_segundos: 90, peso_sugerido: '', notas: '', orden: 0 },
    ],
  },
])
assert.equal(loadSummary.totalSesiones, 2)
assert.equal(loadSummary.totalSets, 15)
assert.equal(loadSummary.diasProgramados, 2)
assert.equal(loadSummary.sesionesFuertes, 2)
assert.equal(loadSummary.tone, 'warn')
assert.ok(loadSummary.alertas.includes('Semana exigente: revisa recuperación y distribución de intensidad'))
assert.ok(loadSummary.minutosEstimados > 0)

console.log('training builder tests passed')
