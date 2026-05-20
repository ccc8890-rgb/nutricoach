/**
 * generar-revinculacion.mjs — V3
 * 
 * Re-vincula alimentos genéricos (es_generico=true) a su seed REAL
 * (es_generico=false, custom=false), generando SQL limpio.
 * 
 * Estrategia conservadora:
 *   - Nv1/Nv2: exacto / sin acentos → 100% seguros
 *   - Nv3: candidato CONTIENE seed name (ej: "espagueti marca X" → "espagueti")
 *   - Nv4/Nv5: solo si macros coinciden (±30%) Y hay warning en comentario
 * 
 * Uso: node scripts/generar-revinculacion.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const supabase = createClient(
  'https://hopeqzwzmlrpktoeygxz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcGVxend6bWxycGt0b2V5Z3h6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyMjUxOSwiZXhwIjoyMDkyNjk4NTE5fQ.e0iP547fppOHFfFiWEo053tjl7FmcQMAZzvCPwcVSkc'
)

// ─── Utils ───

function unaccent(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function limpiarNombre(n) {
  return n
    .replace(/\([^)]*\)/g, '')
    .replace(/\d+\s*(kg|g|ml|l|litro|litros?|unidad(?:es)?|pack|ud|uds|unid|pieza(?:s)?|cl|dl|mg|µg)/gi, '')
    .replace(/(pack|lote|caja|kit)\s*\d+/gi, '')
    .replace(/\d+\s*(pack|lote|caja|kit)/gi, '')
    .replace(/\b(freír|freir|asar|cocinar|horno|plancha|vapor|microondas|troceado|fileteado|cortado|entero|natural|ecológico|ecologica|tradicional|congelado|fresco|fresca|ahumado|curado|desnatado|semidesnatado|light|zero|gourmet|premium|selección|seleccion|artesano|artesana|casero|casera|extra|loncheado|picado|rallado|triturado|molido|deshuesado|pelado|sin lactosa|sin gluten|vegano|vegetal)\b/gi, '')
    .replace(/\b(de|del|la|las|los|el|en|con|sin|y|e|o|a|para|por|al|un|una|su|que)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function macrosSimilares(gen, seed) {
  const kCal = gen.calorias || 0
  const kPal = gen.proteinas || 0
  const kCar = gen.carbohidratos || 0
  const kGra = gen.grasas || 0
  const sCal = seed.calorias || 0
  const sPal = seed.proteinas || 0
  const sCar = seed.carbohidratos || 0
  const sGra = seed.grasas || 0

  // Si ambos son 0 kcal, no podemos validar
  if (kCal === 0 && sCal === 0) return true

  // Diferencia porcentual en kcal
  const maxKcal = Math.max(kCal, sCal)
  if (maxKcal === 0) return true
  const diffCal = Math.abs(kCal - sCal) / maxKcal

  // Diferencia en macros principales
  const maxPro = Math.max(kPal, sPal)
  const maxCar = Math.max(kCar, sCar)
  const maxGra = Math.max(kGra, sGra)

  let diffPro = maxPro > 0 ? Math.abs(kPal - sPal) / maxPro : 0
  let diffCar = maxCar > 0 ? Math.abs(kCar - sCar) / maxCar : 0
  let diffGra = maxGra > 0 ? Math.abs(kGra - sGra) / maxGra : 0

  // Si alguna macro es >10, debe coincidir mejor
  const significantMacro = (v) => v >= 5
  const sigCountG = [kPal, kCar, kGra].filter(significantMacro).length
  const sigCountS = [sPal, sCar, sGra].filter(significantMacro).length

  // Para niveles 4-5, exigir ≤30% de diferencia en kcal y macros significativas
  if (diffCal > 0.30) return false

  // Si hay macros significativas, al menos 2 deben coincidir dentro del 40%
  let coincidenSignificativas = 0
  if (sigCountG > 0 || sigCountS > 0) {
    if (!sigCountG || !sigCountS) return false // una tiene macros, la otra no
    const diffs = []
    if (sigCountG > 0 && sigCountS > 0) {
      if (kPal >= 5) diffs.push(diffPro)
      if (kCar >= 5) diffs.push(diffCar)
      if (kGra >= 5) diffs.push(diffGra)
    }
    if (diffs.length > 0) {
      const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
      return avgDiff <= 0.40
    }
  }

  return true // si no hay macros significativas, aceptamos
}

function matchAlimento(nombreCandidato, macrosGen, seedAlimentos) {
  const limpio = limpiarNombre(nombreCandidato)
  const limpioSinAcentos = unaccent(limpio)

  // 1. Exacto (case-insensitive)
  for (const s of seedAlimentos) {
    if (s.nombre.toLowerCase() === limpio) return { match: s, nivel: 1 }
  }

  // 2. Exacto sin acentos
  for (const s of seedAlimentos) {
    if (unaccent(s.nombre.toLowerCase()) === limpioSinAcentos) return { match: s, nivel: 2 }
  }

  // 3. Candidato CONTIENE seed name (producto específico contiene nombre genérico)
  // Valida: "espagueti marca X" contiene "espagueti" → OK
  // No valida: "espagueti" contiene "pasta" → No (es al revés)
  for (const s of seedAlimentos) {
    const sLimpio = limpiarNombre(s.nombre)
    if (sLimpio.length < 3) continue
    // El candidato debe CONTENER el seed, no al revés
    if (limpio.includes(sLimpio) && limpio.length > sLimpio.length + 2) {
      if (macrosSimilares(macrosGen, s)) return { match: s, nivel: 3 }
    }
  }

  // 4. Palabra clave más larga (del candidato) + validación de macros (solo semillas cortas)
  const palabras = limpio.split(/\s+/).filter(p => p.length > 3)
  if (palabras.length > 0) {
    // Ordenar por longitud descendente
    const palabrasOrdenadas = [...palabras].sort((a, b) => b.length - a.length)

    // Probar cada palabra clave hasta encontrar match
    for (const palabra of palabrasOrdenadas) {
      for (const s of seedAlimentos) {
        const sLimpio = limpiarNombre(s.nombre)
        // La palabra clave debe aparecer en el seed
        if (sLimpio.includes(palabra) && sLimpio.length <= palabra.length + 8) {
          if (macrosSimilares(macrosGen, s)) return { match: s, nivel: 4 }
        }
      }
    }
  }

  return null
}

// ─── MAIN ───

console.log('=== GENERAR RE-VINCULACIÓN V3 ===\n')

// Cargar seed REAL
const { data: seedAlimentos, error: errSeed } = await supabase
  .from('alimentos')
  .select('id, nombre, calorias, proteinas, carbohidratos, grasas')
  .eq('custom', false)
  .eq('es_generico', false)
  .or('calorias.gt.0,proteinas.gt.0,carbohidratos.gt.0,grasas.gt.0')
  .limit(5000)

if (errSeed) { console.error('ERROR seed:', errSeed); process.exit(1) }
console.log(`Seed real: ${seedAlimentos.length}`)

// Cargar genéricos
const { data: genericos, error: errGen } = await supabase
  .from('alimentos')
  .select('id, nombre, calorias, proteinas, carbohidratos, grasas')
  .eq('es_generico', true)
  .limit(6000)

if (errGen) { console.error('ERROR genéricos:', errGen); process.exit(1) }
console.log(`Genéricos totales: ${genericos.length}`)

// ─── PROCESAR ───

const sqlLines = [
  '-- ============================================================',
  '-- RE-VINCULACIÓN V3: productos_supermercado → seed_alimentos',
  `-- Generado: ${new Date().toISOString()}`,
  '-- ============================================================',
  '-- SOLO niveles 1-2 (exacto) y 3-4 con validación de macros.',
  '-- ============================================================',
  '',
  'begin;',
  ''
]

let totalConProds = 0
let countN1 = 0, countN2 = 0, countN3 = 0, countN4 = 0
let sinMatch = 0
let totalProdsAfectados = 0
const noMatchList = []
const matchEjemplos = []
const statsPorSuper = {}

for (const gen of genericos) {
  const { count, error: errP } = await supabase
    .from('productos_supermercado')
    .select('id', { count: 'exact', head: true })
    .eq('alimento_id', gen.id)

  if (errP || !count || count === 0) continue
  totalConProds++

  const resultado = matchAlimento(gen.nombre, gen, seedAlimentos)

  if (!resultado) {
    sinMatch++
    noMatchList.push({ ...gen, prods: count })
    continue
  }

  // Contar por nivel
  if (resultado.nivel === 1) countN1++
  else if (resultado.nivel === 2) countN2++
  else if (resultado.nivel === 3) countN3++
  else if (resultado.nivel === 4) countN4++

  totalProdsAfectados += count

  // Stats por supermercado
  const { data: prodsDet } = await supabase
    .from('productos_supermercado')
    .select('supermercado_id')
    .eq('alimento_id', gen.id)

  if (prodsDet) {
    for (const p of prodsDet) {
      statsPorSuper[p.supermercado_id] = (statsPorSuper[p.supermercado_id] || 0) + 1
    }
  }

  sqlLines.push(`-- [N${resultado.nivel}] "${gen.nombre.slice(0, 55)}" → "${resultado.match.nombre.slice(0, 55)}"`)
  sqlLines.push(`--   gen=${gen.id.slice(0, 8)}... (${gen.calorias ?? 0}/${gen.proteinas ?? 0}/${gen.carbohidratos ?? 0}/${gen.grasas ?? 0})`)
  sqlLines.push(`--   seed=${resultado.match.id.slice(0, 8)}... (${resultado.match.calorias ?? 0}/${resultado.match.proteinas ?? 0}/${resultado.match.carbohidratos ?? 0}/${resultado.match.grasas ?? 0})`)
  sqlLines.push(`--   productos: ${count}`)
  sqlLines.push(`update public.productos_supermercado set alimento_id = '${resultado.match.id}' where alimento_id = '${gen.id}';`)
  sqlLines.push(`update public.precios_historico set alimento_id = '${resultado.match.id}' where alimento_id = '${gen.id}';`)
  sqlLines.push(`delete from public.alimentos where id = '${gen.id}';`)
  sqlLines.push('')

  if (matchEjemplos.length < 15) {
    matchEjemplos.push({
      nombre: gen.nombre.slice(0, 50),
      seedNombre: resultado.match.nombre.slice(0, 50),
      nivel: resultado.nivel,
      prods: count,
      genMacros: `${gen.calorias ?? 0}/${gen.proteinas ?? 0}/${gen.carbohidratos ?? 0}/${gen.grasas ?? 0}`,
      seedMacros: `${resultado.match.calorias ?? 0}/${resultado.match.proteinas ?? 0}/${resultado.match.carbohidratos ?? 0}/${resultado.match.grasas ?? 0}`
    })
  }
}

sqlLines.push('commit;')
sqlLines.push('')

// ─── Resumen ───
console.log('=== RESUMEN ===')
console.log(`Genéricos con productos vinculados: ${totalConProds}`)
console.log(`  ├─ N1 (exacto):          ${countN1}`)
console.log(`  ├─ N2 (sin acentos):     ${countN2}`)
console.log(`  ├─ N3 (contiene):        ${countN3}`)
console.log(`  ├─ N4 (keyword+macros):  ${countN4}`)
console.log(`  └─ Sin match:            ${sinMatch}`)
console.log(`Total re-vinculaciones: ${countN1 + countN2 + countN3 + countN4}`)
console.log(`Productos afectados:   ${totalProdsAfectados}`)

console.log('\n--- EJEMPLOS DE MATCH ---')
matchEjemplos.forEach(e => {
  console.log(`  N${e.nivel}: "${e.nombre}" (${e.genMacros})`)
  console.log(`       → "${e.seedNombre}" (${e.seedMacros}) — ${e.prods} prod(s)`)
})

console.log(`\n--- SIN MATCH (${noMatchList.length}) ---`)
noMatchList.sort((a, b) => (b.prods || 0) - (a.prods || 0))
noMatchList.slice(0, 30).forEach(g => {
  const mac = (g.calorias || 0) > 0 ? `${g.calorias}/${g.proteinas}/${g.carbohidratos}/${g.grasas}` : '[0 kcal]'
  console.log(`  "${g.nombre.slice(0, 65).padEnd(65)} ${mac}  ${g.prods} prod(s)`)
})
if (noMatchList.length > 30) console.log(`  ... y ${noMatchList.length - 30} más`)

// Stats por supermercado
if (Object.keys(statsPorSuper).length > 0) {
  const { data: sms } = await supabase
    .from('supermercados')
    .select('id, nombre')
    .in('id', Object.keys(statsPorSuper))

  const smMap = {}
  if (sms) for (const s of sms) smMap[s.id] = s.nombre

  console.log('\nProductos re-vinculados por supermercado:')
  for (const [id, c] of Object.entries(statsPorSuper).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${(smMap[id] || id).padEnd(20)} ${c}`)
  }
}

// Escribir SQL
const sqlContent = sqlLines.join('\n')
writeFileSync('scripts/revinculacion_output.sql', sqlContent)
console.log(`\nSQL: scripts/revinculacion_output.sql (${sqlLines.length} líneas)`)
console.log('=== COMPLETADO ===')
