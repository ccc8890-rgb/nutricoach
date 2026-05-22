#!/usr/bin/env node
/**
 * auditar-y-limpiar-ingredientes-malos.mjs
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  DETECTA Y CORRIGE INGREDIENTES MAL ASIGNADOS EN RECETAS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ¿Qué detecta?
 *   1. Alimentos NO comestibles en la tabla `alimentos` (ej: "Absorbe Olor Lavanda")
 *   2. Ingredientes en recetas cuyo nombre_libre NO coincide con el alimento vinculado
 *      (ej: "Queso crema" → alimento "Guisantes")
 *   3. Recetas con ingredientes incongruentes para su tipo (ej: cheesecake con guisantes)
 *
 * ¿Qué hace?
 *   - Modo --dry-run (default): solo muestra lo que se corregiría
 *   - Modo --fix-alimentos: marca no-comestibles como es_comestible=false
 *   - Modo --fix-ingredientes: corrige alimento_id a null + recalcula macros
 *
 * USO:
 *   node scripts/auditar-y-limpiar-ingredientes-malos.mjs                    → diagnóstico
 *   node scripts/auditar-y-limpiar-ingredientes-malos.mjs --fix-alimentos    → marca no comestibles
 *   node scripts/auditar-y-limpiar-ingredientes-malos.mjs --fix-ingredientes → corrige mal matches
 *   node scripts/auditar-y-limpiar-ingredientes-malos.mjs --fix-all          → todo
 *   node scripts/auditar-y-limpiar-ingredientes-malos.mjs --fix-alimentos --apply → escribe en BD
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ─── Cargar .env.local ─────────────────────────────────────────────
function loadEnv() {
  const p = resolve(RAÍZ, '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const DRY_RUN = !process.argv.includes('--apply')
const FIX_ALIMENTOS = process.argv.includes('--fix-alimentos') || process.argv.includes('--fix-all')
const FIX_INGREDIENTES = process.argv.includes('--fix-ingredientes') || process.argv.includes('--fix-all')

// ═══════════════════════════════════════════════════════════════════
//  PASO 0: DETECTAR ALIMENTOS NO COMESTIBLES EN LA BD
// ═══════════════════════════════════════════════════════════════════

/**
 * Patrones para detectar alimentos NO comestibles en la BD.
 * Complementan a guard-no-comestible.ts.
 */
const PATRONES_NO_COMESTIBLE_AMPLIADOS = [
  // Limpieza / hogar
  /\babsorbe\s+olor\b/i,
  /\beliminador\s+olor(es)?\b/i,
  /\beliminador\s+turbidez\b/i,
  /\blavanda\s*(limpieza|olor|ambientador|perfume)\b/i,
  /\bambientador\b/i,
  /\blavanda\s*(spray|difusor)\b/i,
  /\blimpia\w*\s*(cristal|hogar|bano|suelo)\b/i,
  /\bsuavizante\b/i,
  /\bdetergente\b/i,
  /\bfregasuelos\b/i,
  /\blejia?\b/i,
  /\bdesinfectante\b/i,
  /\bestropajo\b/i,
  /\bbayeta\b/i,
  /\bfregona\b/i,
  /\bmopa\b/i,

  // Cuidado personal / cosmética
  /\bjabon\s*(manos|intimo|ban|o)\b/i,
  /\bchampu\b/i,
  /\bacondicionador\b/i,
  /\bcrema\s*(hidrat|corporal|manos|facial)\b/i,
  /\bdesodorante\b/i,
  /\bcolonia\b/i,
  /\bperfume\b/i,
  /\bmaquillaje\b/i,
  /\blabial\b/i,
  /\bprotector\s*solar\b/i,
  /\bdentifrico\b/i,
  /\bcoloracion\s+permanente\b/i,
  /\bmaquinillas?\s+depilacion\b/i,
  /\besparadrapo\b/i,
  /\besponja\s+calzado\b/i,
  /\bmantel\s+papel\b/i,

  // Mascotas
  /\bpienso\b/i,
  /\bcomida\s*(gato|perro)\b/i,
  /\balimento\s*(gato|perro)\b/i,
  /\bmascotas?\b/i,

  // Medicamentos / para-farmacia (solo cuando es claramente no comestible)
  /\blaxante\b/i,
  /\bminoxidil\b/i,
  /\bcomprimido\b/i,
  /\bserum\s+facial\b/i,
  /\bcapsulas?\s+(lax|laxante|facial)\b/i,

  // Bebidas alcohólicas como producto (no como ingrediente de cocina)
  // NOTA: "cerveza" sola y "whisky" se excluyen por EXCEPCIONES_COMESTIBLES

  // Otros no comestibles evidentes
  /\bbiberon\b/i,
  /\bpanales?\b/i,
  /\bchupete\b/i,
  /\btoallitas?\s*(bebe|humedas)\b/i,
  /\bpapel\s*(higienico|cocina|aluminio)\b/i,
  /\bpapel\s+hogar\b/i,
  /\binsecticida\b/i,
  /\brepelente\s*(insectos|mosquitos)\b/i,

  // Palabras individuales peligrosas (solo cuando son el nombre completo)
  /^(crema|jabon|champu|suavizante|ambientador|desodorante|perfume|colonia)$/i,
  /^(lejia|detergente|fregasuelos|estropajo|bayeta|fregona|mopa)$/i,
  /^(pienso|panales|panal|biberon|chupete|mascota)$/i,
  /^(laxante|minoxidil|comprimido|tampon)$/i,
]

