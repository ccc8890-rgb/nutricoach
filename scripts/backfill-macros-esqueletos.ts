// scripts/backfill-macros-esqueletos.ts
// Para las recetas generadas hoy desde esqueletos que tienen kcal=null,
// intenta linkear ingredientes del esqueleto a la tabla alimentos
// y calcular macros por porción.

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { TODOS_LOS_ESQUELETOS } from '../lib/recetas/esqueletos/index'
import type { Esqueleto } from '../lib/recetas/esqueletos/types'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DRY_RUN = !process.argv.includes('--apply')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

// ── Tipos ─────────────────────────────────────────────────────────

type AlimentoDB = {
  id: string
  nombre: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

type IngredienteResuelto = {
  receta_id: string
  alimento_id: string
  nombre_libre: string
  cantidad_gramos: number
  rol_ingrediente: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

// ── Buscar alimento por nombre ─────────────────────────────────────

async function buscarAlimento(nombre: string): Promise<AlimentoDB | null> {
  // Nivel 1: match exacto ilike
  const { data: exacto } = await db
    .from('alimentos')
    .select('id, nombre, calorias, proteinas, carbohidratos, grasas')
    .ilike('nombre', nombre)
    .eq('es_comestible', true)
    .gt('calorias', 0)
    .order('nombre')
    .limit(1)

  if (exacto?.[0]) return exacto[0]

  // Nivel 2: búsqueda por palabras significativas (>3 chars)
  const palabras = nombre.toLowerCase()
    .replace(/[áéíóú]/g, (c) => ({ á:'a',é:'e',í:'i',ó:'o',ú:'u' }[c] ?? c))
    .split(/\s+/)
    .filter(w => w.length > 3)

  for (const w of palabras) {
    const { data } = await db
      .from('alimentos')
      .select('id, nombre, calorias, proteinas, carbohidratos, grasas')
      .ilike('nombre', `%${w}%`)
      .eq('es_comestible', true)
      .gt('calorias', 0)
      .order('nombre')
      .limit(1)

    if (data?.[0]) return data[0]
  }

  return null
}

// ── Calcular macros por porción ───────────────────────────────────

function calcularMacros(
  ingredientes: IngredienteResuelto[],
  porciones: number,
): { kcal: number; proteinas: number; carbohidratos: number; grasas: number } {
  let kcal = 0, prot = 0, carbs = 0, grasas = 0

  for (const ing of ingredientes) {
    const factor = ing.cantidad_gramos / 100
    kcal   += ing.calorias      * factor
    prot   += ing.proteinas     * factor
    carbs  += ing.carbohidratos * factor
    grasas += ing.grasas        * factor
  }

  const p = Math.max(porciones, 1)
  return {
    kcal:           Math.round(kcal   / p),
    proteinas:      Math.round(prot   / p),
    carbohidratos:  Math.round(carbs  / p),
    grasas:         Math.round(grasas / p),
  }
}

// ── Encontrar esqueleto que mejor encaja con la receta ────────────

function encontrarEsqueleto(
  receta: { tipo_plato: string; tags: string[] },
): Esqueleto | null {
  const tags = new Set(receta.tags ?? [])

  // PERFILES en orden de prioridad (tal como los inserta el generador)
  const PERFILES = ['perdida_grasa', 'rendimiento', 'patologia'] as const
  const perfil = PERFILES.find(p => tags.has(p)) ?? null

  if (!perfil) return null

  // Filtrar esqueletos por perfil + tipoPlato
  const candidatos = TODOS_LOS_ESQUELETOS.filter(
    e => e.perfil === perfil && e.tipoPlato === receta.tipo_plato,
  )

  if (candidatos.length === 0) return null
  if (candidatos.length === 1) return candidatos[0]

  // Con múltiples candidatos: elegir el que tenga más momentos en común con los tags
  let mejorScore = -1
  let mejor: Esqueleto | null = null

  for (const e of candidatos) {
    const score = e.metadatos.momentos.filter(m => tags.has(m)).length
    if (score > mejorScore) {
      mejorScore = score
      mejor = e
    }
  }

  return mejor
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Backfill macros desde esqueletos ===`)
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (usar --apply para guardar)' : 'APPLY'}`)

  // Verificar columnas reales de receta_ingredientes
  const { data: sampleRow } = await db.from('receta_ingredientes').select('*').limit(1)
  const cols = Object.keys(sampleRow?.[0] ?? {})
  const tieneRol = cols.includes('rol_ingrediente')
  console.log(`\nColumnas de receta_ingredientes: ${cols.join(', ')}`)
  console.log(`Soporta rol_ingrediente: ${tieneRol}`)

  // Recetas de hoy con kcal null (creadas por generar-recetas-desde-esqueletos)
  const hoy = new Date().toISOString().split('T')[0]
  const { data: sinMacros, error } = await db
    .from('recetas')
    .select('id, nombre, tipo_plato, tags, porciones, estado')
    .gte('created_at', hoy)
    .is('kcal', null)

  if (error) {
    console.error('Error al consultar recetas:', error.message)
    process.exit(1)
  }

  console.log(`\nRecetas hoy sin kcal: ${sinMacros?.length ?? 0}`)
  console.log()

  let ok = 0, skip = 0, errCount = 0

  for (const receta of sinMacros ?? []) {
    // Encontrar esqueleto correspondiente
    const esqueleto = encontrarEsqueleto(receta)

    if (!esqueleto) {
      console.log(`  SKIP: "${receta.nombre}" — sin esqueleto para perfil+tipo`)
      skip++
      continue
    }

    console.log(`  Procesando: "${receta.nombre}"`)
    console.log(`    Esqueleto: ${esqueleto.id} (${esqueleto.ingredientes.length} ingredientes)`)

    // Resolver ingredientes del esqueleto contra la tabla alimentos
    const ingredientesResueltos: IngredienteResuelto[] = []

    for (const ing of esqueleto.ingredientes) {
      const alimento = await buscarAlimento(ing.nombre)
      if (alimento) {
        ingredientesResueltos.push({
          receta_id:        receta.id,
          alimento_id:      alimento.id,
          nombre_libre:     ing.nombre,
          cantidad_gramos:  ing.gramos,
          rol_ingrediente:  ing.rol,
          calorias:         alimento.calorias,
          proteinas:        alimento.proteinas,
          carbohidratos:    alimento.carbohidratos,
          grasas:           alimento.grasas,
        })
      } else {
        console.log(`    Sin match: "${ing.nombre}"`)
      }
    }

    if (ingredientesResueltos.length < 2) {
      console.log(`    SKIP: solo ${ingredientesResueltos.length} ingredientes resueltos — insuficiente`)
      skip++
      continue
    }

    console.log(`    Matches: ${ingredientesResueltos.length}/${esqueleto.ingredientes.length}`)

    const macros = calcularMacros(ingredientesResueltos, receta.porciones ?? 1)
    console.log(`    Macros: ${macros.kcal} kcal | ${macros.proteinas}g P | ${macros.carbohidratos}g C | ${macros.grasas}g G`)

    if (!DRY_RUN) {
      try {
        // Limpiar ingredientes existentes (por si hay restos vacíos)
        await db.from('receta_ingredientes').delete().eq('receta_id', receta.id)

        // Insertar ingredientes resueltos (solo columnas que existen en la tabla)
        // El constraint de rol_ingrediente no acepta todos los valores del esqueleto.
        // Mapeamos los rechazados a su equivalente permitido.
        const ROL_MAP: Record<string, string | null> = {
          proteina_secundaria: 'proteina_principal',
          lacteo_base:         null,  // null = sin rol, siempre permitido
        }

        const toInsert = ingredientesResueltos.map(({ calorias, proteinas, carbohidratos, grasas, ...rest }) => {
          const base: Record<string, unknown> = {
            receta_id:       rest.receta_id,
            alimento_id:     rest.alimento_id,
            nombre_libre:    rest.nombre_libre,
            cantidad_gramos: rest.cantidad_gramos,
          }
          if (tieneRol) {
            const rol = rest.rol_ingrediente in ROL_MAP
              ? ROL_MAP[rest.rol_ingrediente]
              : rest.rol_ingrediente
            base.rol_ingrediente = rol ?? null
          }
          return base
        })

        const { error: insError } = await db.from('receta_ingredientes').insert(toInsert)
        if (insError) throw new Error(insError.message)

        // Actualizar macros en la receta
        const { error: updError } = await db
          .from('recetas')
          .update(macros)
          .eq('id', receta.id)

        if (updError) throw new Error(updError.message)

        console.log(`    OK: guardado en BD`)
        ok++
      } catch (e: unknown) {
        console.log(`    ERROR: ${e instanceof Error ? e.message : String(e)}`)
        errCount++
      }
    } else {
      console.log(`    [DRY-RUN: no se guarda]`)
      ok++
    }

    // Pausa entre recetas para no saturar Supabase
    await new Promise(r => setTimeout(r, 100))
    console.log()
  }

  // Resumen final
  console.log(`\n=== Resumen ===`)
  console.log(`  Procesadas con macros: ${ok}`)
  console.log(`  Saltadas (sin esqueleto/matches): ${skip}`)
  console.log(`  Errores: ${errCount}`)
  console.log(`  Total: ${sinMacros?.length ?? 0}`)

  if (DRY_RUN) {
    console.log(`\n  Usa --apply para guardar en BD`)
  }

  // Verificación final
  if (!DRY_RUN) {
    const { count: totalSinMacros } = await db
      .from('recetas')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', hoy)
      .is('kcal', null)

    const { count: totalConMacros } = await db
      .from('recetas')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', hoy)
      .gt('kcal', 0)

    console.log(`\n  Estado final hoy:`)
    console.log(`    Con kcal > 0: ${totalConMacros}`)
    console.log(`    Aún sin kcal: ${totalSinMacros}`)
  }
}

main().catch(console.error)
