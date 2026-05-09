/**
 * fotos-fallback-curadas.mjs
 *
 * Asigna fotos curadas de Unsplash (sin API, URLs directas) a las recetas
 * que siguen sin imagen. Cada receta recibe una foto distinta de su categoría.
 * No consume cuota de API.
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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Pool de fotos curadas por categoría — todas verificadas, calidad editorial
// Format: photo ID de Unsplash (URL base: https://images.unsplash.com/photo-{id})
const FOTOS_POR_CATEGORIA = {
  Desayuno: [
    'photo-1525351484163-7529414344d8', // pancakes stack
    'photo-1504754524776-8f4f37790ca0', // acai bowl
    'photo-1493770348161-369560ae357d', // breakfast bowl colorido
    'photo-1484723091739-30a097e8f929', // tostadas aguacate
    'photo-1598300042247-d088f8ab3a91', // oat bowl
  ],
  Comida: [
    'photo-1546069901-ba9599a7e63c', // bowl saludable
    'photo-1512621776951-a57141f2eefd', // ensalada colorida
    'photo-1490645935967-10de6ba17061', // plato saludable
    'photo-1547592180-85f173990554', // wrap/burrito
    'photo-1565557623262-b51c2513a641', // pollo con verduras
  ],
  Cena: [
    'photo-1467003909585-2f8a72700288', // salmón plato
    'photo-1432139509613-5c4255815697', // pollo plancha
    'photo-1476224203421-9ac39bcb3327', // plato cena
    'photo-1414235077428-338989a2e8c0', // plato elegante
    'photo-1482049016688-2d3e1b311543', // huevos
  ],
  Merienda: [
    'photo-1488477181946-6428a0291777', // smoothie bowl
    'photo-1570197788417-0e82375c9371', // frutas
    'photo-1509440159596-0249088772ff', // pan casero
    'photo-1558961363-fa8fdf82db35', // chocolate snack
    'photo-1556040220-4096d522378d', // manzana
  ],
  Snack: [
    'photo-1623227314822-6ab8109b9990', // energy balls
    'photo-1549007994-cb92caebd54b', // frutos secos mix
    'photo-1615485290382-441e4d049cb5', // barritas
    'photo-1571091718767-18b5b1457add', // burger bite
    'photo-1491553895911-0055eca6402d', // zanahoria hummus
  ],
  Postre: [
    'photo-1563805042-7684c019e1cb', // brownie chocolate
    'photo-1551024506-0bccd828d307', // cake slice
    'photo-1565958011703-44f9829ba187', // tarta
    'photo-1519915028121-7d3463d20b13', // cookies
    'photo-1488477304112-4944851de03d', // helado
  ],
  default: [
    'photo-1512621776951-a57141f2eefd', // ensalada colorida
    'photo-1546069901-ba9599a7e63c', // bowl saludable
    'photo-1490645935967-10de6ba17061', // plato saludable
    'photo-1484723091739-30a097e8f929', // tostadas
    'photo-1565557623262-b51c2513a641', // pollo verduras
  ],
}

function fotoParaReceta(nombre, categoria, indice) {
  const pool = FOTOS_POR_CATEGORIA[categoria] ?? FOTOS_POR_CATEGORIA.default
  const foto = pool[indice % pool.length]
  return `https://images.unsplash.com/${foto}?w=800&q=80&fit=crop`
}

async function main() {
  const { data: recetas, error } = await sb
    .from('recetas')
    .select('id, nombre, categoria')
    .is('imagen_url', null)
    .eq('estado', 'aprobada')
    .order('created_at', { ascending: false })

  if (error) { console.error(error.message); process.exit(1) }

  console.log(`📦 ${recetas.length} recetas sin foto — asignando fotos curadas\n`)

  // Contador por categoría para rotar fotos
  const contadores = {}

  for (const r of recetas) {
    const cat = r.categoria ?? 'default'
    contadores[cat] = (contadores[cat] ?? 0)
    const url = fotoParaReceta(r.nombre, cat, contadores[cat])
    contadores[cat]++

    const { error: upErr } = await sb.from('recetas').update({ imagen_url: url }).eq('id', r.id)
    if (upErr) {
      console.log(`❌ ${r.nombre}: ${upErr.message}`)
    } else {
      console.log(`✅ ${r.nombre} [${cat}] → ${foto}`)
    }
  }

  console.log('\n✅ Hecho')
}

main()