/** Excepciones: alimentos reales que parecen no comestibles pero SÍ lo son */
const EXCEPCIONES_COMESTIBLES = [
  /\bcrema\s+de\s+(cacahuete|avellana|almendra|chocolate|leche|queso|verduras|calabaza|champi|setas|marisco|anacardo|mani)/i,
  /\baceite\s+de\s+(coco|oliva|girasol|almendra|aguacate|sesamo|linaza|nuez)/i,
  /\bleche\s+(de\s+)?(coco|almendra|avellana|soja|avena|arroz|cabr[a-z]|oveja)/i,
  /\bharina\s+de\s+(trigo|avena|almendra|maiz|arroz|garbanzo|coco|espelta|centeno)/i,
  /\blevadura\s+(cerveza|pan|quimica|fresca|seca|polvo)/i,
  /\bbebida\s+(de\s+)?(soja|almendra|avena|arroz|coco|avellana)/i,
  /\byogur\s+(griego|natural|desnatado|entero|sabor)/i,
  /\bpan\s+(de\s+)?(molde|integral|rallado|tostado|pita|centeno|trigo|hambur)/i,
  /\bsalsa\s+(de\s+)?(tomate|soja|mostaza|yogur|queso|pesto|barbacoa|teriyaki)/i,
  /\bvinagre\s+(de\s+)?(manzana|vino|modena|arro[sz]|blanco)/i,
  /\bsal\s+(de\s+)?(mar|mesa|himalaya|escamas|gruesa|fina|yodada)/i,
  /\bcafe\s+(molido|grano|soluble|descafeinado|natural|toStado|mezcla)/i,

  // Café en cápsulas (sí es comestible)
  /\b(cafe|descafeinado)\s+\w+\s+capsulas?\b/i,

  // Cerveza / whisky usados como ingrediente de cocina
  /\bcerveza\s+\w/i,
  /\bwhisky\b/i,
]

function esNoComestible(nombre) {
  if (!nombre || nombre.trim().length < 3) return false
  const n = nombre.toLowerCase().trim()

  // Excepciones primero
  for (const exc of EXCEPCIONES_COMESTIBLES) {
    if (exc.test(n)) return false
  }

  for (const patron of PATRONES_NO_COMESTIBLE_AMPLIADOS) {
    if (patron.test(n)) return true
  }
  return false
}

