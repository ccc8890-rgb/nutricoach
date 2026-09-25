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
    id: '0e07abb0-4697-4c3e-b9fc-adcba9cd1454',
    nombre: 'Andrés López',
    label: '🏋️ POWERLIFTER + DISLIPIDEMIA',
    peso: 95, altura: 175, edad: 45, sexo: 'hombre' as const,
    objetivo: 'recomposicion',
    deficitAjuste: -100,
    proteinas_gkg: 2.2,
    actividad_factor: 1.55,
    restricciones: [] as string[],
    condiciones: 'dislipidemia (LDL alto), 45 años, powerlifter',
    alimentos_base: ['carne roja magra', 'huevo', 'avena', 'nueces', 'salmón', 'lentejas'],
    alimentos_rechazados: 'embutidos grasos, mantequilla, nata, bollería',
    contexto_extra: 'Powerlifter: sentadilla 180kg, banca 130kg. Dislipidemia: reducir grasas saturadas, aumentar omega-3 y fibra soluble. Recomposición: mantener fuerza bajando grasa corporal.',
    deporte: 'fuerza',
  },
  {
    id: '869cd0b7-e2b6-4f50-a4fd-10845c734507',
    nombre: 'Sofía Ruiz',
    label: '🚴 CICLISTA + COLON IRRITABLE (SII)',
    peso: 60, altura: 168, edad: 26, sexo: 'mujer' as const,
    objetivo: 'rendimiento',
    deficitAjuste: 150,
    proteinas_gkg: 1.8,
    actividad_factor: 1.725,
    restricciones: [] as string[],
    condiciones: 'colon_irritable (SII), dieta baja en FODMAPs',
    alimentos_base: ['arroz blanco', 'pollo', 'plátano', 'patata', 'zanahoria', 'atún'],
    alimentos_rechazados: 'cebolla, ajo crudo, legumbres, lactosa alta, manzana cruda, pera, brócoli',
    contexto_extra: 'Ciclista amateur: rutas 80-150km fines de semana. SII severo: FODMAPs bajos estricto. Necesita carbohidratos de fácil digestión para rutas largas. Sin cebolla ni ajo en ninguna preparación.',
    deporte: 'ciclismo',
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

  // Para Sofía (SII), forzar FODMAPs bajos
  const esSII = c.condiciones.includes('colon_irritable')
  const filtroCliente = {
    restricciones: esSII ? [] : c.restricciones, // SII manejo manual en prompt, no por tag
    alimentos_evitar_extra: c.alimentos_rechazados,
    tiempo_cocina_min: 40,
    alimentos_base: c.alimentos_base,
  }

  const slots = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack']
  const todasRecetas: any[] = []
  const resumenSlots: string[] = []

  for (const slot of slots) {
    const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObj, prot, 5)

    // Para Sofía, usar filtro FODMAP bajo directamente en la query
    let recetas
    if (esSII) {
      recetas = await filtrarRecetasPorSlot(db, slot, targetKcal, targetProt,
        { restricciones: [], alimentos_evitar_extra: c.alimentos_rechazados, tiempo_cocina_min: 40, alimentos_base: c.alimentos_base },
        5, c.id, c.objetivo, {}, c.deporte)
    } else {
      recetas = await filtrarRecetasPorSlot(db, slot, targetKcal, targetProt, filtroCliente, 5, c.id, c.objetivo, {}, c.deporte)
    }

    todasRecetas.push(...recetas)
    resumenSlots.push(`${slot}:${recetas.length}`)
  }

  console.log('Candidatas por slot:', resumenSlots.join(' | '))

  // Esqueleto apropiado
  const prefs = {
    alimentos_favoritos: c.alimentos_base,
    alimentos_rechazados: c.alimentos_rechazados.split(',').map(s => s.trim()).filter(Boolean),
    intolerancias: c.restricciones,
    patologias: esSII ? ['colon_irritable'] : (c.condiciones.includes('dislipidemia') ? ['dislipidemia'] : []),
    tecnicas_preferidas: [] as string[],
    dieta_habitual: null,
  }

  const gap = { objetivo: c.objetivo, deporte: c.deporte, momento: esSII ? 'pre_entreno' : 'base', tipoPlato: 'Comida', actuales: 0, minimo: 3, prioridad: 'alta' as const, motivo: '' }
  const esq = seleccionarEsqueleto(gap, prefs)
  if (esq) {
    const ings = aplicarSustituciones(esq, prefs)
    console.log(`Esqueleto: ${esq.id} (FODMAPs: ${esq.metadatos.fodmaps})`)
    console.log(`  → ${ings.map(i => i.nombre).join(', ')}`)
  } else {
    console.log('⚠️ Sin esqueleto compatible')
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
  if (plan.justificacion_coach?.razonamiento_macros) console.log(`🔬 ${plan.justificacion_coach.razonamiento_macros.substring(0, 120)}`)

  return plan
}

async function main() {
  for (const c of CLIENTES) {
    await generarPlanCliente(c)
    await new Promise(r => setTimeout(r, 1000))
  }
  console.log('\n✅ Lote 2 completado')
}
main().catch(console.error)
