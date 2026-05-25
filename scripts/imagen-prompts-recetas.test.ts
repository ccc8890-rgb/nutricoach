import assert from 'node:assert/strict'
import { construirPromptImagenReceta, inferirPresetImagenReceta } from '../lib/recetas/imagen-prompts'

const receta = {
  nombre: 'Bowl de arroz, pollo y mango post-entreno',
  descripcion: 'Bowl fresco con carbohidratos útiles y proteína magra.',
  kcal: 620,
  proteinas: 42,
  carbohidratos: 78,
  grasas: 14,
  deportes: ['running', 'endurance'],
  momentos: ['post_entreno'],
  estilos: ['funcional'],
  receta_ingredientes: [
    { nombre_libre: 'arroz jazmín', cantidad_gramos: 150 },
    { nombre_libre: 'pollo a la plancha', cantidad_gramos: 140 },
    { nombre_libre: 'mango', cantidad_gramos: 80 },
  ],
}

assert.equal(inferirPresetImagenReceta(receta), 'performance_bowl')

const prompt = construirPromptImagenReceta(receta)
assert.match(prompt, /arroz jazmín/)
assert.match(prompt, /pollo a la plancha/)
assert.match(prompt, /mango/)
assert.match(prompt, /Evitar estrictamente/)
assert.match(prompt, /aspecto de imagen IA/)
assert.match(prompt, /sin aspecto CGI/)

console.log('imagen-prompts-recetas.test.ts OK')
