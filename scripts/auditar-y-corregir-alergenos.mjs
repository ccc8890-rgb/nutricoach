/**
 * auditar-y-corregir-alergenos.mjs
 *
 * AUDITA y CORRIGE datos de alérgenos en el recetario.
 *
 * ═══ LO QUE HACE ESTE SCRIPT ═══
 * 1. Limpia tags condicionales malformados:
 *    "Sin Gluten (con avena certificada)" → "Sin Gluten"
 *    "Vegano (si no usas whey)" → "Vegano"
 * 2. Elimina tags inválidos (e.g. "Apto Diabéticos")
 * 3. Añade tags POSITIVOS (Pescado, Lácteos) donde falten, según ingredientes
 * 4. Añade tag "Vegano" a recetas sin ningún producto animal (solo si tiene ingredientes)
 * 5. Añade "Sin Mariscos", "Sin Cerdo", "Sin Soja" donde falten
 *
 * USO:
 *   node scripts/auditar-y-corregir-alergenos.mjs           # dry-run
 *   node scripts/auditar-y-corregir-alergenos.mjs --aplica  # aplica
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

try {
  const env = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8')
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  }
} catch { /* no .env.local */ }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const APLICA = process.argv.includes('--aplica')

// ─── Tags estándar reconocidos ──────────────────────────────────────
const TAGS_VALIDOS = new Set([
  // Positivos (alérgenos EU)
  'Gluten', 'Lácteos', 'Huevos', 'Soja', 'Cacahuetes',
  'Frutos Secos', 'Pescado', 'Crustáceos', 'Moluscos',
  'Sésamo', 'Mostaza', 'Sulfitos',
  // Negativos (libre de)
  'Sin Gluten', 'Sin Lactosa', 'Sin Huevo',
  'Sin Frutos Secos', 'Sin Soja', 'Sin Pescado',
  'Sin Mariscos', 'Sin Cerdo',
  // Dietéticos
  'Vegetariano', 'Vegano',
])

// Tags que DEBEN eliminarse (no estándar)
const TAGS_A_ELIMINAR = new Set([
  'Apto Diabéticos',
])

