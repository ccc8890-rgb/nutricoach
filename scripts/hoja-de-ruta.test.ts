import assert from 'node:assert/strict'
import { construirHojaDeRuta } from '../lib/entrenos/hoja-de-ruta'
import { planificarMacrociclo, type EntradaMacro } from '../lib/entrenos/macrociclo'

const e: EntradaMacro = { hoy: '2026-10-11', nivel: 'avanzado', edad: 36, sexo: 'hombre', diasDisponibles: 5, diasCorrer: 3, vdot: 45, minutosSemanaActuales: 133, competicion: null, lesiones: [], restricciones: null, recuperacion: 'alta', condicionesSalud: null, semanasParon: 0, sesionesFuerzaFijas: 3, tiradaMasLargaMin: 77 }
const m = planificarMacrociclo(e)

// Tope de volumen en híbridos: ninguna semana de carga pasa de ~35 % sobre la base
const base = 133
assert.ok(m.semanas.every(w => w.minutos <= Math.ceil(base * 1.35 / 5) * 5 + 5), `volúmenes: ${m.semanas.map(w => w.minutos)}`)
assert.ok(m.avisos.some(a => a.includes('sesiones de fuerza fijas')))
// Sin fuerza fija el volumen sí puede crecer más (el tope no se aplica a no híbridos)
const libre = planificarMacrociclo({ ...e, sesionesFuerzaFijas: 0 })
assert.ok(Math.max(...libre.semanas.map(w => w.minutos)) > Math.max(...m.semanas.map(w => w.minutos)))

// Hoja de ruta: previsto frente a real por semana; la semana en curso se marca y las futuras no tienen «hecho»
const hoy = '2026-10-21' // miércoles de la semana 2 (el plan empieza el lunes 12-10)
const filas = construirHojaDeRuta(m.semanas.map((w, i) => ({ ...w, lunes: `2026-10-${12 + i * 7}` })).slice(0, 3) as never,
  [{ fecha: '2026-10-14', tipo: 'running', duracion_s: 3000 }, { fecha: '2026-10-17', tipo: 'running', duracion_s: 3600 }, { fecha: '2026-10-15', tipo: 'strength_training', duracion_s: 3600 }], hoy)
assert.equal(filas[0].realMin, 110)      // 50 + 60 min de carrera; la fuerza no cuenta
assert.equal(filas[0].enCurso, false)
assert.equal(filas[1].enCurso, true)
assert.equal(filas[1].realMin, 0)        // empezada, sin carreras todavía
assert.equal(filas[2].realMin, null)     // futura
console.log('hoja-de-ruta.test.ts OK')
