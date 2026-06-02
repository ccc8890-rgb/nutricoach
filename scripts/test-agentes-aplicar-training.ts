import assert from 'node:assert/strict'
import { crearPlanEntrenoUpdateSeguro } from '../lib/agentes/aplicar'

const update = crearPlanEntrenoUpdateSeguro({
  descripcionActual: 'Plan HYROX base',
  planUpdate: {
    sesiones_por_semana: 4,
    duracion_semanas: 8,
  },
  propuesta: 'Reducir temporalmente la semana a 4 sesiones para mejorar adherencia.',
})

assert.equal(update.campos.duracion_semanas, 8)
assert.ok(!('sesiones_por_semana' in update.campos))
assert.ok(update.campos.descripcion.includes('Plan HYROX base'))
assert.ok(update.campos.descripcion.includes('[IA coach] Objetivo operativo: 4 sesiones/semana'))
assert.ok(update.campos.descripcion.includes('Reducir temporalmente la semana a 4 sesiones'))
assert.equal(update.mensaje, 'Plan de entrenamiento anotado: duración y objetivo semanal operativo')

const empty = crearPlanEntrenoUpdateSeguro({
  descripcionActual: null,
  planUpdate: {},
  propuesta: null,
})
assert.deepEqual(empty.campos, {})
assert.equal(empty.mensaje, 'Sin actualización estructural segura')

console.log('agentes aplicar training tests passed')