async function detectarAlimentosNoComestiblesEnBD() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  🔍 FASE 0: ALIMENTOS NO COMESTIBLES EN BD')
  console.log('═══════════════════════════════════════════\n')

  const { data: alimentos, error } = await sb
    .from('alimentos')
    .select('id, nombre, es_comestible, fuente')
    .not('es_comestible', 'eq', false)

  if (error || !alimentos) {
    console.log('  ❌ Error al leer alimentos:', error?.message)
    return { noComestibles: [], sospechosos: [] }
  }

  const noComestibles = []
  const sospechosos = []

  for (const a of alimentos) {
    if (esNoComestible(a.nombre)) {
      noComestibles.push(a)
    }
    // Patrones de sospecha adicional
    if (
      a.nombre.toLowerCase().includes('absorbe') ||
      a.nombre.toLowerCase().includes('lavanda') ||
      a.nombre.toLowerCase().includes('olor') ||
      a.nombre.toLowerCase().includes('ambientador') ||
      a.nombre.toLowerCase().includes('eliminador') ||
      a.nombre.toLowerCase().includes('neutraliza')
    ) {
      if (!noComestibles.some(n => n.id === a.id)) {
        sospechosos.push(a)
      }
    }
  }

  console.log(`  📊 Alimentos activos revisados: ${alimentos.length}`)
  console.log(`  🚫 No comestibles detectados: ${noComestibles.length}`)
  if (sospechosos.length > 0) {
    console.log(`  ⚠️  Sospechosos adicionales: ${sospechosos.length}`)
  }

  for (const nc of noComestibles) {
    console.log(`  🚫 "${nc.nombre}" (${nc.id.substring(0, 8)}...) fuente: ${nc.fuente || '?'}`)
  }

  for (const s of sospechosos) {
    console.log(`  ⚠️  "${s.nombre}" (${s.id.substring(0, 8)}...) — REVISAR MANUALMENTE`)
  }

  return { noComestibles, sospechosos }
}

// ═══════════════════════════════════════════════════════════════════
//  FASE 1: RECETAS CON INGREDIENTES INCOHERENTES (semántica)
// ═══════════════════════════════════════════════════════════════════

const CATEGORIA_ES_POSTRE = new Set(['Postre', 'postre'])

const INGREDIENTES_NO_POSTRE = [
  'guisante', 'judia', 'judías', 'alubia', 'alubias', 'garbanzo', 'garbanzos',
  'lenteja', 'lentejas', 'haba', 'habas', 'brócoli', 'brocoli', 'coliflor',
  'repollo', 'berza', 'acelga', 'espinaca', 'espinacas', 'canónigos', 'canonigos',
  'rúcula', 'rucula', 'lechuga', 'endivia', 'escarola',
  'calabacín', 'calabacin', 'berenjena', 'pimiento', 'pimientos',
  'cebolla', 'cebollas', 'cebolleta', 'puerro', 'ajo',
  'apio', 'hinojo',
  'patata', 'patatas',
  'remolacha', 'nabo', 'rábano', 'rabanito',
  'maíz', 'maiz', 'elote', 'choclo',
  'seta', 'setas', 'champiñón', 'champinon', 'champiñones', 'boletus',
  'esparrago', 'esparragos', 'alcachofa', 'alcachofas',
  'col', 'coles de bruselas',
  'pepino',
  'pollo', 'pechuga', 'muslo', 'contramuslo',
  'ternera', 'cerdo', 'lomo', 'solomillo', 'entrecot', 'filete',
  'cordero', 'conejo', 'pavo',
  'jamón', 'jamon', 'chorizo', 'salchicha', 'beicon', 'bacon', 'panceta',
  'salmón', 'salmon', 'merluza', 'bacalao', 'atún', 'atun', 'dorada',
  'lubina', 'rape', 'rodaballo', 'trucha',
  'gamba', 'gambas', 'langostino', 'langostinos', 'camarón', 'camarones',
  'mejillón', 'mejillones', 'almeja', 'almejas', 'berberecho', 'berberechos',
  'calamar', 'calamares', 'pulpo', 'sepia',
  'anchoa', 'anchoas', 'boquerón', 'boquerones',
].map(i => i.toLowerCase())

