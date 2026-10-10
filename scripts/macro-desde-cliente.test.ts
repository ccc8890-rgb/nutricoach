import assert from 'node:assert/strict'
import { construirEntradaMacro, disciplinaCanonica, minutosCarreraMedios, type DatosClienteMacro } from '../lib/entrenos/macro-desde-cliente'

const hoy = '2026-10-10' // sábado; semana en curso desde el lunes 05-10
const run = (fecha: string, min: number) => ({ fecha, tipo: 'running', duracion_s: min * 60 })

// Media de las 4 semanas completas (28-09 → 04-10 es la última) sin contar la semana en curso.
const entrenos = [run('2026-10-07', 90), run('2026-10-03', 30), run('2026-09-29', 30), run('2026-09-22', 60), run('2026-09-15', 40), run('2026-09-10', 40)]
const m = minutosCarreraMedios(entrenos, hoy)
assert.equal(m.minutos, Math.round((60 + 60 + 40 + 40) / 4)) // la del 07-10 es de la semana en curso y no cuenta
assert.equal(m.semanasConDatos, 4)
assert.equal(minutosCarreraMedios([], hoy).minutos, null)
assert.equal(minutosCarreraMedios([{ fecha: '2026-10-01', tipo: 'strength_training', duracion_s: 3600 }], hoy).minutos, null)

const base: DatosClienteMacro = {
  hoy,
  cliente: { nivel: 'intermedio', edad: 36, sexo: 'hombre' },
  perfil: { nivel: null, vdot: '45', dias_disponibles: '5', patron_lesiones: [{ zona: 'rodilla' }, 'gemelo'], restricciones_temporales: null, capacidad_recuperacion: 'alta' },
  competicion: null,
  onboarding: { condiciones_salud: 'anemia ferropénica', fecha_competicion: null, tipo_competicion: null },
  entrenos,
  sesionesFuerzaFijas: 3,
}

// Nivel: el perfil manda; si no, la ficha, y se avisa.
const r = construirEntradaMacro(base)
assert.equal(r.entrada.nivel, 'intermedio')
assert.ok(r.supuestos.some(s => s.includes('ficha del cliente')))
assert.equal(r.entrada.vdot, 45)
assert.equal(r.entrada.diasDisponibles, 5)
assert.deepEqual(r.entrada.lesiones, ['rodilla', 'gemelo'])
assert.equal(r.entrada.condicionesSalud, 'anemia ferropénica')
assert.ok(r.faltan.some(f => f.startsWith('Competición')))
assert.equal(r.entrada.semanasParon, 0)
assert.equal(construirEntradaMacro({ ...base, perfil: { ...base.perfil!, nivel: 'avanzado' } }).entrada.nivel, 'avanzado')

// Sin perfil ni datos: nada se inventa, todo queda en «faltan».
const vacio = construirEntradaMacro({ ...base, cliente: { nivel: null, edad: null, sexo: null }, perfil: null, onboarding: null, entrenos: [], sesionesFuerzaFijas: 0 })
assert.equal(vacio.entrada.nivel, null)
assert.equal(vacio.entrada.vdot, null)
assert.equal(vacio.entrada.minutosSemanaActuales, null)
for (const x of ['Nivel', 'Perfil de atleta', 'Edad', 'VDOT', 'Competición', 'Datos de carrera']) assert.ok(vacio.faltan.some(f => f.startsWith(x)), x)

// Competición: la registrada manda; la del onboarding se usa avisando; una pasada se ignora.
const reg = construirEntradaMacro({ ...base, competicion: { fecha_competicion: '2026-12-06', disciplina: 'maraton', tiempo_objetivo_min: 210, objetivo: 'bajar de 3:30' } })
assert.equal(reg.entrada.competicion?.fecha, '2026-12-06')
assert.equal(reg.entrada.competicion?.tiempoObjetivoMin, 210)
const onb = construirEntradaMacro({ ...base, onboarding: { condiciones_salud: null, fecha_competicion: '2026-11-15', tipo_competicion: 'ultra 50 km' } })
assert.equal(onb.entrada.competicion?.fecha, '2026-11-15')
assert.ok(onb.supuestos.some(s => s.includes('no está registrada')))
assert.equal(construirEntradaMacro({ ...base, onboarding: { condiciones_salud: null, fecha_competicion: '2026-09-01', tipo_competicion: 'maraton' } }).entrada.competicion, null)

// Parón: ≥ 2 semanas desde la última carrera.
assert.equal(construirEntradaMacro({ ...base, entrenos: [run('2026-09-01', 50)] }).entrada.semanasParon, 5)
assert.equal(construirEntradaMacro({ ...base, entrenos: [run('2026-10-05', 50)] }).entrada.semanasParon, 0)

// Texto libre del onboarding → disciplina del motor (lo desconocido se devuelve vacío, no se adivina).
assert.equal(disciplinaCanonica('Maratón Valencia'), 'running_maraton')
assert.equal(disciplinaCanonica('media maratón de Valencia'), 'running_hm')
assert.equal(disciplinaCanonica('Half Marathon'), 'running_hm')
assert.equal(disciplinaCanonica('10K Ciudad'), 'running_10k')
assert.equal(disciplinaCanonica('5 km'), 'running_5k')
assert.equal(disciplinaCanonica('trail 50 km'), 'trail_largo')
assert.equal(disciplinaCanonica('trail 20k'), 'trail_corto')
assert.equal(disciplinaCanonica('trail'), '')
assert.equal(disciplinaCanonica('Hyrox Valencia'), 'hyrox')
assert.equal(disciplinaCanonica('trail_largo'), 'trail_largo')
assert.equal(disciplinaCanonica('carrera popular'), '')
assert.equal(disciplinaCanonica(null), '')
const natalia = construirEntradaMacro({ ...base, onboarding: { condiciones_salud: null, fecha_competicion: '2026-12-06', tipo_competicion: 'Maratón Valencia' } })
assert.equal(natalia.entrada.competicion?.disciplina, 'running_maraton')
const rara = construirEntradaMacro({ ...base, onboarding: { condiciones_salud: null, fecha_competicion: '2026-12-06', tipo_competicion: 'carrera popular' } })
assert.ok(rara.faltan.some(f => f.startsWith('Tipo de prueba exacto')))

console.log('macro-desde-cliente.test OK')
