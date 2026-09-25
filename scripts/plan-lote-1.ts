import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
import { createClient } from '@supabase/supabase-js'
import { construirPrompt, generarDietaConIA } from '../lib/deepseek'
import { filtrarRecetasPorSlot, calcularTargetSlot } from '../lib/plan-recetas'
import { seleccionarEsqueleto, aplicarSustituciones } from '../lib/recetas/agente-recetario/generator'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const CLIENTES = [
  {
    id: 'ca4c9412-67a3-4635-9420-c3013d489fc0',
    nombre: 'Carlos Rodríguez',
    label: '🏋️ HYROX COMPETITOR',
    peso: 82, altura: 180, edad: 28, sexo: 'hombre' as const,
    objetivo: 'rendimiento',
    kcalBase: 3200, // TDEE muy alto atleta
    deficitAjuste: 200, // ligero superávit
    proteinas_gkg: 2.0,
    actividad_factor: 1.9, // muy_activo
    restricciones: [] as string[],
    condiciones: 'ninguna',
    alimentos_base: ['arroz', 'pasta', 'pollo', 'huevo', 'plátano', 'dátiles'],
    alimentos_rechazados: '',
    contexto_extra: 'Competición Hyrox en 8 semanas. Necesita periodización: días de carga alta, tapering la semana previa.',
    deporte: 'hyrox',
  },
  {
    id: '09633508-50c3-4e70-b3d7-bde6944b5e79',
    nombre: 'María Sánchez',
    label: '🚴 TRIATLETA + HIPOTIROIDISMO',
    peso: 58, altura: 162, edad: 38, sexo: 'mujer' as const,
    objetivo: 'rendimiento',
    kcalBase: 0, // se calcula
    deficitAjuste: 100, // mínimo superávit para rendimiento
    proteinas_gkg: 1.8,
    actividad_factor: 1.9,
    restricciones: [] as string[],
    condiciones: 'hipotiroidismo (medicada con levotiroxina), sensible a goitrógenos crudos',
    alimentos_base: ['arroz', 'patata', 'pescado blanco', 'huevo', 'espinacas'],
    alimentos_rechazados: 'brócoli crudo, col cruda, repollo crudo, coliflor cruda',
    contexto_extra: 'Triatlón Sprint en 6 semanas. Hipotiroidismo: evitar goitrógenos crudos, priorizar yodo y selenio. 10-12h/semana entrenamiento.',
    deporte: 'triathlon',
  },
]

function calcularMacros(c: typeof CLIENTES[0]) {
  const tmb = c.sexo === 'mujer'
    ? 10 * c.peso + 6.25 * c.altura - 5 * c.edad - 161
    : 10 * c.peso + 6.25 * c.altura - 5 * c.edad + 5
  const tdee = Math.round(tmb * c.actividad_factor)
  const kcalObj = tdee + c.deficitAjuste
  const prot = Math.round(c.peso * c.proteinas_gkg)
  const grasas = Math.round(kcalObj * 0.25 / 9)
  const carbos = Math.round((kcalObj - prot * 4 - grasas * 9) / 4)
  return { tdee, kcalObj, prot, grasas, carbos }
}

