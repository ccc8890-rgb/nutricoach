/**
 * Auditoría E2E read-only para alimentos -> precios -> recetas -> escandallo.
 *
 * Uso:
 *   node scripts/auditar-escandallo-e2e.mjs
 *
 * Comprueba:
 * - Cobertura de precios de ingredientes usados en recetas.
 * - Productos no alimentarios colados en vistas de precio.
 * - Recetas cuyo ranking de supermercados puede subestimar coste por falta de cobertura.
 * - Una receta real con coste calculado ingrediente a ingrediente.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const envPath = resolve(ROOT, '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
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
const PAGE_SIZE = 1000

const NON_FOOD_TERMS = [
  'champu', 'champú', 'gel ducha', 'desodorante', 'detergente', 'suavizante',
  'lejia', 'lejía', 'ambientador', 'maquillaje', 'pañal', 'compresa',
  'colonia', 'perfume', 'cepillo dental', 'pasta dentifrica', 'crema facial',
]

function money(n) {
  return `${Number(n || 0).toFixed(2)} EUR`
}

function pct(n) {
  return `${Math.round(Number(n || 0))}%`
}

async function count(table, filters = (q) => q) {
  const { count: total, error } = await filters(sb.from(table).select('*', { count: 'exact', head: true }))
  if (error) throw error
  return total ?? 0
}

async function selectAll(table, columns, filters = (q) => q) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await filters(sb.from(table).select(columns)).range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function main() {
  console.log('='.repeat(70))
  console.log('AUDITORÍA E2E ESCANDALLO')
  console.log('='.repeat(70))

  const totalAlimentos = await count('alimentos')
  const totalRecetas = await count('recetas')
  const totalIngredientes = await count('receta_ingredientes')
  const ingredientesSinAlimento = await count('receta_ingredientes', q => q.is('alimento_id', null))
  const ingredientesSinCantidad = await count('receta_ingredientes', q => q.or('cantidad_gramos.is.null,cantidad_gramos.lte.0'))
  const productos = await count('productos_supermercado')

  console.log('\n1. Base de datos')
  console.log(`   Alimentos: ${totalAlimentos}`)
  console.log(`   Recetas: ${totalRecetas}`)
  console.log(`   Ingredientes receta: ${totalIngredientes}`)
  console.log(`   Ingredientes sin alimento_id: ${ingredientesSinAlimento}`)
  console.log(`   Ingredientes sin cantidad válida: ${ingredientesSinCantidad}`)
  console.log(`   Productos supermercado: ${productos}`)

  const preciosVista = await selectAll(
    'mejores_precios_por_alimento',
    'alimento_id, alimento_nombre, supermercado_id, supermercado_nombre, nombre_original, precio_por_kg',
  )

  const sospechosos = (preciosVista || []).filter(p => {
    const text = `${p.alimento_nombre || ''} ${p.nombre_original || ''}`.toLowerCase()
    return NON_FOOD_TERMS.some(t => text.includes(t))
  })

  console.log('\n2. Limpieza de vistas de precios')
  console.log(`   Filas en mejores_precios_por_alimento: ${(preciosVista || []).length}`)
  console.log(`   Posibles no-alimentos en vista: ${sospechosos.length}`)
  for (const p of sospechosos.slice(0, 10)) {
    console.log(`   - ${p.alimento_nombre} -> ${p.nombre_original} (${p.supermercado_nombre})`)
  }

  const preciosValidos = (preciosVista || []).filter(p => Number(p.precio_por_kg) > 0)
  const preciosInvalidos = (preciosVista || []).filter(p => !(Number(p.precio_por_kg) > 0))
  const precioPorAlimento = new Set(preciosValidos.map(p => p.alimento_id))
  console.log(`   Precios inválidos en vista: ${preciosInvalidos.length}`)

  const ingredientes = await selectAll(
    'receta_ingredientes',
    'id, receta_id, alimento_id, nombre_libre, cantidad_gramos, recetas(id,nombre,estado)',
    q => q.not('alimento_id', 'is', null).gt('cantidad_gramos', 0),
  )

  const ingredientesConPrecio = ingredientes.filter(i => precioPorAlimento.has(i.alimento_id))
  const sinPrecio = ingredientes.filter(i => !precioPorAlimento.has(i.alimento_id))
  const coberturaGlobal = ingredientes.length
    ? (ingredientesConPrecio.length / ingredientes.length) * 100
    : 0

  console.log('\n3. Cobertura recetas -> precios')
  console.log(`   Ingredientes con alimento y gramos: ${ingredientes.length}`)
  console.log(`   Con al menos un precio: ${ingredientesConPrecio.length}`)
  console.log(`   Sin precio: ${sinPrecio.length}`)
  console.log(`   Cobertura global: ${pct(coberturaGlobal)}`)
  for (const i of sinPrecio.slice(0, 12)) {
    console.log(`   - ${i.recetas?.nombre || i.receta_id}: ${i.nombre_libre}`)
  }

  const porReceta = new Map()
  for (const ing of ingredientes) {
    const r = ing.recetas || { id: ing.receta_id, nombre: ing.receta_id }
    const item = porReceta.get(r.id) || { id: r.id, nombre: r.nombre, total: 0, conPrecio: 0 }
    item.total += 1
    if (precioPorAlimento.has(ing.alimento_id)) item.conPrecio += 1
    porReceta.set(r.id, item)
  }

  const recetasBajaCobertura = Array.from(porReceta.values())
    .map(r => ({ ...r, cobertura: r.total ? (r.conPrecio / r.total) * 100 : 0 }))
    .filter(r => r.cobertura < 80)
    .sort((a, b) => a.cobertura - b.cobertura)

  console.log('\n4. Recetas con cobertura de precio <80%')
  console.log(`   Total: ${recetasBajaCobertura.length}`)
  for (const r of recetasBajaCobertura.slice(0, 12)) {
    console.log(`   - ${r.nombre}: ${r.conPrecio}/${r.total} (${pct(r.cobertura)})`)
  }

  const recetaE2E = Array.from(porReceta.values())
    .filter(r => r.total >= 3 && r.conPrecio === r.total)
    .sort((a, b) => b.total - a.total)[0]

  console.log('\n5. Cálculo E2E de receta real con 100% cobertura')
  if (!recetaE2E) {
    console.log('   No hay receta con 100% cobertura en la muestra.')
  } else {
    const recetaIngredientes = ingredientes.filter(i => i.receta_id === recetaE2E.id)
    let total = 0
    for (const ing of recetaIngredientes) {
      const opciones = preciosValidos.filter(p => p.alimento_id === ing.alimento_id)
      const mejor = opciones.sort((a, b) => Number(a.precio_por_kg) - Number(b.precio_por_kg))[0]
      const coste = (Number(ing.cantidad_gramos) / 1000) * Number(mejor.precio_por_kg)
      total += coste
      console.log(`   - ${ing.nombre_libre}: ${ing.cantidad_gramos}g x ${money(mejor.precio_por_kg)}/kg = ${money(coste)} (${mejor.supermercado_nombre})`)
    }
    console.log(`   Receta: ${recetaE2E.nombre}`)
    console.log(`   Coste total mínimo multi-super: ${money(total)}`)
  }

  console.log('\n6. Resultado')
  const fail = ingredientesSinAlimento > 0 || ingredientesSinCantidad > 0 || sospechosos.length > 0
  if (fail) {
    console.log('   Estado: REVISAR. Hay problemas de integridad o limpieza.')
    process.exitCode = 1
  } else {
    console.log('   Estado: OK técnico. Revisar recetas sin precio para mejorar cobertura comercial.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
