import assert from 'node:assert/strict'
import { PLAN_EDITOR_PLAN_SELECT, PLAN_EDITOR_SESIONES_SELECT } from '../app/api/entrenos/[id]/route'

assert.ok(PLAN_EDITOR_PLAN_SELECT.includes('coach_id'))
assert.ok(PLAN_EDITOR_PLAN_SELECT.includes('cliente:clientes(profile:profiles!profile_id(nombre, apellidos))'))
assert.ok(PLAN_EDITOR_SESIONES_SELECT.includes('ejercicios:sesion_ejercicios'))
assert.ok(PLAN_EDITOR_SESIONES_SELECT.includes('ejercicio:ejercicios'))

console.log('entreno plan api select tests passed')
