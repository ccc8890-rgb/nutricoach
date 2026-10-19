import assert from 'node:assert/strict'
import { ejercicioDeLaSemana, nombreSinCifras, pasosDeLaSemana, progresionDeMacro, semanaDelBloque, objetivoOpen } from '../lib/entrenos/progresion-semanal'
import { resumenSesion } from '../lib/entrenos/pasos'

// Semanas del bloque: plan creado un lunes (12-10), 4 semanas
const plan = { created_at: '2026-10-12T12:17:00Z', duracion_semanas: 4 }
assert.equal(semanaDelBloque(plan, '2026-10-12'), 1)
assert.equal(semanaDelBloque(plan, '2026-10-18'), 1)
assert.equal(semanaDelBloque(plan, '2026-10-19'), 2)
assert.equal(semanaDelBloque(plan, '2026-11-02'), 4)
assert.equal(semanaDelBloque(plan, '2026-11-09'), null)
assert.equal(semanaDelBloque(plan, '2026-10-05'), null)
// Plan creado a mitad de semana: la semana 1 es la natural
assert.equal(semanaDelBloque({ created_at: '2026-10-14T09:00:00Z', duracion_semanas: 4 }, '2026-10-19'), 2)

// Fuerza: sentadilla 80 kg 4×5. S1-S2 igual, S3 +2,5 kg, S4 descarga (-35 % series, -10 % carga sobre lo de S3)
const sent = { nombre: 'Sentadilla con barra', bloque: 'principal', series: 4, repeticiones: '5', peso_sugerido: '80kg' }
assert.equal(ejercicioDeLaSemana(sent, 1, false).peso_sugerido, '80kg')
assert.equal(ejercicioDeLaSemana(sent, 2, false).peso_sugerido, '80kg')
assert.equal(ejercicioDeLaSemana(sent, 3, false).peso_sugerido, '82.5kg')
const d = ejercicioDeLaSemana(sent, 4, true)
assert.equal(d.series, 3); assert.equal(d.peso_sugerido, '74.5kg')
// Trineo +10 kg y referencia Open
const sled = { nombre: 'Sled push', bloque: 'principal', series: 3, repeticiones: '25m', peso_sugerido: '110kg' }
assert.equal(ejercicioDeLaSemana(sled, 3, false).peso_sugerido, '120kg')
assert.equal(ejercicioDeLaSemana(sled, 3, false).objetivo_open, '152 kg')
assert.equal(objetivoOpen('Farmer Carry'), '2 × 24 kg')
// SkiErg +1 serie en S3, pliometría +1 serie y a la mitad en descarga
assert.equal(ejercicioDeLaSemana({ nombre: 'SkiErg', bloque: 'principal', series: 4, repeticiones: '500m', peso_sugerido: null }, 3, false).series, 5)
assert.equal(ejercicioDeLaSemana({ nombre: 'Salto vertical (CMJ)', bloque: 'pliometria', series: 5, repeticiones: '6', peso_sugerido: null }, 3, false).series, 6)
assert.equal(ejercicioDeLaSemana({ nombre: 'Salto vertical (CMJ)', bloque: 'pliometria', series: 5, repeticiones: '6', peso_sugerido: null }, 4, true).series, 3)
// Calentamiento y accesorios sin peso de barra no cambian
assert.equal(ejercicioDeLaSemana({ nombre: 'Sentadilla goblet', bloque: 'calentamiento', series: 2, repeticiones: '8', peso_sugerido: '16kg' }, 3, false).cambio, false)
assert.equal(ejercicioDeLaSemana({ nombre: 'Curl Bíceps con Barra EZ', bloque: 'accesorios', series: 3, repeticiones: '10-12', peso_sugerido: '25kg' }, 3, false).peso_sugerido, '25kg')
// Descarga nunca deja menos de 2 series en trabajo real
assert.equal(ejercicioDeLaSemana({ nombre: 'Press banca plano', bloque: 'accesorios', series: 3, repeticiones: '6', peso_sugerido: '60kg' }, 4, true).series, 2)

