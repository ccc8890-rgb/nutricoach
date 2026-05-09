/**
 * rellenar-fotos-unsplash.mjs
 *
 * Busca fotos en Unsplash para las recetas sin imagen_url.
 * Usa el nombre de la receta como query, coge la primera foto landscape.
 * Actualiza imagen_url en Supabase con la URL de Unsplash (full size).
 *
 * Uso: node scripts/rellenar-fotos-unsplash.mjs [--dry-run] [--limit 20]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!UNSPLASH_KEY || !SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error('❌ Faltan variables de entorno')
  process.exit(1)
}

const isDryRun = process.argv.includes('--dry-run')
const limitArg = process.argv.indexOf('--limit')
const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1]) : 999

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE)

// Términos de búsqueda en inglés para categorías comunes
// Unsplash funciona mejor en inglés
const TRADUCCION = {
  'tortitas': 'pancakes healthy',
  'gofres': 'waffles homemade',
  'overnight oats': 'overnight oats',
  'bowl': 'healthy food bowl',
  'tostadas': 'toast avocado healthy',
  'smoothie': 'smoothie bowl',
  'brownie': 'healthy brownie chocolate',
  'bizcocho': 'healthy cake homemade',
  'muffins': 'healthy muffins',
  'galletas': 'healthy cookies oats',
  'barritas': 'protein bars homemade',
  'yogur': 'greek yogurt berries',
  'ensalada': 'healthy salad',
  'pollo': 'grilled chicken healthy',
  'arroz': 'rice bowl healthy',
  'pasta': 'healthy pasta',
  'wrap': 'healthy wrap',
  'burger': 'healthy burger',
  'tacos': 'healthy tacos',
  'kebab': 'healthy kebab',
  'cheesecake': 'healthy cheesecake',
  'tarta': 'healthy cake slice',
  'mousse': 'chocolate mousse healthy',
  'pudding': 'chia pudding',
  'crepes': 'healthy crepes',
  'donuts': 'baked donuts healthy',
  'energy balls': 'energy balls oats',
  'bolas': 'energy balls protein',
  'porridge': 'oatmeal bowl',
  'avena': 'oatmeal healthy',
  'salmón': 'salmon healthy plate',
  'aguacate': 'avocado toast',
  'huevo': 'eggs healthy breakfast',
  'boniato': 'sweet potato healthy',
  'waffle': 'waffle healthy homemade',
  'helado': 'nice cream banana',
  'tiramisu': 'healthy tiramisu',
  'trufas': 'chocolate truffles healthy',
  'mug cake': 'mug cake chocolate',
}

const FALLBACK_POR_CATEGORIA = {
  Desayuno: 'healthy breakfast bowl homemade',
  Comida: 'healthy lunch plate homemade',
  Cena: 'healthy dinner plate',
  Merienda: 'healthy snack fruit',
  Snack: 'healthy snack energy balls',
  Postre: 'healthy dessert homemade',
}

function buildQueries(nombre, categoria) {
  const lower = nombre.toLowerCase()
  const queries = []

  // 1. Traducción específica por palabra clave
  for (const [es, en] of Object.entries(TRADUCCION)) {
    if (lower.includes(es)) { queries.push(en); break }
  }

  // 2. Primeras dos palabras en inglés (para nombres como "Pancake Tupper Mealprep")
  const palabras = nombre.split(' ').slice(0, 2).join(' ')
  if (palabras !== nombre) queries.push(`${palabras} healthy homemade`)

  // 3. Fallback por categoría
  if (categoria && FALLBACK_POR_CATEGORIA[categoria]) {
    queries.push(FALLBACK_POR_CATEGORIA[categoria])
  }

  // 4. Último recurso
  queries.push('healthy food homemade plate')

  return [...new Set(queries)]
}

async function buscarFotoUnsplash(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high&per_page=3&client_id=${UNSPLASH_KEY}`
  const res = await fetch(url)

  if (res.status === 429) {
    console.log('  ⏳ Rate limit Unsplash — esperando 65s...')
    await new Promise(r => setTimeout(r, 65000))
    return buscarFotoUnsplash(query)
  }

  if (!res.ok) {
    console.log(`  ⚠️  Unsplash error ${res.status}`)
    return null
  }

  const data = await res.json()
  if (!data.results?.length) return null

  // Preferir fotos con más likes (tienden a ser mejores)
  const sorted = data.results.sort((a, b) => b.likes - a.likes)
  const foto = sorted[0]

  return {
    url: foto.urls.regular, // 1080px ancho, buena calidad sin ser enorme
    autor: foto.user.name,
    unsplash_id: foto.id,
  }
}

async function main() {
  console.log('🖼️  Rellenar fotos Unsplash para recetas sin imagen')
  console.log(`   Modo: ${isDryRun ? 'DRY RUN (sin guardar)' : 'REAL'}`)
  console.log(`   Límite: ${limit} recetas\n`)

  // Cargar recetas sin imagen
  const { data: recetas, error } = await sb
    .from('recetas')
    .select('id, nombre, categoria, coach_id')
    .is('imagen_url', null)
    .eq('estado', 'aprobada')
    .limit(limit)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error cargando recetas:', error.message)
    process.exit(1)
  }

  console.log(`📦 ${recetas.length} recetas sin foto\n`)

  let ok = 0
  let skip = 0
  let fail = 0

  for (let i = 0; i < recetas.length; i++) {
    const r = recetas[i]
    const queries = buildQueries(r.nombre, r.categoria)
    const prefix = `[${i + 1}/${recetas.length}]`

    process.stdout.write(`${prefix} "${r.nombre}" ... `)

    try {
      let foto = null
      for (const q of queries) {
        foto = await buscarFotoUnsplash(q)
        if (foto) { process.stdout.write(`[${q}] `); break }
        await new Promise(r => setTimeout(r, 1500))
      }

      if (!foto) {
        console.log('sin resultado')
        skip++
      } else {
        console.log(`✅ ${foto.url.substring(0, 60)}...`)

        if (!isDryRun) {
          const { error: upErr } = await sb
            .from('recetas')
            .update({ imagen_url: foto.url })
            .eq('id', r.id)

          if (upErr) {
            console.log(`   ❌ Error guardando: ${upErr.message}`)
            fail++
          } else {
            ok++
          }
        } else {
          ok++
        }
      }
    } catch (err) {
      console.log(`❌ ${err.message}`)
      fail++
    }

    // Respetar rate limit: 50 req/hora en demo = 1 req cada ~72s
    // Usamos 2s entre requests — suficiente para demo tier
    if (i < recetas.length - 1) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  console.log('\n─────────────────────────────────')
  console.log(`✅ Completadas: ${ok}`)
  console.log(`⏭️  Sin resultado: ${skip}`)
  console.log(`❌ Errores: ${fail}`)
  if (isDryRun) console.log('\n⚠️  DRY RUN — ningún cambio guardado en BD')
}

main()
