/**
 * Banco de pruebas de modelos para generar una dieta (caso Laura: celiaquía + resistencia a la insulina, 5 comidas).
 * Compara modelos con el MISMO prompt: tiempo, tokens y comprobaciones objetivas (recetas que existen, macros del día,
 * repeticiones, notas con datos del cliente). Cada modelo se llama solo (sin respaldo) para medirlo de verdad.
 * Uso:  npx tsx scripts/benchmark-dieta-modelos.ts [proveedor:modelo ...]
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { construirPrompt, generarDietaConIA, type DietaGenerada } from '../lib/deepseek'
import { filtrarRecetasPorSlot, calcularTargetSlot } from '../lib/plan-recetas'
import { seleccionarProtocolos, formatearEvidenciaParaPrompt } from '../lib/knowledge-base'

const LAURA_ID = '5fbb70cf-dbca-4541-8f37-7df2fa7ec6d1'
const MODELOS = process.argv.slice(2).length ? process.argv.slice(2) : ['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-5.5-2026-04-23', 'deepseek:deepseek-chat']

const tmb = 10 * 68 + 6.25 * 165 - 5 * 32 - 161
const kcalObjetivo = Math.round(tmb * 1.55) - 400
const proteinas = Math.round(68 * 2.4)
const grasas = Math.round(kcalObjetivo * 0.25 / 9)
const carbos = Math.round((kcalObjetivo - proteinas * 4 - grasas * 9) / 4)

interface Receta { id: string; nombre: string; categoria: string; kcal: number; proteinas: number; carbohidratos: number; grasas: number }

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const filtroCliente = { restricciones: ['Sin Gluten'], alimentos_evitar_extra: 'pescado azul, hígado', tiempo_cocina_min: 30, alimentos_base: ['pollo', 'huevo', 'arroz', 'yogur griego', 'espinacas'] }
  const candidatas: Receta[] = []
  for (const slot of ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack']) {
    const { targetKcal, targetProt } = calcularTargetSlot(slot, kcalObjetivo, proteinas, 5)
    const rs = await filtrarRecetasPorSlot(db, slot, targetKcal, targetProt, filtroCliente, 6, LAURA_ID, 'perder_grasa', {}, null)
    for (const r of rs) candidatas.push({ id: r.id, nombre: r.nombre, categoria: r.tipo_plato ?? 'General', kcal: r.kcal, proteinas: r.proteinas, carbohidratos: r.carbohidratos, grasas: r.grasas })
  }
  const evidencia = await seleccionarProtocolos(db, { objetivo: 'perder_grasa', condiciones_salud: 'resistencia_insulina, celiaquía', sexo: 'mujer', edad: 32 })
  const prompt = construirPrompt({
    nombre: 'Laura García', objetivo: 'Pérdida de grasa (celiaquía + resistencia a insulina)', kcal_objetivo: kcalObjetivo, proteinas_objetivo: proteinas,
    carbohidratos_objetivo: carbos, grasas_objetivo: grasas, peso: 68, altura: 165, edad: 32, sexo: 'mujer', actividad: 'moderado (3 días gym/semana)',
    restricciones: ['Sin Gluten', 'Sin pescado azul'], condiciones: ['resistencia_insulina', 'celiaquía'], alimentos_base: ['pollo', 'huevo', 'arroz', 'yogur griego', 'espinacas'],
    tiempo_cocina: '30 minutos máximo', comidas_al_dia: 5,
  } as Parameters<typeof construirPrompt>[0], [{ id: 'deficit-moderado-sin-gluten', nombre: 'Déficit moderado sin gluten con control glucémico', kcal_objetivo: kcalObjetivo, proteinas_objetivo: proteinas, carbohidratos_objetivo: carbos, grasas_objetivo: grasas }] as Parameters<typeof construirPrompt>[1], candidatas as Parameters<typeof construirPrompt>[2], formatearEvidenciaParaPrompt(evidencia.slice(0, 5)))
  console.log(`Caso: ${kcalObjetivo} kcal · ${proteinas} P · ${carbos} C · ${grasas} G · ${candidatas.length} recetas candidatas · prompt ${prompt.length} caracteres\n`)

  const porId = new Map(candidatas.map(r => [r.id, r]))
  for (const m of MODELOS) {
    process.env.IA_RUTA_PLAN_DIETA = m
    const t0 = Date.now()
    try {
      const { data, total_tokens } = await generarDietaConIA(prompt)
      console.log(evaluar(m, data, total_tokens, Date.now() - t0, porId))
    } catch (e) {
      console.log(`### ${m}\n  ❌ ${(e instanceof Error ? e.message : String(e)).slice(0, 200)} (${Math.round((Date.now() - t0) / 1000)} s)\n`)
    }
  }
}

function evaluar(modelo: string, d: DietaGenerada, tokens: number, ms: number, porId: Map<string, Receta>): string {
  const filas = d.comidas.flatMap(c => c.alimentos.map(a => ({ comida: c.nombre, ...a })))
  const inventadas = filas.filter(f => !porId.has(f.receta_id))
  // Macros del día recalculados con los datos reales de las recetas (no con lo que dice el modelo).
  const suma = { kcal: 0, p: 0, c: 0, g: 0 }
  for (const f of filas) { const r = porId.get(f.receta_id); if (!r) continue; suma.kcal += r.kcal * f.cantidad_porciones; suma.p += r.proteinas * f.cantidad_porciones; suma.c += r.carbohidratos * f.cantidad_porciones; suma.g += r.grasas * f.cantidad_porciones }
  const desv = (v: number, o: number) => `${v >= o ? '+' : ''}${Math.round(((v - o) / o) * 100)} %`
  const ids = filas.map(f => f.receta_id)
  const repetidas = ids.length - new Set(ids).size
  const palabras = (t?: string) => (t ?? '').split(/\s+/).filter(Boolean).length
  const cita = (d.justificacion_coach?.razonamiento_macros ?? '').match(/\b(19|20)\d\d\b/g)?.length ?? 0
  return [
    `### ${modelo} — ${Math.round(ms / 1000)} s · ${tokens} tokens`,
    `  recetas: ${filas.length} (inventadas/no candidatas: ${inventadas.length}${inventadas.length ? ' → ' + inventadas.map(i => i.receta_nombre).join(', ') : ''}) · repetidas en el día: ${repetidas}`,
    `  macros reales del día: ${Math.round(suma.kcal)} kcal (${desv(suma.kcal, kcalObjetivo)}) · P ${Math.round(suma.p)} (${desv(suma.p, proteinas)}) · C ${Math.round(suma.c)} (${desv(suma.c, carbos)}) · G ${Math.round(suma.g)} (${desv(suma.g, grasas)})`,
    `  notas al cliente: ${palabras(d.notas_cliente)} palabras · menciona celiaquía/insulina: ${/celiaqu|gluten/i.test(d.notas_cliente ?? '') ? 'sí' : 'no'}/${/insulin|glucé|glice/i.test(d.notas_cliente ?? '') ? 'sí' : 'no'} · razonamiento coach: ${palabras(d.justificacion_coach?.razonamiento_macros)} palabras (${cita} años citados) · señales: ${d.justificacion_coach?.senales_seguimiento?.length ?? 0}`,
    `  notas_cliente: «${(d.notas_cliente ?? '').slice(0, 420)}»`,
    '',
  ].join('\n')
}

main().catch(e => { console.error(e); process.exit(1) })
