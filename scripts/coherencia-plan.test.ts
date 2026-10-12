import assert from 'node:assert/strict'
import { comprobarCoherenciaPlan, comprobarCoherenciaSesion } from '../lib/entrenos/coherencia-plan'
import { progresionDeMacro } from '../lib/entrenos/progresion-semanal'

const E = { tipo: 'zona', zona: 'E' } as const
const prog = progresionDeMacro([
  { n: 1, descarga: false, sesiones: [{ tipo: 'series', minutos: 35 }, { tipo: 'rodaje', minutos: 50 }, { tipo: 'tirada', minutos: 60 }] },
  { n: 2, descarga: false, sesiones: [{ tipo: 'series', minutos: 40 }, { tipo: 'rodaje', minutos: 55 }, { tipo: 'tirada', minutos: 65 }] },
  { n: 3, descarga: false, sesiones: [{ tipo: 'series', minutos: 40 }, { tipo: 'rodaje', minutos: 60 }, { tipo: 'tirada', minutos: 75 }] },
  { n: 4, descarga: true, sesiones: [{ tipo: 'series', minutos: 35 }, { tipo: 'rodaje', minutos: 50 }, { tipo: 'tirada', minutos: 40 }] },
], 4)
const plan = { created_at: '2026-10-12T12:00:00Z', duracion_semanas: 4, progresion: prog }

// Plan de ejemplo con la forma del plan real de Carlos
const tirada = {
  nombre: 'Tirada larga Z2',
  pasos: [{ tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 3600 }, objetivo: E }],
  ejercicios: [
    { orden: 1, bloque: 'calentamiento', series: 1, repeticiones: '10 por pierna', peso_sugerido: null, ejercicio: { nombre: 'Movilidad dinámica' } },
    { orden: 2, bloque: 'calentamiento', series: 1, repeticiones: '10min', peso_sugerido: null, ejercicio: { nombre: 'Trote de calentamiento' } },
    { orden: 3, bloque: 'principal', series: 1, repeticiones: '45min', peso_sugerido: null, ejercicio: { nombre: 'Carrera continua' } },
    { orden: 4, bloque: 'vuelta_calma', series: 1, repeticiones: '5min', peso_sugerido: null, ejercicio: { nombre: 'Vuelta a la calma' } },
  ],
}
const series = {
  nombre: 'Series a ritmo de intervalos',
  pasos: [
    { tipo: 'calentamiento', duracion: { unidad: 'segundos', valor: 600 }, objetivo: E },
    { tipo: 'repetir', veces: 5, pasos: [{ tipo: 'trabajo', duracion: { unidad: 'metros', valor: 400 }, objetivo: { tipo: 'zona', zona: 'I' } }, { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 90 }, objetivo: E }] },
    { tipo: 'enfriamiento', duracion: { unidad: 'segundos', valor: 300 }, objetivo: E },
  ],
  ejercicios: [{ orden: 1, bloque: 'principal', series: 5, repeticiones: '400m', peso_sugerido: null, ejercicio: { nombre: 'Series a ritmo de intervalos' } }],
}
const hibrida = {
  nombre: 'Híbrida Pierna · Sled Push', pasos: null,
  ejercicios: [
    { orden: 1, bloque: 'principal', series: 3, repeticiones: '25m', peso_sugerido: '110kg', encadenado: true, ejercicio: { nombre: 'Sled push' } },
    { orden: 2, bloque: 'principal', series: 3, repeticiones: '500m', peso_sugerido: null, ejercicio: { nombre: 'Intervalos 500m' } },
  ],
}
assert.deepEqual(comprobarCoherenciaPlan(plan, [tirada, series, hibrida] as never), [])

// Si alguien cambia la lista sin tocar los pasos (el fallo que vimos), la comprobación lo detecta
const rota = { ...tirada, ejercicios: tirada.ejercicios.map(e => ({ ...e })) }
const sinProgresion = { ...plan, progresion: null }
assert.deepEqual(comprobarCoherenciaPlan(sinProgresion, [rota] as never), [])
const conLista45 = { ...rota, pasos: [{ tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 4200 }, objetivo: E }] } // pasos 70 min, lista 60
assert.match(comprobarCoherenciaSesion(sinProgresion, conLista45 as never, '2026-10-13')[0], /lista suma 60 min y los pasos del reloj 70/)

// Una descarga que no baja se detecta
const progMala = { ...prog!, semanas: prog!.semanas.map(s => s.n === 4 ? { ...s, sesiones: s.sesiones.map(x => ({ ...x, minutos: x.minutos + 40 })) } : s) }
assert.ok(comprobarCoherenciaPlan({ ...plan, progresion: progMala }, [tirada] as never).some(m => /descarga/.test(m)))
console.log('coherencia-plan OK')
