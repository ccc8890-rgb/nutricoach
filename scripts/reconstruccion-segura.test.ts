import assert from 'node:assert/strict'
import { calidadVinculo, raicesBusqueda, evaluarReconstruccion, type IngredienteResuelto } from '../lib/recetas/reconstruccion-segura'

// --- Calidad de la vinculación (casos reales de las propuestas del 02-10)
const q = calidadVinculo
assert.equal(q('Sal', 'Sal'), 'exacta')
assert.equal(q('Sal', 'Salsa de soja'), 'dudosa')                    // 10 g de soja en vez de sal
assert.equal(q('Sal', 'Salsa de tomate casera'), 'dudosa')
assert.equal(q('Tomate', 'Salsa de tomate casera'), 'dudosa')        // salsa ≠ tomate fresco
assert.equal(q('Albahaca fresca', 'Salsa fresca Pesto con albahaca'), 'dudosa')
assert.equal(q('Yogur griego', 'Yogur Griego Fresa'), 'dudosa')      // sabor
assert.equal(q('Pechuga de pollo', 'Pechuga de pollo'), 'exacta')
assert.equal(q('Aceite de oliva virgen extra', 'Aceite de oliva extra virgen'), 'exacta')
assert.equal(q('Carne picada de ternera', 'Carne picada de ternera (5% grasa)'), 'exacta')
assert.equal(q('Pimentón de la Vera', 'Pimentón dulce de la Vera'), 'buena')
assert.equal(q('Tomate concentrado', 'Tomate Doble Concentrado Lata'), 'exacta') // envase y forma se ignoran
assert.equal(q('Pimienta negra', 'Pimienta negra molida'), 'buena')
assert.equal(q('Carne picada de cordero', 'Carne picada de ternera (5% grasa)'), 'dudosa') // otro animal
assert.equal(q('Zumo de lima', 'Lima'), 'buena')
// Falsos "buenos" detectados en la simulación del 07-10
assert.equal(q('Nata agria', 'Aperitivo de patata con sabor a nata agria y cebolla'), 'dudosa')
assert.equal(q('Tomate enlatado', 'Tomate seco'), 'dudosa')
assert.equal(q('Queso duro', 'Queso fresco'), 'dudosa')
assert.equal(q('Leche vegetal', 'Leche entera fresca'), 'dudosa')
assert.equal(q('Pasta de tomate', 'Tarrito de Pasta Cachitos Pasta y Tomate'), 'dudosa')
assert.equal(q('Pasta de ají panca', 'Pasta'), 'dudosa')
assert.equal(q('Yogur griego', 'Yogur Griego Cabra'), 'dudosa')
assert.equal(q('Chile seco', 'Chile, jalapeño, crudo'), 'dudosa')
assert.equal(q('Sal', 'Margarina con sal'), 'dudosa')                // margarina = grasa
assert.equal(q('Sal', 'Sal de ajo'), 'dudosa')
// Plural/singular, aclaraciones entre paréntesis y sinónimos
assert.equal(q('Chipotle en adobo', 'chipotles en adobo'), 'exacta')
assert.equal(q('Zanahorias', 'Zanahoria'), 'exacta')
assert.equal(q('Masa yufka', 'Yufka (masa para rollos)'), 'exacta')
assert.equal(q('Nata agria', 'Crema agria'), 'exacta')
assert.equal(q('Yogurt griego', 'Yogur griego'), 'exacta')
assert.equal(q('Yogur desnatado', 'Yogur natural desnatado'), 'buena')
assert.equal(q('Germinados', 'Brotes Germinados Frasco'), 'buena')
assert.equal(q('Tomates Roma', 'Tomate'), 'buena')
assert.equal(q('Zumo y ralladura de lima', 'Lima'), 'buena')
// Y los que sí deben pasar
assert.equal(q('Aceite de oliva virgen extra o girasol', 'Aceite de oliva virgen extra'), 'exacta') // vale la 1.ª alternativa
assert.equal(q('Cacahuete tostado', 'Cacahuete tostado con sal'), 'buena')
assert.equal(q('Aceitunas negras', 'Aceitunas negras sin hueso'), 'buena')
assert.equal(q('Yogur griego', 'Yogur Griego Pack de'), 'exacta')
assert.equal(q('Pepinos persas', 'Pepino'), 'buena')
assert.equal(q('Sal kosher', 'Sal'), 'buena')
assert.equal(q('Cilantro fresco', 'Cilantro'), 'buena')
assert.equal(q('Pan rallado panko', 'Pan Rallado Estilo Japonés Panko'), 'buena')
assert.equal(q('Salsa picante', 'Salsa Picante Louisiana'), 'dudosa') // marca desconocida: conservador
assert.equal(q('Tortillas de trigo', 'Maxi tortillas de trigo'), 'buena')

// --- Palabras de búsqueda en el catálogo
assert.deepEqual(raicesBusqueda('Zumo y ralladura de lima'), ['lima'])
assert.ok(raicesBusqueda('Tomates Roma').includes('tomate'))
assert.deepEqual(raicesBusqueda('Aceite de oliva virgen extra o girasol'), ['aceite', 'oliva', 'virgen'])

