import assert from 'node:assert/strict'
import { sesionesPrevision, semanaMacroDe, type SemanaMacroPrevision, type SesionPlantilla } from '../lib/entrenos/prevision'

const semanas: SemanaMacroPrevision[] = [
  { n: 5, lunes: '2026-11-09', fase: 'construccion', descarga: false, minutos: 175,
    sesiones: [{ dia: 1, tipo: 'series', minutos: 45 }, { dia: 3, tipo: 'rodaje', minutos: 40 }, { dia: 5, tipo: 'tirada', minutos: 75 }] },
]
const noCarrera = new Map<string, SesionPlantilla[]>([
  ['Miércoles', [{ nombre: 'Híbrido Pierna', tipo_sesion: 'hibrido' }]],
  ['Jueves', [{ nombre: 'Híbrido Tren Superior A', tipo_sesion: 'mixto' }]],
])

// Martes (índice 1): series del macrociclo, con km a ritmo de rodaje (354 s/km): 45 min ≈ 7,6 km
const mar = sesionesPrevision('2026-11-10', 'Martes', semanas, noCarrera, 354)!
assert.equal(mar.fase, 'construccion')
assert.deepEqual(mar.sesiones.map(s => [s.nombre, s.tipo_sesion, s.km, s.prevision]), [['Series', 'carrera', 7.6, true]])
// Miércoles: solo la híbrida de la semana tipo, sin km
const mie = sesionesPrevision('2026-11-11', 'Miércoles', semanas, noCarrera, 354)!
assert.deepEqual(mie.sesiones.map(s => [s.nombre, s.km]), [['Híbrido Pierna', null]])
// Jueves: rodaje del macrociclo + híbrida (dos sesiones el mismo día), ids distintos
const jue = sesionesPrevision('2026-11-12', 'Jueves', semanas, noCarrera, 354)!
assert.equal(jue.sesiones.length, 2)
assert.equal(new Set(jue.sesiones.map(s => s.id)).size, 2)
// Lunes sin nada: día de descanso previsto
assert.deepEqual(sesionesPrevision('2026-11-09', 'Lunes', semanas, noCarrera, 354)!.sesiones, [])
// Sin ritmo no se inventan km; fuera del macrociclo → null
assert.equal(sesionesPrevision('2026-11-10', 'Martes', semanas, noCarrera, null)!.sesiones[0].km, null)
assert.equal(sesionesPrevision('2026-12-10', 'Jueves', semanas, noCarrera, 354), null)
assert.equal(semanaMacroDe('2026-11-15', semanas)?.n, 5)
assert.equal(semanaMacroDe('2026-11-16', semanas), null)
// Si el atleta movió el rodaje del jueves al viernes, la previsión lo respeta (tipo y minutos del macrociclo, día de su semana tipo)
const plantilla = [{ dia_semana: 'Martes', nombre: 'Series · 5×500 m' }, { dia_semana: 'Viernes', nombre: 'Rodaje regenerativo Z2' }, { dia_semana: 'Sábado', nombre: 'Tirada larga Z2' }]
const jueMovido = sesionesPrevision('2026-11-12', 'Jueves', semanas, noCarrera, 354, plantilla)!
assert.deepEqual(jueMovido.sesiones.map(s => s.nombre), ['Híbrido Tren Superior A'])
const vieMovido = sesionesPrevision('2026-11-13', 'Viernes', semanas, noCarrera, 354, plantilla)!
assert.deepEqual(vieMovido.sesiones.map(s => [s.nombre, s.km]), [['Rodaje fácil', 6.8]])
// Sin equivalente en la semana tipo, vale el día del macrociclo
assert.equal(sesionesPrevision('2026-11-12', 'Jueves', semanas, noCarrera, 354, [])!.sesiones.some(s => s.nombre === 'Rodaje fácil'), true)
console.log('prevision OK')
