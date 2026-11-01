import assert from 'node:assert/strict'
import { vinculoParaReceta } from '../lib/alimentos/vinculo-receta'

const v = (libre: string, alimento: string, categoria?: string) => vinculoParaReceta(libre, { nombre: alimento, categoria }).ok

// fallos reales que se repetían: la línea de receta acaba en un producto elaborado o de marca
assert.equal(v('Nata', 'Castañas heladas de nata'), false)
assert.equal(v('Tomate triturado natural', 'Tomate Triturado con Cebolla'), false)
assert.equal(v('AOVE', 'Lingote de Bacalao Macerado en Aove'), false)
assert.equal(v('Café', 'Cafe Soluble 3 en 1 3 Sobres'), false)
assert.equal(v('Chocolate para relleno', 'Crepes rellenos de chocolate'), false)
assert.equal(v('Langostinos', 'Langostinos Coc Rodolfo'), false)
assert.equal(v('Verduras', 'Verduras Gourmet Listos en Tres Minutos'), false)
assert.equal(v('Pan de hamburguesa integral', 'Pan de hamburguesa sin gluten'), false)
assert.equal(v('Orégano seco', 'Cuadraditos Tomate y Orégano'), false)
assert.equal(v('Pasta de tomate', 'Tarrito de Pasta Cachitos Pasta y Tomate'), false)

// lo normal sigue pasando: forma, corte, estado, envase, nombre idéntico
assert.equal(v('Canela en polvo', 'Canela molida'), true)
assert.equal(v('Tomates cherry', 'Tomate cherry'), true)
assert.equal(v('Caldo de pollo', 'Caldo de Pollo Brick'), true)
assert.equal(v('Zumo de limón', 'Zumo de limón', 'Platos preparados'), true)
assert.equal(v('Aceitunas negras', 'Aceitunas negras sin hueso'), true)
assert.equal(v('Crepes rellenos de chocolate', 'Crepes rellenos de chocolate'), true)
console.log('vinculo-receta OK')

// componentes de una receta (otra preparación): nunca un ingrediente ni un alimento nuevo
import { esSubReceta } from '../lib/alimentos/vinculo-receta'
for (const n of ['Crema diplomática de mantequilla dorada y arce', 'Ganache de crema agria', 'Caramelo de kabocha, miso, sésamo y frutos secos', 'Crujiente de copos de maíz, arce y soja', 'Pan de calabaza y arce', 'Frosting con sabor a café'])
  assert.equal(esSubReceta(n), true, n)
for (const n of ['Salsa de soja baja en sal', 'Aceite de oliva 0,4º', 'Cacao en polvo, sin azúcar', 'Pan de burger integral o de boniato (opcional)', 'Masa de hojaldre refrigerada', 'Crema de cacahuete', 'Nata', 'Caramelo líquido'])
  assert.equal(esSubReceta(n), false, n)
console.log('sub-receta OK')
