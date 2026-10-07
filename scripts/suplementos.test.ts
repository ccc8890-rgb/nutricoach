import assert from 'node:assert/strict'
import { getFichaSuplemento, NOTA_ANTIDOPAJE, recomendarSuplementos } from '../lib/nutricion/suplementos'

const fichaCreatina = getFichaSuplemento('creatina')
assert.deepEqual(fichaCreatina, {
  id: 'creatina',
  nombre: 'Creatina',
  evidencia: 'A',
  fuentes: ['IOC 2018 (Maughan et al., Br J Sports Med 52:439-455)', 'ISSN 2017 (Kreider et al.)'],
  precauciones: [
    'Puede aumentar 1-2 kg de agua; valora su uso en running puro si el peso es critico',
    'Consulta al medico si tienes enfermedad renal',
    NOTA_ANTIDOPAJE,
  ],
})
assert.equal(getFichaSuplemento('no_existe'), null)

const base = { peso_kg: 75, disciplina: 'hyrox', duracion_min: 180, intensidad: 'alta' as const, fase_competicion: 'race_day' }
const r = recomendarSuplementos(base)
const buscar = (lista: typeof r.sesion, id: string) => lista.find(item => item.id === id)
assert.equal(buscar(r.diaria, 'creatina')?.dosis, '3-5 g/dia')
assert.equal(buscar(r.sesion, 'cafeina')?.dosis, '225-450 mg')
assert.equal(buscar(r.carrera, 'bicarbonato')?.dosis, '15-22,5 g')
assert.equal(buscar(r.sesion, 'recuperacion')?.dosis, '75-90 g de carbohidratos + 22,5 g de proteina')
assert.match(buscar(r.sesion, 'carbohidratos_intra')?.dosis ?? '', /60-90 g\/h.*2:1/)
for (const [min, dosis] of [[44, null], [45, 'Hasta 30 g/h'], [75, 'Hasta 30 g/h'], [76, '30-60 g/h'], [150, '30-60 g/h'], [151, '60-90 g/h']] as const) {
  const cho = buscar(recomendarSuplementos({ peso_kg: 75, duracion_min: min }).sesion, 'carbohidratos_intra')
  assert.equal(dosis === null ? null : cho?.dosis.slice(0, dosis.length), dosis)
}
assert.equal(buscar(r.diaria, 'hierro'), undefined)
assert.equal(buscar(r.diaria, 'vitamina_d'), undefined)
assert.match(r.avisos.join(' '), /Pide analitica/)
assert.equal(buscar(recomendarSuplementos({ peso_kg: 75, duracion_min: 59 }).sesion, 'electrolitos_sodio'), undefined)
assert.match(recomendarSuplementos({ ...base, hora_inicio: '16:30' }).avisos.join(' '), /Cafeina por la tarde/)
assert.equal(buscar(recomendarSuplementos({ ...base, condiciones: ['Enfermedad RENAL'] }).diaria, 'creatina'), undefined)
assert.deepEqual(((x) => [x.sesion, x.diaria, x.carrera])(recomendarSuplementos({ ...base, condiciones: ['Embarazo'] })), [[], [], []])
assert.equal(buscar(recomendarSuplementos({ peso_kg: 75, analitica: { ferritina_ngml: 20, vitamina_d_ngml: 25 } }).diaria, 'hierro')?.id, 'hierro')
for (const item of [...r.sesion, ...r.diaria, ...r.carrera]) {
  assert.equal(item.estado, 'propuesta')
  assert.ok(item.precauciones.includes(NOTA_ANTIDOPAJE))
}
// Día de maratón sin sesión de entreno ese día: el plan de carrera usa la duración típica de la prueba
const maraton = recomendarSuplementos({ peso_kg: 65, disciplina: 'running_maraton', fase_competicion: 'race_day' })
assert.match(maraton.carrera.find(r => r.id === 'carbohidratos_intra')!.dosis, /60-90 g\/h/)
assert.ok(maraton.carrera.some(r => r.id === 'electrolitos_sodio'))
const hyroxCarrera = recomendarSuplementos({ peso_kg: 75, disciplina: 'hyrox', fase_competicion: 'race_day' })
assert.match(hyroxCarrera.carrera.find(r => r.id === 'carbohidratos_intra')!.dosis, /30-60 g\/h/)
assert.ok(!hyroxCarrera.carrera.some(r => r.id === 'electrolitos_sodio'))
// Avisos por disciplina
assert.ok(hyroxCarrera.avisos.some(a => /Hyrox limitada/.test(a)))
const tri = recomendarSuplementos({ peso_kg: 70, disciplina: 'ironman', fase_competicion: 'race_day' })
assert.ok(tri.avisos.some(a => /bici/.test(a)) && tri.avisos.some(a => /muy larga/.test(a)))
// Tiempo objetivo de la prueba manda sobre la duración típica de la disciplina
const hmRapida = recomendarSuplementos({ peso_kg: 70, disciplina: 'running_hm', duracion_prueba_min: 70, fase_competicion: 'race_day' })
assert.match(hmRapida.carrera.find(r => r.id === 'carbohidratos_intra')!.dosis, /30 g\/h/)
console.log('suplementos: OK')
