import assert from 'node:assert/strict'
import { pasosDeSesionCarrera, segundosDe, metrosDe } from '../lib/entrenos/pasos-desde-plan-ia'
import type { SemanaMacro } from '../lib/entrenos/macrociclo'

const semana = { n: 1, lunes: '2026-10-12', fase: 'base', descarga: false, minutos: 145, salidas: 3, tiradaMin: 60, pctSuave: 80, fuerza: 3, notas: [],
  sesiones: [{ tipo: 'series', minutos: 35, dia: 1 }, { tipo: 'rodaje', minutos: 50, dia: 3 }, { tipo: 'tirada', minutos: 60, dia: 5 }, { tipo: 'tempo', minutos: 40, dia: 4 }] } as unknown as SemanaMacro

assert.equal(segundosDe('8min'), 480)
assert.equal(segundosDe('2 min'), 120)
assert.equal(segundosDe('30s'), 30)
assert.equal(segundosDe('20m skipping'), null)
assert.equal(segundosDe(5), null)
assert.equal(metrosDe('500m'), 500)
assert.equal(metrosDe('1000 m'), 1000)
assert.equal(metrosDe('1.000m'), 1000)
assert.equal(metrosDe('1km'), 1000)
assert.equal(metrosDe('20m skipping + 20m talones'), null)
assert.equal(metrosDe('2min'), null)

const series = { nombre: 'Series · 5×2 min', dia_semana: 'Martes', ritmo_objetivo: '4:15/km', ejercicios: [
  { bloque: 'calentamiento', repeticiones: '8min', series: 1 }, { bloque: 'calentamiento', repeticiones: '20m skipping', series: 3 },
  { bloque: 'principal', series: 5, repeticiones: '2min' }, { bloque: 'vuelta_calma', repeticiones: '4min', series: 1 }] }
const ps = pasosDeSesionCarrera(series, semana)!
assert.equal(ps.length, 3)
assert.equal(ps[0].tipo, 'calentamiento'); assert.deepEqual((ps[0] as { duracion: unknown }).duracion, { unidad: 'segundos', valor: 480 })
const rep = ps[1] as { tipo: string; veces: number; pasos: { objetivo?: { zona?: string }; duracion: { valor: number } }[] }
assert.equal(rep.tipo, 'repetir'); assert.equal(rep.veces, 5); assert.equal(rep.pasos[0].objetivo?.zona, 'I'); assert.equal(rep.pasos[0].duracion.valor, 120)
assert.deepEqual((ps[2] as { duracion: unknown }).duracion, { unidad: 'segundos', valor: 240 })

// Rodaje y tirada: un paso en zona E con los minutos del esqueleto
const rodaje = pasosDeSesionCarrera({ nombre: 'Rodaje', dia_semana: 'Jueves', ritmo_objetivo: '5:54/km', ejercicios: [] }, semana)!
assert.deepEqual(rodaje, [{ tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 3000 }, objetivo: { tipo: 'zona', zona: 'E' } }])
const tirada = pasosDeSesionCarrera({ nombre: 'Tirada', dia_semana: 'Sábado', ritmo_objetivo: '5:54/km', ejercicios: [] }, semana)!
assert.equal((tirada[0] as { duracion: { valor: number } }).duracion.valor, 3600)
// Tempo: calentamiento + trabajo T + enfriamiento que suman la sesión
const tempo = pasosDeSesionCarrera({ nombre: 'Tempo', dia_semana: 'Viernes', ritmo_objetivo: '4:38/km', ejercicios: [] }, semana)!
assert.equal(tempo.length, 3); assert.equal((tempo[1] as { objetivo: { zona: string } }).objetivo.zona, 'T')
assert.equal(tempo.reduce((a, p) => a + (p as { duracion: { valor: number } }).duracion.valor, 0), 2400)

// Sin pasos (nunca se inventan): híbrida (sin ritmo), series sin reps legibles, día sin sesión de carrera, sin esqueleto
assert.equal(pasosDeSesionCarrera({ nombre: 'Híbrido', dia_semana: 'Miércoles', ejercicios: [] }, semana), null)
assert.equal(pasosDeSesionCarrera({ ...series, ejercicios: [{ bloque: 'principal', series: 5, repeticiones: 'al límite' }] }, semana), null)

// Series en pista, por distancia: el trabajo va en metros y la recuperación por tiempo (trote)
const pista = pasosDeSesionCarrera({ ...series, nombre: 'Series · 5×500 m', ejercicios: [
  { bloque: 'calentamiento', repeticiones: '8min', series: 1 },
  { bloque: 'principal', series: 5, repeticiones: '500m', descanso_segundos: 120 }, { bloque: 'vuelta_calma', repeticiones: '4min', series: 1 }] }, semana)!
const bloque = pista[1] as { tipo: string; veces: number; pasos: { tipo: string; duracion: { unidad: string; valor: number } }[] }
assert.equal(bloque.tipo, 'repetir'); assert.equal(bloque.veces, 5)
assert.deepEqual(bloque.pasos[0].duracion, { unidad: 'metros', valor: 500 })
assert.deepEqual(bloque.pasos[1].duracion, { unidad: 'segundos', valor: 120 })
assert.equal(pasosDeSesionCarrera({ ...rodaje2(), dia_semana: 'Domingo' }, semana), null)
assert.equal(pasosDeSesionCarrera(series, undefined), null)
function rodaje2() { return { nombre: 'x', ritmo_objetivo: '5:00/km', ejercicios: [] } }
console.log('pasos-desde-plan-ia.test OK')
