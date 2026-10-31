import assert from 'node:assert/strict'
import { cantidadEstimada, esUrlDeReel } from '../lib/recetas/estimadas'

const ing = { cantidad_gramos: 100, cantidad_original: null }
// Reel en revisión: sin cantidad dicha = estimada; con cantidad dicha, no
assert.equal(cantidadEstimada(ing, { estado: 'en_revision', url_origen: 'https://vm.tiktok.com/abc/' }), true)
assert.equal(cantidadEstimada({ ...ing, cantidad_original: 2 }, { estado: 'en_revision', url_origen: 'https://www.instagram.com/reel/x/' }), false)
// Web: las cantidades son de la receta original, aunque no guarden cantidad_original
assert.equal(cantidadEstimada(ing, { estado: 'en_revision', url_origen: 'https://www.skinnytaste.com/receta/' }), false)
// Ya aprobada: revisada
assert.equal(cantidadEstimada(ing, { estado: 'aprobada', url_origen: 'https://vm.tiktok.com/abc/' }), false)
assert.equal(esUrlDeReel('https://youtu.be/abc'), true)
assert.equal(esUrlDeReel(null), false)
console.log('estimadas OK')
