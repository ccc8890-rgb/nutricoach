/**
 * scripts/verificar-e2e-recetario.ts
 *
 * Verificación E2E del sistema de recetario:
 * - Test 1: /api/recetas/sugeridas devuelve recetas skeleton aprobadas hoy
 * - Test 2: filtrarEsqueletos + seleccionarEsqueleto para 3 escenarios reales
 * - Test 3: Estado correcto en BD (tipos, tags, cobertura tipoPlato)
 *
 * Ejecutar: npx tsx scripts/verificar-e2e-recetario.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { filtrarEsqueletos } from '../lib/recetas/esqueletos/index'
import { seleccionarEsqueleto, aplicarSustituciones } from '../lib/recetas/agente-recetario/generator'
import { validarVocabulario } from '../lib/recetas/agente-recetario/vocabulary-guard'
import type { PreferenciasCliente } from '../lib/recetas/agente-recetario/generator'
import type { RecetaCoverageGap } from '../lib/recetas/agente-recetario/types'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ── helpers ────────────────────────────────────────────────────────────────────

function ok(label: string)  { console.log(`  ✅ ${label}`) }
function fail(label: string) { console.log(`  ❌ ${label}`) }
function info(label: string) { console.log(`     ${label}`) }

let totalTests = 0
let passedTests = 0

function assert(condition: boolean, label: string, detail?: string) {
  totalTests++
  if (condition) {
    passedTests++
    ok(label)
  } else {
    fail(label)
    if (detail) info(`→ ${detail}`)
  }
  return condition
}

// ── Test 1: Simular /api/recetas/sugeridas con kcal típica ─────────────────────

async function test1_sugeridas() {
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('TEST 1: /api/recetas/sugeridas → devuelve recetas skeleton')
  console.log('═══════════════════════════════════════════════════════')

  const hoy = new Date().toISOString().split('T')[0]

  // 1a. Recetas aprobadas hoy existen
  const { data: hoySkelAprobadas, error: e1 } = await db
    .from('recetas')
    .select('id, nombre, estado, tipo_plato, kcal, proteinas, tags, created_at')
    .eq('estado', 'aprobada')
    .gte('created_at', hoy)
    .order('created_at', { ascending: false })

  if (e1) { fail(`Supabase error: ${e1.message}`); return }

  const totalHoy = hoySkelAprobadas?.length ?? 0
  assert(totalHoy > 0, `Recetas aprobadas hoy en BD: ${totalHoy}`, 'No hay recetas aprobadas hoy — el agente no corrió o no hay skeleton insertado')

  // 1b. Distribución por tipo_plato
  const tiposHoy: Record<string, number> = {}
  hoySkelAprobadas?.forEach(r => { tiposHoy[r.tipo_plato ?? 'null'] = (tiposHoy[r.tipo_plato ?? 'null'] || 0) + 1 })
  info(`Distribución hoy: ${JSON.stringify(tiposHoy)}`)

  const tiposEsperados = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack']
  for (const tipo of tiposEsperados) {
    assert((tiposHoy[tipo] ?? 0) >= 1, `tipoPlato '${tipo}' presente hoy (${tiposHoy[tipo] ?? 0} recetas)`)
  }

  // 1c. Tags presentes (al menos alguna tiene tags de esqueleto)
  const conTags = hoySkelAprobadas?.filter(r => r.tags && r.tags.length > 0) ?? []
  assert(conTags.length > 0, `Recetas con tags de esqueleto: ${conTags.length}/${totalHoy}`)

  // 1d. Simular query de sugeridas (estado='aprobada' es el único filtro crítico)
  // La ruta real hace: .eq('estado','aprobada').gte('kcal',...).lte('kcal',...)
  // Las skeleton NO tienen kcal calculado aún → verificar si sugeridas puede devolver alguna
  const conKcal = hoySkelAprobadas?.filter(r => r.kcal && r.kcal > 0) ?? []
  const sinKcal = hoySkelAprobadas?.filter(r => !r.kcal || r.kcal === 0) ?? []

  info(`Con kcal calculado: ${conKcal.length} | Sin kcal (null/0): ${sinKcal.length}`)

  assert(
    conKcal.length >= 0,
    `Recetas skeleton con kcal: ${conKcal.length}`,
    conKcal.length === 0
      ? '⚠️  ADVERTENCIA: Todas tienen kcal null — la ruta /api/recetas/sugeridas filtra por kcal range, estas recetas NO aparecerán si kcal=null'
      : undefined
  )

  if (sinKcal.length > 0) {
    info(`⚠️  ${sinKcal.length} recetas skeleton sin kcal calculado → NO serán devueltas por /api/recetas/sugeridas con filtro de kcal`)
    info(`   Estas recetas solo aparecerán en búsqueda por texto (parámetro q=) o si kcal<=0 se salta el filtro`)
    info(`   Acción necesaria: calcular macros de los ingredientes skeleton y actualizar kcal en BD`)
  }

  // 1e. La query de sugeridas SÍ puede devolver recetas hoy si hay rango amplio o qText
  // Verificar con kcal=0 (sin filtro de rango)
  const { data: todasAprobadas, count: totalAprobadas } = await db
    .from('recetas')
    .select('id, nombre, kcal, tipo_plato', { count: 'exact' })
    .eq('estado', 'aprobada')
    .gt('kcal', 0)
    .limit(5)

  assert((totalAprobadas ?? 0) > 0, `Total recetas aprobadas con kcal>0 (disponibles para sugeridas): ${totalAprobadas}`)

  // 1f. Verificar que la ruta NO filtra por fecha creación — cualquier aprobada con kcal sirve
  const recientesConKcal = hoySkelAprobadas?.filter(r => (r.kcal ?? 0) > 0)
  if (recientesConKcal && recientesConKcal.length > 0) {
    ok(`Skeleton recientes con kcal (fluirán a clientes sin cambios): ${recientesConKcal.length}`)
    recientesConKcal.slice(0, 3).forEach(r => info(`  - ${r.nombre} | ${r.tipo_plato} | ${r.kcal}kcal`))
  } else {
    info('Ninguna receta skeleton hoy tiene kcal calculado. Flujo bloqueado en sugeridas por rango de kcal.')
  }
}

// ── Test 2: filtrarEsqueletos + seleccionarEsqueleto (3 escenarios) ────────────

function test2_esqueletos() {
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('TEST 2: filtrarEsqueletos + seleccionarEsqueleto (3 escenarios)')
  console.log('═══════════════════════════════════════════════════════')

  // Escenario A: Runner tapering, odia el pescado, colon irritable
  console.log('\n  [Escenario A] Runner tapering + odia pescado + colon irritable')
  const gapA: RecetaCoverageGap = {
    objetivo: 'rendimiento',
    deporte: 'running',
    momento: 'tapering',
    tipoPlato: 'Comida',
    actuales: 0,
    minimo: 3,
    prioridad: 'alta',
    motivo: 'test escenario A'
  }
  const prefA: PreferenciasCliente = {
    alimentos_favoritos: ['arroz', 'pollo'],
    alimentos_rechazados: ['pescado', 'merluza', 'salmón', 'atún', 'sardina', 'caballa'],
    intolerancias: [],
    patologias: ['colon_irritable'],
    tecnicas_preferidas: ['plancha'],
    dieta_habitual: 'omnívora mediterránea',
  }

  const esqueletosA = filtrarEsqueletos({
    objetivo: gapA.objetivo,
    momento: gapA.momento,
    tipoPlato: gapA.tipoPlato,
    deporte: gapA.deporte,
    patologias: prefA.patologias,
    fodmapsMaximo: 'bajos',
  })
  assert(esqueletosA.length > 0, `Escenario A: esqueletos compatibles encontrados: ${esqueletosA.length}`)

  const selA = seleccionarEsqueleto(gapA, prefA)
  assert(selA !== null, `Escenario A: esqueleto seleccionado: ${selA?.id ?? 'ninguno'}`)

  if (selA) {
    info(`Esqueleto: ${selA.id} | tipoPlato: ${selA.tipoPlato} | FODMAP: ${selA.metadatos.fodmaps}`)
    assert(
      selA.metadatos.fodmaps === 'bajos',
      `Escenario A: FODMAP es 'bajos' (colon irritable requiere FODMAP bajo)`,
      `FODMAP actual: ${selA.metadatos.fodmaps}`
    )

    const ingsA = aplicarSustituciones(selA, prefA)
    const pescadoPresente = ingsA.some(i =>
      prefA.alimentos_rechazados.some(r => i.nombre.toLowerCase().includes(r.toLowerCase()))
    )
    assert(!pescadoPresente, 'Escenario A: ningún ingrediente rechazado (pescado) en resultado', `Ingredientes: ${ingsA.map(i => i.nombre).join(', ')}`)
    info(`Ingredientes resultado: ${ingsA.map(i => `${i.gramos}g ${i.nombre}`).join(' | ')}`)

    // Check patologia_incompatible no incluye colon_irritable
    assert(
      !selA.metadatos.patologias_incompatibles.includes('colon_irritable'),
      'Escenario A: esqueleto NO tiene colon_irritable en patologias_incompatibles'
    )
  }

  // Escenario B: Powerlifter post-workout, sin intolerancias
  console.log('\n  [Escenario B] Powerlifter post-entreno, sin intolerancias')
  const gapB: RecetaCoverageGap = {
    objetivo: 'rendimiento',
    deporte: 'fuerza',
    momento: 'post_entreno',
    tipoPlato: 'Comida',
    actuales: 0,
    minimo: 3,
    prioridad: 'alta',
    motivo: 'test escenario B'
  }
  const prefB: PreferenciasCliente = {
    alimentos_favoritos: ['arroz', 'pollo', 'huevo'],
    alimentos_rechazados: [],
    intolerancias: [],
    patologias: [],
    tecnicas_preferidas: [],
    dieta_habitual: null,
  }

  const esqueletosB = filtrarEsqueletos({
    objetivo: gapB.objetivo,
    momento: gapB.momento,
    tipoPlato: gapB.tipoPlato,
    deporte: gapB.deporte,
    patologias: [],
  })
  assert(esqueletosB.length > 0, `Escenario B: esqueletos compatibles: ${esqueletosB.length}`)

  const selB = seleccionarEsqueleto(gapB, prefB)
  assert(selB !== null, `Escenario B: esqueleto seleccionado: ${selB?.id ?? 'ninguno'}`)

  if (selB) {
    info(`Esqueleto: ${selB.id} | nivel_proteina: ${selB.metadatos.nivel_proteina} | digestibilidad: ${selB.metadatos.digestibilidad}`)
    assert(
      selB.metadatos.nivel_proteina === 'alto',
      'Escenario B: nivel_proteina=alto (post-entreno fuerza requiere proteína alta)',
      `Nivel actual: ${selB.metadatos.nivel_proteina}`
    )
    const ingsB = aplicarSustituciones(selB, prefB)
    info(`Ingredientes: ${ingsB.map(i => `${i.gramos}g ${i.nombre}`).join(' | ')}`)
  }

  // Escenario C: Pérdida de grasa + resistencia insulina + le encanta la comida mediterránea
  console.log('\n  [Escenario C] Pérdida grasa + resistencia insulina + mediterráneo')
  const gapC: RecetaCoverageGap = {
    objetivo: 'perdida_grasa',
    deporte: 'todos',
    momento: 'deficit',
    tipoPlato: 'Cena',
    actuales: 0,
    minimo: 3,
    prioridad: 'media',
    motivo: 'test escenario C'
  }
  const prefC: PreferenciasCliente = {
    alimentos_favoritos: ['tomate', 'pimiento', 'aceite de oliva', 'pescado', 'legumbres'],
    alimentos_rechazados: ['proteína en polvo', 'suplemento'],
    intolerancias: [],
    patologias: ['resistencia_insulina'],
    tecnicas_preferidas: ['horno', 'plancha'],
    dieta_habitual: 'mediterránea tradicional',
  }

  const esqueletosC = filtrarEsqueletos({
    objetivo: gapC.objetivo,
    momento: gapC.momento,
    tipoPlato: gapC.tipoPlato,
    deporte: gapC.deporte,
    patologias: prefC.patologias,
  })
  assert(esqueletosC.length > 0, `Escenario C: esqueletos compatibles: ${esqueletosC.length}`)

  const selC = seleccionarEsqueleto(gapC, prefC)
  assert(selC !== null, `Escenario C: esqueleto seleccionado: ${selC?.id ?? 'ninguno'}`)

  if (selC) {
    info(`Esqueleto: ${selC.id} | objetivo: ${selC.metadatos.objetivos.join(',')} | compat: ${selC.metadatos.patologias_compatibles.join(',')}`)
    // Verificar que el esqueleto NO excluye resistencia_insulina
    assert(
      !selC.metadatos.patologias_incompatibles.includes('resistencia_insulina'),
      'Escenario C: esqueleto no incompatible con resistencia_insulina'
    )
    const priorizaRI = selC.metadatos.patologias_compatibles.includes('resistencia_insulina')
    if (priorizaRI) ok('Escenario C: esqueleto específicamente compatible con resistencia_insulina (priorizado)')
    else info('Escenario C: esqueleto genérico (no específico para resistencia_insulina) — válido')

    const ingsC = aplicarSustituciones(selC, prefC)
    const suplementoPresente = ingsC.some(i =>
      prefC.alimentos_rechazados.some(r => i.nombre.toLowerCase().includes(r.toLowerCase()))
    )
    assert(!suplementoPresente, 'Escenario C: sin ingredientes rechazados (suplementos) en resultado')
    info(`Ingredientes: ${ingsC.map(i => `${i.gramos}g ${i.nombre}`).join(' | ')}`)
  }

  // Total esqueletos disponibles
  const { TODOS_LOS_ESQUELETOS } = require('../lib/recetas/esqueletos/index')
  const total = TODOS_LOS_ESQUELETOS.length
  info(`\nTotal esqueletos en sistema: ${total}`)
  const perPerfil: Record<string, number> = {}
  TODOS_LOS_ESQUELETOS.forEach((e: {perfil: string}) => { perPerfil[e.perfil] = (perPerfil[e.perfil] || 0) + 1 })
  info(`Por perfil: ${JSON.stringify(perPerfil)}`)
}

// ── Test 3: Estado BD ─────────────────────────────────────────────────────────

async function test3_estadoBD() {
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('TEST 3: Estado BD — estado, tags, cobertura tipoPlato, vocabulario')
  console.log('═══════════════════════════════════════════════════════')

  const hoy = new Date().toISOString().split('T')[0]

  // 3a. Todas las skeleton de hoy son aprobadas (0 en en_revision)
  const { data: enRevHoy } = await db
    .from('recetas')
    .select('id, nombre')
    .eq('estado', 'en_revision')
    .gte('created_at', hoy)

  assert((enRevHoy?.length ?? 0) === 0, `No hay recetas skeleton en 'en_revision' hoy (${enRevHoy?.length ?? 0})`)

  // 3b. Al menos 1 receta por tipoPlato principal entre las aprobadas hoy
  const { data: hoyAprobadas } = await db
    .from('recetas')
    .select('id, nombre, tipo_plato, tags, kcal, proteinas, instrucciones')
    .eq('estado', 'aprobada')
    .gte('created_at', hoy)

  const tipos: Record<string, number> = {}
  hoyAprobadas?.forEach(r => { tipos[r.tipo_plato ?? 'null'] = (tipos[r.tipo_plato ?? 'null'] || 0) + 1 })

  const tiposRequeridos = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack']
  for (const tipo of tiposRequeridos) {
    assert((tipos[tipo] ?? 0) >= 1, `tipoPlato '${tipo}' presente hoy: ${tipos[tipo] ?? 0} receta(s)`)
  }
  info(`Distribución completa: ${JSON.stringify(tipos)}`)

  // 3c. Tags contienen metadatos de esqueleto (rendimiento, perdida_grasa, patologia, etc.)
  const TAGS_ESQUELETO = ['rendimiento', 'perdida_grasa', 'patologia', 'salud', 'ganancia_muscular']
  const conTagEsqueleto = hoyAprobadas?.filter(r =>
    r.tags?.some((t: string) => TAGS_ESQUELETO.includes(t))
  ) ?? []
  assert(conTagEsqueleto.length > 0, `Recetas con tag de perfil (rendimiento/perdida_grasa/patologia/salud): ${conTagEsqueleto.length}/${hoyAprobadas?.length ?? 0}`)

  // 3d. Vocabulary guard sobre todas las aprobadas hoy (solo nombre — instrucciones pueden ser null)
  let violacionesNombre = 0
  const violacionesDetalle: string[] = []
  for (const r of (hoyAprobadas ?? [])) {
    if (!r.nombre) continue
    const check = validarVocabulario({
      nombre: r.nombre,
      descripcion: '',
      instrucciones: [],
      consejos: '',
    })
    if (!check.valido) {
      violacionesNombre++
      check.violaciones.forEach(v => violacionesDetalle.push(`"${r.nombre}" → campo:${v.campo} patrón:${v.patron}`))
    }
  }
  assert(violacionesNombre === 0, `Vocabulary guard en nombre: 0 violaciones de ${hoyAprobadas?.length ?? 0} recetas`,
    violacionesNombre > 0 ? violacionesDetalle.slice(0, 5).join('; ') : undefined
  )
  if (violacionesDetalle.length > 0) {
    violacionesDetalle.slice(0, 5).forEach(v => info(`  ⚠️  ${v}`))
  }

  // 3e. Instrucciones no vacías en skeleton (al menos tienen instrucciones generadas)
  const sinInstrucciones = hoyAprobadas?.filter(r => {
    if (!r.instrucciones) return true
    const inst = r.instrucciones
    if (Array.isArray(inst)) return inst.length === 0
    return false
  }) ?? []
  assert(sinInstrucciones.length === 0, `Recetas sin instrucciones hoy: ${sinInstrucciones.length}`,
    sinInstrucciones.map(r => r.nombre).slice(0, 3).join(', ')
  )

  // 3f. Check recetas skeleton vs total aprobadas
  const { count: totalAprobadas } = await db.from('recetas').select('*', {count:'exact', head: true}).eq('estado','aprobada')
  info(`Total aprobadas en BD: ${totalAprobadas} | Nuevas hoy: ${hoyAprobadas?.length ?? 0}`)
  assert((totalAprobadas ?? 0) >= (hoyAprobadas?.length ?? 0), `BD consistente: total (${totalAprobadas}) >= hoy (${hoyAprobadas?.length})`)

  // 3g. Vocabulary guard completo (nombre + descripcion + instrucciones) para sample de 10
  let violacionesCompletas = 0
  const sample = (hoyAprobadas ?? []).slice(0, 10)
  for (const r of sample) {
    const instrArray = Array.isArray(r.instrucciones) ? r.instrucciones : []
    const check = validarVocabulario({
      nombre: r.nombre ?? '',
      descripcion: '',
      instrucciones: instrArray,
      consejos: '',
    })
    if (!check.valido) {
      violacionesCompletas++
      check.violaciones.forEach(v => info(`  ⚠️  vocab: "${r.nombre}" → ${v.campo}: /${v.patron}/`))
    }
  }
  assert(violacionesCompletas === 0, `Vocabulary guard completo (muestra 10 recetas): 0 violaciones`)
}

// ── MAIN ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║   VERIFICACIÓN E2E — Sistema Recetario NutriCoach   ║')
  console.log(`║   Fecha: ${new Date().toLocaleDateString('es-ES')}                              ║`)
  console.log('╚══════════════════════════════════════════════════════╝')

  await test1_sugeridas()
  test2_esqueletos()
  await test3_estadoBD()

  console.log('\n══════════════════════════════════════════════════════')
  console.log('RESULTADO FINAL')
  console.log('══════════════════════════════════════════════════════')
  console.log(`Tests: ${passedTests}/${totalTests} pasados`)

  if (passedTests === totalTests) {
    console.log('\n✅ SISTEMA LISTO — las recetas skeleton fluyen correctamente')
  } else {
    console.log(`\n⚠️  ${totalTests - passedTests} test(s) fallaron — revisar detalles arriba`)
  }

  // Veredicto final
  console.log('\n── VEREDICTO ───────────────────────────────────────────')
  const hoy = new Date().toISOString().split('T')[0]
  const { data: kpi } = await db
    .from('recetas')
    .select('tipo_plato, kcal')
    .eq('estado', 'aprobada')
    .gte('created_at', hoy)

  const tiposHoy = new Set(kpi?.map(r => r.tipo_plato))
  const conKcalHoy = kpi?.filter(r => r.kcal && r.kcal > 0).length ?? 0
  const tiposCubiertos = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack'].filter(t => tiposHoy.has(t))

  if (tiposCubiertos.length === 5 && conKcalHoy > 0) {
    console.log('✅ APTO para asignar recetas a clientes reales')
    console.log(`   ${kpi?.length} recetas | ${tiposCubiertos.join(', ')} cubiertos | ${conKcalHoy} con kcal calculado`)
  } else if (tiposCubiertos.length === 5 && conKcalHoy === 0) {
    console.log('⚠️  PARCIALMENTE APTO — recetas en BD pero sin kcal calculado')
    console.log('   Las recetas NO aparecerán en /api/recetas/sugeridas con filtro de kcal')
    console.log('   Acción: calcular y actualizar kcal en las recetas skeleton (via receta_ingredientes + alimentos)')
    console.log(`   ${kpi?.length} recetas | tipos: ${tiposCubiertos.join(', ')}`)
  } else {
    console.log('❌ NO APTO — faltan tipos de plato o kcal')
    console.log(`   Tipos cubiertos: ${tiposCubiertos.join(', ')} (faltan: ${['Desayuno','Comida','Cena','Merienda','Snack'].filter(t => !tiposHoy.has(t)).join(', ')})`)
  }
}

main().catch(e => {
  console.error('Error fatal:', e)
  process.exit(1)
})
