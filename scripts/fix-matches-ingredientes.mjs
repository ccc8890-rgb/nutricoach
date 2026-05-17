/**
 * fix-matches-ingredientes.mjs
 *
 * Repara los 68 ingredientes con alimento_id incorrecto detectados en auditoría 14-05-2026.
 *
 * Problemas principales:
 *   - aceite de coco → Aceite de oliva 0,4º  (37 casos)
 *   - harina de almendra → Harina De Avena    (4 casos)
 *   - Queso feta → Queso mozzarella           (4 casos)
 *   - proteína en polvo → Barrita Enervit     (6 casos)
 *   - Harina de trigo → Harina De Avena       (3 casos)
 *   - más 14 casos individuales
 *
 * USO:
 *   node scripts/fix-matches-ingredientes.mjs            → dry-run (muestra cambios)
 *   node scripts/fix-matches-ingredientes.mjs --apply    → aplica
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const p = resolve(ROOT, '.env.local')
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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const DRY = !process.argv.includes('--apply')

if (DRY) console.log('🔍 DRY-RUN — usa --apply para ejecutar\n')
else console.log('✏️  APLICANDO CAMBIOS\n')

// ── Paso 1: Obtener IDs de alimentos correctos ya existentes ─────────────────
async function resolverAlimentosExistentes() {
  const busquedas = [
    { key: 'aceite_coco',      query: sb.from('alimentos').select('id,nombre,calorias').ilike('nombre','aceite de coco%').gt('calorias', 800).limit(1) },
    { key: 'queso_feta',       query: sb.from('alimentos').select('id,nombre,calorias').eq('nombre','Queso feta').limit(1) },
    { key: 'mascarpone',       query: sb.from('alimentos').select('id,nombre,calorias').ilike('nombre','%mascarpone%').gt('calorias',300).limit(1) },
    { key: 'proteina_whey',    query: sb.from('alimentos').select('id,nombre,calorias').ilike('nombre','Proteína whey%').limit(1) },
    { key: 'levadura_quimica', query: sb.from('alimentos').select('id,nombre,calorias').ilike('nombre','polvo de hornear').limit(1) },
    { key: 'harina_trigo',     query: sb.from('alimentos').select('id,nombre,calorias').eq('nombre','Harina de trigo').limit(1) },
    { key: 'cornflakes',       query: sb.from('alimentos').select('id,nombre,calorias').ilike('nombre','Cornflakes%').gt('calorias',300).limit(1) },
    { key: 'nata_cocinar',     query: sb.from('alimentos').select('id,nombre,calorias').ilike('nombre','Nata para cocinar%').gt('calorias',100).limit(1) },
    { key: 'aceite_girasol',   query: sb.from('alimentos').select('id,nombre,calorias').or('nombre.ilike.Aceite de girasol%,nombre.ilike.Aceite%girasol%').gt('calorias',800).limit(1) },
    { key: 'ajo_tierno',       query: sb.from('alimentos').select('id,nombre,calorias').ilike('nombre','Ajo tierno%').limit(1) },
    { key: 'calabacin',        query: sb.from('alimentos').select('id,nombre,calorias').ilike('nombre','Calabacín%').limit(1) },
    { key: 'patata',           query: sb.from('alimentos').select('id,nombre,calorias').ilike('nombre','Patata%').limit(1) },
  ]

  const resultados = {}
  for (const { key, query } of busquedas) {
    const { data } = await query
    if (data?.[0]) {
      resultados[key] = data[0]
      console.log(`  ✅ ${key}: "${data[0].nombre}" (${data[0].calorias} kcal) [${data[0].id.substring(0,8)}...]`)
    } else {
      console.log(`  ⚠️  ${key}: NO encontrado`)
    }
  }
  return resultados
}

// ── Paso 2: Crear alimentos que faltan ───────────────────────────────────────
async function crearAlimentosFaltantes(existentes) {
  const faltantes = []

  if (!existentes.harina_almendra) {
    faltantes.push({
      nombre: 'Harina de almendra',
      calorias: 602, proteinas: 21.4, carbohidratos: 9.8, grasas: 52.0, fibra: 10.5,
      categoria: 'Harinas y cereales', fuente: 'curada'
    })
  }
  if (!existentes.crema_avellanas) {
    faltantes.push({
      nombre: 'Crema de avellanas (sin azúcar)',
      calorias: 628, proteinas: 14.0, carbohidratos: 14.0, grasas: 61.0, fibra: 9.0,
      categoria: 'Frutos secos y semillas', fuente: 'curada'
    })
  }
  if (!existentes.mantequilla_cacahuete) {
    faltantes.push({
      nombre: 'Mantequilla de cacahuete (natural)',
      calorias: 588, proteinas: 25.0, carbohidratos: 20.0, grasas: 50.0, fibra: 6.0,
      categoria: 'Frutos secos y semillas', fuente: 'curada'
    })
  }
  if (!existentes.yogur_proteina) {
    faltantes.push({
      nombre: 'Yogur de proteína (alto en proteínas)',
      calorias: 72, proteinas: 10.0, carbohidratos: 5.0, grasas: 0.5, fibra: 0,
      categoria: 'Lácteos', fuente: 'curada'
    })
  }
  if (!existentes.salsa_barbacoa) {
    faltantes.push({
      nombre: 'Salsa barbacoa',
      calorias: 90, proteinas: 1.0, carbohidratos: 22.0, grasas: 0.5, fibra: 0.5,
      categoria: 'Salsas y condimentos', fuente: 'curada'
    })
  }

  if (faltantes.length === 0) {
    console.log('\n  ✅ No hay alimentos nuevos que crear')
    return existentes
  }

  console.log(`\n  📝 Alimentos a crear: ${faltantes.length}`)
  const nuevos = { ...existentes }

  for (const alim of faltantes) {
    console.log(`  ${DRY ? '🔍' : '➕'} Crear: "${alim.nombre}" (${alim.calorias} kcal)`)
    if (!DRY) {
      const { data, error } = await sb.from('alimentos').insert(alim).select('id,nombre').single()
      if (error) { console.log(`     ❌ Error: ${error.message}`); continue }
      console.log(`     ✅ Creado: ${data.id.substring(0,8)}...`)

      // Mapear a clave para uso posterior
      if (alim.nombre.includes('almendra')) nuevos.harina_almendra = data
      if (alim.nombre.includes('avellanas')) nuevos.crema_avellanas = data
      if (alim.nombre.includes('cacahuete')) nuevos.mantequilla_cacahuete = data
      if (alim.nombre.includes('proteína') && alim.nombre.includes('Yogur')) nuevos.yogur_proteina = data
      if (alim.nombre.includes('barbacoa')) nuevos.salsa_barbacoa = data
    }
  }
  return nuevos
}

// ── Paso 3: Definir y aplicar los re-links ───────────────────────────────────
function construirRelinks(ids) {
  return [
    // ── aceite de coco (37 casos — la mayoría) ──────────────────────────────
    { patron: 'aceite de coco',      alimento_key: 'aceite_coco',       exacto: false },
    { patron: 'Aceite de coco',      alimento_key: 'aceite_coco',       exacto: false },
    { patron: 'Aceite vegetal',      alimento_key: 'aceite_girasol',    exacto: true  },

    // ── harinas ─────────────────────────────────────────────────────────────
    { patron: 'harina de almendra',  alimento_key: 'harina_almendra',   exacto: false },
    { patron: 'Harina de almendra',  alimento_key: 'harina_almendra',   exacto: false },
    { patron: 'harina de trigo',     alimento_key: 'harina_trigo',      exacto: false },
    { patron: 'Harina de trigo',     alimento_key: 'harina_trigo',      exacto: false },

    // ── quesos ──────────────────────────────────────────────────────────────
    { patron: 'Queso feta',          alimento_key: 'queso_feta',        exacto: false },
    { patron: 'queso feta',          alimento_key: 'queso_feta',        exacto: false },
    { patron: 'queso mascarpone',    alimento_key: 'mascarpone',        exacto: false },
    { patron: 'Queso mascarpone',    alimento_key: 'mascarpone',        exacto: false },

    // ── proteínas en polvo ──────────────────────────────────────────────────
    { patron: 'proteína en polvo',   alimento_key: 'proteina_whey',     exacto: false },
    { patron: 'Proteína en polvo',   alimento_key: 'proteina_whey',     exacto: false },
    { patron: 'Proteína de suero',   alimento_key: 'proteina_whey',     exacto: false },

    // ── levadura / polvo de hornear ──────────────────────────────────────────
    { patron: 'polvo de hornear',    alimento_key: 'levadura_quimica',  exacto: false },
    { patron: 'Polvo de hornear',    alimento_key: 'levadura_quimica',  exacto: false },

    // ── nata / crema de leche ────────────────────────────────────────────────
    { patron: 'Crema de leche',      alimento_key: 'nata_cocinar',      exacto: false },
    { patron: 'crema de leche',      alimento_key: 'nata_cocinar',      exacto: false },
    { patron: 'nata para cocinar',   alimento_key: 'nata_cocinar',      exacto: false },

    // ── yogur de proteína ────────────────────────────────────────────────────
    { patron: 'Yogur de proteína',   alimento_key: 'yogur_proteina',    exacto: false },
    { patron: 'yogur de proteína',   alimento_key: 'yogur_proteina',    exacto: false },
    { patron: 'yogur proteico',      alimento_key: 'yogur_proteina',    exacto: false },

    // ── salsas ───────────────────────────────────────────────────────────────
    { patron: 'Salsa barbacoa',      alimento_key: 'salsa_barbacoa',    exacto: false },
    { patron: 'salsa barbacoa',      alimento_key: 'salsa_barbacoa',    exacto: false },

    // ── crema de avellanas ───────────────────────────────────────────────────
    { patron: 'crema de avellana',   alimento_key: 'crema_avellanas',   exacto: false },
    { patron: 'Crema de avellana',   alimento_key: 'crema_avellanas',   exacto: false },

    // ── pasta/mantequilla de maní / cacahuete ────────────────────────────────
    { patron: 'pasta de maní',       alimento_key: 'mantequilla_cacahuete', exacto: false },
    { patron: 'mantequilla de maní', alimento_key: 'mantequilla_cacahuete', exacto: false },
    { patron: 'pasta de cacahuete',  alimento_key: 'mantequilla_cacahuete', exacto: false },

    // ── ingredientes en latín/anglicismo que ya existen bien ────────────────
    { patron: 'ajetes',              alimento_key: 'ajo_tierno',        exacto: false },
    { patron: 'ajete',               alimento_key: 'ajo_tierno',        exacto: false },
    { patron: 'zucchini',            alimento_key: 'calabacin',         exacto: false },
    { patron: 'papa',                alimento_key: 'patata',            exacto: true  },

    // ── cornflakes ───────────────────────────────────────────────────────────
    { patron: 'Cornflakes sin azúcar', alimento_key: 'cornflakes',      exacto: false },
  ]
}

async function aplicarRelinks(ids) {
  const relinks = construirRelinks(ids)
  let totalFixes = 0

  for (const { patron, alimento_key, exacto } of relinks) {
    const alimento = ids[alimento_key]
    if (!alimento) {
      console.log(`  ⏭️  Saltando "${patron}" — alimento "${alimento_key}" no disponible`)
      continue
    }

    // Buscar receta_ingredientes que coincidan
    let query = sb.from('receta_ingredientes').select('id, nombre_libre, receta_id')
    if (exacto) {
      query = query.eq('nombre_libre', patron)
    } else {
      query = query.ilike('nombre_libre', `%${patron}%`)
    }

    const { data: filas } = await query
    if (!filas?.length) continue

    console.log(`\n  ${DRY ? '🔍' : '✏️'} "${patron}" → "${alimento.nombre}" (${alimento.calorias} kcal)`)
    console.log(`     ${filas.length} ingrediente/s a actualizar`)

    if (!DRY) {
      const ids_a_actualizar = filas.map(f => f.id)
      const { error } = await sb.from('receta_ingredientes')
        .update({ alimento_id: alimento.id })
        .in('id', ids_a_actualizar)
      if (error) console.log(`     ❌ Error: ${error.message}`)
      else { console.log(`     ✅ Actualizado`); totalFixes += filas.length }
    } else {
      totalFixes += filas.length
    }
  }
  return totalFixes
}

// ── Paso 4: Recalcular macros para recetas afectadas ─────────────────────────
async function recalcularMacrosAfectadas() {
  // Obtener recetas que tenían ingredientes con los patrones problemáticos
  const patrones = ['aceite de coco', 'Aceite de coco', 'harina de almendra', 'Harina de almendra',
    'Queso feta', 'queso feta', 'queso mascarpone', 'proteína en polvo', 'Proteína en polvo',
    'Proteína de suero', 'polvo de hornear', 'Crema de leche', 'Yogur de proteína',
    'Salsa barbacoa', 'crema de avellana', 'Crema de avellana', 'pasta de maní',
    'Cornflakes sin azúcar', 'harina de trigo', 'Harina de trigo', 'ajetes', 'zucchini']

  const { data: ings } = await sb.from('receta_ingredientes')
    .select('receta_id')
    .or(patrones.map(p => `nombre_libre.ilike.%${p}%`).join(','))

  if (!ings?.length) return

  const recetaIds = [...new Set(ings.map(i => i.receta_id))]
  console.log(`\n  📊 Recalculando macros para ${recetaIds.length} recetas afectadas...`)

  for (const receta_id of recetaIds) {
    const { data: receta } = await sb.from('recetas').select('nombre, porciones').eq('id', receta_id).single()
    const porciones = receta?.porciones || 1

    const { data: ings } = await sb.from('receta_ingredientes')
      .select('cantidad_gramos, alimentos(calorias, proteinas, carbohidratos, grasas, fibra)')
      .eq('receta_id', receta_id)

    let kcal = 0, prot = 0, carb = 0, gras = 0, fib = 0
    for (const i of (ings || [])) {
      const g = i.cantidad_gramos || 0
      const a = i.alimentos
      if (!a) continue
      kcal += (a.calorias || 0) * g / 100
      prot += (a.proteinas || 0) * g / 100
      carb += (a.carbohidratos || 0) * g / 100
      gras += (a.grasas || 0) * g / 100
      fib  += (a.fibra || 0) * g / 100
    }

    const pesoTotal = (ings || []).reduce((s, i) => s + (i.cantidad_gramos || 0), 0)
    const macros = {
      kcal:          Math.round(kcal / porciones * 10) / 10,
      proteinas:     Math.round(prot / porciones * 10) / 10,
      carbohidratos: Math.round(carb / porciones * 10) / 10,
      grasas:        Math.round(gras / porciones * 10) / 10,
      fibra:         Math.round(fib / porciones * 10) / 10,
      kcal_100g:     pesoTotal > 0 ? Math.round(kcal / pesoTotal * 100 * 10) / 10 : 0,
      peso_total_g:  Math.round(pesoTotal),
    }

    console.log(`  ${DRY ? '🔍' : '✅'} ${receta?.nombre}: ${macros.kcal} kcal | P:${macros.proteinas}g | C:${macros.carbohidratos}g | G:${macros.grasas}g`)

    if (!DRY) {
      await sb.from('recetas').update(macros).eq('id', receta_id)
    }
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔧 Fix matches ingredientes — auditoría 14-05-2026\n')

  console.log('1️⃣  Localizando alimentos correctos en BD...')
  const ids = await resolverAlimentosExistentes()

  console.log('\n2️⃣  Creando alimentos faltantes...')
  const idsCompletos = await crearAlimentosFaltantes(ids)

  // Si no se crearon (dry-run), simular con placeholders para el informe
  if (DRY) {
    if (!idsCompletos.aceite_girasol)        idsCompletos.aceite_girasol        = { id: 'NUEVO', nombre: 'Aceite de girasol', calorias: 884 }
    if (!idsCompletos.harina_almendra)       idsCompletos.harina_almendra       = { id: 'NUEVO', nombre: 'Harina de almendra', calorias: 602 }
    if (!idsCompletos.crema_avellanas)       idsCompletos.crema_avellanas       = { id: 'NUEVO', nombre: 'Crema de avellanas', calorias: 628 }
    if (!idsCompletos.mantequilla_cacahuete) idsCompletos.mantequilla_cacahuete = { id: 'NUEVO', nombre: 'Mantequilla de cacahuete', calorias: 588 }
    if (!idsCompletos.yogur_proteina)        idsCompletos.yogur_proteina        = { id: 'NUEVO', nombre: 'Yogur de proteína', calorias: 72 }
    if (!idsCompletos.salsa_barbacoa)        idsCompletos.salsa_barbacoa        = { id: 'NUEVO', nombre: 'Salsa barbacoa', calorias: 90 }
  }

  console.log('\n3️⃣  Aplicando re-links de ingredientes...')
  const totalFixes = await aplicarRelinks(idsCompletos)

  console.log('\n4️⃣  Recalculando macros...')
  await recalcularMacrosAfectadas()

  console.log(`\n${'─'.repeat(50)}`)
  if (DRY) {
    console.log(`✅ DRY-RUN completado — ${totalFixes} ingredientes a corregir`)
    console.log('   Para aplicar: node scripts/fix-matches-ingredientes.mjs --apply')
  } else {
    console.log(`✅ ${totalFixes} ingredientes corregidos`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
