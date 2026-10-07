// npx tsx scripts/reglas-clinicas.test.ts
import assert from 'node:assert/strict'
import { ajusteClinico, reglasClinicas } from '../lib/nutricion/reglas-clinicas'

const andres = reglasClinicas('dislipidemia: colesterol LDL 168 mg/dL, HDL 38, triglicéridos 210. Sin medicación. TA 130/85 (normal-alta). Sin diabetes.')
assert.deepEqual(andres.condiciones, ['dislipidemia']) // «sin diabetes» no activa diabetes; TA normal-alta no es hipertensión
assert.equal(ajusteClinico(andres, 'Lazanya de Hígado de Pollo', ['hígado de pollo', 'pasta']).excluir, true)
assert.equal(ajusteClinico(andres, 'Pasta con chorizo', ['chorizo']).excluir, true)
const burger = ajusteClinico(andres, 'Smashed Burger Tacos', ['ternera', 'queso', 'tortilla'])
assert.equal(burger.excluir, false); assert.ok(burger.mult < 0.5) // burger + queso: penalización doble
const legumbre = ajusteClinico(andres, 'Lentejas con verduras', ['lentejas', 'zanahoria'])
assert.equal(legumbre.mult, 1); assert.ok(legumbre.bonus > 0)

assert.deepEqual(reglasClinicas('Ninguna').condiciones, [])
assert.deepEqual(reglasClinicas('hipertensión arterial').condiciones, ['hipertension'])
assert.equal(ajusteClinico(reglasClinicas('hipertensión'), 'Bocadillo de jamón serrano', ['jamón serrano']).excluir, true)
const diab = reglasClinicas('prediabetes, resistencia a la insulina')
assert.ok(diab.condiciones.includes('diabetes'))
assert.ok(ajusteClinico(diab, 'Tostada con mermelada y plátano', ['mermelada']).mult < 1)
assert.ok(ajusteClinico(reglasClinicas('anemia ferropénica (ferritina 11)'), 'Estofado de lentejas', ['lentejas', 'espinacas']).bonus > 0)
assert.deepEqual(reglasClinicas('hipertensión y dislipidemia').condiciones.sort(), ['dislipidemia', 'hipertension'])
console.log('reglas-clinicas: OK')
