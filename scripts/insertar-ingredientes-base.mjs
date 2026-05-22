#!/usr/bin/env node
/**
 * insertar-ingredientes-base.mjs
 *
 * Inserta ingredientes culinarios básicos (BEDCA / USDA) que faltan en la BD.
 * La BD de alimentos viene de scraping de supermercados (productos de marca)
 * y carece de los ingredientes crudos/genéricos necesarios para matching de recetas.
 *
 * Solo inserta si el nombre exacto no existe ya.
 * USO: node scripts/insertar-ingredientes-base.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const [k, ...v] = line.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// ── Ingredientes base (macros por 100g, fuente: BEDCA / USDA / etiquetas comunes) ────────────────
// Formato: { nombre, categoria, calorias, proteinas, carbohidratos, grasas, fibra }
const INGREDIENTES = [
  // ── Verduras y hortalizas frescas ───────────────────────────────────────────
  { nombre: 'Espinacas frescas', categoria: 'Verduras y hortalizas', calorias: 23, proteinas: 2.9, carbohidratos: 1.4, grasas: 0.4, fibra: 2.2 },
  { nombre: 'Espinacas baby', categoria: 'Verduras y hortalizas', calorias: 23, proteinas: 2.9, carbohidratos: 1.4, grasas: 0.4, fibra: 2.2 },
  { nombre: 'Tomate fresco', categoria: 'Verduras y hortalizas', calorias: 18, proteinas: 0.9, carbohidratos: 3.9, grasas: 0.2, fibra: 1.2 },
  { nombre: 'Tomate maduro', categoria: 'Verduras y hortalizas', calorias: 18, proteinas: 0.9, carbohidratos: 3.9, grasas: 0.2, fibra: 1.2 },
  { nombre: 'Tomate cherry', categoria: 'Verduras y hortalizas', calorias: 18, proteinas: 0.9, carbohidratos: 3.9, grasas: 0.2, fibra: 1.2 },
  { nombre: 'Cebolla', categoria: 'Verduras y hortalizas', calorias: 40, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.1, fibra: 1.7 },
  { nombre: 'Cebolla roja', categoria: 'Verduras y hortalizas', calorias: 40, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.1, fibra: 1.7 },
  { nombre: 'Pimiento rojo', categoria: 'Verduras y hortalizas', calorias: 31, proteinas: 1.0, carbohidratos: 6.0, grasas: 0.3, fibra: 2.1 },
  { nombre: 'Pimiento verde', categoria: 'Verduras y hortalizas', calorias: 20, proteinas: 0.9, carbohidratos: 4.6, grasas: 0.2, fibra: 1.7 },
  { nombre: 'Calabacín', categoria: 'Verduras y hortalizas', calorias: 17, proteinas: 1.2, carbohidratos: 3.1, grasas: 0.3, fibra: 1.0 },
  { nombre: 'Berenjena', categoria: 'Verduras y hortalizas', calorias: 25, proteinas: 1.0, carbohidratos: 5.7, grasas: 0.2, fibra: 3.0 },
  { nombre: 'Brócoli', categoria: 'Verduras y hortalizas', calorias: 34, proteinas: 2.8, carbohidratos: 7.2, grasas: 0.4, fibra: 2.6 },
  { nombre: 'Coliflor', categoria: 'Verduras y hortalizas', calorias: 25, proteinas: 1.9, carbohidratos: 5.0, grasas: 0.3, fibra: 2.0 },
  { nombre: 'Zanahoria', categoria: 'Verduras y hortalizas', calorias: 41, proteinas: 0.9, carbohidratos: 10.0, grasas: 0.2, fibra: 2.8 },
  { nombre: 'Champiñón', categoria: 'Verduras y hortalizas', calorias: 22, proteinas: 3.1, carbohidratos: 3.3, grasas: 0.3, fibra: 1.0 },
  { nombre: 'Champiñones', categoria: 'Verduras y hortalizas', calorias: 22, proteinas: 3.1, carbohidratos: 3.3, grasas: 0.3, fibra: 1.0 },
  { nombre: 'Espárragos trigueros', categoria: 'Verduras y hortalizas', calorias: 20, proteinas: 2.2, carbohidratos: 3.9, grasas: 0.1, fibra: 2.1 },
  { nombre: 'Espárragos verdes', categoria: 'Verduras y hortalizas', calorias: 20, proteinas: 2.2, carbohidratos: 3.9, grasas: 0.1, fibra: 2.1 },
  { nombre: 'Judías verdes', categoria: 'Verduras y hortalizas', calorias: 31, proteinas: 1.8, carbohidratos: 7.1, grasas: 0.1, fibra: 3.4 },
  { nombre: 'Lechuga', categoria: 'Verduras y hortalizas', calorias: 15, proteinas: 1.4, carbohidratos: 2.2, grasas: 0.2, fibra: 1.3 },
  { nombre: 'Rúcula', categoria: 'Verduras y hortalizas', calorias: 25, proteinas: 2.6, carbohidratos: 3.7, grasas: 0.7, fibra: 1.6 },
  { nombre: 'Pepino', categoria: 'Verduras y hortalizas', calorias: 15, proteinas: 0.7, carbohidratos: 3.6, grasas: 0.1, fibra: 0.5 },
  { nombre: 'Apio', categoria: 'Verduras y hortalizas', calorias: 16, proteinas: 0.7, carbohidratos: 3.0, grasas: 0.2, fibra: 1.6 },
  { nombre: 'Puerro', categoria: 'Verduras y hortalizas', calorias: 61, proteinas: 1.5, carbohidratos: 14.2, grasas: 0.3, fibra: 1.8 },
  { nombre: 'Remolacha', categoria: 'Verduras y hortalizas', calorias: 43, proteinas: 1.6, carbohidratos: 9.6, grasas: 0.1, fibra: 2.8 },
  { nombre: 'Maíz dulce', categoria: 'Verduras y hortalizas', calorias: 86, proteinas: 3.2, carbohidratos: 19.0, grasas: 1.2, fibra: 2.4 },
  // ── Proteínas animales ─────────────────────────────────────────────────────
  { nombre: 'Salmón fresco', categoria: 'Pescados y mariscos', calorias: 208, proteinas: 20.0, carbohidratos: 0, grasas: 13.0, fibra: 0 },
  { nombre: 'Lomo de salmón', categoria: 'Pescados y mariscos', calorias: 208, proteinas: 20.0, carbohidratos: 0, grasas: 13.0, fibra: 0 },
  { nombre: 'Filete de salmón', categoria: 'Pescados y mariscos', calorias: 208, proteinas: 20.0, carbohidratos: 0, grasas: 13.0, fibra: 0 },
  { nombre: 'Atún fresco', categoria: 'Pescados y mariscos', calorias: 132, proteinas: 28.0, carbohidratos: 0, grasas: 1.0, fibra: 0 },
  { nombre: 'Lomo de atún', categoria: 'Pescados y mariscos', calorias: 132, proteinas: 28.0, carbohidratos: 0, grasas: 1.0, fibra: 0 },
  { nombre: 'Merluza', categoria: 'Pescados y mariscos', calorias: 79, proteinas: 17.0, carbohidratos: 0, grasas: 0.7, fibra: 0 },
  { nombre: 'Dorada', categoria: 'Pescados y mariscos', calorias: 100, proteinas: 18.0, carbohidratos: 0, grasas: 3.0, fibra: 0 },
  { nombre: 'Caballa', categoria: 'Pescados y mariscos', calorias: 205, proteinas: 19.0, carbohidratos: 0, grasas: 13.5, fibra: 0 },
  { nombre: 'Boquerón fresco', categoria: 'Pescados y mariscos', calorias: 131, proteinas: 20.0, carbohidratos: 0, grasas: 5.5, fibra: 0 },
  { nombre: 'Gambas', categoria: 'Pescados y mariscos', calorias: 85, proteinas: 18.0, carbohidratos: 1.5, grasas: 0.9, fibra: 0 },
  { nombre: 'Langostinos', categoria: 'Pescados y mariscos', calorias: 85, proteinas: 18.0, carbohidratos: 1.5, grasas: 0.9, fibra: 0 },
  { nombre: 'Pulpo cocido', categoria: 'Pescados y mariscos', calorias: 82, proteinas: 14.9, carbohidratos: 2.2, grasas: 1.0, fibra: 0 },
  { nombre: 'Mejillones', categoria: 'Pescados y mariscos', calorias: 86, proteinas: 11.9, carbohidratos: 3.7, grasas: 2.2, fibra: 0 },
  { nombre: 'Bacalao fresco', categoria: 'Pescados y mariscos', calorias: 82, proteinas: 17.8, carbohidratos: 0, grasas: 0.7, fibra: 0 },
  { nombre: 'Pechuga de pollo', categoria: 'Carnes y aves', calorias: 110, proteinas: 23.0, carbohidratos: 0, grasas: 1.8, fibra: 0 },
  { nombre: 'Contramuslos de pollo', categoria: 'Carnes y aves', calorias: 170, proteinas: 17.0, carbohidratos: 0, grasas: 10.0, fibra: 0 },
  { nombre: 'Muslos de pollo', categoria: 'Carnes y aves', calorias: 177, proteinas: 16.0, carbohidratos: 0, grasas: 12.0, fibra: 0 },
  { nombre: 'Pavo en filetes', categoria: 'Carnes y aves', calorias: 104, proteinas: 22.0, carbohidratos: 0, grasas: 1.5, fibra: 0 },
  { nombre: 'Pechuga de pavo', categoria: 'Carnes y aves', calorias: 104, proteinas: 22.0, carbohidratos: 0, grasas: 1.5, fibra: 0 },
  { nombre: 'Ternera magra', categoria: 'Carnes y aves', calorias: 145, proteinas: 21.0, carbohidratos: 0, grasas: 6.5, fibra: 0 },
  { nombre: 'Lomo de cerdo', categoria: 'Carnes y aves', calorias: 143, proteinas: 20.0, carbohidratos: 0, grasas: 6.5, fibra: 0 },
  { nombre: 'Carne picada de ternera', categoria: 'Carnes y aves', calorias: 180, proteinas: 19.0, carbohidratos: 0, grasas: 11.0, fibra: 0 },
  { nombre: 'Carne picada mixta', categoria: 'Carnes y aves', calorias: 200, proteinas: 17.0, carbohidratos: 0, grasas: 14.0, fibra: 0 },
  { nombre: 'Jamón ibérico', categoria: 'Embutidos y charcutería', calorias: 375, proteinas: 37.0, carbohidratos: 0.5, grasas: 25.0, fibra: 0 },
  // ── Huevos ─────────────────────────────────────────────────────────────────
  { nombre: 'Huevo entero', categoria: 'Huevos y derivados', calorias: 155, proteinas: 12.6, carbohidratos: 1.1, grasas: 10.6, fibra: 0 },
  { nombre: 'Clara de huevo', categoria: 'Huevos y derivados', calorias: 52, proteinas: 11.0, carbohidratos: 0.7, grasas: 0.2, fibra: 0 },
  { nombre: 'Yema de huevo', categoria: 'Huevos y derivados', calorias: 322, proteinas: 15.9, carbohidratos: 3.6, grasas: 26.5, fibra: 0 },
  // ── Lácteos ────────────────────────────────────────────────────────────────
  { nombre: 'Queso feta', categoria: 'Lácteos y derivados', calorias: 264, proteinas: 14.2, carbohidratos: 4.1, grasas: 21.3, fibra: 0 },
  { nombre: 'Queso fresco', categoria: 'Lácteos y derivados', calorias: 98, proteinas: 10.0, carbohidratos: 2.0, grasas: 5.8, fibra: 0 },
  { nombre: 'Queso parmesano', categoria: 'Lácteos y derivados', calorias: 431, proteinas: 38.5, carbohidratos: 4.1, grasas: 29.7, fibra: 0 },
  { nombre: 'Queso rallado', categoria: 'Lácteos y derivados', calorias: 400, proteinas: 30.0, carbohidratos: 2.0, grasas: 30.0, fibra: 0 },
  { nombre: 'Requesón', categoria: 'Lácteos y derivados', calorias: 105, proteinas: 10.0, carbohidratos: 3.0, grasas: 6.0, fibra: 0 },
  { nombre: 'Leche desnatada', categoria: 'Lácteos y derivados', calorias: 35, proteinas: 3.4, carbohidratos: 4.9, grasas: 0.1, fibra: 0 },
  { nombre: 'Leche semidesnatada', categoria: 'Lácteos y derivados', calorias: 47, proteinas: 3.3, carbohidratos: 4.8, grasas: 1.5, fibra: 0 },
  { nombre: 'Nata para cocinar', categoria: 'Lácteos y derivados', calorias: 195, proteinas: 2.5, carbohidratos: 3.5, grasas: 19.5, fibra: 0 },
  { nombre: 'Mantequilla', categoria: 'Grasas y aceites', calorias: 744, proteinas: 0.5, carbohidratos: 0.8, grasas: 82.0, fibra: 0 },
  // ── Frutos secos y semillas ────────────────────────────────────────────────
  { nombre: 'Almendras crudas', categoria: 'Frutos secos', calorias: 579, proteinas: 21.2, carbohidratos: 21.7, grasas: 49.9, fibra: 12.5 },
  { nombre: 'Nueces', categoria: 'Frutos secos', calorias: 654, proteinas: 15.2, carbohidratos: 13.7, grasas: 65.2, fibra: 6.7 },
  { nombre: 'Anacardos', categoria: 'Frutos secos', calorias: 553, proteinas: 18.2, carbohidratos: 30.2, grasas: 43.8, fibra: 3.3 },
  { nombre: 'Piñones', categoria: 'Frutos secos', calorias: 673, proteinas: 13.7, carbohidratos: 13.1, grasas: 68.4, fibra: 3.7 },
  { nombre: 'Semillas de calabaza', categoria: 'Semillas', calorias: 559, proteinas: 30.2, carbohidratos: 10.7, grasas: 49.1, fibra: 6.0 },
  { nombre: 'Semillas de chía', categoria: 'Semillas', calorias: 486, proteinas: 16.5, carbohidratos: 42.1, grasas: 30.7, fibra: 34.4 },
  { nombre: 'Semillas de lino', categoria: 'Semillas', calorias: 534, proteinas: 18.3, carbohidratos: 28.9, grasas: 42.2, fibra: 27.3 },
  { nombre: 'Semillas de sésamo', categoria: 'Semillas', calorias: 573, proteinas: 17.7, carbohidratos: 23.5, grasas: 49.7, fibra: 11.8 },
  { nombre: 'Mantequilla de almendras', categoria: 'Frutos secos', calorias: 614, proteinas: 21.0, carbohidratos: 18.8, grasas: 55.5, fibra: 10.3 },
  { nombre: 'Mantequilla de cacahuete', categoria: 'Frutos secos', calorias: 588, proteinas: 25.0, carbohidratos: 20.0, grasas: 50.0, fibra: 6.0 },
  // ── Frutas ─────────────────────────────────────────────────────────────────
  { nombre: 'Dátiles medjool', categoria: 'Frutas', calorias: 277, proteinas: 1.8, carbohidratos: 75.0, grasas: 0.2, fibra: 6.7 },
  { nombre: 'Dátiles', categoria: 'Frutas', calorias: 277, proteinas: 1.8, carbohidratos: 75.0, grasas: 0.2, fibra: 6.7 },
  { nombre: 'Limón', categoria: 'Frutas', calorias: 29, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.3, fibra: 2.8 },
  { nombre: 'Lima', categoria: 'Frutas', calorias: 30, proteinas: 0.7, carbohidratos: 10.5, grasas: 0.2, fibra: 2.8 },
  { nombre: 'Naranja', categoria: 'Frutas', calorias: 47, proteinas: 0.9, carbohidratos: 11.8, grasas: 0.1, fibra: 2.4 },
  { nombre: 'Higo fresco', categoria: 'Frutas', calorias: 74, proteinas: 0.8, carbohidratos: 19.2, grasas: 0.3, fibra: 2.9 },
  { nombre: 'Higos frescos', categoria: 'Frutas', calorias: 74, proteinas: 0.8, carbohidratos: 19.2, grasas: 0.3, fibra: 2.9 },
  // ── Legumbres ──────────────────────────────────────────────────────────────
  { nombre: 'Garbanzos cocidos', categoria: 'Legumbres', calorias: 164, proteinas: 8.9, carbohidratos: 27.4, grasas: 2.6, fibra: 7.6 },
  { nombre: 'Lentejas cocidas', categoria: 'Legumbres', calorias: 116, proteinas: 9.0, carbohidratos: 20.1, grasas: 0.4, fibra: 7.9 },
  { nombre: 'Alubias negras cocidas', categoria: 'Legumbres', calorias: 132, proteinas: 8.9, carbohidratos: 23.7, grasas: 0.5, fibra: 8.7 },
  { nombre: 'Edamame', categoria: 'Legumbres', calorias: 122, proteinas: 11.0, carbohidratos: 8.9, grasas: 5.2, fibra: 5.2 },
  // ── Cereales y harinas ─────────────────────────────────────────────────────
  { nombre: 'Arroz blanco', categoria: 'Cereales y derivados', calorias: 360, proteinas: 6.7, carbohidratos: 79.4, grasas: 0.6, fibra: 1.0 },
  { nombre: 'Arroz integral', categoria: 'Cereales y derivados', calorias: 350, proteinas: 7.9, carbohidratos: 74.1, grasas: 2.1, fibra: 3.5 },
  { nombre: 'Arroz basmati', categoria: 'Cereales y derivados', calorias: 356, proteinas: 7.0, carbohidratos: 78.0, grasas: 0.6, fibra: 1.0 },
  { nombre: 'Fideos de arroz', categoria: 'Cereales y derivados', calorias: 364, proteinas: 6.8, carbohidratos: 80.0, grasas: 0.6, fibra: 0.9 },
  { nombre: 'Pan integral', categoria: 'Cereales y derivados', calorias: 247, proteinas: 9.0, carbohidratos: 41.4, grasas: 3.5, fibra: 6.8 },
  { nombre: 'Pan de centeno', categoria: 'Cereales y derivados', calorias: 259, proteinas: 8.5, carbohidratos: 48.0, grasas: 3.3, fibra: 6.2 },
  { nombre: 'Tortilla de maíz', categoria: 'Cereales y derivados', calorias: 218, proteinas: 5.7, carbohidratos: 44.6, grasas: 2.9, fibra: 3.6 },
  // ── Especias, condimentos y hierbas ───────────────────────────────────────
  { nombre: 'Pimentón ahumado', categoria: 'Especias y condimentos', calorias: 282, proteinas: 14.1, carbohidratos: 54.0, grasas: 12.9, fibra: 34.9 },
  { nombre: 'Pimentón dulce', categoria: 'Especias y condimentos', calorias: 282, proteinas: 14.1, carbohidratos: 54.0, grasas: 12.9, fibra: 34.9 },
  { nombre: 'Pimentón picante', categoria: 'Especias y condimentos', calorias: 282, proteinas: 14.1, carbohidratos: 54.0, grasas: 12.9, fibra: 34.9 },
  { nombre: 'Comino molido', categoria: 'Especias y condimentos', calorias: 375, proteinas: 17.8, carbohidratos: 44.2, grasas: 22.3, fibra: 10.5 },
  { nombre: 'Cúrcuma', categoria: 'Especias y condimentos', calorias: 312, proteinas: 9.7, carbohidratos: 67.1, grasas: 3.3, fibra: 21.1 },
  { nombre: 'Canela molida', categoria: 'Especias y condimentos', calorias: 247, proteinas: 4.0, carbohidratos: 80.6, grasas: 1.2, fibra: 53.1 },
  { nombre: 'Jengibre fresco', categoria: 'Especias y condimentos', calorias: 80, proteinas: 1.8, carbohidratos: 17.8, grasas: 0.8, fibra: 2.0 },
  { nombre: 'Jengibre en polvo', categoria: 'Especias y condimentos', calorias: 335, proteinas: 8.9, carbohidratos: 71.6, grasas: 4.2, fibra: 14.1 },
  { nombre: 'Perejil fresco', categoria: 'Especias y condimentos', calorias: 36, proteinas: 3.0, carbohidratos: 6.3, grasas: 0.8, fibra: 3.3 },
  { nombre: 'Perejil seco', categoria: 'Especias y condimentos', calorias: 292, proteinas: 26.6, carbohidratos: 50.6, grasas: 5.5, fibra: 26.7 },
  { nombre: 'Cilantro fresco', categoria: 'Especias y condimentos', calorias: 23, proteinas: 2.1, carbohidratos: 3.7, grasas: 0.5, fibra: 2.8 },
  { nombre: 'Menta fresca', categoria: 'Especias y condimentos', calorias: 44, proteinas: 3.3, carbohidratos: 8.4, grasas: 0.7, fibra: 6.8 },
  { nombre: 'Albahaca fresca', categoria: 'Especias y condimentos', calorias: 23, proteinas: 3.2, carbohidratos: 2.7, grasas: 0.6, fibra: 1.6 },
  { nombre: 'Tomillo seco', categoria: 'Especias y condimentos', calorias: 276, proteinas: 9.1, carbohidratos: 63.9, grasas: 7.4, fibra: 37.0 },
  { nombre: 'Romero seco', categoria: 'Especias y condimentos', calorias: 331, proteinas: 4.9, carbohidratos: 64.1, grasas: 15.2, fibra: 42.6 },
  { nombre: 'Orégano seco', categoria: 'Especias y condimentos', calorias: 265, proteinas: 11.0, carbohidratos: 68.9, grasas: 4.3, fibra: 42.5 },
  { nombre: 'Orégano fresco', categoria: 'Especias y condimentos', calorias: 265, proteinas: 11.0, carbohidratos: 68.9, grasas: 4.3, fibra: 42.5 },
  { nombre: 'Vinagre de vino tinto', categoria: 'Especias y condimentos', calorias: 18, proteinas: 0.1, carbohidratos: 0.3, grasas: 0, fibra: 0 },
  { nombre: 'Vinagre de vino', categoria: 'Especias y condimentos', calorias: 18, proteinas: 0.1, carbohidratos: 0.3, grasas: 0, fibra: 0 },
  { nombre: 'Vinagre balsámico', categoria: 'Especias y condimentos', calorias: 88, proteinas: 0.5, carbohidratos: 17.0, grasas: 0, fibra: 0 },
  { nombre: 'Mostaza', categoria: 'Especias y condimentos', calorias: 66, proteinas: 4.4, carbohidratos: 5.8, grasas: 3.3, fibra: 3.2 },
  { nombre: 'Salsa de soja', categoria: 'Especias y condimentos', calorias: 60, proteinas: 10.0, carbohidratos: 5.6, grasas: 0.1, fibra: 0.8 },
  { nombre: 'Pasta de tomate', categoria: 'Especias y condimentos', calorias: 82, proteinas: 4.3, carbohidratos: 18.9, grasas: 0.5, fibra: 4.2 },
  { nombre: 'Tomate triturado', categoria: 'Conservas vegetales', calorias: 25, proteinas: 1.2, carbohidratos: 5.0, grasas: 0.2, fibra: 1.5 },
  // ── Aceites y grasas ───────────────────────────────────────────────────────
  { nombre: 'Aceite de oliva extra virgen', categoria: 'Grasas y aceites', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100.0, fibra: 0 },
  { nombre: 'Aceite de sésamo', categoria: 'Grasas y aceites', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100.0, fibra: 0 },
  { nombre: 'Aceite de coco', categoria: 'Grasas y aceites', calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100.0, fibra: 0 },
  // ── Otros ─────────────────────────────────────────────────────────────────
  { nombre: 'Caldo de verduras', categoria: 'Caldos y sopas', calorias: 15, proteinas: 0.5, carbohidratos: 2.5, grasas: 0.3, fibra: 0 },
  { nombre: 'Levadura nutricional', categoria: 'Otros', calorias: 325, proteinas: 50.0, carbohidratos: 38.0, grasas: 7.3, fibra: 17.0 },
  { nombre: 'Cacao puro en polvo', categoria: 'Cacao y chocolate', calorias: 228, proteinas: 19.6, carbohidratos: 57.9, grasas: 13.7, fibra: 33.2 },
  { nombre: 'Vainilla en pasta', categoria: 'Especias y condimentos', calorias: 288, proteinas: 0.1, carbohidratos: 12.6, grasas: 0.1, fibra: 0 },
  { nombre: 'Harina de almendras', categoria: 'Harinas y féculas', calorias: 579, proteinas: 21.2, carbohidratos: 21.7, grasas: 49.9, fibra: 12.5 },
  { nombre: 'Harina de avena', categoria: 'Harinas y féculas', calorias: 379, proteinas: 13.2, carbohidratos: 67.7, grasas: 6.9, fibra: 8.5 },
  { nombre: 'Harina integral', categoria: 'Harinas y féculas', calorias: 340, proteinas: 13.2, carbohidratos: 72.0, grasas: 1.9, fibra: 10.7 },
]

async function main() {
  console.log(`🥗 Insertando ${INGREDIENTES.length} ingredientes base en BD...`)
  console.log()

  let insertados = 0
  let yaExistian = 0
  let errores = 0

  for (const ing of INGREDIENTES) {
    // Verificar si ya existe
    const { data: existente } = await supabase
      .from('alimentos')
      .select('id')
      .ilike('nombre', ing.nombre)
      .limit(1)

    if (existente && existente.length > 0) {
      yaExistian++
      continue
    }

    const { error } = await supabase.from('alimentos').insert({
      nombre: ing.nombre,
      categoria: ing.categoria,
      calorias: ing.calorias,
      proteinas: ing.proteinas,
      carbohidratos: ing.carbohidratos,
      grasas: ing.grasas,
      fibra: ing.fibra || 0,
      fuente: 'bedca',
      es_generico: true,
      es_comestible: true,
    })

    if (error) {
      console.error(`  ❌ ${ing.nombre}: ${error.message}`)
      errores++
    } else {
      console.log(`  ✅ ${ing.nombre} (${ing.calorias} kcal)`)
      insertados++
    }
  }

  console.log()
  console.log(`📊 Resumen:`)
  console.log(`   ✅ Insertados: ${insertados}`)
  console.log(`   ⏭️  Ya existían: ${yaExistian}`)
  console.log(`   ❌ Errores: ${errores}`)
}

main().catch(console.error)
