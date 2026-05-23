/**
 * DIAGNÓSTICO: Cobertura de precios en recetas
 *
 * Analiza:
 * 1. Recetas con ingredientes vinculados a alimentos (alimento_id NOT NULL)
 * 2. Alimentos con precios en productos_supermercado (por supermercado)
 * 3. Ingredientes de recetas SIN precio en ningún supermercado
 * 4. Alimentos que se usan en recetas pero no tienen precio asignado
 * 5. Score de cobertura por receta
 *
 * Uso:
 *   node scripts/diagnosticar-cobertura-precios.mjs
 *   node scripts/diagnosticar-cobertura-precios.mjs --full   # análisis más detallado
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
  console.error('Faltan credenciales en .env.local')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const SUPERMERCADO_REF_ID = '11111111-1111-4111-8111-111111111111'
const args = process.argv.slice(2)
const FULL = args.includes('--full')

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
  const n = norm(alimento.nombre || '')
  for (const [regex, precio] of EXACT) {
    if (regex.test(n)) return { precio: Math.round(precio * 100) / 100, metodo: `regla:${regex.source}` }
  }
  const def = CATEGORY_DEFAULT[alimento.categoria] || 5
  return { precio: Math.round(def * 100) / 100, metodo: `categoria:${alimento.categoria || 'sin_categoria'}` }
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

async function main() {
  console.log('═'.repeat(70))
  console.log('  DIAGNÓSTICO DE COBERTURA DE PRECIOS EN RECETAS')
  console.log('═'.repeat(70))

  // 1. Cargar supermercados y sus precios
  const supermercados = await selectAll('supermercados', 'id, nombre, slug')
  console.log(`\n📊 Supermercados registrados: ${supermercados.length}`)
  supermercados.forEach(s => console.log(`   - ${s.nombre} (${s.slug})`))

  // 2. Contar productos por supermercado
  const preciosPorSuper = {}
  for (const s of supermercados) {
    const { count } = await sb.from('productos_supermercado')
      .select('*', { count: 'exact', head: true })
      .eq('supermercado_id', s.id)
      .gt('precio_por_kg', 0)
    preciosPorSuper[s.nombre] = count || 0
  }
  console.log(`\n📦 Productos con precio por supermercado:`)
  Object.entries(preciosPorSuper)
    .sort((a, b) => b[1] - a[1])
    .forEach(([nombre, count]) => {
      const marca = nombre === 'Precio referencia coach' ? ' ⭐' : ''
      console.log(`   ${nombre.padEnd(25)} ${String(count).padStart(6)} productos${marca}`)
    })
  const totalProductos = Object.values(preciosPorSuper).reduce((a, b) => a + b, 0)
  console.log(`   ${''.padEnd(25)} ${'─'.repeat(6)}`)
  console.log(`   ${'TOTAL'.padEnd(25)} ${String(totalProductos).padStart(6)}`)

  // 3. Recetas con ingredientes
  const { count: totalRecetas } = await sb.from('recetas').select('*', { count: 'exact', head: true })
  const { data: recetasIng } = await sb.from('receta_ingredientes')
    .select('receta_id')
    .not('alimento_id', 'is', null)

  const recetasConIng = new Set(recetasIng?.map(i => i.receta_id) || [])
  console.log(`\n🍽️ Recetas: ${totalRecetas} totales, ${recetasConIng.size} con ingredientes vinculados a alimentos`)

  // 4. TODOS los alimentos que aparecen en ingredientes de recetas
  const ingredientes = await selectAll(
    'receta_ingredientes',
    'id, receta_id, alimento_id, cantidad_gramos, nombre_libre',
    q => q.not('alimento_id', 'is', null).gt('cantidad_gramos', 0)
  )
  console.log(`\n📝 Ingredientes totales en recetas: ${ingredientes.length}`)

  // 5. Obtener alimentos únicos usados en recetas
  const alimentoIds = [...new Set(ingredientes.map(i => i.alimento_id))]
  console.log(`   Alimentos únicos referenciados: ${alimentoIds.length}`)

  // Obtener nombres de esos alimentos (batch para evitar límite de .in())
  const alimentoMap = new Map()
  for (let i = 0; i < alimentoIds.length; i += 100) {
    const batch = alimentoIds.slice(i, i + 100)
    const { data } = await sb.from('alimentos')
      .select('id, nombre, categoria')
      .in('id', batch)
    if (data) for (const a of data) alimentoMap.set(a.id, a)
  }

  // 6. Precios existentes para esos alimentos (todos los supermercados, batch)
  const preciosExistentes = []
  for (let i = 0; i < alimentoIds.length; i += 100) {
    const batch = alimentoIds.slice(i, i + 100)
    const { data } = await sb.from('productos_supermercado')
      .select('alimento_id, supermercado_id, precio_por_kg')
      .in('alimento_id', batch)
      .gt('precio_por_kg', 0)
    if (data) preciosExistentes.push(...data)
  }

  // Construir mapa: alimento_id → set de supermercados que tienen precio
  const alimentoPrecios = new Map()
  for (const p of preciosExistentes || []) {
    if (!alimentoPrecios.has(p.alimento_id)) {
      alimentoPrecios.set(p.alimento_id, new Map())
    }
    const actual = alimentoPrecios.get(p.alimento_id)
    // Guardar el mejor precio de cada supermercado
    if (!actual.has(p.supermercado_id) || p.precio_por_kg < actual.get(p.supermercado_id)) {
      actual.set(p.supermercado_id, p.precio_por_kg)
    }
  }

  // 7. Alimentos SIN PRECIO (huérfanos de precio)
  const sinPrecio = alimentoIds.filter(id => {
    const precios = alimentoPrecios.get(id)
    return !precios || precios.size === 0
  })

  console.log(`\n🔴 Alimentos usados en recetas SIN precio en ningún supermercado:`)
  console.log(`   Total: ${sinPrecio.length} de ${alimentoIds.length} (${Math.round((1 - sinPrecio.length / alimentoIds.length) * 100)}% cobertura)`)

  if (sinPrecio.length > 0 && FULL) {
    console.log(`\n   Lista (${Math.min(sinPrecio.length, 30)} mostrados):`)
    const detalle = sinPrecio.slice(0, 30).map(id => {
      const a = alimentoMap.get(id)
      return { id, nombre: a?.nombre || '?', categoria: a?.categoria || '?' }
    })
    // Calcular usos en recetas
    for (const d of detalle) {
      d.usos = ingredientes.filter(i => i.alimento_id === d.id).length
      d.gramos = ingredientes.filter(i => i.alimento_id === d.id).reduce((s, i) => s + Number(i.cantidad_gramos || 0), 0)
    }
    detalle.sort((a, b) => b.usos - a.usos)
    for (const d of detalle) {
      const est = estimarPrecioKg({ nombre: d.nombre, categoria: d.categoria })
      console.log(`   ${String(d.usos).padStart(3)} usos | ${d.nombre.padEnd(35)} [${d.categoria.padEnd(15)}] → estimado ${est.precio}€/kg (${est.metodo})`)
    }
  }

  // 8. SCORE de cobertura por receta
  console.log(`\n═'.repeat(70)`)
  console.log('  SCORE DE COBERTURA POR RECETA')
  console.log('═'.repeat(70))

  // Agrupar ingredientes por receta
  const ingsPorReceta = new Map()
  for (const ing of ingredientes) {
    if (!ingsPorReceta.has(ing.receta_id)) ingsPorReceta.set(ing.receta_id, [])
    ingsPorReceta.get(ing.receta_id).push(ing)
  }

  // Obtener nombres de recetas
  const { data: recetasNombres } = await sb.from('recetas')
    .select('id, nombre')
    .in('id', [...ingsPorReceta.keys()])
  const nombreReceta = new Map((recetasNombres || []).map(r => [r.id, r.nombre]))

  // IDs de supermercados reales (excluyendo referencia)
  const superRealIds = supermercados
    .filter(s => s.id !== SUPERMERCADO_REF_ID)
    .map(s => s.id)

  let recetas100 = 0
  let recetas90 = 0
  let recetas80 = 0
  let recetas50 = 0
  let recetasBajo = 0
  const bajas = []

  for (const [recetaId, ings] of ingsPorReceta) {
    let conPrecioReal = 0
    let conPrecioRef = 0
    let sinPrecioTotal = 0
    const ingredientesDetalle = ings.map(ing => {
      const precios = alimentoPrecios.get(ing.alimento_id)
      const a = alimentoMap.get(ing.alimento_id)
      if (!precios || precios.size === 0) {
        sinPrecioTotal++
        return { ...ing, nombre: a?.nombre || '?', tienePrecio: false, esReferencia: false }
      }
      const tieneReal = [...precios.keys()].some(sid => superRealIds.includes(sid))
      const tieneRef = precios.has(SUPERMERCADO_REF_ID)
      if (tieneReal) conPrecioReal++
      else if (tieneRef) conPrecioRef++
      return { ...ing, nombre: a?.nombre || '?', tienePrecio: true, esReferencia: !tieneReal && tieneRef }
    })

    const total = ings.length
    const scoreReal = Math.round((conPrecioReal / total) * 100)
    const scoreTotal = Math.round(((conPrecioReal + conPrecioRef) / total) * 100)

    if (scoreTotal === 100) recetas100++
    else if (scoreTotal >= 90) recetas90++
    else if (scoreTotal >= 80) recetas80++
    else if (scoreTotal >= 50) recetas50++
    else recetasBajo++

    if (scoreTotal < 100) {
      bajas.push({
        recetaId,
        nombre: nombreReceta.get(recetaId) || '?',
        scoreReal,
        scoreTotal,
        total,
        conPrecioReal,
        conPrecioRef,
        sinPrecio: sinPrecioTotal,
        ingredientes: ingredientesDetalle.filter(i => !i.tienePrecio).map(i => i.nombre),
      })
    }
  }

  console.log(`\n📊 Distribución de cobertura (incluyendo precios de referencia):`)
  console.log(`   100%  (completas):           ${recetas100} recetas`)
  console.log(`   90-99% (casi completas):     ${recetas90} recetas`)
  console.log(`   80-89% (buena):              ${recetas80} recetas`)
  console.log(`   50-79% (regular):            ${recetas50} recetas`)
  console.log(`   <50%  (baja):                ${recetasBajo} recetas`)
  const totalAnalizadas = recetas100 + recetas90 + recetas80 + recetas50 + recetasBajo
  console.log(`   TOTAL analizadas:            ${totalAnalizadas} recetas`)

  // 9. Detalle de recetas con score < 100
  if (bajas.length > 0) {
    console.log(`\n📋 Recetas con score < 100% (${bajas.length} total):`)
    bajas.sort((a, b) => a.scoreTotal - b.scoreTotal).slice(0, 40).forEach(r => {
      const faltan = r.ingredientes.slice(0, 5).join(', ') + (r.ingredientes.length > 5 ? `...(+${r.ingredientes.length - 5})` : '')
      console.log(`   ${String(r.scoreTotal).padStart(3)}% (real:${r.scoreReal}%) | ${r.nombre.substring(0, 40).padEnd(42)} | Faltan: ${r.sinPrecio} ing → ${faltan}`)
    })
    if (bajas.length > 40) {
      console.log(`   ... y ${bajas.length - 40} más`)
    }
  }

  // 10. TOP alimentos sin precio por uso en recetas
  if (sinPrecio.length > 0) {
    const sinPrecioDetalle = sinPrecio.map(id => {
      const a = alimentoMap.get(id)
      const usos = ingredientes.filter(i => i.alimento_id === id).length
      const gramos = ingredientes.filter(i => i.alimento_id === id).reduce((s, i) => s + Number(i.cantidad_gramos || 0), 0)
      const est = estimarPrecioKg({ nombre: a?.nombre, categoria: a?.categoria })
      return { id, nombre: a?.nombre || '?', categoria: a?.categoria || '?', usos, gramos, ...est }
    })
    sinPrecioDetalle.sort((a, b) => b.usos - a.usos)

    console.log(`\n🏆 Top 20 alimentos sin precio (más usados en recetas):`)
    sinPrecioDetalle.slice(0, 20).forEach(a => {
      console.log(`   ${String(a.usos).padStart(4)} usos | ${String(Math.round(a.gramos)).padStart(6)}g | ${a.nombre.padEnd(35)} [${(a.categoria || '').padEnd(15)}] → estimado ${a.precio}€/kg (${a.metodo})`)
    })

    // Mostrar también alimentos que SÓLO tienen precio de referencia (no real)
    const soloRef = alimentoIds.filter(id => {
      const precios = alimentoPrecios.get(id)
      if (!precios) return false
      const tieneReal = [...precios.keys()].some(sid => superRealIds.includes(sid))
      return !tieneReal && precios.has(SUPERMERCADO_REF_ID)
    })
    if (soloRef.length > 0) {
      const soloRefDetalle = soloRef.map(id => {
        const a = alimentoMap.get(id)
        const usos = ingredientes.filter(i => i.alimento_id === id).length
        return { id, nombre: a?.nombre || '?', categoria: a?.categoria || '?', usos }
      })
      soloRefDetalle.sort((a, b) => b.usos - a.usos)
      console.log(`\n🟡 Alimentos con SÓLO precio de referencia (${soloRef.length}):`)
      soloRefDetalle.slice(0, 15).forEach(a => {
        console.log(`   ${String(a.usos).padStart(4)} usos | ${a.nombre.padEnd(35)} [${(a.categoria || '').padEnd(15)}]`)
      })
    }

    // Resumen final
    console.log(`\n${'═'.repeat(70)}`)
    console.log('  RESUMEN Y ACCIONES RECOMENDADAS')
    console.log('═'.repeat(70))
    console.log(`
  🎯 Para lograr 100% de cobertura en todas las recetas:

  1. POBLAR PRECIOS REFERENCIA (${sinPrecio.length} alimentos sin precio):
     node scripts/poblar-precios-referencia.mjs --limite=${Math.max(sinPrecio.length, 500)}
     Esto creará precios estimados para todos los alimentos huérfanos.

  2. MEJORAR FALLBACK en API escandallo:
     El API actual (app/api/precios/escandallo/receta/route.ts:68-72)
     SOLO busca en la vista 'precios_actuales'. Habría que añadir fallback
     a 'productos_supermercado' filtrando por el supermercado referencia.

  3. Verificar alimentos con ${soloRef.length} que solo tienen precio referencia:
     Si hay datos de Mercadona/Consum disponibles, se pueden poblar también.

  4. Score real (solo supermercados reales) vs score total (con referencia):
     ${recetas100} recetas al 100% real
     Muchas más al 100% si incluimos referencia coach
  `)
  }

  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
