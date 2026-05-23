/**
 * auditar-y-corregir-alergenos.mjs
 *
 * AUDITA y CORRIGE datos de alérgenos en el recetario.
 *
 * ═══ BUG RAÍZ (YA CORREGIDO EN CÓDIGO) ═══
 * "Sin Mariscos", "Sin Cerdo", "Sin Soja" NO estaban en ALERGENOS_NEGATIVOS
 * de lib/recetas-constants.ts, por lo que clasificarIntolerancia() devolvía
 * 'positivo' y se mostraban bajo "Contiene" en la UI.
 *
 * La corrección en lib/recetas-constants.ts ya resuelve la UI para TODAS las
 * recetas, tanto existentes como futuras.
 *
 * ═══ LO QUE HACE ESTE SCRIPT ═══
 * 1. Elimina tags inválidos/no estándar (e.g. "Apto Diabéticos")
 * 2. Añade "Sin Mariscos", "Sin Cerdo", "Sin Soja" donde falten
 *    (basado en análisis de ingredientes)
 * 3. Mantiene SIN CAMBIOS los tags positivos (Gluten, Lácteos...),
 *    los negativos existentes (Sin Gluten, Sin Lactosa...) y los dietéticos
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

// Tags que DEBEN eliminarse (no estándar, incorrectos)
const TAGS_A_ELIMINAR = new Set([
  'Apto Diabéticos',
])

// Keywords para detectar mariscos (Crustáceos + Moluscos)
const KW_MARISCOS = [
  'gamba', 'langostino', 'camarón', 'mejillón', 'almeja', 'berberecho',
  'pulpo', 'calamar', 'sepia', 'cangrejo', 'nécora', 'bogavante', 'langosta',
  'vieira', 'navaja', 'ostra', 'surimi', 'marisco', 'crustáceo',
]

const KW_CERDO = [
  'cerdo', 'panceta', 'bacon', 'beicon', 'chorizo', 'salchichón',
  'morcilla', 'fuet', 'longaniza', 'sobrasada', 'jamón', 'jamon',
  'lomo embuchado', 'lomo de cerdo', 'costilla de cerdo',
  'chicharrón', 'tocino', 'butifarra',
]

const KW_SOJA = [
  'soja', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari',
  'salsa de soja', 'leche de soja', 'soja texturizada',
]

function normalizar(n) {
  return n
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function contieneKeyword(texto, keywords) {
  return keywords.some(kw => texto.includes(kw))
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
  let totalAptoDiabeticos = 0
  let totalSinMariscosAnadido = 0
  let totalSinCerdoAnadido = 0
  let totalSinSojaAnadido = 0
  const detalles = []
  const errores = []

  for (const receta of recetas) {
    const actuales = Array.isArray(receta.intolerancias) ? receta.intolerancias : []
    const cambios = []
    const nuevos = [...actuales]

    // ─── 1. Eliminar tags inválidos ───
    for (const t of actuales) {
      if (TAGS_A_ELIMINAR.has(t)) {
        const idx = nuevos.indexOf(t)
        if (idx >= 0) {
          nuevos.splice(idx, 1)
          cambios.push(`🗑️ Eliminado "${t}"`)
          if (t === 'Apto Diabéticos') totalAptoDiabeticos++
        }
      }
    }

    // ─── 2. Analizar ingredientes para añadir tags faltantes ───
    const ings = ingsPorReceta.get(receta.id) || []
    const nombresIngs = ings.map(i => {
      const nombre = i.alimento_id ? alimentosMap.get(i.alimento_id) : i.nombre_libre
      return normalizar(nombre || '')
    }).filter(Boolean)

    if (nombresIngs.length === 0) {
      sinIngredientes++
    } else {
      const textoIngs = nombresIngs.join(' ')
      const nombreNorm = normalizar(receta.nombre)
      const descNorm = normalizar(receta.descripcion || '')
      const textoCompleto = [textoIngs, nombreNorm, descNorm].join(' ')

      // Tags negativos a evaluar
      const tagsAChequear = [
        { tag: 'Sin Mariscos', keywords: KW_MARISCOS },
        { tag: 'Sin Cerdo', keywords: KW_CERDO },
        { tag: 'Sin Soja', keywords: KW_SOJA },
      ]

      for (const { tag, keywords } of tagsAChequear) {
        // Si ya lo tiene (como cualquier tag), saltar
        if (actuales.some(t => t.toLowerCase() === tag.toLowerCase())) continue

        // Si NO contiene ningún keyword → añadir tag negativo
        if (!contieneKeyword(textoCompleto, keywords)) {
          nuevos.push(tag)
          cambios.push(`➕ Añadido "${tag}"`)
          if (tag === 'Sin Mariscos') totalSinMariscosAnadido++
          if (tag === 'Sin Cerdo') totalSinCerdoAnadido++
          if (tag === 'Sin Soja') totalSinSojaAnadido++
        }
      }
    }

    if (cambios.length === 0) {
      sinCambios++
      continue
    }

    detalles.push({
      nombre: receta.nombre,
      id: receta.id,
      actuales,
      nuevos,
      cambios,
    })

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
  console.log(`  📊 Total recetas:                ${recetas.length}`)
  console.log(`  ✅ Sin cambios:                  ${sinCambios}`)
  console.log(`  ${APLICA ? '✅ Corregidas' : '🔍 A corregir'}:                 ${corregidas}`)
  console.log(`  ⚠️  Sin ingredientes (no analiz.): ${sinIngredientes}`)
  console.log('')
  console.log(`  🗑️  "Apto Diabéticos" eliminados:    ${totalAptoDiabeticos}`)
  console.log(`  ➕ "Sin Mariscos" añadidos:          ${totalSinMariscosAnadido}`)
  console.log(`  ➕ "Sin Cerdo" añadidos:             ${totalSinCerdoAnadido}`)
  console.log(`  ➕ "Sin Soja" añadidos:              ${totalSinSojaAnadido}`)

  if (errores.length) {
    console.log(`\n  ❌ Errores: ${errores.length}`)
  }

  // ─── Diagnóstico del bug conocido ─────────────────────────────
  console.log('\n  ─── DIAGNÓSTICO DEL BUG REPORTADO ───')
  console.log('')
  console.log('  🔍 Receta: "Dátiles rellenos de almendra y chocolate negro"')
  console.log('  ❌ Síntoma: mostraba "Sin Mariscos" bajo "Contiene" en la UI')
  console.log('')
  console.log('  ══ CAUSA RAÍZ ════════════════════════════════════════════')
  console.log('  scripts/etiquetar-alergenos.mjs añadió "Sin Mariscos" a las')
  console.log('  recetas, pero ALERGENOS_NEGATIVOS en lib/recetas-constants.ts')
  console.log('  NO incluía este tag. Por tanto clasificarIntolerancia("Sin')
  console.log('  Mariscos") devolvía "positivo" → se mostraba bajo "Contiene".')
  console.log('')
  console.log('  ══ CORRECCIÓN APLICADA ═══════════════════════════════════')
  console.log('  1. lib/recetas-constants.ts → AÑADIDOS "Sin Mariscos" y')
  console.log('     "Sin Cerdo" a ALERGENOS_NEGATIVOS')
  console.log('  2. clasificarIntolerancia() → AHORA detecta CUALQUIER tag')
  console.log('     que empiece con "Sin " como negativo (fallback genérico)')
  console.log('  3. scripts/generar-intolerancias-y-consejos.ts → AÑADIDA')
  console.log('     detección de mariscos, cerdo y soja')
  console.log('  ')
  console.log('  ✅ La corrección en código aplica a TODAS las recetas,')
  console.log('     actuales y futuras. No requiere cambios en datos BD.')
  console.log('')

  if (!APLICA && corregidas > 0) {
    console.log('→ Ejecuta con --aplica para guardar los cambios.')

    // Mostrar preview detallado
    console.log('\n  ─── PREVIEW DE CAMBIOS ───\n')
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
