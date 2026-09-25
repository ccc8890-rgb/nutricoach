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
    id: 'ae6e6f15-6e1e-4eb0-ab0b-5a09c6de5fc0',
    nombre: 'Javier Morales',
    label: '🏃 RUNNER 52 AÑOS + PREDIABETES + SIN LACTOSA',
    peso: 88, altura: 174, edad: 52, sexo: 'hombre' as const,
    objetivo: 'perder_grasa',
    deficitAjuste: -500,
    proteinas_gkg: 2.2, // alto para preservar masa muscular a los 52
    actividad_factor: 1.55,
    restricciones: ['Sin Lactosa'],
    condiciones: 'prediabetes leve (glucosa 108 mg/dL en ayunas), 52 años, sarcopenia prevention',
    alimentos_base: ['huevo', 'pollo', 'pescado azul', 'nueces', 'arroz', 'patata'],
    alimentos_rechazados: 'lácteos, nata, mantequilla, leche entera',
    contexto_extra: 'Runner 52 años: 30-50km/semana. Prediabetes: índice glucémico bajo, evitar picos de insulina. Sarcopenia: proteína alta distribuida en todas las comidas (>30g/comida). Sin lactosa total.',
    deporte: 'running',
  },
  {
    id: '63f31484-66ec-43e5-ab09-d548a74b0498',
    nombre: 'Natalia González',
    label: '🌱 MARATONIANA VEGANA + ANEMIA FERROPÉNICA',
    peso: 54, altura: 166, edad: 34, sexo: 'mujer' as const,
    objetivo: 'rendimiento',
    deficitAjuste: 200,
    proteinas_gkg: 1.9, // algo más alto por menor biodisponibilidad proteína vegetal
    actividad_factor: 1.9, // 80-90km/semana
    restricciones: ['Vegano'],
    condiciones: 'anemia ferropénica leve (en tratamiento con hierro oral), vegana estricta',
    alimentos_base: ['legumbres', 'tofu', 'tempeh', 'quinoa', 'arroz', 'frutos secos', 'frutas'],
    alimentos_rechazados: 'carne, pescado, marisco, huevo, lácteos, miel, cualquier producto animal',
    contexto_extra: 'Maratoniana 80-90km/semana. Vegana estricta: proteína completa (combinaciones). Anemia: potenciar hierro no hemo + vitamina C en la misma comida, evitar té/café justo después. Suplementa B12, omega-3 vegano, hierro. Alto volumen carbohidratos para entrenamiento de fondo.',
    deporte: 'running',
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
  console.log(`TDEE: ${tdee} | Plan: ${kcalObj} kcal | P:${prot}g C:${carbos}g G:${grasas}g`)

  const filtroCliente = {
    restricciones: c.restricciones,
    alimentos_evitar_extra: c.alimentos_rechazados,
    tiempo_cocina_min: 45,
    alimentos_base: c.alimentos_base,
  }

  const slots = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack']
  const todasRecetas: any[] = []
  const resumenSlots: string[] = []

  for (const slot of slots) {
    const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObj, prot, 5)
    const recetas = await filtrarRecetasPorSlot(db, slot, targetKcal, targetProt, filtroCliente, 5, c.id, c.objetivo, {}, c.deporte)
    todasRecetas.push(...recetas)
    resumenSlots.push(`${slot}:${recetas.length}`)

    // Para vegana: verificar que no haya productos animales
    if (c.restricciones.includes('Vegano')) {
      const conAnimal = recetas.filter(r => {
        const n = r.nombre.toLowerCase()
        return n.includes('pollo') || n.includes('huevo') || n.includes('pecho') || n.includes('atún') || n.includes('salmon') || n.includes('queso') || n.includes('yogur')
      })
      if (conAnimal.length > 0) console.log(`  ⚠️ VEGANO: ${slot} tiene ${conAnimal.length} recetas con posible animal: ${conAnimal.map(r => r.nombre).join(', ')}`)
    }
  }

  console.log('Candidatas por slot:', resumenSlots.join(' | '))

  // Esqueleto apropiado
  const prefs = {
    alimentos_favoritos: c.alimentos_base,
    alimentos_rechazados: c.alimentos_rechazados.split(',').map(s => s.trim()).filter(Boolean),
    intolerancias: c.restricciones,
    patologias: c.condiciones.includes('anemia') ? ['anemia'] : (c.condiciones.includes('prediabetes') ? ['resistencia_insulina'] : []),
    tecnicas_preferidas: [] as string[],
    dieta_habitual: null,
  }

  const gap = { objetivo: c.objetivo, deporte: c.deporte, momento: 'base', tipoPlato: 'Comida', actuales: 0, minimo: 3, prioridad: 'alta' as const, motivo: '' }
  const esq = seleccionarEsqueleto(gap, prefs)
  if (esq) {
    const ings = aplicarSustituciones(esq, prefs)
    console.log(`Esqueleto: ${esq.id}`)
    console.log(`  → ${ings.map(i => i.nombre).join(', ')}`)
  } else {
    console.log('⚠️ Sin esqueleto compatible para este perfil')
  }

  // Plan DeepSeek
  const recetasFormat = [...new Map(todasRecetas.map(r => [r.id, r])).values()].map(r => ({
    id: r.id, nombre: r.nombre, categoria: r.tipo_plato ?? 'General',
    kcal: r.kcal, proteinas: r.proteinas, carbohidratos: r.carbohidratos, grasas: r.grasas,
  }))

  const plantillas = [{
    id: `plan-${c.objetivo}`, nombre: `Plan ${c.objetivo} ${c.deporte}`,
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
    alimentos_a_evitar: c.alimentos_rechazados,
    restricciones: c.restricciones,
    contexto_especifico: c.contexto_extra,
  }

  console.log('\n🤖 DeepSeek...')
  const { data: plan, total_tokens } = await generarDietaConIA(construirPrompt(datosCliente, plantillas, recetasFormat))

  console.log(`✅ ${total_tokens} tokens`)
  plan.comidas?.forEach(comida => {
    console.log(`  ${comida.nombre}: ${comida.alimentos?.map(a => a.receta_nombre).join(', ')}`)
  })
  const m = plan.macros_totales
  console.log(`📊 ${m?.kcal ?? '?'} kcal | P:${m?.proteinas ?? '?'}g C:${m?.carbohidratos ?? '?'}g G:${m?.grasas ?? '?'}g`)
  console.log(`💬 ${plan.notas_cliente?.substring(0, 130)}`)
  if (plan.justificacion_coach?.razonamiento_macros) console.log(`🔬 ${plan.justificacion_coach.razonamiento_macros.substring(0, 130)}`)

  return plan
}

async function main() {
  for (const c of CLIENTES) {
    await generarPlanCliente(c)
    await new Promise(r => setTimeout(r, 1000))
  }
  console.log('\n✅ Lote 3 completado')
}
main().catch(console.error)
