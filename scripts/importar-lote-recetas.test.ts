import assert from 'node:assert/strict'
import { MAX_IMPORT_RECETAS_LOTE, normalizarRecetasGeneradas } from '../lib/recetas/importar-lote'

const recetas = normalizarRecetasGeneradas({
  recetas: Array.from({ length: 30 }, (_, idx) => ({
    nombre: idx === 0 ? 'Bowl post-entreno' : `Receta ${idx}`,
    porciones: 1,
    kcal: 520,
    proteinas: 38,
    ingredientes: [
      { nombre: 'Arroz jazmín', cantidad_gramos: 125.4 },
      { nombre_libre: 'Pollo', cantidad_gramos: 150 },
      { nombre: '', cantidad_gramos: 10 },
    ],
    objetivos: ['rendimiento'],
    deportes: ['running'],
    momentos: ['post_entreno'],
    estilos: ['chef_healthy'],
    premium_chef: true,
    estado: 'aprobada',
  })),
})

assert.equal(recetas.length, MAX_IMPORT_RECETAS_LOTE)
assert.equal(recetas[0].nombre, 'Bowl post-entreno')
assert.equal(recetas[0].premium_chef, true)
assert.equal(recetas[0].objetivos[0], 'rendimiento')
assert.equal(recetas[0].ingredientes.length, 2)
assert.equal(recetas[0].ingredientes[0].orden, 0)

const vacias = normalizarRecetasGeneradas({ recetas: [{ descripcion: 'sin nombre' }] })
assert.equal(vacias.length, 0)

console.log('importar-lote-recetas.test.ts OK')
