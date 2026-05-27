/**
 * Script para importar lotes de recetas DeepSeek a Supabase.
 * Divide en tandas de 20 (límite del normalizador).
 * Normaliza tipo_plato según categoría (check constraint existente).
 *
 * Valores permitidos en tipo_plato: Almuerzo|Cena|Comida|Desayuno|Merienda|Postre|Snack|null
 *
 * Uso:
 *   npx tsx scripts/importar-lote-deepseek.ts [archivo.json]
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizarRecetasGeneradas } from '../lib/recetas/importar-lote'

// ── Cargar .env.local manualmente ─────────────────────────────
const ENV_LOCAL = resolve(process.cwd(), '.env.local')
function loadEnvLocal() {
  if (!existsSync(ENV_LOCAL)) {
    console.error(`❌ No se encuentra .env.local en ${ENV_LOCAL}`)
    process.exit(1)
  }
  const lines = readFileSync(ENV_LOCAL, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}
loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const COACH_ID = process.env.NUTRICOACH_COACH_ID

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!COACH_ID) {
  console.error('❌ Falta NUTRICOACH_COACH_ID en .env.local')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

// Mapeo de categoría a tipo_plato permitido por check constraint
function categoriaATipoPlato(categoria: string | null): string | null {
  const cat = (categoria ?? '').trim()
  if (!cat) return null
  // Los valores permitidos son: Almuerzo|Cena|Comida|Desayuno|Merienda|Postre|Snack
  const map: Record<string, string> = {
    'comida': 'Comida',
    'cena': 'Cena',
    'desayuno': 'Desayuno',
    'postre': 'Postre',
    'merienda': 'Merienda',
    'snack': 'Snack',
    'almuerzo': 'Almuerzo',
  }
  return map[cat.toLowerCase()] ?? null
}

function formatearInstrucciones(instrucciones: string | null) {
  if (!instrucciones) return instrucciones
  return instrucciones
    .replace(/\s+(\d+[\.)]\s+)/g, '\n$1')
    .replace(/^\n+/, '')
    .trim()
}

function normalizarIngredienteAlias(nombre: string) {
  const n = nombre.toLowerCase()
  if (n === 'aove' || n.includes('aove en spray') || n.includes('aceite de oliva virgen extra')) return 'Aceite de oliva virgen extra'
  if (n.includes('pan integral de molde') || n.includes('pan integral en cubos')) return 'Pan integral'
  if (n.includes('pan rallado integral')) return 'Pan rallado'
  if (n.includes('piña natural')) return 'Piña natural'
  if (n.includes('pollo cocido desmenuzado') || n.includes('pollo troceado')) return 'Pechuga de pollo'
  if (n.includes('wrap de trigo integral')) return 'Tortilla de Trigo'
  if (n.includes('plátano congelado') || n.includes('platano congelado')) return 'Plátano'
  if (n.includes('setas variadas')) return 'Champiñón'
  if (n.includes('calabacín') || n.includes('calabacin')) return 'Calabacín crudo'
  if (n.includes('proteína whey')) return 'Proteína whey (polvo)'
  return nombre
}

async function main() {
  // Si se pasa argumento, usarlo tal cual (ruta relativa al CWD).
  // Si no, default al archivo original de 31 recetas.
  const fileArg = process.argv[2] || 'scripts/deepseek-lote-perdida-grasa.json'
  const filePath = fileArg.startsWith('/') ? fileArg : resolve(process.cwd(), fileArg)
  console.log(`📁 Leyendo: ${filePath}`)
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
  const recetasRaw = Array.isArray(raw.recetas) ? raw.recetas : Array.isArray(raw) ? raw : []
  console.log(`📦 Total recetas a importar: ${recetasRaw.length}`)

  // Dividir el RAW en tandas de 20. normalizarRecetasGeneradas limita a 20 por seguridad.
  const tandasRaw: unknown[][] = []
  for (let i = 0; i < recetasRaw.length; i += 20) {
    tandasRaw.push(recetasRaw.slice(i, i + 20))
  }
  console.log(`📦 Dividido en ${tandasRaw.length} tanda(s)`)

  let totalCreadas = 0
  let totalErrores = 0

  for (let t = 0; t < tandasRaw.length; t++) {
    const tandaRaw = tandasRaw[t]
    const rawPorNombre = new Map(
      tandaRaw
        .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
        .map(r => [String(r.nombre ?? '').trim().toLowerCase(), r])
    )
    const tanda = normalizarRecetasGeneradas(tandaRaw).map(r => ({
      ...r,
      tipo_plato: categoriaATipoPlato(r.categoria),
      instrucciones: formatearInstrucciones(r.instrucciones),
      ingredientes: r.ingredientes.map(ing => ({
        ...ing,
        nombre_libre: normalizarIngredienteAlias(ing.nombre_libre),
      })),
    }))
    console.log(`\n📋 Tanda ${t + 1}/${tandasRaw.length}: ${tanda.length} recetas`)

    for (const receta of tanda) {
      const { ingredientes, ...recetaBase } = receta
      const rawReceta = rawPorNombre.get(receta.nombre.toLowerCase())
      const { data, error } = await db
        .from('recetas')
        .insert({
          ...recetaBase,
          coach_id: COACH_ID,
          estado: 'en_revision',
          fuente: 'ia_lote_deepseek',
          fuente_tipo: 'ia_generada',
          intolerancias: Array.isArray(rawReceta?.intolerancias) ? rawReceta.intolerancias : [],
          taxonomia_version: 2,
          taxonomia_actualizada_at: new Date().toISOString(),
          imagen_estado: 'sin_imagen',
          imagen_origen: 'missing',
          imagen_needs_review: true,
          imagen_prompt_base: typeof rawReceta?.imagen_prompt === 'string' ? rawReceta.imagen_prompt : null,
          imagen_review_notes: 'Receta nueva generada por lote DeepSeek. Requiere imagen realista o revisión antes de aprobar.',
        })
        .select('id, nombre')
        .single()

      if (error || !data) {
        console.error(`  ❌ [${receta.nombre}] ${error?.message}`)
        totalErrores++
        continue
      }

      if (ingredientes.length > 0) {
        const { error: ingError } = await db
          .from('receta_ingredientes')
          .insert(ingredientes.map((ing) => ({
            receta_id: data.id,
            alimento_id: null,
            nombre_libre: ing.nombre_libre,
            cantidad_gramos: ing.cantidad_gramos,
            orden: ing.orden,
          })))

        if (ingError) {
          console.error(`  ⚠️ "${receta.nombre}" ingredientes fallaron: ${ingError.message}`)
        }
      }

      console.log(`  ✅ "${receta.nombre}" → ${data.id}`)
      totalCreadas++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`✅ Importación completada`)
  console.log(`   Creadas: ${totalCreadas}`)
  console.log(`   Errores: ${totalErrores}`)
  console.log(`   Pendiente: node scripts/quality-gate-recetas.mjs --todas`)
  console.log('='.repeat(50))
}

main().catch(console.error)
