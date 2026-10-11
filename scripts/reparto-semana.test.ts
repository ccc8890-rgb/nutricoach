import assert from 'node:assert/strict'
import { repartirHibridas, tieneTrabajoDePierna, validarRepartoSemana, diaNumero } from '../lib/entrenos/reparto-semana'
import { planificarMacrociclo, type EntradaMacro } from '../lib/entrenos/macrociclo'

// ── Clasificación de pierna ──
assert.equal(tieneTrabajoDePierna({ nombre: 'Híbrido C — Pierna y Wall Balls' }), true)
assert.equal(tieneTrabajoDePierna({ nombre: 'Híbrido A', ejercicios: [{ nombre: 'SkiErg', bloque: 'principal' }, { nombre: 'Press banca', bloque: 'principal' }] }), false)
assert.equal(tieneTrabajoDePierna({ nombre: 'Híbrido B', ejercicios: [{ nombre: 'Sled Push (empuje de trineo)', bloque: 'principal' }] }), true)
assert.equal(tieneTrabajoDePierna({ nombre: 'Híbrido A', ejercicios: [{ nombre: 'Sentadilla con pausa', bloque: 'calentamiento' }, { nombre: 'Remo', bloque: 'principal' }] }), false, 'el calentamiento no cuenta')

// ── El caso real de Carlos: 3 carreras (mar calidad, jue rodaje, sáb tirada), 3 híbridas (2 con pierna), 5 días disponibles ──
const runs = [{ tipo: 'series', dia: 1 }, { tipo: 'rodaje', dia: 3 }, { tipo: 'tirada', dia: 5 }]
const hib = [{ pierna: false }, { pierna: true }, { pierna: true }]
const r = repartirHibridas(runs, hib, 5)
assert.deepEqual(r.avisos, [], 'existe un reparto válido')
const usados = new Set([...runs.map(x => x.dia), ...r.dias])
assert.ok(usados.size <= 5, `días usados ${usados.size} ≤ 5 disponibles`)
assert.ok(usados.size <= 6, 'siempre un descanso completo')
for (let i = 0; i < 3; i++) {
  const d = r.dias[i]
  assert.ok(![1, 5].includes(d), 'ninguna híbrida el día de la calidad ni de la tirada')
  if (hib[i].pierna) { assert.notEqual(d, 0, 'pierna no el día antes de la calidad (lunes)'); assert.notEqual(d, 4, 'pierna no el día antes de la tirada (viernes)') }
}
const piernas = [r.dias[1], r.dias[2]].sort((a, b) => a - b)
assert.ok(piernas[1] - piernas[0] >= 2, '48 h entre sesiones de pierna')
// Determinista: mismo resultado siempre.
assert.deepEqual(repartirHibridas(runs, hib, 5).dias, r.dias)

// ── Sin días disponibles conocidos: igualmente cumple las reglas de pierna ──
const r2 = repartirHibridas(runs, hib, null)
for (let i = 0; i < 3; i++) if (hib[i].pierna) { assert.notEqual(r2.dias[i], 0); assert.notEqual(r2.dias[i], 4) }

// ── Con 3 días disponibles es imposible (3 carreras + híbridas en 3 días): avisa en vez de callar ──
const r3 = repartirHibridas(runs, hib, 3)
assert.ok(r3.avisos.length > 0, 'avisa si no existe un reparto válido')

// ── Validador sobre la semana que generó la IA el 11-10 (el fallo real) ──
const ses = (nombre: string, dia: string, esCarrera: boolean, tipoCarrera?: string, pierna = false) => ({ nombre, dia_semana: dia, esCarrera, tipoCarrera, ejercicios: pierna ? [{ nombre: 'Wall Balls', bloque: 'principal' }] : [] })
const malo = [
  ses('Híbrido A', 'Lunes', false), ses('Rodaje', 'Martes', true, 'rodaje'), ses('Híbrido B', 'Miércoles', false, undefined, true),
  ses('Series 400', 'Jueves', true, 'series'), ses('Híbrido C pierna', 'Viernes', false, undefined, true), ses('Tirada', 'Sábado', true, 'tirada'),
]
const cod = validarRepartoSemana(malo, 5).map(h => h.codigo)
assert.ok(cod.includes('mas_dias_que_disponibles'), '6 días con 5 disponibles')
assert.ok(cod.includes('pierna_antes_tirada'), 'pierna el viernes antes de la tirada del sábado')
// La misma semana, repartida por el motor, ya no da avisos.
const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const bueno = [
  ...runs.map((x, i) => ses(`carrera ${i}`, dias[x.dia], true, x.tipo)),
  ...hib.map((h, i) => ses(`hib ${i}`, dias[r.dias[i]], false, undefined, h.pierna)),
]
assert.deepEqual(validarRepartoSemana(bueno, 5), [])
assert.equal(diaNumero('Miércoles'), 2)

