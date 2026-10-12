import assert from 'node:assert/strict'
import { faseDeBloqueSegunObjetivos, objetivoPrincipal, planificarAnio, textoObjetivos, type ObjetivoAnual } from '../lib/entrenos/objetivos-anuales'

const hoy = '2026-10-12'
const hyrox: ObjetivoAnual = { nombre: 'Hyrox Valencia', fecha: '2027-03-20', prioridad: 'A', estado: 'posible', disciplina: 'hyrox' }
const media: ObjetivoAnual = { nombre: 'Media de prueba', fecha: '2026-12-13', prioridad: 'B', estado: 'posible', disciplina: 'running_hm' }
const c10k: ObjetivoAnual = { nombre: '10K popular', fecha: '2026-11-08', prioridad: 'C', estado: 'posible', disciplina: 'running_10k' }

// Sin objetivos: mantenimiento y sin fase propuesta
assert.deepEqual(planificarAnio([], hoy, 8).map(t => t.fase), ['mantenimiento'])
assert.equal(faseDeBloqueSegunObjetivos([], hoy), null)
// Solo una C: no cambia nada
assert.equal(faseDeBloqueSegunObjetivos([c10k], hoy), null)
assert.equal(objetivoPrincipal([c10k, hyrox], hoy)?.nombre, 'Hyrox Valencia')

// Hyrox A el 20-03: desde hoy son 23 semanas → base; a 12 sem fuerza; a 6 sem resistencia; la semana de la prueba, carrera; luego recuperación
const t = planificarAnio([hyrox], hoy, 52)
const faseEn = (f: string) => t.find(x => x.desde <= f && f <= x.hasta)!.fase
assert.equal(faseEn('2026-10-12'), 'base')
assert.equal(faseEn('2026-12-28'), 'fuerza')
assert.equal(faseEn('2027-02-08'), 'resistencia')
assert.equal(faseEn('2027-03-15'), 'carrera')
assert.equal(faseEn('2027-03-22'), 'recuperacion')
assert.equal(faseEn('2027-05-17'), 'mantenimiento')
assert.equal(faseDeBloqueSegunObjetivos([hyrox], '2027-02-08'), 'Resistencia')

// Un B entre medias hace un mini-pico y luego recupera una semana
const dos = planificarAnio([media, hyrox], hoy, 30)
const f2 = (f: string) => dos.find(x => x.desde <= f && f <= x.hasta)!.fase
assert.equal(f2('2026-11-30'), 'afinado')
assert.equal(f2('2026-12-07'), 'carrera')
assert.equal(f2('2026-12-14'), 'recuperacion')
assert.equal(f2('2026-12-21'), 'fuerza') // vuelve a construir hacia el A

assert.match(textoObjetivos([media, hyrox], hoy), /POSIBLE/)
assert.equal(textoObjetivos([], hoy), '')
console.log('objetivos-anuales OK')
