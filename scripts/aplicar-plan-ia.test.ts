import assert from 'node:assert/strict'
import { validarPayloadPlanEntrenoIA } from '../lib/entrenos/aplicar-plan-ia'

const base = { modo: 'crear', fase_bloque: 'Base', nombre_plan: 'Plan', duracion_semanas: 4, es_hibrido: true, macrociclo: null, validacion: null, generado_en: '2026-10-10T10:00:00Z' }
const sesion = { nombre: 'Rodaje', dia_semana: 'martes', ejercicios: [{ nombre: 'Rodaje continuo' }] }

const ok = validarPayloadPlanEntrenoIA({ ...base, plan: { sesiones: [sesion] } })
assert.equal(ok.ok, true)

// Payloads inválidos o manipulados: nada se crea
for (const [nombre, p] of Object.entries({
  'no es objeto': 'hola', 'null': null,
  'sin plan': { ...base },
  'plan no objeto': { ...base, plan: 'x' },
  'sin sesiones': { ...base, plan: { sesiones: [] } },
  'sesiones no es lista': { ...base, plan: { sesiones: 'x' } },
  'demasiadas sesiones': { ...base, plan: { sesiones: Array.from({ length: 15 }, () => sesion) } },
  'sesión sin nombre': { ...base, plan: { sesiones: [{ ejercicios: [] }] } },
  'modo raro': { ...base, modo: 'borrar_todo', plan: { sesiones: [sesion] } },
  'duración absurda': { ...base, duracion_semanas: 500, plan: { sesiones: [sesion] } },
})) {
  const r = validarPayloadPlanEntrenoIA(p)
  assert.equal(r.ok, false, nombre)
}
console.log('aplicar-plan-ia.test OK')