// ── Macrociclo: si el atleta ya hace calidad, la fase base conserva 1 sesión; si no, sigue sin ella ──
const base: EntradaMacro = { hoy: '2026-10-11', nivel: 'avanzado', edad: 36, sexo: 'hombre', diasDisponibles: 5, diasCorrer: 3, vdot: 45, minutosSemanaActuales: 89, competicion: null, lesiones: [], restricciones: null, recuperacion: 'alta', condicionesSalud: null, semanasParon: 0, sesionesFuerzaFijas: 3, tiradaMasLargaMin: 50 }
const calidad = (e: EntradaMacro) => planificarMacrociclo(e).semanas[0].sesiones.filter(x => ['tempo', 'series', 'ritmo_carrera'].includes(x.tipo)).length
assert.equal(calidad(base), 0, 'sin calidad habitual, la base con 3 salidas no lleva calidad')
assert.equal(calidad({ ...base, calidadHabitual: 1 }), 1, 'con calidad habitual, la base conserva 1 sesión')
assert.equal(calidad({ ...base, calidadHabitual: 1, nivel: 'principiante' }), 0, 'un principiante nunca')
assert.equal(calidad({ ...base, calidadHabitual: 1, lesiones: ['rodilla'] }), 0, 'con lesión nunca')
assert.equal(calidad({ ...base, calidadHabitual: 1, condicionesSalud: 'hipertensión 150/95' }), 0, 'con hipertensión nunca')
const s1 = planificarMacrociclo({ ...base, calidadHabitual: 1 }).semanas[0]
const dq = s1.sesiones.find(x => x.tipo === 'series')!
const dt = s1.sesiones.find(x => x.tipo === 'tirada')!
assert.notEqual(dq.dia + 1, dt.dia, 'calidad nunca el día antes de la tirada')

// Carrera tras la estación el día antes de la tirada → aviso; 7 días seguidos entrenando → aviso de descanso
const hibCarrera = (dia: string) => ({ nombre: 'Híbrida Tren Superior – SkiErg', dia_semana: dia, esCarrera: false, ejercicios: [{ nombre: 'SkiErg', bloque: 'principal' }, { nombre: 'Carrera continua', bloque: 'principal' }] })
const tiradaSab = { nombre: 'Tirada larga', dia_semana: 'Sábado', esCarrera: true, tipoCarrera: 'tirada' }
assert.ok(validarRepartoSemana([hibCarrera('Viernes'), tiradaSab], null).some(h => h.codigo === 'carrera_comprometida_antes_tirada'))
assert.ok(!validarRepartoSemana([hibCarrera('Jueves'), tiradaSab], null).some(h => h.codigo === 'carrera_comprometida_antes_tirada'))
const sieteDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => ({ nombre: 'x', dia_semana: d, esCarrera: true, tipoCarrera: 'rodaje' }))
assert.ok(validarRepartoSemana(sieteDias, null).some(h => h.codigo === 'sin_dia_de_descanso'))

// Híbridas con carrera tras la estación: ninguna cae el día antes de la tirada (sábado=5) si hay hueco
const rc = repartirHibridas([{ tipo: 'tirada', dia: 5 }, { tipo: 'series', dia: 1 }, { tipo: 'rodaje', dia: 3 }], [{ pierna: true, conCarrera: true }, { pierna: false, conCarrera: true }, { pierna: false, conCarrera: true }], 5)
assert.ok(rc.dias.every(d => d !== 4), `ninguna híbrida con carrera el viernes: ${rc.dias}`)

console.log('reparto-semana: OK')
