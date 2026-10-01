import assert from 'node:assert/strict'
import { optimizarFactoresReceta, type IngredienteOptimizable } from '../lib/recetas/optimizar-factores'

const ing = (
  rol: IngredienteOptimizable['rol'],
  gramos: number,
  kcal: number, p: number, c: number, g: number,
  fija = false,
): IngredienteOptimizable => ({ rol, gramos, fija, por100: { kcal, p, c, g } })

function macrosResultado(ings: IngredienteOptimizable[], factores: number[]) {
  return ings.reduce((acc, i, idx) => {
    const f = (i.gramos * factores[idx]) / 100
    acc.kcal += i.por100.kcal * f; acc.p += i.por100.p * f; acc.c += i.por100.c * f; acc.g += i.por100.g * f
    return acc
  }, { kcal: 0, p: 0, c: 0, g: 0 })
}
const err = (real: number, obj: number) => Math.abs(real - obj) / obj

// Salmón con arroz y aceite: el salmón aporta grasa además de proteína.
// El escalado antiguo cubría el 100% de la grasa con el aceite y se pasaba.
const salmonArroz = [
  ing('proteina_principal', 150, 208, 20, 0, 13),   // salmón
  ing('carbohidrato_base', 80, 350, 7, 78, 1),       // arroz crudo
  ing('grasa_saludable', 10, 884, 0, 0, 100),        // aceite
  ing('verdura_volumen', 100, 34, 2.8, 7, 0.4),      // brócoli
  ing('especias_aromaticos', 2, 0, 0, 0, 0, true),   // sal
]
const objetivo = { kcal: 750, p: 50, c: 85, g: 22 }
const r1 = optimizarFactoresReceta(salmonArroz, objetivo)
const m1 = macrosResultado(salmonArroz, r1.factores)
assert.ok(err(m1.kcal, objetivo.kcal) < 0.05, `kcal ${m1.kcal}`)
assert.ok(err(m1.p, objetivo.p) < 0.10, `proteína ${m1.p}`)
assert.ok(err(m1.c, objetivo.c) < 0.10, `hidratos ${m1.c}`)
assert.ok(err(m1.g, objetivo.g) < 0.30, `grasa ${m1.g}`) // el salmón ya aporta grasa: no se puede bajar más sin perder proteína

// Ingredientes de cantidad fija no cambian
assert.equal(r1.factores[4], 1)

// Factores acotados: nunca 0 ni desproporcionados
for (const f of r1.factores) assert.ok(f >= 0.25 && f <= 3, `factor fuera de rango ${f}`)

// Sin objetivos de macro: solo ajusta tamaño por kcal (comportamiento uniforme)
const r2 = optimizarFactoresReceta(salmonArroz, { kcal: 750 })
const m2 = macrosResultado(salmonArroz, r2.factores)
assert.ok(err(m2.kcal, 750) < 0.03, `kcal sin macros ${m2.kcal}`)
const variables = r2.factores.filter((_, i) => !salmonArroz[i].fija)
assert.ok(Math.max(...variables) - Math.min(...variables) < 0.05, 'sin objetivos de macro debe escalar uniforme')

// Receta sin grupo de grasa: no se rompe y prioriza kcal y proteína
const polloPatata = [
  ing('proteina_principal', 120, 110, 23, 0, 1.5),
  ing('carbohidrato_base', 200, 77, 2, 17, 0.1),
]
const r3 = optimizarFactoresReceta(polloPatata, { kcal: 600, p: 55, c: 70, g: 15 })
const m3 = macrosResultado(polloPatata, r3.factores)
assert.ok(err(m3.p, 55) < 0.15, `proteína pollo ${m3.p}`)
assert.ok(err(m3.kcal, 600) < 0.15, `kcal pollo ${m3.kcal}`)

// Receta vacía o sin kcal: factores neutros
assert.deepEqual(optimizarFactoresReceta([], { kcal: 500 }).factores, [])

console.log('optimizar factores receta tests passed')
