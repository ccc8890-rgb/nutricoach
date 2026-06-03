import assert from 'node:assert/strict'
import { crearPlanEntrenoUpdateSeguro, crearSesionesEntrenoUpdatesSeguros } from '../lib/agentes/aplicar'

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

const sessionUpdates = crearSesionesEntrenoUpdatesSeguros({
  sesionesActuales: [
    {
      id: 'sesion-fuerza',
      nombre: 'Fuerza tren inferior',
      dia_semana: 'Lunes',
      notas: 'Sentadilla principal',
      duracion_estimada_min: 60,
      ejercicios: [
        {
          id: 'ej-sentadilla',
          ejercicio_id: 'sentadilla',
          ejercicio_nombre: 'Sentadilla',
          series: 5,
          repeticiones: '5',
          descanso_segundos: 150,
          rpe: '8',
          notas: 'Trabajo pesado',
          instruccion_ejercicio: null,
        },
      ],
    },
  ],
  sesionesPayload: [
    {
      dia_semana: 'Lunes',
      duracion_estimada_min: 45,
      notas: 'Semana de descarga por fatiga alta.',
      foco: 'Descarga neural',
      ejercicios: [
        {
          ejercicio_nombre: 'Sentadilla',
          series: 3,
          repeticiones: '6',
          rpe: '6',
          notas: 'Bajar carga y dejar 3 repeticiones en recámara.',
        },
      ],
    },
  ],
})

assert.equal(sessionUpdates.sesiones.length, 1)
assert.equal(sessionUpdates.sesiones[0].id, 'sesion-fuerza')
assert.equal(sessionUpdates.sesiones[0].campos.duracion_estimada_min, 45)
assert.ok(sessionUpdates.sesiones[0].campos.notas?.includes('Sentadilla principal'))
assert.ok(sessionUpdates.sesiones[0].campos.notas?.includes('[IA coach] Semana de descarga por fatiga alta.'))
assert.ok(sessionUpdates.sesiones[0].campos.contexto_ia?.includes('Descarga neural'))
assert.equal(sessionUpdates.ejercicios.length, 1)
assert.equal(sessionUpdates.ejercicios[0].id, 'ej-sentadilla')
assert.equal(sessionUpdates.ejercicios[0].campos.series, 3)
assert.equal(sessionUpdates.ejercicios[0].campos.repeticiones, '6')
assert.equal(sessionUpdates.ejercicios[0].campos.rpe, '6')
assert.ok(sessionUpdates.ejercicios[0].campos.notas?.includes('Trabajo pesado'))
assert.ok(sessionUpdates.ejercicios[0].campos.notas?.includes('[IA coach] Bajar carga'))
assert.equal(sessionUpdates.resumen, '1 sesión y 1 ejercicio ajustados')

console.log('agentes aplicar training tests passed')
