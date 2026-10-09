// scripts/proxima-fecha.test.ts
import assert from 'node:assert/strict'
import { proximaFechaDia } from '../lib/entrenos/proxima-fecha'

// 09-10-2026 es viernes
const viernes = new Date(2026, 9, 9, 12, 0, 0)
assert.equal(proximaFechaDia('Viernes', viernes), '2026-10-09') // hoy
assert.equal(proximaFechaDia('Sábado', viernes), '2026-10-10')
assert.equal(proximaFechaDia('sabado', viernes), '2026-10-10') // sin acento/minúscula
assert.equal(proximaFechaDia('Lunes', viernes), '2026-10-12') // ya pasó esta semana → próximo
assert.equal(proximaFechaDia('Miércoles', viernes), '2026-10-14')
assert.equal(proximaFechaDia('MIERCOLES', viernes), '2026-10-14')
assert.equal(proximaFechaDia('Domingo', viernes), '2026-10-11')
assert.equal(proximaFechaDia('Jueves', viernes), '2026-10-15')
assert.equal(proximaFechaDia('Funsday', viernes), null)
assert.equal(proximaFechaDia(null, viernes), null)
assert.equal(proximaFechaDia('', viernes), null)
// Cambio de mes
assert.equal(proximaFechaDia('Lunes', new Date(2026, 9, 30, 9, 0, 0)), '2026-11-02')

console.log('proxima-fecha.test.ts OK')
