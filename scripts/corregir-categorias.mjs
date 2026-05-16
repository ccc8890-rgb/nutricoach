/**
 * Script que normaliza la columna `categoria` de alimentos.
 * Problema: la función actualizar_alimento_con_ia guarda valores como
 * "Carnes blancas", "Verduras y hortalizas", etc., pero la UI solo
 * reconoce 17 categorías amplias: Carnes, Verduras, etc.
 *
 * USO:
 *   node scripts/corregir-categorias.mjs             → dry run
 *   node scripts/corregir-categorias.mjs --aplicar   → actualiza BD
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const APLICAR = process.argv.includes('--aplicar')

// ── Mapa de categorías IA → categorías UI ────────────────────────────────────

const MAPA_CATEGORIA_IA = {
  // Carnes
  'Carnes rojas': 'Carnes',
  'Carnes blancas': 'Carnes',
  'Carne roja': 'Carnes',
  'Carne blanca': 'Carnes',
  // Pescados y mariscos
  'Pescado azul': 'Pescados',
  'Pescado blanco': 'Pescados',
  'Mariscos': 'Pescados',
  'Marisco': 'Pescados',
  // Huevos
  'Huevos': 'Huevos',
  'Huevo': 'Huevos',
  // Legumbres
  'Legumbres': 'Legumbres',
  'Legumbre': 'Legumbres',
  // Frutos secos y semillas
  'Frutos secos y semillas': 'Frutos secos',
  'Frutos secos': 'Frutos secos',
  'Semillas': 'Semillas',
  // Lácteos
  'Lácteos enteros': 'Lácteos',
  'Lácteos semidesnatados': 'Lácteos',
  'Lácteos desnatados': 'Lácteos',
  'Lácteos': 'Lácteos',
  'Lácteo': 'Lácteos',
  // Cereales y derivados
  'Arroces y pastas': 'Cereales',
  'Pan y cereales': 'Cereales',
  'Cereales': 'Cereales',
  'Cereal': 'Cereales',
  'Arroz y pasta': 'Cereales',
  // Tubérculos
  'Patatas y tubérculos': 'Tubérculos',
  'Tubérculos': 'Tubérculos',
  'Tubérculo': 'Tubérculos',
  // Verduras
  'Verduras de hoja verde': 'Verduras',
  'Verduras y hortalizas': 'Verduras',
  'Verduras': 'Verduras',
  'Verdura': 'Verduras',
  'Hortalizas': 'Verduras',
  // Frutas
  'Frutas frescas': 'Frutas',
  'Frutas deshidratadas': 'Frutas',
  'Frutas': 'Frutas',
  'Fruta': 'Frutas',
  // Grasas y aceites
  'Aceites y grasas': 'Grasas',
  'Grasas': 'Grasas',
  'Aceites': 'Grasas',
  // Condimentos
  'Salsas y condimentos': 'Condimentos',
  'Condimentos': 'Condimentos',
  'Especias y condimentos': 'Condimentos',
  'Especias': 'Condimentos',
  'Salsas': 'Condimentos',
  // Bebidas
  'Bebidas': 'Bebidas',
  'Bebida': 'Bebidas',
  // Suplementos
  'Suplementos deportivos': 'Suplementos',
  'Suplementos': 'Suplementos',
  // Otros (dulces, preparados, etc.)
  'Dulces y bollería': 'Otros',
  'Platos preparados': 'Otros',
  'Otros': 'Otros',
  // Sin clasificar → Supermercado
  'Supermercado - Sin clasificar': 'Supermercado',
  'Sin clasificar': 'Supermercado',
}

// ── Inferencia por nombre (para items que siguen en 'Supermercado' sin categoria_ia) ──

const INFERENCIA_POR_NOMBRE = [
  { pattern: /\b(pollo|pavo|pechuga|muslo|contramuslo|ala de pollo|cerdo|ternera|cordero|conejo|carne|lomo|costilla|jamón|jamón serrano|jamón cocido|chorizo|salchichón|mortadela|lomo embuchado|fuet|butifarra|morcilla|lacón|cecina)\b/i, categoria: 'Carnes' },
  { pattern: /\b(merluza|salmón|atún|sardina|anchoa|bacalao|lubina|dorada|trucha|rape|rodaballo|boquerón|caballa|pez espada|lenguado|sepia|calamar|pulpo|gambas?|langostino|mejillones?|almejas?|berberecho|percebes?|nécora|cangrejo|langosta|bogavante|vieira|marisco|mariscos)\b/i, categoria: 'Pescados' },
  { pattern: /\b(huevo|huevos)\b/i, categoria: 'Huevos' },
  { pattern: /\b(leche|yogur|yogurt|queso|mantequilla|nata|kéfir|requesón|mascarpone|ricotta|mozzarella|burrata|lácteo|lacteo)\b/i, categoria: 'Lácteos' },
  { pattern: /\b(lentejas?|garbanzos?|alubias?|judías?|habas?|guisantes?|soja|tofu|tempeh|edamame|legumbre|legumbres)\b/i, categoria: 'Legumbres' },
  { pattern: /\b(almendra|nuez|avellana|anacardo|pistacho|cacahuete|piñón|macadamia|fruto seco|frutos secos|coco|semilla de chía|semilla de lino|semilla de sésamo|pipas|semilla de girasol|semilla de calabaza)\b/i, categoria: 'Frutos secos' },
  { pattern: /\b(arroz|pasta|espagueti|macarrón|fideo|tallarín|quinoa|cuscús|bulgur|avena|muesli|granola|copos de avena|harina|pan|baguete|biscote|tostada|galleta salada|cereales? de desayuno|salvado|centeno|espelta|kamut)\b/i, categoria: 'Cereales' },
  { pattern: /\b(patata|papa|boniato|batata|yuca|ñame|taro|chirivía|nabo)\b/i, categoria: 'Tubérculos' },
  { pattern: /\b(lechuga|espinaca|acelga|kale|rúcula|canónigo|endivia|escarola|berro|col|brócoli|coliflor|cebolla|ajo|puerro|tomate|pepino|calabacín|berenjena|pimiento|zanahoria|remolacha|apio|alcachofa|espárrago|champiñón|seta|verdura|hortaliza|judía verde|vaina|guisante fresco|pimiento rojo|pimiento verde|maíz dulce|aguacate)\b/i, categoria: 'Verduras' },
  { pattern: /\b(manzana|pera|naranja|mandarina|limón|plátano|banana|fresa|frambuesa|arándano|mora|cereza|melocotón|nectarina|albaricoque|ciruela|uva|sandía|melón|piña|mango|papaya|kiwi|granada|higo|dátil|fruta)\b/i, categoria: 'Frutas' },
  { pattern: /\b(aceite|manteca|margarina|ghee|grasa)\b/i, categoria: 'Grasas' },
  { pattern: /\b(sal|pimienta|especias?|canela|cúrcuma|comino|orégano|tomillo|romero|albahaca|perejil|laurel|vinagre|mostaza|kétchup|salsa|mayonesa|alioli|tahini|miso|soja salsa|soja fermentada|sriracha|tabasco|curry|pimentón|azafrán|nuez moscada|cardamomo|jengibre|ajo en polvo|cebolla en polvo|condimento)\b/i, categoria: 'Condimentos' },
  { pattern: /\b(agua|zumo|jugo|bebida|infusión|té|café|chocolate caliente|leche de avena|leche de almendra|leche vegetal|refresco|cerveza|vino|sidra|cava|cóctel|batido|smoothie|limonada|horchata)\b/i, categoria: 'Bebidas' },
  { pattern: /\b(proteína en polvo|whey|creatina|bcaa|aminoácido|pre.?entreno|gainer|isotónico|suplemento|multivitamínico|omega.?3 suplemento|colageno|colágeno en polvo)\b/i, categoria: 'Suplementos' },
  { pattern: /\b(azúcar|azucar|miel|sirope|jarabe|mermelada|confitura|chocolate|bombón|caramelo|galleta|pastel|tarta|bizcocho|croissant|donut|magdalena|helado|postre|dulce|bollería)\b/i, categoria: 'Otros' },
]

function inferirCategoriaPorNombre(nombre) {
  const lower = nombre.toLowerCase()
  for (const { pattern, categoria } of INFERENCIA_POR_NOMBRE) {
    if (pattern.test(lower)) return categoria
  }
  return null
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function fetchTodos() {
  const todos = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('alimentos')
      .select('id, nombre, categoria')
      .range(from, from + 999)
      .order('nombre')
    if (error) return { data: null, error }
    if (!data || data.length === 0) break
    todos.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return { data: todos, error: null }
}

async function main() {
  console.log('📂 CORRECCIÓN DE CATEGORÍAS')
  console.log(`📋 Modo: ${APLICAR ? '⚠️  APLICAR' : '🔍 DRY RUN'}\n`)

  const { data: alimentos, error } = await fetchTodos()
  if (error) { console.error('❌', error.message); process.exit(1) }

  console.log(`📊 Total alimentos: ${alimentos.length}\n`)

  const categorias_ui_validas = new Set([
    'Carnes', 'Pescados', 'Huevos', 'Lácteos', 'Suplementos',
    'Cereales', 'Tubérculos', 'Legumbres', 'Verduras', 'Frutas',
    'Grasas', 'Frutos secos', 'Semillas', 'Condimentos', 'Otros',
    'Bebidas', 'Supermercado',
  ])

  const cambios = []
  const stats = {}

  for (const a of alimentos) {
    const categoriaActual = a.categoria ?? 'Supermercado'

    // Ya está bien
    if (categorias_ui_validas.has(categoriaActual)) continue

    // Intentar mapeo directo por categoría IA
    const nuevaCategoria = MAPA_CATEGORIA_IA[categoriaActual]
      ?? inferirCategoriaPorNombre(a.nombre)
      ?? 'Supermercado'

    if (nuevaCategoria !== categoriaActual) {
      cambios.push({ id: a.id, nombre: a.nombre, de: categoriaActual, a: nuevaCategoria })
      stats[`${categoriaActual} → ${nuevaCategoria}`] = (stats[`${categoriaActual} → ${nuevaCategoria}`] ?? 0) + 1
    }
  }

  if (cambios.length === 0) {
    console.log('✅ Todas las categorías son ya válidas. Nada que corregir.')
    return
  }

  console.log(`🔄 Cambios detectados: ${cambios.length}\n`)
  console.log('📊 Resumen por mapeo:')
  for (const [key, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key}: ${count}`)
  }

  if (!APLICAR) {
    console.log('\n💡 Primeros 20 ejemplos:')
    cambios.slice(0, 20).forEach(c =>
      console.log(`  "${c.nombre}": ${c.de} → ${c.a}`)
    )
    console.log(`\n💡 Para aplicar: node scripts/corregir-categorias.mjs --aplicar`)
    return
  }

  // Agrupar por categoría destino para hacer UPDATEs por lotes
  const porCategoria = {}
  for (const c of cambios) {
    if (!porCategoria[c.a]) porCategoria[c.a] = []
    porCategoria[c.a].push(c.id)
  }

  const BATCH = 200
  let totalActualizados = 0
  for (const [categoria, ids] of Object.entries(porCategoria)) {
    let actualizados = 0
    let errored = false
    for (let i = 0; i < ids.length; i += BATCH) {
      const lote = ids.slice(i, i + BATCH)
      const { error: e } = await supabase
        .from('alimentos')
        .update({ categoria })
        .in('id', lote)
      if (e) {
        console.error(`❌ Error actualizando "${categoria}" (lote ${i}-${i + lote.length}):`, e.message)
        errored = true
        break
      }
      actualizados += lote.length
    }
    if (!errored) {
      console.log(`✅ ${actualizados} alimentos → ${categoria}`)
      totalActualizados += actualizados
    }
  }

  console.log(`\n✅ Total actualizados: ${totalActualizados}`)
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1) })
