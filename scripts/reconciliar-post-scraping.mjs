/**
 * reconciliar-post-scraping.mjs
 *
 * Busca productos cuyo alimento_id apunta a un alimento con macros=0
 * y re-ejecuta el matching para encontrar un mejor alimento con macros reales.
 *
 * USO:
 *   node scripts/reconciliar-post-scraping.mjs
 *
 * OPCIONES:
 *   --dry-run   Solo mostrar lo que se haría, sin modificar BD
 *   --limit=N   Máximo de productos a procesar (default: 100)
 *   --supermercado=slug  Filtrar por supermercado
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan variables: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Parsear args ──────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '100', 10)
const SUPERMERCADO_SLUG = args.find(a => a.startsWith('--supermercado='))?.split('=')[1] || null

// ─── Normalización básica (sin imports, es script independiente) ──
function quitarAcentos(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizar(s) {
  return quitarAcentos(s.toLowerCase().trim())
    .replace(/[·\(\)\[\]{}¿?!¡,;:"'«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Categorías de alimentos conocidos para match ──────────────
// Palabras clave que ayudan a identificar alimentos con macros reales
const ALIMENTOS_COMUNES = [
  'pollo', 'ternera', 'cerdo', 'cordero', 'pavo', 'conejo',
  'merluza', 'bacalao', 'salmón', 'atún', 'dorada', 'lubina',
  'leche', 'yogur', 'queso', 'huevo',
  'arroz', 'pasta', 'pan', 'lenteja', 'garbanzo', 'alubia',
  'manzana', 'plátano', 'naranja', 'pera', 'uva', 'fresa',
  'lechuga', 'tomate', 'cebolla', 'pimiento', 'zanahoria',
  'patata', 'aceite', 'mantequilla',
]

// ─── Match simple de palabras clave ────────────────────────────
function matchPalabras(nombreProducto, nombreAlimento) {
  const prodWords = normalizar(nombreProducto).split(/\s+/).filter(w => w.length >= 3)
  const aliWords = normalizar(nombreAlimento).split(/\s+/).filter(w => w.length >= 3)

  // Coincidencia exacta
  if (prodWords.join(' ') === aliWords.join(' ')) return 1.0

  // Una cadena contiene a la otra
  const prodStr = prodWords.join(' ')
  const aliStr = aliWords.join(' ')
  if (prodStr.includes(aliStr) || aliStr.includes(prodStr)) return 0.9

  // Coincidencia de palabras
  const coincidencias = prodWords.filter(pw =>
    aliWords.some(aw => aw.includes(pw) || pw.includes(aw))
  ).length

  if (coincidencias === 0) return 0

  // Score: ratio de coincidencia
  const ratio = coincidencias / Math.max(prodWords.length, aliWords.length)
  return ratio
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Reconciliación post-scraping')
  console.log(`   Dry run: ${DRY_RUN ? '✅ SÍ (solo lectura)' : '❌ NO (modificará BD)'}`)
  console.log(`   Límite: ${LIMIT} productos`)
  if (SUPERMERCADO_SLUG) console.log(`   Supermercado: ${SUPERMERCADO_SLUG}`)
  console.log('')

  // 1. Obtener supermercado si se filtró
  let supermercadoId = null
  if (SUPERMERCADO_SLUG) {
    const { data: sm } = await supabase
      .from('supermercados')
      .select('id, nombre')
      .eq('slug', SUPERMERCADO_SLUG)
      .maybeSingle()
    if (!sm) {
      console.error(`❌ Supermercado "${SUPERMERCADO_SLUG}" no encontrado`)
      process.exit(1)
    }
    supermercadoId = sm.id
    console.log(`📍 Supermercado: ${sm.nombre} (${sm.id})`)
  }

  // 2. Obtener productos con alimentos que tienen macros=0
  let query = supabase
    .from('productos_supermercado')
    .select(`
            id,
            nombre_original,
            alimento_id,
            supermercado_id,
            precio_unidad,
            precio_por_kg,
            supermercados!inner(nombre, slug)
        `)
    .not('alimento_id', 'is', null)

  if (supermercadoId) {
    query = query.eq('supermercado_id', supermercadoId)
  }

  const { data: productos, error: errProd } = await query.limit(LIMIT)

  if (errProd) {
    console.error(`❌ Error al obtener productos: ${errProd.message}`)
    process.exit(1)
  }

  if (!productos || productos.length === 0) {
    console.log('ℹ️ No hay productos para reconciliar')
    return
  }

  console.log(`📦 ${productos.length} productos cargados`)
  console.log('')

  // 3. Obtener los alimentos asociados
  const alimentoIds = [...new Set(productos.map(p => p.alimento_id))]

  const { data: alimentosActuales, error: errAli } = await supabase
    .from('alimentos')
    .select('id, nombre, calorias, proteinas, carbohidratos, grasas')
    .in('id', alimentoIds)

  if (errAli) {
    console.error(`❌ Error al obtener alimentos: ${errAli.message}`)
    process.exit(1)
  }

  const alimentosMap = new Map(alimentosActuales?.map(a => [a.id, a]) || [])

  // 4. Cargar todos los alimentos con macros reales para re-matching
  console.log('📚 Cargando alimentos con macros reales para re-matching...')
  const { data: alimentosReales, error: errReales } = await supabase
    .from('alimentos')
    .select('id, nombre, calorias, proteinas, carbohidratos, grasas')
    .gt('calorias', 0)
    .eq('es_comestible', true)
    .order('calorias', { ascending: false })

  if (errReales) {
    console.error(`❌ Error al cargar alimentos reales: ${errReales.message}`)
    process.exit(1)
  }

  console.log(`📚 ${alimentosReales?.length || 0} alimentos con macros reales cargados`)
  console.log('')

  // 5. Para cada producto, verificar si el alimento actual tiene macros=0
  //    y si hay un mejor match disponible
  let reconciliados = 0
  let sinMejorMatch = 0
  let errores = 0

  for (const prod of productos) {
    const alimento = alimentosMap.get(prod.alimento_id)
    const nombreSuper = prod.supermercados?.nombre || '?'

    if (!alimento) {
      console.warn(`⚠️ Producto "${prod.nombre_original}" → alimento_id ${prod.alimento_id} no encontrado en BD`)
      continue
    }

    // Si el alimento YA tiene macros reales, no tocar
    if (alimento.calorias > 0) {
      continue
    }

    // Este producto está vinculado a un alimento SIN macros
    console.log(`🔍 "${prod.nombre_original}" → "${alimento.nombre}" (${alimento.calorias} kcal) [${nombreSuper}]`)

    // Buscar mejor match entre alimentos con macros reales
    let mejorMatch = null
    let mejorScore = 0.5  // umbral mínimo

    for (const real of alimentosReales) {
      // No sugerir el mismo alimento
      if (real.id === prod.alimento_id) continue

      const score = matchPalabras(prod.nombre_original, real.nombre)
      if (score > mejorScore) {
        mejorScore = score
        mejorMatch = real
      }
    }

    if (mejorMatch) {
      console.log(`   → MEJOR MATCH: "${mejorMatch.nombre}" (${mejorMatch.calorias} kcal) score=${mejorScore.toFixed(2)}`)

      if (!DRY_RUN) {
        const { error: updateErr } = await supabase
          .from('productos_supermercado')
          .update({
            alimento_id: mejorMatch.id,
            // También actualizar el nombre para que el matcher futuro lo encuentre
          })
          .eq('id', prod.id)

        if (updateErr) {
          console.error(`   ❌ Error al actualizar: ${updateErr.message}`)
          errores++
        } else {
          reconciliados++
          console.log(`   ✅ Reconciliado`)
        }
      } else {
        reconciliados++
        console.log(`   🔄 [DRY RUN] Se actualizaría`)
      }
    } else {
      sinMejorMatch++
      console.log(`   → Sin mejor match (umbral: 0.5, mejor score: ${mejorScore.toFixed(2)})`)
    }
  }

  // 6. Resumen
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('📊 RESUMEN')
  console.log('═══════════════════════════════════════════')
  console.log(`   Total productos revisados: ${productos.length}`)
  console.log(`   Productos sin macros (evaluados): ${productos.length - productos.filter(p => {
    const a = alimentosMap.get(p.alimento_id)
    return a && a.calorias > 0
  }).length}`)
  console.log(`   Reconciliados: ${reconciliados}`)
  console.log(`   Sin mejor match: ${sinMejorMatch}`)
  console.log(`   Errores: ${errores}`)
  console.log(`   Modo: ${DRY_RUN ? '🔍 SÓLO LECTURA' : '✏️ ESCRITURA'}`)
  console.log('')
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
