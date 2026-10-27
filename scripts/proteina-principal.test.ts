import assert from 'node:assert/strict'
import { proteinasPrincipales } from '../lib/recetas/proteina-principal'

const g = (nombre: string, gramos: number) => ({ nombre, gramos })

// Una proteína clara
assert.deepEqual(proteinasPrincipales([g('Pechuga de pollo', 200), g('Arroz basmati', 80), g('Aceite de oliva', 10)]), ['Pollo'])
assert.deepEqual(proteinasPrincipales([g('Salmón', 160), g('Espárragos', 150)]), ['Pescado'])
// Plurales y marisco
assert.deepEqual(proteinasPrincipales([g('Gambas', 150), g('Fideos de arroz', 60)]), ['Pescado'])
assert.deepEqual(proteinasPrincipales([g('Mejillones', 300), g('Patata', 200)]), ['Pescado'])
// Legumbres y vegetal
assert.deepEqual(proteinasPrincipales([g('Lentejas cocidas', 250), g('Zanahoria', 80)]), ['Legumbres'])
assert.deepEqual(proteinasPrincipales([g('Tofu firme', 150), g('Brócoli', 100)]), ['Vegetal'])
// Dos proteínas relevantes (≥ 40 % de la primera) → las dos; una menor se ignora
assert.deepEqual(proteinasPrincipales([g('Pollo', 200), g('Gambas', 100)]), ['Pollo', 'Pescado'])
assert.deepEqual(proteinasPrincipales([g('Pollo', 200), g('Huevo', 50)]), ['Pollo'])
// Caldos, salsas y aceites con la palabra no cuentan
assert.deepEqual(proteinasPrincipales([g('Caldo de pollo', 400), g('Arroz', 100)]), [])
assert.deepEqual(proteinasPrincipales([g('Salsa de soja', 50), g('Brócoli', 200)]), [])
// Cantidades pequeñas (toque o aderezo) no son la proteína del plato
assert.deepEqual(proteinasPrincipales([g('Jamón serrano', 20), g('Pan', 80)]), [])
// El yogur solo cuenta si no hay otra proteína (desayunos): en un plato con pollo es aderezo
assert.deepEqual(proteinasPrincipales([g('Skyr', 150), g('Avena', 40)]), ['Lácteos'])
assert.deepEqual(proteinasPrincipales([g('Pollo', 200), g('Yogur natural', 100)]), ['Pollo'])
// Sin ingredientes: el nombre de la receta
assert.deepEqual(proteinasPrincipales([], 'Pulpo con patata y pimentón'), ['Pescado'])
assert.deepEqual(proteinasPrincipales([], 'Crema de calabaza'), [])
// Tortilla de trigo (wrap) no es huevo
assert.deepEqual(proteinasPrincipales([g('Tortilla de trigo', 120), g('Pechuga de pavo', 150)]), ['Pollo'])

console.log('proteina-principal.test OK')
