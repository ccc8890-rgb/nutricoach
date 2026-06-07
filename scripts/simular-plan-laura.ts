/**
 * Simula la generación completa de plan para Laura García:
 * - Plan de nutrición con DeepSeek
 * - Plan de entrenamiento con motor-entreno
 * - Alternativas de recetas por slot
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { construirPrompt, generarDietaConIA } from '../lib/deepseek'
import { filtrarRecetasPorSlot, calcularTargetSlot } from '../lib/plan-recetas'
import { evaluarPerfilEntreno } from '../lib/motor-entreno'
import { seleccionarProtocolos, formatearEvidenciaParaPrompt } from '../lib/knowledge-base'

const LAURA_ID = '5fbb70cf-dbca-4541-8f37-7df2fa7ec6d1'
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ─── TDEE Laura ───────────────────────────────────────────────
const tmb = 10 * 68 + 6.25 * 165 - 5 * 32 - 161
const tdee = Math.round(tmb * 1.55)
const kcalObjetivo = tdee - 400
const proteinas = Math.round(68 * 2.4)
const grasas = Math.round(kcalObjetivo * 0.25 / 9)
const carbos = Math.round((kcalObjetivo - proteinas * 4 - grasas * 9) / 4)

async function generarPlanNutricion() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('🍽️  PLAN DE NUTRICIÓN — Laura García')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`TDEE: ${tdee} kcal | Objetivo: ${kcalObjetivo} kcal`)
  console.log(`Macros: ${proteinas}g P | ${carbos}g C | ${grasas}g G`)

  // 1. Cargar recetas candidatas por slot (sin gluten)
  const filtroCliente = {
    restricciones: ['Sin Gluten'],
    alimentos_evitar_extra: 'pescado azul, hígado',
    tiempo_cocina_min: 30,
    alimentos_base: ['pollo', 'huevo', 'arroz', 'yogur griego', 'espinacas'],
  }

  const slots = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack']
  const recetasCandidatas: Record<string, any[]> = {}

  console.log('\n📦 Cargando recetas candidatas...')
  for (const slot of slots) {
    const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObjetivo, proteinas, 5)
    const recetas = await filtrarRecetasPorSlot(db, slot, targetKcal, targetProt, filtroCliente, 6, LAURA_ID, 'perder_grasa', {}, null)
    recetasCandidatas[slot] = recetas
    console.log(`  ${slot}: ${recetas.length} candidatas (target: ${targetKcal} kcal)`)
  }

  // 2. Formatear recetas para el prompt
  const todasRecetas = Object.values(recetasCandidatas).flat().map(r => ({
    id: r.id,
    nombre: r.nombre,
    categoria: r.tipo_plato ?? 'General',
    kcal: r.kcal,
    proteinas: r.proteinas,
    carbohidratos: r.carbohidratos,
    grasas: r.grasas,
  }))

  // 3. Cargar evidencia científica relevante
  const evidencia = await seleccionarProtocolos(db, {
    objetivo: 'perder_grasa',
    condiciones_salud: 'resistencia_insulina, celiaquía',
    sexo: 'mujer',
    edad: 32,
  })
  const conocimientoCientifico = formatearEvidenciaParaPrompt(evidencia.slice(0, 5))

  // 4. Construir prompt
  const datosCliente = {
    nombre: 'Laura García',
    objetivo: 'Pérdida de grasa (celiaquía + resistencia a insulina)',
    kcal_objetivo: kcalObjetivo,
    proteinas_objetivo: proteinas,
    carbohidratos_objetivo: carbos,
    grasas_objetivo: grasas,
    peso: 68,
    altura: 165,
    edad: 32,
    sexo: 'mujer',
    actividad: 'moderado (3 días gym/semana)',
    restricciones: ['Sin Gluten', 'Sin pescado azul'],
    condiciones: ['resistencia_insulina', 'celiaquía'],
    alimentos_base: ['pollo', 'huevo', 'arroz', 'yogur griego', 'espinacas'],
    tiempo_cocina: '30 minutos máximo',
    comidas_al_dia: 5,
  }

  const plantillas = [{
    id: 'deficit-moderado-sin-gluten',
    nombre: 'Déficit moderado sin gluten con control glucémico',
    kcal_objetivo: kcalObjetivo,
    proteinas_objetivo: proteinas,
    carbohidratos_objetivo: carbos,
    grasas_objetivo: grasas,
  }]

  const prompt = construirPrompt(datosCliente, plantillas, todasRecetas, conocimientoCientifico)

  // 5. Llamar DeepSeek
  console.log('\n🤖 Generando plan con DeepSeek...')
  const { data: plan, total_tokens } = await generarDietaConIA(prompt)

  console.log(`\n✅ Plan generado (${total_tokens} tokens)`)
  console.log('\n📋 COMIDAS DEL PLAN:')
  for (const comida of plan.comidas ?? []) {
    console.log(`\n  ── ${comida.nombre} ──────────────────────────────`)
    for (const alimento of comida.alimentos ?? []) {
      console.log(`     • ${alimento.receta_nombre} (${alimento.cantidad_porciones} porción/es)`)
    }
    if (comida.origen_adherencia === 'habitual_adaptado') {
      console.log(`     📌 Adaptado de dieta habitual: ${comida.adaptacion_habitual}`)
    }
  }

  console.log('\n📊 MACROS TOTALES:')
  const m = plan.macros_totales
  console.log(`  ${m?.kcal ?? '?'} kcal | ${m?.proteinas ?? '?'}g P | ${m?.carbohidratos ?? '?'}g C | ${m?.grasas ?? '?'}g G`)

  if (plan.notas_cliente) {
    console.log('\n💬 MENSAJE AL CLIENTE:')
    console.log(`  "${plan.notas_cliente}"`)
  }

  if (plan.protocolo_semana) {
    console.log('\n📅 PROTOCOLO SEMANAL:')
    console.log(`  Día entreno: ${plan.protocolo_semana.dia_entreno}`)
    console.log(`  Día descanso: ${plan.protocolo_semana.dia_descanso}`)
    console.log(`  Regla clave: ${plan.protocolo_semana.timing_clave}`)
  }

  if (plan.justificacion_coach) {
    console.log('\n🔬 JUSTIFICACIÓN CIENTÍFICA:')
    console.log(`  ${plan.justificacion_coach.razonamiento_macros}`)
    console.log('  Señales a monitorizar:')
    plan.justificacion_coach.senales_seguimiento?.forEach(s => console.log(`  - ${s}`))
  }

  return plan
}

async function generarPlanEntrenamiento() {
  console.log('\n\n═══════════════════════════════════════════════════════')
  console.log('💪 PLAN DE ENTRENAMIENTO — Laura García')
  console.log('═══════════════════════════════════════════════════════')

  // Evaluar perfil atleta de Laura
  const perfilEntreno = {
    id: 'test',
    cliente_id: LAURA_ID,
    sport_modality: 'gym' as const,
    objetivo_especifico: 'perdida_grasa_composicion',
    dias_disponibles: 3,
    capacidad_recuperacion: 'media' as const,
    respuesta_a_volumen: 'medio' as const,
    respuesta_psicologica: 'rutina' as const,
    patron_lesiones: [],
    plateau_detectado: false,
    semanas_sin_progresion: 0,
    equipo_disponible: ['pesas', 'mancuernas', 'barra'],
  }

  const recomendacion = evaluarPerfilEntreno(perfilEntreno)
  console.log('\n🎯 Recomendación motor-entreno:')
  console.log(`  Foco principal: ${recomendacion.foco_principal}`)
  console.log(`  Tier: ${recomendacion.tier} | Volumen: ${recomendacion.volumen} | Intensidad: ${recomendacion.intensidad}`)
  if (recomendacion.advertencias?.length) {
    console.log('  ⚠️  Advertencias:', recomendacion.advertencias.join(', '))
  }
  if (recomendacion.ajustes_adicionales?.length) {
    console.log('  🔧 Ajustes:', recomendacion.ajustes_adicionales.join(', '))
  }
  console.log(`  Filtros sugeridos:`, JSON.stringify(recomendacion.filtros_plantilla))

  // Buscar plantillas compatibles
  const { data: plantillas } = await db.from('plantillas_entrenamiento')
    .select('id, nombre, descripcion, sport_modality, tier')
    .limit(20)

  // Plantillas null sport_modality = genéricas (valen para gym y cualquier deporte)
  const modality = recomendacion.filtros_plantilla?.sport_modality
  const compatibles = plantillas?.filter(p =>
    !p.sport_modality || !modality || p.sport_modality === modality
  ) ?? []
  console.log(`\n📋 Plantillas compatibles (${compatibles.length}):`)
  compatibles.slice(0, 5).forEach(p => {
    console.log(`  • ${p.nombre} | ${p.sport_modality ?? 'genérica'} | ${p.tier}`)
  })
}

async function mostrarAlternativasRecetas() {
  console.log('\n\n═══════════════════════════════════════════════════════')
  console.log('🔄 ALTERNATIVAS DE RECETAS POR SLOT')
  console.log('═══════════════════════════════════════════════════════')

  const filtroCliente = {
    restricciones: ['Sin Gluten'],
    alimentos_evitar_extra: 'pescado azul, hígado',
    tiempo_cocina_min: 30,
    alimentos_base: ['pollo', 'huevo', 'arroz', 'yogur griego', 'espinacas'],
  }

  const slots = ['Desayuno', 'Comida', 'Cena', 'Merienda']
  for (const slot of slots) {
    const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObjetivo, proteinas, 5)
    const recetas = await filtrarRecetasPorSlot(db, slot, targetKcal, targetProt, filtroCliente, 5, LAURA_ID, 'perder_grasa', {}, null)

    console.log(`\n  📌 ${slot} (target: ~${targetKcal} kcal | ~${targetProt}g P):`)
    if (!recetas.length) {
      console.log('    ❌ Sin recetas compatibles')
    } else {
      recetas.forEach(r => {
        const glutenCheck = (r.intolerancias as string[] ?? []).includes('Gluten')
        const icon = glutenCheck ? '🔴' : '✅'
        console.log(`    ${icon} ${r.nombre} | ${r.kcal} kcal | ${r.proteinas}g P`)
      })
    }
  }
}

async function main() {
  try {
    await generarPlanNutricion()
    await generarPlanEntrenamiento()
    await mostrarAlternativasRecetas()
    console.log('\n\n✅ Simulación completada')
    console.log('Para ver el plan real: nutricoach-delta.vercel.app/clientes/5fbb70cf.../revisar-plan')
  } catch (err) {
    console.error('\n❌ Error:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main()
