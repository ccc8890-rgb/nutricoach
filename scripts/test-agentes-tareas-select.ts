import assert from 'node:assert/strict'
import { AGENTE_TAREAS_SELECT } from '../app/api/agentes/tareas/route'

assert.ok(
  AGENTE_TAREAS_SELECT.includes('profile:profiles!profile_id'),
  'El selector de tareas debe desambiguar clientes.profile_id -> profiles para evitar errores PostgREST'
)
assert.ok(!AGENTE_TAREAS_SELECT.includes('profiles ( nombre, apellidos )'))

console.log('agentes tareas select tests passed')
