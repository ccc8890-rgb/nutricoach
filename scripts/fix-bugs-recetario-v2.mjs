/**
 * fix-bugs-recetario-v2.mjs
 *
 * Corrige bugs de ingredientes mal vinculados:
 * BUG 1: huevos crudos (huevos) -> Huevos cocidos (debe: Huevo entero)
 * BUG 2: Brownie 3 chocolates - Chocolate negro -> Fresas Chocolate (producto erroneo)
 * BUG 3: Brownie - Chocolate con leche (decorar) -> Leche (liquida)
 * BUG 4: datil medjool huerfano en "Datiles rellenos de almendra y chocolate negro"
 * BUG 5: Dulce de Leche - leche condensada light -> Leche condensada (entera)
 * BUG 6: Ingredientes huerfanos de chocolate en Brownie
 *
 * USO: node scripts/fix-bugs-recetario-v2.mjs        (dry run)
 *      node scripts/fix-bugs-recetario-v2.mjs --apply (aplicar cambios)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')
const APPLY = process.argv.includes('--apply')

function loadEnv() {
  const envPath = resolve(RAÍZ, '.env.local')
  if (!envPath) return
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (m) process.env[m[1].trim()] = m[2].replace(/^["']|["']$/g, '').trim()
  }
}
loadEnv()

async function findAlimento(sb, patron, excludePatterns = []) {
  const { data } = await sb
    .from('alimentos')
    .select('id,nombre,calorias,categoria')
    .ilike('nombre', patron)
    .order('calorias', { ascending: false })

  if (!data || data.length === 0) return null

  // Filter out excluded patterns
  let filtered = data
  for (const ex of excludePatterns) {
    filtered = filtered.filter(a => !a.nombre.toLowerCase().includes(ex.toLowerCase()))
  }

  if (filtered.length === 0) return data[0]
  return filtered[0]
}

function log(msg) {
  console.log('  ' + msg)
}

function ok(msg) {
  console.log('  OK ' + msg)
}

function bug(msg) {
  console.log('  BUG ' + msg)
}

function warn(msg) {
  console.log('  WARN ' + msg)
}

function fix(msg) {
  console.log('  FIX ' + msg)
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  // Resolve alimentos de referencia dinamicamente
  const huevoEntero = await findAlimento(sb, 'Huevo entero%', ['L'])
  const huevosCocidos = await findAlimento(sb, 'Huevos cocidos')
  const huevoCamperoCocido = await findAlimento(sb, 'Huevo Campero Cocido%')
  const chocolateNegro85 = await findAlimento(sb, 'Chocolate negro 85%')
  const chocolateBlancoPostres = await findAlimento(sb, '%chocolate blanco%postres%')
  const chocolateConLecheMilka = await findAlimento(sb, '%chocolate con leche milka%')
  const datilesMedjool = await findAlimento(sb, '%dátiles medjool%') || await findAlimento(sb, '%datiles%medjool%')
  const lecheCondensadaDesnatada = await findAlimento(sb, '%leche condensada desnatada%')

  console.log('========================================')
  console.log('  FIX BUGS RECETARIO v2')
  console.log('  Modo: ' + (APPLY ? 'APLICANDO' : 'DRY RUN'))
  console.log('========================================\n')

  // Verificar alimentos de referencia
  console.log('Alimentos de referencia:')
  for (const [name, val] of Object.entries({
    huevoEntero, huevosCocidos, huevoCamperoCocido,
    chocolateNegro85, chocolateBlancoPostres, chocolateConLecheMilka,
    datilesMedjool, lecheCondensadaDesnatada
  })) {
    if (val) {
      ok(name + ': "' + val.nombre + '" (' + val.calorias + ' kcal) [id: ' + val.id + ']')
    } else {
      warn(name + ': NO ENCONTRADO')
    }
  }

  // ===========================================================
  // BUG 1: Huevos crudos -> Huevos cocidos
  // ===========================================================
  console.log('\n========================================')
  console.log('BUG 1: huevos crudos -> Huevos cocidos')
  console.log('========================================')

  const cocidosIds = [huevosCocidos?.id, huevoCamperoCocido?.id].filter(Boolean)
  if (cocidosIds.length > 0) {
    const { data: bug1Ings } = await sb
      .from('receta_ingredientes')
      .select('id,nombre_libre,cantidad_gramos,receta_id')
      .in('alimento_id', cocidosIds)

    let nBug = 0
    let nOk = 0

    for (const ing of bug1Ings || []) {
      const { data: r } = await sb
        .from('recetas')
        .select('nombre,instrucciones')
        .eq('id', ing.receta_id)
        .single()

      const nomR = (r?.nombre || '').toLowerCase()
      const nomI = (ing.nombre_libre || '').toLowerCase()
      const instr = (r?.instrucciones || '').toLowerCase()

      const esCorrecto =
        nomR.includes('cocido') || nomR.includes('huevo duro') ||
        nomR.includes('salmorejo') || nomR.includes('ensalada') ||
        nomR.includes('mayonesa') ||
        nomI.includes('cocido') || nomI.includes('duro') ||
        instr.includes('cocer los huevos') || instr.includes('cocer huevos')

      if (esCorrecto) {
        ok('"' + r?.nombre + '" - ' + ing.nombre_libre + ' (correcto, la receta pide huevo cocido)')
        nOk++
        continue
      }

      bug('"' + r?.nombre + '" | ' + ing.nombre_libre + ' ' + ing.cantidad_gramos + 'g -> Huevos cocidos (debe: Huevo entero)')
      nBug++

      if (APPLY && huevoEntero) {
        const { error } = await sb
          .from('receta_ingredientes')
          .update({ alimento_id: huevoEntero.id })
          .eq('id', ing.id)
        if (error) log('  ERROR: ' + error.message)
        else fix('Corregido -> Huevo entero')
      }
    }

    console.log('')
    log('Total: ' + (bug1Ings?.length || 0) + ' ingredientes')
    log('Correctos (saltados): ' + nOk)
    log('Bugs: ' + nBug)
  }

  // ===========================================================
  // BUG 2+3: Brownie de 3 chocolates
  // ===========================================================
  console.log('\n========================================')
  console.log('BUG 2+3: Brownie de 3 chocolates')
  console.log('========================================')

  const { data: brownie } = await sb
    .from('recetas')
    .select('id,nombre,kcal')
    .ilike('nombre', 'Brownie de 3 chocolates')
    .single()

  if (brownie) {
    log('Receta: ' + brownie.nombre + ' (' + brownie.kcal + ' kcal)')

    const { data: brownieIngs } = await sb
      .from('receta_ingredientes')
      .select('id,nombre_libre,cantidad_gramos,alimento_id')
      .eq('receta_id', brownie.id)

    for (const ing of brownieIngs || []) {
      const n = (ing.nombre_libre || '').toLowerCase().trim()

      // Chocolate negro mal vinculado
      if (n === 'chocolate negro' && ing.alimento_id) {
        const { data: a } = await sb.from('alimentos').select('nombre').eq('id', ing.alimento_id).single()
        if (a && a.nombre.toLowerCase().includes('fresas')) {
          bug('"' + ing.nombre_libre + '" ' + ing.cantidad_gramos + 'g -> "' + a.nombre + '" (producto de fresas, no chocolate)')
          if (chocolateNegro85) {
            log('  Deberia: "' + chocolateNegro85.nombre + '" (' + chocolateNegro85.calorias + ' kcal)')
            if (APPLY) {
              const { error } = await sb.from('receta_ingredientes').update({ alimento_id: chocolateNegro85.id }).eq('id', ing.id)
              if (error) log('  ERROR: ' + error.message)
              else fix('Corregido')
            }
          }
        }
      }

      // Chocolate con leche (decorar) -> Leche
      if (n === 'chocolate con leche (para decorar)' && ing.alimento_id) {
        const { data: a } = await sb.from('alimentos').select('nombre').eq('id', ing.alimento_id).single()
        if (a && a.nombre.toLowerCase() === 'leche') {
          bug('"' + ing.nombre_libre + '" ' + ing.cantidad_gramos + 'g -> "' + a.nombre + '" (leche liquida, no chocolate)')
          if (chocolateConLecheMilka) {
            log('  Deberia: "' + chocolateConLecheMilka.nombre + '" (' + chocolateConLecheMilka.calorias + ' kcal)')
            if (APPLY) {
              const { error } = await sb.from('receta_ingredientes').update({ alimento_id: chocolateConLecheMilka.id }).eq('id', ing.id)
              if (error) log('  ERROR: ' + error.message)
              else fix('Corregido')
            }
          }
        }
      }

      // Chocolate blanco base 50g -> producto erroneo de fresas
      if (n === 'chocolate blanco' && ing.cantidad_gramos >= 50 && ing.alimento_id) {
        const { data: a } = await sb.from('alimentos').select('nombre').eq('id', ing.alimento_id).single()
        if (a && a.nombre.toLowerCase().includes('fresas')) {
          bug('"' + ing.nombre_libre + '" ' + ing.cantidad_gramos + 'g -> "' + a.nombre + '" (producto de fresas, no chocolate)')
          const chocoBlanco = await findAlimento(sb, '%chocolate blanco%postres%') ||
            await findAlimento(sb, '%Chocolate Blanco para Postres%') ||
            await findAlimento(sb, '%Chocolate Blanco Postres%')
          if (chocoBlanco) {
            log('  Deberia: "' + chocoBlanco.nombre + '" (' + chocoBlanco.calorias + ' kcal)')
            if (APPLY) {
              const { error } = await sb.from('receta_ingredientes').update({ alimento_id: chocoBlanco.id }).eq('id', ing.id)
              if (error) log('  ERROR: ' + error.message)
              else fix('Corregido')
            }
          }
        }
      }

      // Huefranos
      if (!ing.alimento_id) {
        if (n.includes('chocolate blanco')) {
          bug('"' + ing.nombre_libre + '" ' + ing.cantidad_gramos + 'g -> SIN ALIMENTO (huerfano)')
          const chocoBlanco = await findAlimento(sb, '%chocolate blanco%postres%') ||
            await findAlimento(sb, '%Chocolate Blanco para Postres%') ||
            await findAlimento(sb, '%Chocolate Blanco Postres%')
          if (chocoBlanco) {
            log('  Deberia: "' + chocoBlanco.nombre + '" (' + chocoBlanco.calorias + ' kcal)')
            if (APPLY) {
              const { error } = await sb.from('receta_ingredientes').update({ alimento_id: chocoBlanco.id }).eq('id', ing.id)
              if (error) log('  ERROR: ' + error.message)
              else fix('Corregido')
            }
          }
        } else if (n.includes('chocolate negro') && !n.includes('con leche')) {
          bug('"' + ing.nombre_libre + '" ' + ing.cantidad_gramos + 'g -> SIN ALIMENTO (huerfano)')
          if (chocolateNegro85) {
            log('  Deberia: "' + chocolateNegro85.nombre + '" (' + chocolateNegro85.calorias + ' kcal)')
            if (APPLY) {
              const { error } = await sb.from('receta_ingredientes').update({ alimento_id: chocolateNegro85.id }).eq('id', ing.id)
              if (error) log('  ERROR: ' + error.message)
              else fix('Corregido')
            }
          }
        }
      }
    }
  }

  // ===========================================================
  // BUG 4: datil medjool huerfano
  // ===========================================================
  console.log('\n========================================')
  console.log('BUG 4: datil medjool huerfano')
  console.log('========================================')

  if (datilesMedjool) {
    // Search for ingredients with 'datil medjool' (with and without accents)
    const { data: datilIngs } = await sb
      .from('receta_ingredientes')
      .select('id,nombre_libre,cantidad_gramos,receta_id')
      .is('alimento_id', null)
      .or('nombre_libre.ilike.%medjool%,nombre_libre.ilike.%medjoul%')

    for (const ing of datilIngs || []) {
      const { data: r } = await sb.from('recetas').select('nombre').eq('id', ing.receta_id).single()
      bug('"' + ((r && r.nombre) || '?') + '" | ' + ing.nombre_libre + ' ' + ing.cantidad_gramos + 'g -> SIN ALIMENTO')
      log('  Deberia: "' + datilesMedjool.nombre + '" (' + datilesMedjool.calorias + ' kcal)')

      if (APPLY) {
        const { error } = await sb
          .from('receta_ingredientes')
          .update({ alimento_id: datilesMedjool.id })
          .eq('id', ing.id)
        if (error) log('  ERROR: ' + error.message)
        else fix('Corregido -> Dátiles medjool')
      }
    }

    if (!datilIngs || datilIngs.length === 0) {
      ok('No hay ingredientes de datil medjool huerfanos')

      // Search for ANY ingredient with 'medjool' or 'medjoul' (might be already linked)
      // The receta "Arroz con leche de avena y canela sin azucar" already uses "Datiles Medjoul con hueso"
      // But "Datiles rellenos de almendra y chocolate negro" has "datil medjool" without linking
      const { data: allMedjool } = await sb
        .from('receta_ingredientes')
        .select('id,nombre_libre,cantidad_gramos,alimento_id,receta_id')
        .or('nombre_libre.ilike.%medjool%,nombre_libre.ilike.%medjoul%')
      for (const ing of allMedjool || []) {
        const { data: r } = await sb.from('recetas').select('nombre').eq('id', ing.receta_id).single()
        log('"' + (r?.nombre || '?') + '" | ' + ing.nombre_libre + ' ' + ing.cantidad_gramos + 'g -> ' + (ing.alimento_id ? 'vinculado' : 'SIN ALIMENTO'))
      }
    }
  } else {
    warn('Dátiles medjool no encontrado en BD - no se puede arreglar')
  }

  // Also check general datil orphans (without medjool)
  const { data: datilGenIngs } = await sb
    .from('receta_ingredientes')
    .select('id,nombre_libre,cantidad_gramos,receta_id')
    .is('alimento_id', null)
    .or('nombre_libre.ilike.%datil%,nombre_libre.ilike.%dátil%,nombre_libre.ilike.%datiles%,nombre_libre.ilike.%dátiles%')

  if (datilGenIngs && datilGenIngs.length > 0) {
    for (const ing of datilGenIngs || []) {
      const n = (ing.nombre_libre || '').toLowerCase()
      // Skip medjool - already handled above
      if (n.includes('medjool') || n.includes('medjoul')) continue

      const { data: r } = await sb.from('recetas').select('nombre').eq('id', ing.receta_id).single()
      warn('"' + (r?.nombre || '?') + '" | ' + ing.nombre_libre + ' ' + ing.cantidad_gramos + 'g -> SIN ALIMENTO')
    }
  }

  // ===========================================================
  // BUG 5: Dulce de Leche - leches light
  // ===========================================================
  console.log('\n========================================')
  console.log('BUG 5: Dulce de Leche - leches light')
  console.log('========================================')

  const { data: dulce } = await sb
    .from('recetas')
    .select('id,nombre')
    .ilike('nombre', 'Dulce de Leche Saludable')
    .single()

  if (dulce) {
    const { data: dulceIngs } = await sb
      .from('receta_ingredientes')
      .select('id,nombre_libre,cantidad_gramos,alimento_id')
      .eq('receta_id', dulce.id)

    for (const ing of dulceIngs || []) {
      const n = (ing.nombre_libre || '').toLowerCase()

      if (n.includes('leche condensada light')) {
        const { data: a } = await sb.from('alimentos').select('nombre,calorias').eq('id', ing.alimento_id).single()
        bug('"' + ing.nombre_libre + '" ' + ing.cantidad_gramos + 'g -> "' + (a ? a.nombre + '" (' + a.calorias + ' kcal)' : '?'))

        if (lecheCondensadaDesnatada) {
          log('  Deberia: "' + lecheCondensadaDesnatada.nombre + '" (' + lecheCondensadaDesnatada.calorias + ' kcal)')
          if (APPLY) {
            const { error } = await sb
              .from('receta_ingredientes')
              .update({ alimento_id: lecheCondensadaDesnatada.id })
              .eq('id', ing.id)
            if (error) log('  ERROR: ' + error.message)
            else fix('Corregido')
          }
        } else {
          warn('No hay Leche condensada desnatada en BD')
        }
      }

      if (n.includes('leche evaporada light')) {
        const { data: a } = await sb.from('alimentos').select('nombre,calorias').eq('id', ing.alimento_id).single()
        warn('"' + ing.nombre_libre + '" ' + ing.cantidad_gramos + 'g -> "' + (a ? a.nombre + '" (' + a.calorias + ' kcal)' : '?'))
        log('  No hay Leche evaporada light en BD. La normal es lo mas cercano.')
      }
    }
  }

  // ===========================================================
  // FINAL
  // ===========================================================
  console.log('\n========================================')
  console.log('  COMPLETADO - Modo: ' + (APPLY ? 'APLICADO' : 'DRY RUN'))
  if (!APPLY) {
    console.log('  Ejecuta con --apply para aplicar:')
    console.log('  node scripts/fix-bugs-recetario-v2.mjs --apply')
  }
  console.log('========================================\n')
}

main().catch(console.error)