// Carrera: macrociclo real de Carlos (145 / 160 / 175 / 125 min)
const prog = progresionDeMacro([
  { n: 1, descarga: false, sesiones: [{ tipo: 'series', minutos: 35 }, { tipo: 'rodaje', minutos: 50 }, { tipo: 'tirada', minutos: 60 }] },
  { n: 2, descarga: false, sesiones: [{ tipo: 'series', minutos: 40 }, { tipo: 'rodaje', minutos: 55 }, { tipo: 'tirada', minutos: 65 }] },
  { n: 3, descarga: false, sesiones: [{ tipo: 'series', minutos: 40 }, { tipo: 'rodaje', minutos: 60 }, { tipo: 'tirada', minutos: 75 }] },
  { n: 4, descarga: true, sesiones: [{ tipo: 'series', minutos: 30 }, { tipo: 'rodaje', minutos: 40 }, { tipo: 'tirada', minutos: 40 }] },
], 4)!
const E = { tipo: 'zona', zona: 'E' } as const
const tirada = [{ tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 3600 }, objetivo: E }]
const mins = (p: unknown, n: number) => Math.round(resumenSesion(pasosDeLaSemana(p, 'Tirada larga Z2', prog, n)!, null).duracion_s / 60)
assert.equal(mins(tirada, 1), 60); assert.equal(mins(tirada, 2), 65); assert.equal(mins(tirada, 3), 75); assert.equal(mins(tirada, 4), 40)
// Series: 5 repeticiones en S1; con 40/35 min en S2 → 6; descarga 30/35 → 4
const series = [
  { tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 600 }, objetivo: E },
  { tipo: 'repetir', veces: 5, pasos: [{ tipo: 'trabajo', duracion: { unidad: 'metros', valor: 400 }, objetivo: { tipo: 'zona', zona: 'I' } }, { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 90 }, objetivo: E }] },
  { tipo: 'enfriamiento', duracion: { unidad: 'segundos', valor: 300 }, objetivo: E },
]
const veces = (n: number) => (pasosDeLaSemana(series, 'Series a ritmo de intervalos', prog, n)!.find(p => p.tipo === 'repetir') as { veces: number }).veces
assert.equal(veces(1), 5); assert.equal(veces(2), 6); assert.equal(veces(4), 4)
// Sin progresión o sesión híbrida: sin cambios
assert.deepEqual(pasosDeLaSemana(tirada, 'Tirada larga Z2', null, 3), tirada)
assert.deepEqual(pasosDeLaSemana(tirada, 'Híbrida Pierna · Sled Push', prog, 3), tirada)

assert.equal(nombreSinCifras('Tirada larga Z2 · 60 min'), 'Tirada larga Z2')
assert.equal(nombreSinCifras('Series · 5 × 400 m a ritmo de intervalos + pliometría reactiva'), 'Series + Pliometría reactiva')
console.log('progresion-semanal OK')

// Cadena «sin parar»: sled push + intervalos comparten series (rondas) en cada semana
import { ejerciciosParaFecha } from '../lib/entrenos/sesion-semana'
const planProg = { created_at: '2026-10-12T12:00:00Z', duracion_semanas: 4, progresion: prog }
const filas = [
  { series: 3, repeticiones: '25m', peso_sugerido: '110kg', bloque: 'principal', encadenado: true, ejercicio: { nombre: 'Sled push' } },
  { series: 3, repeticiones: '500m', peso_sugerido: null, bloque: 'principal', encadenado: false, ejercicio: { nombre: 'Series run 500m' } },
]
for (const f of ['2026-10-13', '2026-10-27', '2026-11-03']) { const r = ejerciciosParaFecha(planProg, filas, f); assert.equal(r[0].series, r[1].series) }
assert.equal(ejerciciosParaFecha(planProg, filas, '2026-10-27')[0].series, 4)
console.log('progresion-semanal (cadenas) OK')

// La lista de ejercicios de la tirada sigue los minutos de la semana (coincide con los pasos del reloj)
import { ejercicioDeCarreraDeLaSemana } from '../lib/entrenos/progresion-semanal'
const cc = { nombre: 'Carrera continua', bloque: 'principal', series: 1, repeticiones: '45min' }
assert.equal(ejercicioDeCarreraDeLaSemana(cc, 'Tirada larga Z2', prog, 1).repeticiones, '45min')
assert.equal(ejercicioDeCarreraDeLaSemana(cc, 'Tirada larga Z2', prog, 2).repeticiones, '50min')
assert.equal(ejercicioDeCarreraDeLaSemana(cc, 'Tirada larga Z2', prog, 3).repeticiones, '60min')
assert.equal(ejercicioDeCarreraDeLaSemana(cc, 'Tirada larga Z2', prog, 4).repeticiones, '25min')
assert.equal(ejercicioDeCarreraDeLaSemana({ nombre: 'Series a ritmo de intervalos', bloque: 'principal', series: 5, repeticiones: '400m' }, 'Series a ritmo de intervalos + pliometría', prog, 2).series, 6)
assert.equal(ejercicioDeCarreraDeLaSemana(cc, 'Híbrida Pierna', prog, 3).repeticiones, '45min')
console.log('progresion-semanal (carrera) OK')
