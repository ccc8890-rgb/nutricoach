import assert from 'node:assert/strict'
import { analizarVolumen, construirEntradaMacro, disciplinaCanonica, minutosPorSemana, sesionMasLarga30d, type DatosClienteMacro } from '../lib/entrenos/macro-desde-cliente'

const hoy = '2026-10-10' // sábado; semana en curso desde el lunes 05-10
const run = (fecha: string, min: number) => ({ fecha, tipo: 'running', duracion_s: min * 60 })

// Minutos por semana completa (la semana en curso no cuenta): [0] = 28-09→04-10 … 
const entrenos = [run('2026-10-07', 90), run('2026-10-03', 30), run('2026-09-29', 30), run('2026-09-22', 60), run('2026-09-15', 40), run('2026-09-10', 40)]
const sem = minutosPorSemana(entrenos, hoy, 6)
assert.deepEqual(sem, [60, 60, 40, 40, 0, 0]) // el del 07-10 es de la semana en curso y no cuenta; 03-10 y 29-09 caen en la misma semana
assert.deepEqual(minutosPorSemana([], hoy, 3), [0, 0, 0])
assert.deepEqual(minutosPorSemana([{ fecha: '2026-10-01', tipo: 'strength_training', duracion_s: 3600 }], hoy, 3), [0, 0, 0])

// Volumen habitual: media de las semanas con carrera; una semana suelta en cero no lo rebaja.
assert.equal(analizarVolumen([60, 60, 40, 40], 5).minutos, 50)
const suelta = analizarVolumen([150, 0, 150, 150], 3)
assert.equal(suelta.minutos, 150)
assert.equal(suelta.semanasParon, 0)
assert.ok(suelta.nota?.includes('enfermedad'))
assert.equal(analizarVolumen([100, 0, 100, 0], 3).minutos, 50, 'irregular: se promedian todas')
// Parón en curso: el volumen de partida es el de antes de parar.
const paron = analizarVolumen([0, 0, 0, 120, 120, 120, 120], 25)
assert.equal(paron.semanasParon, 3)
assert.equal(paron.minutos, 120)
// Acaba de volver (≤ 2 semanas): el retorno sigue vigente y el volumen de referencia es el previo, no la media con los ceros.
const vuelta = analizarVolumen([40, 30, 0, 0, 0, 150, 150, 150], 2)
assert.equal(vuelta.semanasParon, 3)
assert.equal(vuelta.minutos, 150)
// Ya lleva varias semanas de vuelta: retorno terminado, manda la media reciente.
const yaVuelta = analizarVolumen([100, 90, 80, 70, 0, 0, 150, 150], 2)
assert.equal(yaVuelta.semanasParon, 0)
assert.equal(yaVuelta.minutos, 85)
// Sin datos recientes: no se inventa nada.
assert.equal(analizarVolumen([0, 0, 0, 0], null).minutos, null)
assert.equal(analizarVolumen([0, 0, 0, 0], 40).semanasParon, 5)

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

// Sesión más larga de los últimos 30 días.
assert.equal(sesionMasLarga30d([run('2026-10-07', 90), run('2026-09-25', 70), run('2026-08-01', 150)], hoy), 90)
assert.equal(sesionMasLarga30d([run('2026-08-01', 150)], hoy), null)
assert.equal(construirEntradaMacro(base).entrada.tiradaMasLargaMin, 90)

console.log('macro-desde-cliente.test OK')
