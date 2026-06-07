/**
 * Test del flujo completo de generación de plan para Laura García (cliente ficticio)
 * Prueba directamente las funciones del motor sin pasar por HTTP
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { filtrarRecetasPorSlot, calcularTargetSlot } from '../lib/plan-recetas'
import { cargarContextoCliente } from '../lib/agentes/executor'
import { seleccionarEsqueleto, aplicarSustituciones } from '../lib/recetas/agente-recetario/generator'

const LAURA_ID = '5fbb70cf-dbca-4541-8f37-7df2fa7ec6d1'
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ── TDEE de Laura ──────────────────────────────────────────────
// Mifflin-St Jeor mujer: 10*peso + 6.25*altura - 5*edad - 161
const tmb = 10 * 68 + 6.25 * 165 - 5 * 32 - 161
const tdee = tmb * 1.55   // moderado
const kcalObjetivo = Math.round(tdee - 400)  // déficit perdida_grasa
const proteinas = Math.round(68 * 2.4)       // 2.4 g/kg para perder_grasa

async function testContextoCliente() {
  console.log('\n══ TEST 1: cargarContextoCliente ══════════════════')
  const ctx = await cargarContextoCliente(LAURA_ID)
  if (!ctx) { console.log('❌ No se cargó el contexto'); return null }

  console.log('✅ Contexto cargado')
  console.log('   Objetivo:', ctx.cliente.objetivo)
  console.log('   Preferencias:', JSON.stringify(ctx.preferencias_recetas, null, 2).substring(0, 300))
  return ctx
}

async function testFiltrarRecetas() {
  console.log('\n══ TEST 2: filtrarRecetasPorSlot para cada comida ══')
  console.log(`   TDEE: ${Math.round(tdee)} kcal | Objetivo: ${kcalObjetivo} kcal | Proteína: ${proteinas}g`)

  const restricciones = ['Sin Gluten']  // de onboarding_responses
  const slots = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack']

  let totalRecetas = 0
  let slotsConProblemas: string[] = []

  for (const slot of slots) {
    const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObjetivo, proteinas, 5)

    // FiltroCliente: { restricciones, alimentos_evitar_extra, tiempo_cocina_min, alimentos_base }
    const filtroCliente = {
      restricciones,
      alimentos_evitar_extra: 'pescado azul, hígado',
      tiempo_cocina_min: 30,
      alimentos_base: ['pollo', 'huevo', 'arroz', 'yogur griego', 'espinacas'],
    }
    const recetas = await filtrarRecetasPorSlot(
      db,
      slot,
      targetKcal,
      targetProt,
      filtroCliente,
      3,      // limit
      LAURA_ID,
      'perder_grasa',
      {},     // tagsClinicosRequeridos
      null    // deporte
    )

    totalRecetas += recetas.length
    const status = recetas.length >= 1 ? '✅' : '❌'
    if (recetas.length === 0) slotsConProblemas.push(slot)

    console.log(`\n   ${status} ${slot} (target: ${targetKcal} kcal | ${targetProt}g P):`)
    recetas.slice(0, 3).forEach(r => {
      const intolerancia_issue = (r.intolerancias as string[] ?? []).includes('Gluten')
      console.log(`      ${intolerancia_issue ? '🔴 GLUTEN' : '   '} ${r.nombre} | ${r.kcal} kcal | ${r.proteinas}g P`)
    })
  }

  console.log(`\n   Total recetas encontradas: ${totalRecetas}`)
  if (slotsConProblemas.length > 0) {
    console.log('   ❌ Slots sin recetas:', slotsConProblemas.join(', '))
  } else {
    console.log('   ✅ Todos los slots tienen recetas')
  }
}

async function testEsqueletos() {
  console.log('\n══ TEST 3: seleccionarEsqueleto para Laura ══════════')

  const prefs = {
    alimentos_favoritos: ['pollo', 'huevo', 'arroz', 'yogur griego', 'espinacas'],
    alimentos_rechazados: ['pescado azul', 'hígado'],
    intolerancias: ['Sin Gluten'],
    patologias: ['resistencia_insulina'],
    tecnicas_preferidas: ['plancha'],
    dieta_habitual: 'mediterránea'
  }

  const scenarios = [
    { objetivo: 'perdida_grasa', momento: 'base', tipoPlato: 'Comida', label: 'Comida base' },
    { objetivo: 'perdida_grasa', momento: 'descanso', tipoPlato: 'Cena', label: 'Cena día descanso' },
    { objetivo: 'perdida_grasa', momento: 'base', tipoPlato: 'Desayuno', label: 'Desayuno base' },
    { objetivo: 'salud', momento: 'base', tipoPlato: 'Comida', label: 'Comida para RI' },
  ]

  for (const { objetivo, momento, tipoPlato, label } of scenarios) {
    const gap = { objetivo, momento, tipoPlato, deporte: 'todos', actuales: 0, minimo: 3, prioridad: 'alta' as const, motivo: '' }
    const esq = seleccionarEsqueleto(gap, prefs)
    if (!esq) { console.log(`   ❌ ${label}: sin esqueleto compatible`); continue }

    const ings = aplicarSustituciones(esq, prefs)
    const tienePescadoAzul = ings.some(i => ['sardina', 'caballa', 'arenque', 'anchoa'].some(p => i.nombre.toLowerCase().includes(p)))
    const tieneGluten = ings.some(i => ['pan', 'pasta', 'harina de trigo', 'cebada', 'centeno'].some(p => i.nombre.toLowerCase().includes(p)))

    console.log(`   ✅ ${label}: ${esq.id}`)
    console.log(`      Ings: ${ings.map(i => i.nombre).join(', ')}`)
    if (tienePescadoAzul) console.log('      ⚠️ Contiene pescado azul — debería haberse sustituido')
    if (tieneGluten) console.log('      ⚠️ Posible gluten en ingrediente — revisar')
  }
}

async function testIntoleranciasFiltro() {
  console.log('\n══ TEST 4: Recetas aprobadas con Gluten que se colarían ══')

  // Buscar recetas aprobadas que contienen gluten pero NO están etiquetadas con 'Gluten'
  // (falsos negativos del filtro)
  const { data: sospechosas } = await db.from('recetas')
    .select('id, nombre, intolerancias, tipo_plato')
    .eq('estado', 'aprobada')
    .or('nombre.ilike.%pan%,nombre.ilike.%pasta%,nombre.ilike.%macarr%,nombre.ilike.%espaguet%,nombre.ilike.%harina%')
    .not('intolerancias', 'ov', '{Gluten}')  // SIN etiqueta Gluten
    .limit(10)

  if (!sospechosas?.length) {
    console.log('   ✅ No se detectan recetas con gluten sin etiquetar')
  } else {
    console.log(`   ⚠️ ${sospechosas.length} recetas posiblemente con gluten sin etiquetar:`)
    sospechosas.forEach(r => console.log(`      - ${r.nombre} | tags: ${r.intolerancias}`))
  }
}

async function main() {
  console.log('🧪 TEST FLUJO COMPLETO — Laura García (celiaca, RI, pérdida de grasa)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await testContextoCliente()
  await testFiltrarRecetas()
  await testEsqueletos()
  await testIntoleranciasFiltro()

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Siguiente paso: ir a nutricoach-delta.vercel.app/clientes/5fbb70cf-dbca-4541-8f37-7df2fa7ec6d1/revisar-plan')
  console.log('y pulsar "Generar plan con IA" para el test completo con DeepSeek')
}

main().catch(console.error)
