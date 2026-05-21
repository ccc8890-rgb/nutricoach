/**
 * Puebla precios referencia para ingredientes de recetas sin precio.
 *
 * No scrapea supermercados. Crea/usa un supermercado interno
 * "Precio referencia coach" y añade un precio estimado por kg para los
 * ingredientes más repetidos que no tengan precio en mejores_precios_por_alimento.
 *
 * Uso:
 *   node scripts/poblar-precios-referencia.mjs --limite=100
 *   node scripts/poblar-precios-referencia.mjs --limite=100 --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PAGE_SIZE = 1000

function loadEnv() {
  const envPath = resolve(ROOT, '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const LIMITE = Number(args.find(a => a.startsWith('--limite='))?.split('=')[1] || 100)

const SUPERMERCADO_REFERENCIA = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Precio referencia coach',
  slug: 'precio-referencia-coach',
  color: '#64748b',
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function round2(n) {
  return Math.round(n * 100) / 100
}

const EXACT = [
  [/vodka|licor amaretto|anis seco|anís seco/, 11],
  [/vino tinto|vino blanco/, 3.5],
  [/pasta de curry|curry rojo|curry verde/, 10],
  [/spaghetti|espagueti|pasta/, 1.8],
  [/harina de avena/, 3.8],
  [/overnight oats|proteina.*vainilla/, 18],
  [/aceite de oliva/, 7.5],
  [/cacao puro/, 12],
  [/ajo crudo|ajo picado/, 5],
  [/levadura quimica|polvo de hornear|bicarbonato/, 8],
  [/caseina|whey|proteina.*polvo/, 22],
  [/comino|pimenton|curry|canela|oregano|perejil|cilantro|jengibre|pimienta|curcuma|romero|tomillo/, 18],
  [/leche de avena/, 1.8],
  [/leche entera/, 1.15],
  [/datil|dátiles|datiles/, 7],
  [/aguacate/, 5.5],
  [/pechuga de pollo|pollo.*cruda/, 7.5],
  [/limon|lima/, 2.2],
  [/huevo/, 4.2],
  [/pan integral|pan de pita|tortilla de trigo|wrap/, 4],
  [/queso feta/, 10],
  [/mostaza/, 4],
  [/ternera|carne picada/, 12],
  [/boniato|batata/, 2.4],
  [/mayonesa/, 4.5],
  [/salsa de soja/, 5],
  [/calabacin/, 2],
  [/cebolla/, 1.6],
  [/avena|copos/, 2.2],
  [/harina de trigo/, 1.1],
  [/yogur griego|yogur|requeson|queso fresco batido|skyr/, 3.2],
  [/fresa|frambuesa|frutos rojos|arandano/, 7],
  [/manteca|mantequilla/, 8],
  [/azucar|eritritol|edulcorante/, 2.2],
  [/chocolate/, 12],
  [/garbanzo|lenteja|alubia/, 2.5],
  [/arroz|cuscus|quinoa/, 2.4],
  [/tomate/, 2],
  [/pimiento/, 3],
  [/zanahoria/, 1.4],
  [/patata/, 1.5],
  [/brocoli|coliflor|espinaca|lechuga|rucula|apio|pepino/, 3],
  [/salm[oó]n/, 18],
  [/bacalao|merluza|gamba|camar[oó]n|camarones|sepia|corvina|atun/, 14],
  [/jamon|pavo|bacon/, 12],
  [/almendra|cacahuete|nuez|anacardo|pistacho/, 10],
  [/crema de cacahuete/, 6],
  [/miel/, 6],
  [/salsa teriyaki|salsa picante|salsa verde|tabasco/, 5],
  [/konjac/, 6],
  [/granada|mango|manzana|platano|banana|naranja/, 2.8],
]

const CATEGORY_DEFAULT = {
  'Condimentos': 10,
  'Cereales': 2.5,
  'Arroces y pastas': 2.2,
  'Verduras': 2.5,
  'Suplementos': 22,
  'Lácteos': 3.5,
  'Lacteos': 3.5,
  'Grasas': 6,
  'Aceites y grasas': 7,
  'Frutos secos': 10,
  'Frutas': 3,
  'Carnes': 9,
  'Pescados': 14,
  'Mariscos': 16,
  'Huevos': 4.2,
  'Tubérculos': 1.8,
  'Bebidas': 1.5,
  'Dulces y bollería': 8,
  'Legumbres': 2.5,
  'Semillas': 8,
}

function estimarPrecioKg(alimento) {
  const n = norm(alimento.nombre)
  for (const [regex, precio] of EXACT) {
    if (regex.test(n)) return { precio: round2(precio), metodo: `regla:${regex.source}` }
  }
  const def = CATEGORY_DEFAULT[alimento.categoria] || 5
  return { precio: round2(def), metodo: `categoria:${alimento.categoria || 'sin_categoria'}` }
}

async function selectAll(table, columns, filters = q => q) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await filters(sb.from(table).select(columns)).range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function ensureSupermercado() {
  const { data: existing, error: selectError } = await sb
    .from('supermercados')
    .select('id')
    .eq('slug', SUPERMERCADO_REFERENCIA.slug)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) {
    const { error } = await sb
      .from('supermercados')
      .update(SUPERMERCADO_REFERENCIA)
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await sb.from('supermercados').insert(SUPERMERCADO_REFERENCIA)
  if (error) throw error
}

async function guardarProductoReferencia(payload) {
  const { data: existing, error: selectError } = await sb
    .from('productos_supermercado')
    .select('id')
    .eq('supermercado_id', payload.supermercado_id)
    .eq('url_producto', payload.url_producto)
    .maybeSingle()
  if (selectError) throw selectError

  if (existing) {
    const { error } = await sb
      .from('productos_supermercado')
      .update(payload)
      .eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await sb.from('productos_supermercado').insert(payload)
  if (error) throw error
}

async function main() {
  const precios = await selectAll('mejores_precios_por_alimento', 'alimento_id')
  const conPrecio = new Set(precios.map(p => p.alimento_id))

  const ingredientes = await selectAll(
    'receta_ingredientes',
    'id, alimento_id, cantidad_gramos, nombre_libre, alimentos(id,nombre,categoria)',
    q => q.not('alimento_id', 'is', null).gt('cantidad_gramos', 0),
  )

  const missing = ingredientes.filter(i => !conPrecio.has(i.alimento_id))
  const mapa = new Map()

  for (const ing of missing) {
    const alimento = ing.alimentos
    if (!alimento?.id) continue
    const item = mapa.get(alimento.id) || {
      alimento,
      usos: 0,
      gramos: 0,
    }
    item.usos += 1
    item.gramos += Number(ing.cantidad_gramos || 0)
    mapa.set(alimento.id, item)
  }

  const candidatos = Array.from(mapa.values())
    .sort((a, b) => b.usos - a.usos || b.gramos - a.gramos)
    .slice(0, LIMITE)

  console.log(`Ingredientes sin precio: ${mapa.size} únicos / ${missing.length} usos`)
  console.log(`Objetivo: poblar top ${candidatos.length} (${DRY_RUN ? 'dry-run' : 'aplicar'})`)

  if (!DRY_RUN) await ensureSupermercado()

  let insertados = 0
  const preview = []

  for (const c of candidatos) {
    const { precio, metodo } = estimarPrecioKg(c.alimento)
    const payload = {
      supermercado_id: SUPERMERCADO_REFERENCIA.id,
      alimento_id: c.alimento.id,
      precio_por_kg: precio,
      precio_unidad: null,
      unidad: 'kg',
      url_producto: `referencia://coach/${c.alimento.id}`,
      nombre_original: c.alimento.nombre,
      marca: 'Referencia coach',
      preferido: true,
      notas: `Precio referencia estimado para escandallo. Metodo: ${metodo}. Usos receta: ${c.usos}.`,
      fecha_precio: new Date().toISOString().slice(0, 10),
    }

    preview.push({ nombre: c.alimento.nombre, categoria: c.alimento.categoria, usos: c.usos, precio, metodo })

    if (!DRY_RUN) {
      await guardarProductoReferencia(payload)
      insertados += 1
    }
  }

  for (const p of preview.slice(0, 30)) {
    console.log(`${String(p.usos).padStart(3)} usos | ${String(p.precio.toFixed(2)).padStart(6)} EUR/kg | ${p.nombre} [${p.categoria}]`)
  }

  console.log(`\nInsertados/actualizados: ${insertados}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