const INGREDIENTES_POSTRE = [
  'azúcar', 'azucar', 'edulcorante', 'stevia', 'miel',
  'harina', 'avena', 'copos de avena', 'maicena', 'fécula', 'fecula',
  'leche', 'nata', 'crema de leche', 'queso crema', 'queso fresco',
  'yogur', 'yogur griego', 'requesón', 'ricotta', 'mascarpone',
  'huevo', 'huevos', 'clara', 'claras',
  'mantequilla', 'aceite de coco', 'aceite de oliva',
  'cacao', 'chocolate', 'chocolate negro', 'chocolate blanco', 'chocolate con leche',
  'vainilla', 'extracto de vainilla', 'esencia de vainilla',
  'canela', 'nuez moscada', 'jengibre',
  'fruta', 'manzana', 'pera', 'plátano', 'platano', 'naranja', 'limón', 'limon',
  'fresa', 'fresas', 'arándano', 'arándanos', 'frambuesa', 'frambuesas',
  'mora', 'moras', 'cereza', 'cerezas', 'melocotón', 'melocoton', 'albaricoque',
  'ciruela', 'pasas', 'higo', 'higos', 'dátil', 'datil', 'dátiles', 'datiles',
  'frutos secos', 'almendra', 'nuez', 'nueces', 'avellana', 'anacardo',
  'pistacho', 'cacahuete', 'coco', 'nata montada',
  'gelatina', 'cuajada', 'flan',
  'galleta', 'galletas', 'bizcocho', 'sobaos',
  'sirope', 'caramelo',
  'levadura quimica', 'polvo de hornear', 'levadura',
  'sal', 'pimienta',
  'aguacate',

  // Verduras/hortalizas que SÍ se usan en postres
  'zanahoria', 'zanahorias',
  'boniato', 'boniato (crudo)', 'boniato crudo', 'batata',
  'calabaza', 'semillas de calabaza',
  'tomate', 'tomates', 'concentrado de tomate',
].map(i => i.toLowerCase())

function ingredienteEsSospechosoEnPostre(nombreIngrediente) {
  const n = nombreIngrediente.toLowerCase().trim()

  for (const ok of INGREDIENTES_POSTRE) {
    if (n.includes(ok)) return false
  }

  for (const mal of INGREDIENTES_NO_POSTRE) {
    if (n.includes(mal)) return true
  }

  return false
}

async function detectarRecetasIncoherentes() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  🔍 FASE 1: RECETAS CON INGREDIENTES INCOHERENTES')
  console.log('═══════════════════════════════════════════\n')

  const { data: recetas, error } = await sb
    .from('recetas')
    .select('id, nombre, categoria, tipo_plato')
    .in('categoria', ['Postre', 'Desayuno', 'Merienda', 'Snack'])

  if (error || !recetas) {
    console.log('  ❌ Error:', error?.message)
    return []
  }

  const incoherentes = []

  for (const receta of recetas) {
    const { data: ings } = await sb
      .from('receta_ingredientes')
      .select('id, nombre_libre, alimento_id, cantidad_gramos')
      .eq('receta_id', receta.id)

    if (!ings || ings.length === 0) continue

    const sospechosos = []
    for (const ing of ings) {
      if (!ing.nombre_libre) continue

      const esPostre = CATEGORIA_ES_POSTRE.has(receta.categoria) ||
        (receta.tipo_plato && CATEGORIA_ES_POSTRE.has(receta.tipo_plato))

      if (esPostre && ingredienteEsSospechosoEnPostre(ing.nombre_libre)) {
        sospechosos.push(ing)
      }
    }

    if (sospechosos.length > 0) {
      incoherentes.push({ receta, sospechosos })
      console.log(`\n  🍰 ${receta.nombre} (${receta.categoria || receta.tipo_plato})`)
      console.log(`     ID: ${receta.id}`)
      for (const s of sospechosos) {
        const alimInfo = s.alimento_id ? ` → alimento: ${s.alimento_id.substring(0, 8)}...` : ' (sin vínculo)'
        console.log(`     ❌ ${s.nombre_libre} (${s.cantidad_gramos}g)${alimInfo}`)
      }
    }
  }

  console.log(`\n  📊 Total recetas con ingredientes incoherentes: ${incoherentes.length}`)
  return incoherentes
}

// ═══════════════════════════════════════════════════════════════════
//  FASE 2: DETECTAR alimento_id ≠ nombre_libre (mismatch)
// ═══════════════════════════════════════════════════════════════════

