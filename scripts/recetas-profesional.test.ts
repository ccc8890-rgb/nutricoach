import assert from 'node:assert/strict'
import {
  calcularScoreCalidadReceta,
  clasificarRecetaProfesional,
  resumenCalidadReceta,
  type RecetaProfesionalInput,
} from '../lib/recetas/profesional'

const base: RecetaProfesionalInput = {
  nombre: 'Bowl de pollo y arroz',
  descripcion: 'Bowl completo para comida diaria.',
  instrucciones: 'Cocina el arroz. Marca el pollo. Monta el bowl con verduras.',
  categoria: 'Comida',
  tipo_plato: 'Comida',
  dificultad: 'facil',
  imagen_url: 'https://example.com/bowl.webp',
  url_origen: 'https://example.com',
  kcal: 540,
  proteinas: 42,
  carbohidratos: 58,
  grasas: 15,
  fibra: 8,
  porciones: 1,
  intolerancias: ['sin_gluten'],
  ingredientes: [
    { alimento_id: 'pollo', cantidad_gramos: 180, tiene_precio: true },
    { alimento_id: 'arroz', cantidad_gramos: 120, tiene_precio: true },
    { alimento_id: 'verduras', cantidad_gramos: 150, tiene_precio: true },
    { alimento_id: 'aceite', cantidad_gramos: 10, tiene_precio: true },
  ],
}

assert.equal(clasificarRecetaProfesional(base).nivel_fit, 'fit')
assert.equal(clasificarRecetaProfesional(base).tipo_uso, 'diario')
assert.equal(clasificarRecetaProfesional(base).apta_cliente, 'atleta')

const postreAlcohol: RecetaProfesionalInput = {
  ...base,
  nombre: 'Tiramisú con amaretto',
  categoria: 'Postre',
  tipo_plato: 'Postre',
  kcal: 620,
  proteinas: 8,
  carbohidratos: 72,
  grasas: 32,
  fibra: 1,
  ingredientes: [
    { alimento_id: 'mascarpone', nombre_libre: 'mascarpone', cantidad_gramos: 120, tiene_precio: true },
    { alimento_id: 'bizcocho', nombre_libre: 'bizcocho', cantidad_gramos: 80, tiene_precio: true },
    { alimento_id: 'amaretto', nombre_libre: 'licor amaretto', cantidad_gramos: 15, tiene_precio: true },
    { alimento_id: 'cacao', nombre_libre: 'cacao', cantidad_gramos: 5, tiene_precio: true },
  ],
}

const clasificacionPostre = clasificarRecetaProfesional(postreAlcohol)
assert.equal(clasificacionPostre.nivel_fit, 'indulgente')
assert.equal(clasificacionPostre.tipo_uso, 'ocasional')
assert.equal(clasificacionPostre.alcohol_culinario, true)
assert.equal(clasificacionPostre.apta_cliente, 'requiere_revision')

const scoreBueno = calcularScoreCalidadReceta(base)
assert.equal(scoreBueno.score >= 90, true)
assert.equal(scoreBueno.bloqueantes.length, 0)

const incompleta: RecetaProfesionalInput = {
  ...base,
  descripcion: null,
  instrucciones: 'Mezclar.',
  imagen_url: null,
  kcal: 0,
  ingredientes: [
    { alimento_id: null, cantidad_gramos: 0, tiene_precio: false },
    { alimento_id: 'arroz', cantidad_gramos: 100, tiene_precio: false },
  ],
}

const scoreMalo = calcularScoreCalidadReceta(incompleta)
assert.equal(scoreMalo.score < 60, true)
assert.equal(scoreMalo.bloqueantes.includes('ingredientes_sin_alimento'), true)
assert.equal(scoreMalo.bloqueantes.includes('cantidades_invalidas'), true)

const resumen = resumenCalidadReceta(scoreMalo)
assert.equal(resumen.estado_sugerido, 'bloqueada')

console.log('recetas-profesional.test.ts OK')
