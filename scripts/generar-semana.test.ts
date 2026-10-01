import assert from 'node:assert/strict'
import { claveProteina, repartirSemanaSinRepetir, type Hueco } from '../lib/nutricion/generar-semana'

const c = (id: string, nombre = id) => ({ id, nombre })
const huecos = (franjas: string[], dias: string[]): Hueco[] => dias.flatMap(dia => franjas.map(franja => ({ dia, franja })))

// --- claveProteina: ignora tildes y mayúsculas ---
assert.equal(claveProteina('Pollo teriyaki con arroz'), 'pollo')
assert.equal(claveProteina('Salmón al horno'), 'salmon')
assert.equal(claveProteina('Tostada de BOQUERONES'), null)
assert.equal(claveProteina('Bowl de atún'), 'atun')

// --- sin repetir en la semana, ni entre franjas ---
{
  const r = repartirSemanaSinRepetir(
    { Comida: [c('a'), c('b'), c('c'), c('d')], Cena: [c('a'), c('b'), c('e'), c('f')] },
    huecos(['Comida', 'Cena'], ['Lunes', 'Martes', 'Miércoles']),
  )
  assert.equal(r.asignaciones.length, 6)
  assert.equal(r.sinCubrir.length, 0)
  assert.equal(new Set(r.asignaciones.map(a => a.receta_id)).size, 6)
  assert.ok(r.asignaciones.every(a => !a.repetida))
}

// --- la franja con menos candidatas se sirve primero, para que no se las coman las demás ---
{
  const r = repartirSemanaSinRepetir(
    { Desayuno: [c('x'), c('y')], Comida: [c('x'), c('y'), c('p'), c('q')] },
    huecos(['Desayuno', 'Comida'], ['Lunes', 'Martes']),
  )
  assert.equal(r.sinCubrir.length, 0)
  assert.ok(r.asignaciones.every(a => !a.repetida))
  assert.deepEqual(
    r.asignaciones.filter(a => a.franja === 'Desayuno').map(a => a.receta_id).sort(),
    ['x', 'y'],
  )
}

// --- agotadas: se repite la menos usada y se marca; sin candidatas: sin cubrir ---
{
  const r = repartirSemanaSinRepetir(
    { Comida: [c('a'), c('b')], Cena: [] },
    huecos(['Comida', 'Cena'], ['Lunes', 'Martes', 'Miércoles']),
  )
  assert.equal(r.sinCubrir.length, 3)
  assert.equal(r.sinCubrir[0].franja, 'Cena')
  const comidas = r.asignaciones.filter(a => a.franja === 'Comida')
  assert.equal(comidas.length, 3)
  assert.equal(comidas.filter(a => a.repetida).length, 1)
  assert.equal(comidas[2].receta_id, 'a') // la repetida es la mejor ordenada de las menos usadas
}

// --- variedad de proteína: tras pollo, el día siguiente prefiere otra proteína ---
{
  const r = repartirSemanaSinRepetir(
    { Comida: [c('p1', 'Pollo al curry'), c('p2', 'Pollo asado'), c('s1', 'Salmón al horno'), c('p3', 'Pollo teriyaki')] },
    huecos(['Comida'], ['Lunes', 'Martes', 'Miércoles']),
  )
  const nombres = r.asignaciones.map(a => a.receta_id)
  assert.deepEqual(nombres, ['p1', 's1', 'p2'])
}

// --- si solo quedan de la misma proteína, no se bloquea ---
{
  const r = repartirSemanaSinRepetir(
    { Cena: [c('p1', 'Pollo A'), c('p2', 'Pollo B'), c('p3', 'Pollo C')] },
    huecos(['Cena'], ['Lunes', 'Martes', 'Miércoles']),
  )
  assert.equal(r.asignaciones.length, 3)
  assert.ok(r.asignaciones.every(a => !a.repetida))
}

// --- el orden de salida respeta el de los huecos de entrada (día a día) ---
{
  const h = huecos(['Desayuno', 'Cena'], ['Lunes', 'Martes'])
  const r = repartirSemanaSinRepetir({ Desayuno: [c('a'), c('b')], Cena: [c('x'), c('y')] }, h)
  assert.deepEqual(r.asignaciones.map(a => `${a.dia}-${a.franja}`), h.map(x => `${x.dia}-${x.franja}`))
}

console.log('generar-semana: OK')
