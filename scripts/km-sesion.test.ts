import assert from 'node:assert/strict'
import { kmDeSesion, ritmosDeVdot, textoKm } from '../lib/entrenos/km-sesion'

const r = ritmosDeVdot(45)
// Rodaje por tiempo: 50 min a ritmo E (5:54/km) ≈ 8,5 km
const rodaje = [{ tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 3000 }, objetivo: { tipo: 'zona', zona: 'E' } }]
assert.equal(kmDeSesion(rodaje, r), 8.5)
// Por distancia no necesita ritmo: 7 × 400 m = 2,8 km
const series = [{ tipo: 'repetir', veces: 7, pasos: [{ tipo: 'trabajo', duracion: { unidad: 'metros', valor: 400 } }] }]
assert.equal(kmDeSesion(series, null), 2.8)
// Sin pasos o inválidos: null (no se inventa)
assert.equal(kmDeSesion(null, r), null)
assert.equal(kmDeSesion([], r), null)
assert.equal(textoKm(8.5), '8,5 km')
assert.equal(textoKm(null), null)
console.log('km-sesion OK')
