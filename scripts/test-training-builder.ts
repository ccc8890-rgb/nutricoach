import assert from 'node:assert/strict'
import { duplicarSesionBuilder, moverSesionBuilder } from '../lib/training/builder'

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

console.log('training builder tests passed')
