import assert from 'node:assert/strict'
import { ajusteCompeticion, faseEnFecha, perfilPrueba } from '../lib/nutricion/competicion'

// Los límites replican fase_deportiva_cliente, también para fechas futuras.
assert.equal(faseEnFecha('2026-10-05', '2026-07-06'), 'base')
assert.equal(faseEnFecha('2026-10-05', '2026-08-05'), 'construccion')
assert.equal(faseEnFecha('2026-10-05', '2026-09-05'), 'pico')
assert.equal(faseEnFecha('2026-10-05', '2026-09-25'), 'pico_maximo')
assert.equal(faseEnFecha('2026-10-05', '2026-09-28'), 'tapering')
assert.equal(faseEnFecha('2026-10-05', '2026-10-02'), 'carrera_inminente')
assert.equal(faseEnFecha('2026-10-05', '2026-10-04'), 'carrera_inminente')
assert.equal(faseEnFecha('2026-10-05', '2026-10-05'), 'race_day')
assert.equal(faseEnFecha('2026-10-05', '2026-10-06'), 'recuperacion')
assert.equal(faseEnFecha('2026-10-05', '2026-10-16'), 'finalizada')

const taperLarga = ajusteCompeticion('tapering', 5, 'running_maraton')!
assert.deepEqual([taperLarga.ajuste_kcal_pct, taperLarga.ajuste_cho_pct, taperLarga.ajuste_proteinas_pct], [0, 10, 0])
const taperCorta = ajusteCompeticion('tapering', 5, 'running_5k')!
assert.deepEqual([taperCorta.ajuste_kcal_pct, taperCorta.ajuste_cho_pct, taperCorta.ajuste_proteinas_pct], [-5, 0, 0])
const inminenteLarga = ajusteCompeticion('carrera_inminente', 2, 'ultra')!
const inminenteCorta = ajusteCompeticion('carrera_inminente', 2, 'hyrox')!
assert.deepEqual([inminenteLarga.ajuste_kcal_pct, inminenteLarga.ajuste_cho_pct], [10, 30])
assert.deepEqual([inminenteCorta.ajuste_kcal_pct, inminenteCorta.ajuste_cho_pct], [5, 15])
assert.equal(inminenteLarga.cho_g_kg, 12) // ultra: 10-12 g/kg, tope
assert.equal(ajusteCompeticion('carrera_inminente', 2, 'running_maraton')!.cho_g_kg, 10)
assert.equal(ajusteCompeticion('carrera_inminente', 1, 'hyrox')!.cho_g_kg, 8)
assert.equal(ajusteCompeticion('carrera_inminente', 1, 'running_5k')!.cho_g_kg, undefined)
assert.equal(ajusteCompeticion('carrera_inminente', 3, 'ultra')!.cho_g_kg, undefined)
assert.equal(inminenteCorta.cho_g_kg, undefined)
const vispera = ajusteCompeticion('carrera_inminente', 1, 'ironman')!
assert.match(vispera.consejo, /bajos en fibra y grasa/)
const race = ajusteCompeticion('race_day', 0, 'running_hm')!
assert.deepEqual([race.ajuste_kcal_pct, race.ajuste_cho_pct], [10, 20])
assert.match(race.consejo, /1–4 h/)
const recuperacion1 = ajusteCompeticion('recuperacion', -1, 'trail_largo')!
const recuperacion5 = ajusteCompeticion('recuperacion', -5, 'trail_largo')!
assert.deepEqual([recuperacion1.ajuste_cho_pct, recuperacion1.ajuste_proteinas_pct], [20, 10])
assert.match(recuperacion1.consejo, /1,0–1,2 g\/kg/)
assert.deepEqual([recuperacion5.ajuste_cho_pct, recuperacion5.ajuste_proteinas_pct], [0, 5])
assert.equal(ajusteCompeticion('base', 120, 'ironman'), null)
assert.equal(ajusteCompeticion('finalizada', -11, 'ironman'), null)

// Tapering según disciplina: 14 días en maratón, 7 en 5 km
assert.equal(faseEnFecha('2026-10-05', '2026-09-25', 'running_maraton'), 'tapering')
assert.equal(faseEnFecha('2026-10-05', '2026-09-25', 'running_5k'), 'pico_maximo')
assert.equal(faseEnFecha('2026-10-05', '2026-09-27', 'running_hm'), 'tapering')
assert.equal(perfilPrueba('ironman'), 'muy_larga')
assert.equal(perfilPrueba('hyrox'), 'media')
const taperTemprano = ajusteCompeticion('tapering', 12, 'running_maraton')!
assert.deepEqual([taperTemprano.ajuste_kcal_pct, taperTemprano.ajuste_cho_pct], [-5, 0])
console.log('competicion: OK')