// ─── Normalización ───────────────────────────────────────────────────
function normalizar(n) {
  return n
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Limpieza de tags condicionales malformados ─────────────────────
// "Sin Gluten (con avena certificada)" → "Sin Gluten"
function limpiarTagCondicional(tag) {
  const idx = tag.indexOf('(')
  if (idx === -1) return tag
  return tag.slice(0, idx).trim()
}

// ─── Keywords sin acentos (se comparan con texto ya normalizado) ─────

// Mariscos: crustáceos + moluscos
const KW_MARISCOS = [
  'gamba', 'langostino', 'camaron', 'mejillon', 'almeja', 'berberecho',
  'pulpo', 'calamar', 'sepia', 'cangrejo', 'necora', 'bogavante', 'langosta',
  'vieira', 'navaja', 'ostra', 'surimi', 'marisco', 'crustaceo',
]

// Cerdo y derivados
const KW_CERDO = [
  'cerdo', 'panceta', 'bacon', 'beicon', 'chorizo', 'salchichon',
  'morcilla', 'fuet', 'longaniza', 'sobrasada', 'jamon',
  'lomo embuchado', 'lomo de cerdo', 'costilla de cerdo',
  'chicharron', 'tocino', 'butifarra',
]

// Soja y derivados
const KW_SOJA = [
  'soja', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari',
  'salsa de soja', 'leche de soja', 'soja texturizada',
]

// Pescado: peces de aleta (crustáceos/moluscos → KW_MARISCOS)
const KW_PESCADO = [
  'salmon', 'atun', 'merluza', 'bacalao', 'dorada', 'lubina',
  'sardina', 'anchoa', 'trucha', 'pez espada', 'lenguado', 'rodaballo',
  'rape', 'boqueron', 'caballa', 'bonito', 'halibut', 'mero',
  'corvina', 'jurel', 'cazon', 'pescado', 'filete de pescado',
]

// Lácteos: productos ANIMALES — leches vegetales se excluyen explícitamente
const KW_LACTEOS = [
  'yogur', 'queso', 'mantequilla', 'nata', 'kefir', 'requeson',
  'ricotta', 'mozzarella', 'parmesano', 'cheddar', 'gruyere', 'cottage',
  'crema de queso', 'queso fresco', 'queso batido',
  'whey', 'proteina de suero', 'suero de leche', 'caseina',
  'leche entera', 'leche semidesnatada', 'leche desnatada',
  'leche de vaca', 'leche condensada', 'leche evaporada', 'leche en polvo',
]

// Leches vegetales — si el texto solo contiene estas, NO es lácteo
const KW_LECHE_VEGETAL = [
  'leche de almendra', 'leche de avena', 'leche de soja', 'leche de coco',
  'leche de arroz', 'leche de canamo', 'leche de quinoa', 'leche de nuez',
  'bebida de almendra', 'bebida de avena', 'bebida de soja', 'bebida de coco',
  'bebida de arroz', 'bebida vegetal',
]

// Keywords que IMPIDEN el tag Vegano (la receta contiene productos animales)
const KW_NO_VEGANO = [
  // Carnes
  'pollo', 'pavo', 'ternera', 'cerdo', 'cordero', 'carne', 'res',
  'pechuga', 'muslo', 'costilla', 'buey',
  // Embutidos
  'jamon', 'bacon', 'panceta', 'chorizo', 'salchicha', 'salchichon',
  'morcilla', 'fuet', 'longaniza', 'sobrasada', 'butifarra', 'tocino',
  // Pescados y mariscos
  ...KW_PESCADO, ...KW_MARISCOS,
  // Lácteos animales
  ...KW_LACTEOS,
  // Huevos
  'huevo', 'clara', 'yema',
  // Miel
  'miel',
]

// ─── Funciones de detección ──────────────────────────────────────────

function contieneKeyword(texto, keywords) {
  return keywords.some(kw => texto.includes(kw))
}

// Detecta lácteos excluyendo leches vegetales
function contieneKeywordLacteos(texto) {
  // Quitar tokens de leche vegetal para no causar falso positivo con "leche"
  let textoLimpio = texto
  for (const veg of KW_LECHE_VEGETAL) {
    textoLimpio = textoLimpio.replace(new RegExp(veg.replace(/\s+/g, '\\s+'), 'g'), '')
  }
  return contieneKeyword(textoLimpio, KW_LACTEOS)
}

async function main() {
  console.log('')
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║   AUDITORÍA Y CORRECCIÓN DE ALÉRGENOS EN RECETARIO         ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`  Modo: ${APLICA ? '✅ APLICA cambios' : '🔍 DRY-RUN'}`)
  console.log('')

  // Cargar recetas
  let recetas = []
  let from = 0
  const PAGE = 200
  while (true) {
    const { data, error } = await supabase
      .from('recetas')
      .select('id, nombre, descripcion, intolerancias')
      .range(from, from + PAGE - 1)
    if (error) { console.error('Error:', error.message); process.exit(1) }
    if (!data?.length) break
    recetas.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`  📦 Recetas cargadas: ${recetas.length}`)

  // Cargar ingredientes
  const { data: ingredientes } = await supabase
    .from('receta_ingredientes')
    .select('receta_id, alimento_id, nombre_libre')
  if (!ingredientes) { console.error('Error al cargar ingredientes'); process.exit(1) }
  console.log(`  📦 Ingredientes cargados: ${ingredientes.length}`)

  // Cargar alimentos
  let alimentos = []
  let fromAl = 0
  while (true) {
    const { data } = await supabase.from('alimentos').select('id, nombre').range(fromAl, fromAl + 1000 - 1)
    if (!data || data.length === 0) break
    alimentos = alimentos.concat(data)
    fromAl += 1000
    if (data.length < 1000) break
  }
  const alimentosMap = new Map(alimentos.map(a => [a.id, a.nombre]))
  console.log(`  📦 Alimentos cargados: ${alimentos.length}\n`)

  // Agrupar ingredientes por receta
  const ingsPorReceta = new Map()
  for (const ing of ingredientes) {
    if (!ingsPorReceta.has(ing.receta_id)) ingsPorReceta.set(ing.receta_id, [])
    ingsPorReceta.get(ing.receta_id).push(ing)
  }

  // ─── Estadísticas ──────────────────────────────────────────────
  let sinCambios = 0
  let corregidas = 0
  let sinIngredientes = 0
  let totalCondicionalLimpiado = 0
  let totalAptoDiabeticos = 0
  let totalPescadoAnadido = 0
  let totalLacteosAnadido = 0
  let totalVeganoAnadido = 0
  let totalSinMariscosAnadido = 0
  let totalSinCerdoAnadido = 0
  let totalSinSojaAnadido = 0
  const detalles = []
  const errores = []

  for (const receta of recetas) {
    const actuales = Array.isArray(receta.intolerancias) ? receta.intolerancias : []
    const cambios = []
    let nuevos = [...actuales]

    // ─── 1. Limpiar tags condicionales malformados ───
    const nuevosLimpiados = nuevos.map(tag => {
      if (!tag.includes('(')) return tag
      const limpio = limpiarTagCondicional(tag)
      if (limpio !== tag) {
        cambios.push(`🧹 Limpiado "${tag}" → "${limpio}"`)
        totalCondicionalLimpiado++
      }
      return limpio
    })
    // Deduplicar tras limpieza (puede que ya existiera el tag limpio)
    nuevos = [...new Set(nuevosLimpiados)]

    // ─── 2. Eliminar tags inválidos ───
    for (const t of [...nuevos]) {
      if (TAGS_A_ELIMINAR.has(t)) {
        nuevos = nuevos.filter(x => x !== t)
        cambios.push(`🗑️ Eliminado "${t}"`)
        if (t === 'Apto Diabéticos') totalAptoDiabeticos++
      }
    }

    // ─── 3. Analizar ingredientes para tags positivos y negativos ───
    const ings = ingsPorReceta.get(receta.id) || []
    const nombresIngs = ings.map(i => {
      const nombre = i.alimento_id ? alimentosMap.get(i.alimento_id) : i.nombre_libre
      return normalizar(nombre || '')
    }).filter(Boolean)

    const tieneIngredientes = nombresIngs.length > 0

    if (!tieneIngredientes) {
      sinIngredientes++
    } else {
      const textoIngs = nombresIngs.join(' ')
      const nombreNorm = normalizar(receta.nombre)
      const descNorm = normalizar(receta.descripcion || '')
      const textoCompleto = [textoIngs, nombreNorm, descNorm].join(' ')

      // ─── Tags POSITIVOS: añadir si se detectan en ingredientes ───
      // Respetamos los negativos ya presentes: si tiene "Sin Pescado" no añadimos "Pescado"
      const tenSinPescado = nuevos.some(t => t.toLowerCase() === 'sin pescado')
      const tenSinLacteos = nuevos.some(t => t.toLowerCase() === 'sin lácteos' || t.toLowerCase() === 'sin lactosa')

      // Pescado positivo (solo si no tiene "Sin Pescado")
      if (!nuevos.includes('Pescado') && !tenSinPescado && contieneKeyword(textoCompleto, KW_PESCADO)) {
        nuevos.push('Pescado')
        cambios.push('➕ Añadido "Pescado"')
        totalPescadoAnadido++
      }

      // Lácteos positivo (solo si no tiene "Sin Lácteos"/"Sin Lactosa"; excluye leches vegetales)
      if (!nuevos.includes('Lácteos') && !tenSinLacteos && contieneKeywordLacteos(textoCompleto)) {
        nuevos.push('Lácteos')
        cambios.push('➕ Añadido "Lácteos"')
        totalLacteosAnadido++
      }

      // ─── Vegano: solo si NO contiene ningún producto animal ───
      // Guard 1: si ya tiene tags positivos de origen animal → no es vegano
      const tieneTagAnimal = ['Lácteos', 'Huevos', 'Pescado', 'Crustáceos', 'Moluscos']
        .some(tag => nuevos.includes(tag))
      // Guard 2: keyword check en ingredientes
      const tieneKwAnimal = contieneKeyword(textoCompleto, KW_NO_VEGANO)

      if (!nuevos.includes('Vegano') && !tieneTagAnimal && !tieneKwAnimal) {
        nuevos.push('Vegano')
        cambios.push('➕ Añadido "Vegano"')
        totalVeganoAnadido++
      }

      // ─── Tags NEGATIVOS (libre de) ───
      const tagsNegativos = [
        { tag: 'Sin Mariscos', keywords: KW_MARISCOS, counter: () => totalSinMariscosAnadido++ },
        { tag: 'Sin Cerdo',    keywords: KW_CERDO,    counter: () => totalSinCerdoAnadido++ },
        { tag: 'Sin Soja',     keywords: KW_SOJA,     counter: () => totalSinSojaAnadido++ },
      ]

      for (const { tag, keywords, counter } of tagsNegativos) {
        if (nuevos.some(t => t.toLowerCase() === tag.toLowerCase())) continue
        if (!contieneKeyword(textoCompleto, keywords)) {
          nuevos.push(tag)
          cambios.push(`➕ Añadido "${tag}"`)
          counter()
        }
      }
    }

    if (cambios.length === 0) {
      sinCambios++
      continue
    }

    detalles.push({ nombre: receta.nombre, id: receta.id, actuales, nuevos, cambios })

    if (APLICA) {
      const { error } = await supabase
        .from('recetas')
        .update({ intolerancias: nuevos })
        .eq('id', receta.id)

      if (error) {
        console.error(`  ❌ ${receta.nombre}: ${error.message}`)
        errores.push(receta.nombre)
        continue
      }
    }

    corregidas++
    if (corregidas <= 10 || corregidas % 50 === 0) {
      const diffStr = cambios.join(' | ')
      console.log(`  ${APLICA ? '✅' : '🔍'} [${corregidas}] ${receta.nombre.substring(0, 40).padEnd(42)} → ${diffStr}`)
    }
  }

  // ─── Reporte final ──────────────────────────────────────────────
  console.log('\n  ─── RESUMEN ───')
  console.log(`  📊 Total recetas:                    ${recetas.length}`)
  console.log(`  ✅ Sin cambios:                      ${sinCambios}`)
  console.log(`  ${APLICA ? '✅ Corregidas' : '🔍 A corregir'}:                     ${corregidas}`)
  console.log(`  ⚠️  Sin ingredientes (no analiz.):   ${sinIngredientes}`)
  console.log('')
  console.log(`  🧹 Tags condicionales limpiados:     ${totalCondicionalLimpiado}`)
  console.log(`  🗑️  "Apto Diabéticos" eliminados:     ${totalAptoDiabeticos}`)
  console.log(`  ➕ "Pescado" añadidos:                ${totalPescadoAnadido}`)
  console.log(`  ➕ "Lácteos" añadidos:                ${totalLacteosAnadido}`)
  console.log(`  ➕ "Vegano" añadidos:                 ${totalVeganoAnadido}`)
  console.log(`  ➕ "Sin Mariscos" añadidos:           ${totalSinMariscosAnadido}`)
  console.log(`  ➕ "Sin Cerdo" añadidos:              ${totalSinCerdoAnadido}`)
  console.log(`  ➕ "Sin Soja" añadidos:               ${totalSinSojaAnadido}`)

  if (errores.length) {
    console.log(`\n  ❌ Errores: ${errores.length}`)
  }

  if (!APLICA && corregidas > 0) {
    console.log('\n→ Ejecuta con --aplica para guardar los cambios.')
    console.log('\n  ─── PREVIEW (primeros 20) ───\n')
    for (const d of detalles.slice(0, 20)) {
      console.log(`  📌 ${d.nombre}`)
      console.log(`     Antes: [${d.actuales.join(', ')}]`)
      console.log(`     Desp:  [${d.nuevos.join(', ')}]`)
      console.log(`     Cambios: ${d.cambios.join(' | ')}`)
      console.log('')
    }
    if (detalles.length > 20) {
      console.log(`  ... y ${detalles.length - 20} recetas más.\n`)
    }
  }
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