// --- Puertas de plausibilidad
const al = (nombre: string, calorias: number, proteinas: number, carbohidratos: number, grasas: number) => ({ nombre, calorias, proteinas, carbohidratos, grasas, fibra: 0 })
const ing = (nombre: string, gramos: number, alimento: ReturnType<typeof al> | null, calidad: IngredienteResuelto['calidad'] = 'exacta'): IngredienteResuelto => ({ nombre, gramos, alimento, calidad })
const pollo = al('Pechuga de pollo', 110, 23, 0, 1.5)
const arroz = al('Arroz', 350, 7, 78, 0.6)
const aceite = al('Aceite de oliva', 884, 0, 0, 100)
const base = (extra: IngredienteResuelto[] = []) => [ing('Pechuga de pollo', 500, pollo), ing('Arroz', 300, arroz), ing('Aceite', 20, aceite), ...extra]
const actual = { porciones: 4, kcal: 450, tipo_plato: 'Comida', tipo_receta: 'completa' }

// Receta coherente: se acepta
let r = evaluarReconstruccion({ ingredientes: base(), porciones_propuesta: 4, actual })
assert.equal(r.ok, true, r.motivos.join(';'))
assert.equal(r.nuevo.kcal, Math.round((500 * 1.1 + 300 * 3.5 + 20 * 8.84) / 4))

// Ingrediente dudoso y pequeño (sal→soja, 10 g): se omite con aviso y la receta sigue
r = evaluarReconstruccion({ ingredientes: base([ing('Sal', 10, al('Salsa de soja', 60, 8, 5, 0), 'dudosa')]), porciones_propuesta: 4, actual })
assert.equal(r.ok, true)
assert.deepEqual(r.descartados, ['Sal'])
assert.equal(r.ingredientesFinales.some(i => i.nombre === 'Sal'), false)

// Ingrediente dudoso que pesa: bloquea
r = evaluarReconstruccion({ ingredientes: base([ing('Carne picada de cordero', 300, al('Carne picada de ternera', 130, 21, 0, 5), 'dudosa')]), porciones_propuesta: 4, actual })
assert.equal(r.ok, false)
assert.match(r.motivos.join(' '), /vinculaci/i)

// Ingrediente sin alimento y grande: bloquea; pequeño: se omite
r = evaluarReconstruccion({ ingredientes: base([ing('Queso duro', 150, null, 'sin')]), porciones_propuesta: 4, actual })
assert.equal(r.ok, false)
r = evaluarReconstruccion({ ingredientes: base([ing('Orégano seco', 1, null, 'sin')]), porciones_propuesta: 4, actual })
assert.equal(r.ok, true); assert.deepEqual(r.descartados, ['Orégano seco'])

// kcal/ración absurdas (pollo burger 2.892): bloquea
r = evaluarReconstruccion({ ingredientes: [ing('Pollo', 1500, pollo), ing('Arroz', 1500, arroz)], porciones_propuesta: 1, actual: { ...actual, porciones: 2, kcal: 775 } })
assert.equal(r.ok, false)
assert.match(r.motivos.join(' '), /kcal por ración/i)
assert.match(r.motivos.join(' '), /con \d+ raciones? sald/)

// Gran divergencia con lo actual (±35 %) sin que lo actual sea absurdo: bloquea para revisión
r = evaluarReconstruccion({ ingredientes: base(), porciones_propuesta: 4, actual: { ...actual, kcal: 800 } })
assert.equal(r.ok, false)
assert.match(r.motivos.join(' '), /diverge/i)
// …pero si lo actual ya era absurdo (125 kcal en una comida completa) se permite corregirlo
r = evaluarReconstruccion({ ingredientes: base(), porciones_propuesta: 4, actual: { ...actual, kcal: 125 } })
assert.equal(r.ok, true, r.motivos.join(';'))

// Cambio de raciones desproporcionado (2 → 8): bloquea
r = evaluarReconstruccion({ ingredientes: base(), porciones_propuesta: 8, actual: { ...actual, porciones: 2, kcal: 900 } })
assert.equal(r.ok, false)
assert.match(r.motivos.join(' '), /raciones/i)

// Atwater roto (macros de un alimento incoherentes con sus kcal): bloquea
r = evaluarReconstruccion({ ingredientes: [ing('Raro', 800, al('Raro', 100, 30, 30, 30)), ing('Arroz', 100, arroz)], porciones_propuesta: 2, actual: { ...actual, porciones: 2, kcal: 300 } })
assert.equal(r.ok, false)
assert.match(r.motivos.join(' '), /Atwater/i)

// Cantidad absurda o no positiva: bloquea
r = evaluarReconstruccion({ ingredientes: base([ing('Agua', 3000, al('Agua', 0, 0, 0, 0))]), porciones_propuesta: 4, actual })
assert.equal(r.ok, false)
r = evaluarReconstruccion({ ingredientes: base([ing('Nada', 0, pollo)]), porciones_propuesta: 4, actual })
assert.equal(r.ok, false)

console.log('reconstruccion-segura OK')
