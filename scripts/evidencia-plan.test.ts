// scripts/evidencia-plan.test.ts
import assert from 'node:assert/strict'
import { extraerJsonPlan, resolverEvidenciaPlan } from '../lib/entrenos/evidencia-plan'
import { etiquetasDelCaso, ordenarPorRelevancia, type EstudioCitable, type FilaEstudio } from '../lib/rendimiento/evidencia'

// JSON con vallas de código o texto alrededor
assert.deepEqual(extraerJsonPlan('```json\n{"a":1}\n```'), { a: 1 })
assert.deepEqual(extraerJsonPlan('Aquí tienes: {"a":{"b":2}} fin'), { a: { b: 2 } })
assert.throws(() => extraerJsonPlan('sin json'))
assert.throws(() => extraerJsonPlan('[1,2]'))

const ofrecidos: EstudioCitable[] = [
  { clave: 'K1', titulo: 'Effects of Concurrent Strength and Endurance Training', fuente: 'Wilson et al. 2012', anio: '2012', nivel: 'metaanálisis', nivelCrudo: 'meta_analisis', doi: '10.1/a', aporta: '' },
  { clave: 'K2', titulo: 'Polarized vs Threshold Training', fuente: 'Seiler 2010', anio: '2010', nivel: 'revisión', nivelCrudo: 'revision_sistematica', doi: '10.1/b', aporta: '' },
]
const plan = {
  fundamentacion: 'Se aplica el modelo polarizado (Seiler 2010) y la interferencia (Wilson 2012); además Smith 2019 recomienda más volumen.',
  decisiones_clave: [
    { decision: 'Una sola sesión de pierna', motivo: 'interferencia', tipo: 'estudio', evidencia: ['K1', 'k2'] },
    { decision: 'Volumen', motivo: 'x', tipo: 'estudio', evidencia: ['K9'] },
    { decision: 'Carrera tras estación', motivo: 'Hyrox', tipo: 'criterio_entrenador', evidencia: [] },
  ],
  sesiones: [{ ejercicios: [{ notas: 'Técnica según Johnson et al. 2021' }] }],
}
const ev = resolverEvidenciaPlan(plan, ofrecidos)
assert.equal(ev.ofrecidos, 2)
assert.equal(ev.decisiones.length, 3)
assert.equal(ev.decisiones[0].tipo, 'estudio')
assert.equal(ev.decisiones[0].estudios.length, 2)                // K1 y k2 (sin distinguir mayúsculas)
assert.equal(ev.decisiones[1].tipo, 'criterio_entrenador')       // K9 no existe → no cuenta como estudio
assert.deepEqual(ev.decisiones[1].clavesInventadas, ['K9'])
assert.equal(ev.clavesInventadas, 1)
assert.equal(ev.estudiosCitados.length, 2)
// Autores: Seiler 2010 y Wilson 2012 están en la lista; Smith 2019 y Johnson 2021 no
assert.deepEqual(ev.autoresNoVerificables.sort(), ['Johnson 2021', 'Smith 2019'])
// Sin decisiones: no rompe
assert.equal(resolverEvidenciaPlan({}, ofrecidos).decisiones.length, 0)

// Etiquetas dirigidas al caso
const t = etiquetasDelCaso({ modalidad: 'hibrido', objetivo: 'Hyrox Madrid Open', lesiones: true, edad: 50 })
for (const x of ['hyrox', 'entrenamiento_concurrente', 'lesiones', 'veteranos', 'tapering', 'periodizacion']) assert.ok(t.includes(x), x)
assert.ok(!etiquetasDelCaso({ modalidad: 'gym_fuerza' }).includes('hyrox'))
assert.ok(etiquetasDelCaso({ modalidad: 'gym_fuerza', objetivo: 'Analítica: LDL 168' }).includes('diabetes'))

// Relevancia: más etiquetas del caso primero
const fila = (titulo: string, tags: string[], nivel = 'rct'): FilaEstudio => ({ titulo, fuente: null, doi: '10.1/' + titulo, nivel_evidencia: nivel, puntos_clave: null, resumen: null, tags })
const orden = ordenarPorRelevancia([fila('poco', ['proteina']), fila('mucho', ['hyrox', 'entrenamiento_concurrente']), fila('medio', ['running'])], ['hyrox', 'entrenamiento_concurrente', 'running'])
assert.deepEqual(orden.map(f => f.titulo), ['mucho', 'medio', 'poco'])

console.log('evidencia-plan.test.ts OK')
