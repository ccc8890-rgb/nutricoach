import assert from 'node:assert/strict'
import { notaLegible, pausa, ritmoDeLaNota } from '../lib/training/ejercicio-texto'

assert.equal(pausa(120), '2:00'); assert.equal(pausa(90), '1:30'); assert.equal(pausa(45), '45s')
const nota = 'RPE 6-7 (sem 1-2) · 7-8 (sem 3) — A 4:15/km, con 2 min de recuperación'
assert.equal(ritmoDeLaNota(nota), '4:15/km')
assert.equal(ritmoDeLaNota('RPE 7 — Sin ritmo en el texto'), null)
assert.equal(ritmoDeLaNota(null), null)
assert.equal(notaLegible(nota), 'Esfuerzo 6-7 de 10. A 4:15/km, con 2 min de recuperación')
assert.equal(notaLegible('RPE 7 (RIR 2-3) — Escápulas retraídas'), 'Esfuerzo 7 de 10. Escápulas retraídas')
assert.equal(notaLegible('Sin prefijo de esfuerzo'), 'Sin prefijo de esfuerzo')
console.log('ejercicios-texto OK')