async function generarPlanCliente(c: typeof CLIENTES[0]) {
  const { tdee, kcalObj, prot, grasas, carbos } = calcularMacros(c)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`${c.label} — ${c.nombre}`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`TDEE: ${tdee} kcal | Plan: ${kcalObj} kcal | P:${prot}g C:${carbos}g G:${grasas}g`)

  const filtroCliente = {
    restricciones: c.restricciones,
    alimentos_evitar_extra: c.alimentos_rechazados,
    tiempo_cocina_min: 45,
    alimentos_base: c.alimentos_base,
  }

  // Candidatas por slot
  const slots = ['Desayuno', 'Comida', 'Cena', 'Merienda']
  const todasRecetas: any[] = []
  const resumenSlots: string[] = []

  for (const slot of slots) {
    const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObj, prot, 5)
    const recetas = await filtrarRecetasPorSlot(db, slot, targetKcal, targetProt, filtroCliente, 5, c.id, c.objetivo, {}, c.deporte)
    todasRecetas.push(...recetas)
    resumenSlots.push(`${slot}: ${recetas.length} recetas (${targetKcal} kcal)`)

    // Verificar que ninguna receta tiene alérgeno problemático
    const conGluten = recetas.filter(r => (r.intolerancias as string[] ?? []).includes('Gluten'))
    if (c.restricciones.includes('Sin Gluten') && conGluten.length > 0) {
      console.log(`  ⚠️ GLUTEN encontrado en ${slot}!`)
    }
  }

  console.log('\nCandidatas:', resumenSlots.join(' | '))

  // Esqueletos apropiados
  const prefs = {
    alimentos_favoritos: c.alimentos_base,
    alimentos_rechazados: c.alimentos_rechazados.split(',').map(s => s.trim()).filter(Boolean),
    intolerancias: c.restricciones,
    patologias: c.condiciones.split(',').map(s => s.trim().split(' ')[0]),
    tecnicas_preferidas: [] as string[],
    dieta_habitual: null,
  }

  const gap = { objetivo: c.objetivo, deporte: c.deporte, momento: 'base', tipoPlato: 'Comida', actuales: 0, minimo: 3, prioridad: 'alta' as const, motivo: '' }
  const esq = seleccionarEsqueleto(gap, prefs)
  if (esq) {
    const ings = aplicarSustituciones(esq, prefs)
    console.log(`Esqueleto comida: ${esq.id} → ${ings.map(i => i.nombre).join(', ')}`)
  }

  // Generar plan con DeepSeek
  const recetasFormat = [...new Map(todasRecetas.map(r => [r.id, r])).values()].map(r => ({
    id: r.id, nombre: r.nombre, categoria: r.tipo_plato ?? 'General',
    kcal: r.kcal, proteinas: r.proteinas, carbohidratos: r.carbohidratos, grasas: r.grasas,
  }))

  const plantillas = [{
    id: `plantilla-${c.objetivo}-${c.deporte}`,
    nombre: `Plan ${c.objetivo} ${c.deporte}`,
    kcal_objetivo: kcalObj, proteinas_objetivo: prot,
    carbohidratos_objetivo: carbos, grasas_objetivo: grasas,
  }]

  const datosCliente: Record<string, string | string[] | number> = {
    nombre: c.nombre, objetivo: c.objetivo, deporte: c.deporte,
    kcal_objetivo: kcalObj, proteinas_objetivo: prot,
    carbohidratos_objetivo: carbos, grasas_objetivo: grasas,
    peso: c.peso, altura: c.altura, edad: c.edad, sexo: c.sexo,
    condiciones_salud: c.condiciones,
    alimentos_base: c.alimentos_base,
    restricciones: c.restricciones.length ? c.restricciones : ['ninguna'],
    contexto_especifico: c.contexto_extra,
  }

  console.log('\n🤖 Llamando DeepSeek...')
  const { data: plan, total_tokens } = await generarDietaConIA(construirPrompt(datosCliente, plantillas, recetasFormat))

  console.log(`✅ Plan generado (${total_tokens} tokens)`)
  console.log('\n📋 COMIDAS:')
  plan.comidas?.forEach(comida => {
    console.log(`  ${comida.nombre}:`)
    comida.alimentos?.forEach(a => console.log(`    • ${a.receta_nombre} ×${a.cantidad_porciones}`))
  })

  const m = plan.macros_totales
  console.log(`\n📊 ${m?.kcal ?? '?'} kcal | P:${m?.proteinas ?? '?'}g C:${m?.carbohidratos ?? '?'}g G:${m?.grasas ?? '?'}g`)
  console.log(`💬 ${plan.notas_cliente?.substring(0, 120)}...`)
  if (plan.protocolo_semana?.timing_clave) console.log(`⏱️  ${plan.protocolo_semana.timing_clave}`)
  if (plan.justificacion_coach?.razonamiento_macros) console.log(`🔬 ${plan.justificacion_coach.razonamiento_macros.substring(0, 120)}...`)

  return plan
}

async function main() {
  for (const cliente of CLIENTES) {
    await generarPlanCliente(cliente)
    await new Promise(r => setTimeout(r, 1000))
  }
  console.log('\n\n✅ Lote 1 completado')
}
main().catch(console.error)
