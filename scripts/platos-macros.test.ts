import assert from 'node:assert/strict'
import { calcularMacrosPlato } from '../lib/platos/macros'

const huevo = { calorias: 143, proteinas: 12.6, carbohidratos: 0.7, grasas: 9.5 }
const aceite = { calorias: 900, proteinas: 0, carbohidratos: 0, grasas: 100 }

// 200 g de un alimento de 100 kcal/100 g → 200 kcal
const a = calcularMacrosPlato([{ cantidad_gramos: 200, alimento: { calorias: 100, proteinas: 10, carbohidratos: 20, grasas: 1 } }])
assert.deepEqual(a, { kcal: 200, proteinas: 20, carbohidratos: 40, grasas: 2, incompleto: false })

// Suma de varias líneas, redondeo a 1 decimal
const b = calcularMacrosPlato([{ cantidad_gramos: 150, alimento: huevo }, { cantidad_gramos: 15, alimento: aceite }])
assert.equal(b.kcal, 349.5)
assert.equal(b.grasas, 29.3)
assert.equal(b.incompleto, false)

// Línea sin alimento: no suma y marca incompleto, las demás sí cuentan
const c = calcularMacrosPlato([{ cantidad_gramos: 100, alimento: huevo }, { cantidad_gramos: 80, alimento: null }])
assert.equal(c.incompleto, true)
assert.equal(c.kcal, 143)

// Sin líneas: ceros e incompleto
assert.deepEqual(calcularMacrosPlato([]), { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0, incompleto: true })

console.log('platos-macros OK')