function norm(n) {
  return n.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sonIncongruentes(nombreLibre, nombreAlimento) {
  if (!nombreLibre || !nombreAlimento) return false
  const a = norm(nombreLibre)
  const b = norm(nombreAlimento)

  // Si son iguales o uno contiene al otro → OK
  if (a === b || a.includes(b) || b.includes(a)) return false

  const palabrasA = a.split(/\s+/).filter(p => p.length > 2)
  const palabrasB = b.split(/\s+/).filter(p => p.length > 2)

  if (palabrasA.length === 0 || palabrasB.length === 0) return false

  // Contar coincidencias
  let matches = 0
  for (const pa of palabrasA) {
    for (const pb of palabrasB) {
      if (pa === pb || pa.includes(pb) || pb.includes(pa)) {
        matches++
        break
      }
    }
  }

  // Si ningún token coincide → incongruente
  if (matches === 0) return true

  // Si todos los tokens de nombre_libre están en el nombre del alimento → OK
  const todosEnB = palabrasA.every(pa => {
    for (const pb of palabrasB) {
      if (pa === pb || pa.includes(pb) || pb.includes(pa) ||
        (pa.length > 3 && pb.includes(pa)) ||
        (pb.length > 3 && pa.includes(pb))) return true
    }
    return false
  })
  if (todosEnB) return false

  // Si más de la mitad de tokens NO coinciden → incongruente
  const noMatch = palabrasA.filter(pa => {
    for (const pb of palabrasB) {
      if (pa === pb || pa.includes(pb) || pb.includes(pa)) return false
    }
    return true
  })

  return noMatch.length >= Math.ceil(palabrasA.length / 2)
}

async function detectarIngredientesMalMatch() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  🔍 FASE 2: INGREDIENTES CON alimento_id INCORRECTO')
  console.log('═══════════════════════════════════════════\n')

  // Paginar ingredientes
  let todosIngs = []
  let from = 0
  const limit = 1000
  while (true) {
    const { data, error } = await sb
      .from('receta_ingredientes')
      .select('id, receta_id, nombre_libre, alimento_id, cantidad_gramos')
      .not('alimento_id', 'is', null)
      .range(from, from + limit - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    todosIngs = todosIngs.concat(data)
    from += limit
    if (data.length < limit) break
  }

  console.log(`  📊 Ingredientes con alimento_id: ${todosIngs.length}`)

  // Cargar alimentos en memoria
  const { data: alimentos } = await sb.from('alimentos').select('id, nombre')
  const alimentoMap = {}
  for (const a of (alimentos || [])) {
    alimentoMap[a.id] = a.nombre
  }

  const malos = []
  for (const ing of todosIngs) {
    if (!ing.nombre_libre || !ing.alimento_id) continue
    const nombreAlimento = alimentoMap[ing.alimento_id]
    if (!nombreAlimento) {
      malos.push({ ...ing, nombreAlimento: '❌ NO EXISTE', incongruente: true })
      continue
    }
    if (sonIncongruentes(ing.nombre_libre, nombreAlimento)) {
      malos.push({ ...ing, nombreAlimento, incongruente: true })
    }
  }

  console.log(`  ❌ Ingredientes con posible mal match: ${malos.length}`)

  if (malos.length > 0) {
    for (const m of malos.slice(0, 50)) {
      console.log(`\n     📛 "${m.nombre_libre}" → "${m.nombreAlimento}" (${m.cantidad_gramos}g)`)
      const { data: rec } = await sb.from('recetas').select('nombre').eq('id', m.receta_id).single()
      if (rec) console.log(`        En receta: ${rec.nombre}`)
    }
    if (malos.length > 50) {
      console.log(`     ... y ${malos.length - 50} más`)
    }
  }

  return malos
}

// ═══════════════════════════════════════════════════════════════════
//  ACCIONES
// ═══════════════════════════════════════════════════════════════════

async function corregirAlimentosNoComestibles(noComestibles) {
  if (noComestibles.length === 0) return

  console.log('\n═══════════════════════════════════════════')
  console.log(`  ${DRY_RUN ? '🔍 DRY-RUN' : '✏️'} FIJANDO ALIMENTOS NO COMESTIBLES`)
  console.log('═══════════════════════════════════════════\n')

  for (const nc of noComestibles) {
    console.log(`  ${DRY_RUN ? '🔍' : '✏️'} "${nc.nombre}" → es_comestible=false`)

    if (!DRY_RUN) {
      const { error: err1 } = await sb
        .from('alimentos')
        .update({ es_comestible: false })
        .eq('id', nc.id)

      if (err1) {
        console.log(`     ❌ Error: ${err1.message}`)
        continue
      }

      // Desvincular de recetas
      const { data: ings } = await sb
        .from('receta_ingredientes')
        .select('id, receta_id')
        .eq('alimento_id', nc.id)

      if (ings && ings.length > 0) {
        const recetasAfectadas = new Set(ings.map(i => i.receta_id))
        console.log(`     📛 Desvinculando de ${ings.length} ingredientes en ${recetasAfectadas.size} recetas`)

        await sb.from('receta_ingredientes').update({ alimento_id: null }).eq('alimento_id', nc.id)

        for (const rid of recetasAfectadas) {
          try { await sb.rpc('calcular_macros_receta', { p_receta_id: rid }) } catch { }
        }
        console.log(`     ✅ Desvinculado y recalculado`)
      }

      console.log(`     ✅ Hecho`)
    }
  }
}

async function corregirMalMatches(malos) {
  if (malos.length === 0) return

  const recetasARevisar = new Set()

  console.log('\n═══════════════════════════════════════════')
  console.log(`  ${DRY_RUN ? '🔍 DRY-RUN' : '✏️'} CORRIGIENDO MAL MATCHES`)
  console.log('═══════════════════════════════════════════\n')

  for (const m of malos) {
    console.log(`  ${DRY_RUN ? '🔍' : '✏️'} "${m.nombre_libre}" → desvinculando de "${m.nombreAlimento}"`)

    if (!DRY_RUN) {
      const { error } = await sb
        .from('receta_ingredientes')
        .update({ alimento_id: null })
        .eq('id', m.id)

      if (error) {
        console.log(`     ❌ Error: ${error.message}`)
      } else {
        console.log(`     ✅ Desvinculado`)
        recetasARevisar.add(m.receta_id)
      }
    }
  }

  if (!DRY_RUN && recetasARevisar.size > 0) {
    console.log(`\n  📊 Recalculando macros de ${recetasARevisar.size} recetas...`)
    for (const rid of recetasARevisar) {
      try { await sb.rpc('calcular_macros_receta', { p_receta_id: rid }) } catch { }
    }
    console.log('  ✅ Macros recalculadas')
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('')
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║   AUDITORÍA Y LIMPIEZA DE INGREDIENTES MALOS       ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`  Modo: ${DRY_RUN ? '🔍 DRY-RUN (no se escribe nada)' : '🚀 APLICANDO CAMBIOS'}`)
  console.log(`  Fix alimentos: ${FIX_ALIMENTOS ? 'SÍ' : 'NO (solo diagnóstico)'}`)
  console.log(`  Fix ingredientes: ${FIX_INGREDIENTES ? 'SÍ' : 'NO (solo diagnóstico)'}`)
  console.log('')

  // FASE 0
  const { noComestibles, sospechosos } = await detectarAlimentosNoComestiblesEnBD()
  if (FIX_ALIMENTOS && noComestibles.length > 0) {
    await corregirAlimentosNoComestibles(noComestibles)
  }

  // FASE 1
  const incoherentes = await detectarRecetasIncoherentes()

  // FASE 2
  if (FIX_INGREDIENTES) {
    const malos = await detectarIngredientesMalMatch()
    await corregirMalMatches(malos)
  }

  // Resumen
  console.log('\n═══════════════════════════════════════════')
  console.log('  📊 RESUMEN')
  console.log('═══════════════════════════════════════════\n')
  console.log(`  🚫 Alimentos no comestibles: ${noComestibles.length}`)
  console.log(`  ⚠️  Sospechosos (revisar): ${sospechosos.length}`)
  console.log(`  🍰 Recetas incoherentes:   ${incoherentes.length}`)

  if (DRY_RUN && (FIX_ALIMENTOS || FIX_INGREDIENTES)) {
    console.log('\n  Para aplicar cambios:')
    console.log('  node scripts/auditar-y-limpiar-ingredientes-malos.mjs --fix-all --apply')
    console.log('  node scripts/auditar-y-limpiar-ingredientes-malos.mjs --fix-alimentos --apply   (solo alimentos)')
    console.log('  node scripts/auditar-y-limpiar-ingredientes-malos.mjs --fix-ingredientes --apply (solo ingredientes)')
  }
  console.log('')
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
