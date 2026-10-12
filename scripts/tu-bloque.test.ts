import assert from 'node:assert/strict'
import { construirTuBloque } from '../lib/entrenos/tu-bloque'

const semanas = [
  { n: 1, lunes: '2026-10-05', fase: 'Base', descarga: false, minutos: 130 },
  { n: 2, lunes: '2026-10-12', fase: 'Base', descarga: false, minutos: 145.4 },
  { n: 3, lunes: '2026-10-19', fase: 'Base', descarga: false, minutos: 160 },
  { n: 4, lunes: '2026-10-26', fase: 'Base', descarga: true, minutos: 125 },
  { n: 5, lunes: '2026-11-02', fase: 'Construcción', descarga: false, minutos: 175 },
  { n: 6, lunes: '2026-11-09', fase: 'Construcción', descarga: false, minutos: 180 },
]
const payload = { plan: { notas_cliente_entreno: ' Hola ', mejoras_cliente: ['a', '', 3, 'b', 'c', 'd'], fundamentacion: 'NO', decisiones_clave: [{ x: 1 }] }, macrociclo: { semanas } }

// 2026-10-14 es miércoles: la semana en curso es la del 12-10, y la pasada no se enseña.
const r = construirTuBloque(payload, '2026-10-14')!
assert.equal(r.mensaje, 'Hola')
assert.deepEqual(r.mejoras, ['a', 'b', 'c'])
assert.equal(r.semanas.length, 4)
assert.equal(r.semanas[0].lunes, '2026-10-12')
assert.equal(r.semanas[0].actual, true)
assert.equal(r.semanas[0].minutos, 145)
assert.equal(r.semanas[2].descarga, true)
// Solo sale lo que debe ver el cliente
assert.deepEqual(Object.keys(r).sort(), ['mejoras', 'mensaje', 'semanas'])
// Sin nada que enseñar: null
assert.equal(construirTuBloque({}, '2026-10-14'), null)
assert.equal(construirTuBloque(null, '2026-10-14'), null)
console.log('tu-bloque OK')
