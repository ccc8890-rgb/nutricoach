/**
 * t46-auditar-cantidades.mjs
 *
 * T46 foco 2 — auditoría de cantidades absurdas en receta_ingredientes,
 * solo recetas con estado='aprobada'. Usa como referencia los defaults
 * CONDIMENTO_DEFAULTS_100G ya definidos en scripts/pipeline-calidad.mjs
 * (condimentos/especias/líquidos de aliño) más criterio de sentido común
 * de dietista para categorías no cubiertas (guarniciones, frutos secos,
 * quesos untables, etc).
 *
 * Genera salidas/auditoria-cantidades-2026-09-29.json con TODOS los casos
 * detectados (receta, ingrediente, cantidad actual, cantidad sugerida,
 * razón, confianza).
 *
 * Solo los casos "alta confianza" (categoría de condimento/especia inequívoca
 * y cantidad muy por encima de lo razonable, ej. >4x el default) se corrigen
 * automáticamente con --apply (y se recalculan macros). El resto queda solo
 * en el informe para revisión manual de Carlos.
 *
 * USO:
 *   node scripts/t46-auditar-cantidades.mjs             # dry-run, genera informe
 *   node scripts/t46-auditar-cantidades.mjs --apply      # aplica solo los de alta confianza
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const DRY = !process.argv.includes('--apply')
const envPath = resolve(process.cwd(), '.env.local')
if (!existsSync(envPath)) { console.error('No .env.local'); process.exit(1) }
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function normalizar(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// Mismos defaults que pipeline-calidad.mjs (condimentos/especias/líquidos de aliño)
const CONDIMENTO_DEFAULTS_100G = [
  { kw: ['sal marina', 'sal del himalaya', 'sal rosa', 'sal gorda', 'fleur de sel', 'sal en escamas', 'sal ahumada'], g: 5 },
  { kw: ['sal'], g: 5 },
  { kw: ['pimienta negra', 'pimienta blanca', 'pimienta rosa', 'pimienta verde'], g: 2 },
  { kw: ['pimienta'], g: 2 },
  { kw: ['pimenton ahumado', 'pimenton picante', 'pimenton dulce', 'pimenton', 'paprika smoked', 'paprika'], g: 5 },
  { kw: ['oregano'], g: 3 },
  { kw: ['tomillo'], g: 2 },
  { kw: ['romero seco', 'romero'], g: 2 },
  { kw: ['albahaca seca', 'albahaca'], g: 3 },
  { kw: ['perejil seco'], g: 5 },
  { kw: ['cilantro seco'], g: 5 },
  { kw: ['eneldo seco', 'eneldo'], g: 3 },
  { kw: ['estragon seco', 'estragon'], g: 2 },
  { kw: ['laurel'], g: 2 },
  { kw: ['comino molido', 'comino en polvo', 'comino'], g: 3 },
  { kw: ['curcuma'], g: 3 },
  { kw: ['curry en polvo', 'curry'], g: 5 },
  { kw: ['canela en polvo', 'canela molida', 'canela'], g: 5 },
  { kw: ['jengibre en polvo', 'jengibre molido'], g: 4 },
  { kw: ['jengibre'], g: 5 },
  { kw: ['ajo en polvo', 'ajo molido'], g: 3 },
  { kw: ['cebolla en polvo', 'cebolla molida'], g: 5 },
  { kw: ['cardamomo'], g: 2 },
  { kw: ['clavo'], g: 2 },
  { kw: ['anis estrellado', 'anis'], g: 3 },
  { kw: ['nuez moscada'], g: 2 },
  { kw: ['azafran'], g: 1 },
  { kw: ['cayena', 'chile flakes', 'hojuelas de chile', 'copos de chile', 'chile en polvo'], g: 2 },
  { kw: ['mostaza en polvo'], g: 5 },
  { kw: ['bicarbonato sodico', 'bicarbonato'], g: 5 },
  { kw: ['levadura quimica', 'polvo de hornear', 'polvo hornear', 'royal'], g: 8 },
  { kw: ['extracto de vainilla', 'extracto vainilla', 'esencia de vainilla', 'esencia vainilla'], g: 5 },
  { kw: ['esencia de almendra', 'aroma de almendra'], g: 5 },
  { kw: ['glutamato', 'glutamato monosodico', 'msg'], g: 3 },
  { kw: ['salsa de soja', 'soja baja en sal', 'tamari'], g: 20 },
  { kw: ['vinagre de arroz', 'vinagre de manzana', 'vinagre de vino', 'vinagre balsamico', 'vinagre'], g: 15 },
  { kw: ['miso blanco', 'miso rojo', 'pasta de miso', 'miso'], g: 15 },
  { kw: ['aceite de sesamo', 'aceite de coco'], g: 10 },
  { kw: ['aceite de aguacate'], g: 10 },
  { kw: ['zumo de lima', 'jugo de lima', 'lima'], g: 30 },
  { kw: ['zumo de limon', 'jugo de limon'], g: 20 },
  { kw: ['miel'], g: 15 },
  { kw: ['sriracha', 'tabasco', 'salsa picante'], g: 8 },
  { kw: ['chipotle', 'chipotles en adobo'], g: 25 },
  { kw: ['tahini', 'tahin'], g: 20 },
  { kw: ['mostaza'], g: 10 },
  { kw: ['ketchup'], g: 20 },
  { kw: ['salsa worcestershire', 'worcestershire'], g: 10 },
  { kw: ['pasta de curry', 'pasta curry'], g: 20 },
  { kw: ['concentrado de tomate', 'tomate concentrado'], g: 15 },
  // Guarniciones tipo encurtido (no estaban en el pipeline original)
  { kw: ['piparras', 'piparra'], g: 30 },
  { kw: ['aceitunas', 'aceituna'], g: 40 },
  { kw: ['alcaparras', 'alcaparra'], g: 15 },
  { kw: ['pepinillos', 'pepinillo'], g: 40 },
]

function buscarDefault(nombreLibre) {
  const n = normalizar(nombreLibre)
  for (const { kw, g } of CONDIMENTO_DEFAULTS_100G) {
    for (const k of kw) {
      const kN = normalizar(k)
      if (kN.includes(' ')) {
        if (n.includes(kN)) return g
      } else {
        if (n === kN || n.startsWith(kN + ' ')) return g
      }
    }
  }
  return null
}

async function main() {
  console.log(`Auditoría de cantidades — modo: ${DRY ? 'DRY-RUN' : 'APLICAR alta confianza'}\n`)

  // Traer todas las recetas aprobadas y sus ingredientes
  const { data: recetas, error: errR } = await sb.from('recetas').select('id, nombre, porciones, estado').eq('estado', 'aprobada')
  if (errR) { console.error(errR.message); process.exit(1) }
  console.log(`Recetas aprobadas: ${recetas.length}`)

  const hallazgos = []
  const BATCH = 50
  for (let i = 0; i < recetas.length; i += BATCH) {
    const lote = recetas.slice(i, i + BATCH)
    const ids = lote.map(r => r.id)
    const { data: ings, error: errI } = await sb
      .from('receta_ingredientes')
      .select('id, receta_id, nombre_libre, cantidad_gramos, alimentos(nombre, calorias)')
      .in('receta_id', ids)
    if (errI) { console.error(errI.message); continue }

    for (const ing of ings || []) {
      const g = ing.cantidad_gramos || 0
      const def = buscarDefault(ing.nombre_libre)
      if (def == null) continue
      // Umbral: por encima de 4x el default se considera absurdo (alta confianza)
      // Entre 2x y 4x se reporta como aviso (revisión manual)
      if (g <= def * 2) continue
      const receta = lote.find(r => r.id === ing.receta_id)
      const confianza = g > def * 4 ? 'alta' : 'media'
      hallazgos.push({
        receta_id: ing.receta_id,
        receta_nombre: receta?.nombre,
        ingrediente_id: ing.id,
        nombre_libre: ing.nombre_libre,
        alimento: ing.alimentos?.nombre,
        cantidad_actual_g: g,
        cantidad_sugerida_g: def,
        razon: `Condimento/guarnición tipo "${ing.nombre_libre}" — default típico ${def}g, actual ${g}g (${(g / def).toFixed(1)}x)`,
        confianza,
      })
    }
  }

  hallazgos.sort((a, b) => (b.cantidad_actual_g / b.cantidad_sugerida_g) - (a.cantidad_actual_g / a.cantidad_sugerida_g))
  console.log(`\nHallazgos: ${hallazgos.length} (alta confianza: ${hallazgos.filter(h => h.confianza === 'alta').length}, media: ${hallazgos.filter(h => h.confianza === 'media').length})\n`)
  for (const h of hallazgos) {
    console.log(`  [${h.confianza}] ${h.receta_nombre} — "${h.nombre_libre}" ${h.cantidad_actual_g}g → sugerido ${h.cantidad_sugerida_g}g`)
  }

  writeFileSync(
    resolve(process.cwd(), 'salidas/auditoria-cantidades-2026-09-29.json'),
    JSON.stringify({ fecha: '2026-09-29', total_recetas_auditadas: recetas.length, total_hallazgos: hallazgos.length, hallazgos }, null, 2)
  )
  console.log('\nInforme guardado en salidas/auditoria-cantidades-2026-09-29.json')

  // Aplicar SOLO los de alta confianza
  const altaConfianza = hallazgos.filter(h => h.confianza === 'alta')
  console.log(`\n${DRY ? 'DRY-RUN' : 'APLICANDO'} ${altaConfianza.length} casos de alta confianza...`)
  const recetasAfectadas = []
  for (const h of altaConfianza) {
    console.log(`  ${DRY ? '[dry]' : '[OK] '} ${h.receta_nombre} — "${h.nombre_libre}" ${h.cantidad_actual_g}g → ${h.cantidad_sugerida_g}g`)
    if (!DRY) {
      const { error } = await sb.from('receta_ingredientes').update({ cantidad_gramos: h.cantidad_sugerida_g }).eq('id', h.ingrediente_id)
      if (error) console.error('    ERROR:', error.message)
      else recetasAfectadas.push(h.receta_id)
    }
  }

  if (!DRY && recetasAfectadas.length) {
    console.log(`\nRecalculando macros para ${new Set(recetasAfectadas).size} recetas...`)
    for (const receta_id of new Set(recetasAfectadas)) {
      const { data: receta } = await sb.from('recetas').select('nombre, porciones').eq('id', receta_id).single()
      const porciones = receta?.porciones || 1
      const { data: ingsR } = await sb.from('receta_ingredientes')
        .select('cantidad_gramos, alimentos(calorias, proteinas, carbohidratos, grasas, fibra)')
        .eq('receta_id', receta_id)
      let kcal = 0, prot = 0, carb = 0, gras = 0, fib = 0
      for (const i of (ingsR || [])) {
        const g = i.cantidad_gramos || 0
        const a = i.alimentos
        if (!a) continue
        kcal += (a.calorias || 0) * g / 100
        prot += (a.proteinas || 0) * g / 100
        carb += (a.carbohidratos || 0) * g / 100
        gras += (a.grasas || 0) * g / 100
        fib += (a.fibra || 0) * g / 100
      }
      const pesoTotal = (ingsR || []).reduce((s, i) => s + (i.cantidad_gramos || 0), 0)
      const macros = {
        kcal: Math.round(kcal / porciones * 10) / 10,
        proteinas: Math.round(prot / porciones * 10) / 10,
        carbohidratos: Math.round(carb / porciones * 10) / 10,
        grasas: Math.round(gras / porciones * 10) / 10,
        fibra: Math.round(fib / porciones * 10) / 10,
        kcal_100g: pesoTotal > 0 ? Math.round(kcal / pesoTotal * 100 * 10) / 10 : 0,
        peso_total_g: Math.round(pesoTotal),
      }
      console.log(`  OK ${receta?.nombre}: ${macros.kcal} kcal | P:${macros.proteinas}g | C:${macros.carbohidratos}g | G:${macros.grasas}g`)
      await sb.from('recetas').update(macros).eq('id', receta_id)
    }
  }
  console.log(`\n${DRY ? 'DRY-RUN completo. Ejecuta con --apply para aplicar los de alta confianza.' : 'Cambios aplicados.'}`)
}
main()
