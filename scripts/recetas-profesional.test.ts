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

// ── New quality gate tests ──

// 1. match_semantico_sospechoso: Frutos rojos -> Frutos Secos
{
  const input: RecetaProfesionalInput = {
    ...base,
    ingredientes: [
      { nombre_libre: 'Frutos rojos', nombre_alimento: 'Cóctel Frutos Secos sin Cáscara', cantidad_gramos: 100, tiene_precio: true },
    ],
  }
  const score = calcularScoreCalidadReceta(input)
  assert.ok(score.bloqueantes.includes('match_semantico_sospechoso'), 'Debería bloquear Frutos rojos -> Frutos Secos')
}

// 2. Nata espesa -> Aperitivo de patata con sabor a nata agria y cebolla
{
  const input: RecetaProfesionalInput = {
    ...base,
    ingredientes: [
      { nombre_libre: 'Nata espesa', nombre_alimento: 'Aperitivo de patata con sabor a nata agria y cebolla', cantidad_gramos: 50, tiene_precio: true },
    ],
  }
  const score = calcularScoreCalidadReceta(input)
  assert.ok(score.bloqueantes.includes('match_semantico_sospechoso'), 'Debería bloquear Nata espesa -> Aperitivo de patata')
}

// 3. Arroz glutinoso tailandés -> Cereales copos de trigo integral y arroz bañados en chocolate
{
  const input: RecetaProfesionalInput = {
    ...base,
    ingredientes: [
      { nombre_libre: 'Arroz glutinoso tailandés', nombre_alimento: 'Cereales copos de trigo integral y arroz bañados en chocolate', cantidad_gramos: 100, tiene_precio: true },
    ],
  }
  const score = calcularScoreCalidadReceta(input)
  assert.ok(score.bloqueantes.includes('match_semantico_sospechoso'), 'Debería bloquear Arroz glutinoso -> Cereales chocolateados')
}

// 4. Sal cantidad_gramos 80 => cantidades_sospechosas
{
  const input: RecetaProfesionalInput = {
    ...base,
    ingredientes: [
      { nombre_libre: 'Sal', cantidad_gramos: 80, tiene_precio: true },
    ],
  }
  const score = calcularScoreCalidadReceta(input)
  assert.ok(score.bloqueantes.includes('cantidades_sospechosas'), 'Debería bloquear sal > 10g')
}

// 5. Ralladura de limón cantidad_gramos 120 => cantidades_sospechosas
{
  const input: RecetaProfesionalInput = {
    ...base,
    ingredientes: [
      { nombre_libre: 'Ralladura de limón', cantidad_gramos: 120, tiene_precio: true },
    ],
  }
  const score = calcularScoreCalidadReceta(input)
  assert.ok(score.bloqueantes.includes('cantidades_sospechosas'), 'Debería bloquear ralladura > 10g')
}

// 6. receta nombre 'Mango sticky rice tailandés' con ingredientes 'Nata espesa' y 'Yemas de huevo' => receta_semantica_incoherente
{
  const input: RecetaProfesionalInput = {
    ...base,
    nombre: 'Mango sticky rice tailandés',
    ingredientes: [
      { nombre_libre: 'Nata espesa', cantidad_gramos: 50, tiene_precio: true },
      { nombre_libre: 'Yemas de huevo', cantidad_gramos: 30, tiene_precio: true },
    ],
  }
  const score = calcularScoreCalidadReceta(input)
  assert.ok(score.bloqueantes.includes('receta_semantica_incoherente'), 'Debería bloquear receta incoherente')
}

// 7. caso bueno: Mango sticky rice con ingredientes correctos => no añade esos bloqueantes
{
  const input: RecetaProfesionalInput = {
    ...base,
    nombre: 'Mango sticky rice tailandés',
    ingredientes: [
      { nombre_libre: 'Arroz glutinoso', nombre_alimento: 'Arroz glutinoso', cantidad_gramos: 150, tiene_precio: true },
      { nombre_libre: 'Leche de coco', nombre_alimento: 'Leche de coco', cantidad_gramos: 100, tiene_precio: true },
      { nombre_libre: 'Azúcar', nombre_alimento: 'Azúcar', cantidad_gramos: 30, tiene_precio: true },
      { nombre_libre: 'Sal', cantidad_gramos: 2, tiene_precio: true },
      { nombre_libre: 'Mango maduro', nombre_alimento: 'Mango', cantidad_gramos: 200, tiene_precio: true },
      { nombre_libre: 'Sésamo', nombre_alimento: 'Sésamo', cantidad_gramos: 5, tiene_precio: true },
    ],
  }
  const score = calcularScoreCalidadReceta(input)
  assert.ok(!score.bloqueantes.includes('match_semantico_sospechoso'), 'No debería bloquear match semántico')
  assert.ok(!score.bloqueantes.includes('cantidades_sospechosas'), 'No debería bloquear cantidades sospechosas')
  assert.ok(!score.bloqueantes.includes('receta_semantica_incoherente'), 'No debería bloquear receta incoherente')
}

console.log('recetas-profesional.test.ts OK')
