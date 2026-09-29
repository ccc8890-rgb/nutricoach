/**
 * t46-fix-cantidades.mjs
 *
 * T46 foco 2 — aplica los casos de "cantidad absurda" que resultaron ser
 * de alta confianza y bajo riesgo tras revisar el informe generado por
 * scripts/t46-auditar-cantidades.mjs contra el contexto real de cada receta
 * (instrucciones, porciones, peso total).
 *
 * IMPORTANTE — hallazgo durante la revisión: la mayoría de los "condimentos
 * a cantidad absurda" que el audit automático marcó como alta confianza
 * (Aceite de coco 60-80g, Miel 60-80g, Extracto de vainilla 30g, Zumo de
 * limón 120g, Mix de especias barbacoa completo) resultaron ser cantidades
 * NORMALES para recetas de bulk baking (bizcochos/brownies para 6-9
 * porciones) o para una receta que es literalmente una mezcla de especias
 * (el "default" de condimento asume uso como aliño puntual, no como
 * ingrediente base de una masa o un rub). Esos NO se tocan aquí — quedan
 * documentados en el informe para revisión manual de Carlos.
 *
 * En cambio se descubrió un bug real y sistémico NO capturado por el
 * criterio de "cantidad": "Cebolla en polvo" (330kcal/100g) vinculado en
 * 14 recetas a cantidades de 30-150g que las instrucciones dejan claro que
 * son CEBOLLA FRESCA (40kcal/100g) picada/sofrita/en rodajas — la cantidad
 * ya es correcta para cebolla fresca, el problema es el alimento vinculado
 * (mismo patrón de T45, pero con nombre_libre Y alimento ambos mal
 * etiquetados como "polvo" en vez de fresca). Se corrige aquí como RELINK,
 * no como reducción de cantidad.
 *
 * USO:
 *   node scripts/t46-fix-cantidades.mjs            # dry-run
 *   node scripts/t46-fix-cantidades.mjs --apply    # aplica cambios
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const DRY = !process.argv.includes('--apply')
const envPath = resolve(process.cwd(), '.env.local')
if (!existsSync(envPath)) { console.error('No .env.local'); process.exit(1) }
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const CEBOLLA = '950afc33-a417-4ace-8aa2-8ea809c7913c'       // Cebolla (40kcal)
const CEBOLLA_ROJA = '08637e90-5e34-4cb3-baa9-b63bbb168f97'  // Cebolla roja (40kcal)
const CEBOLLA_MORADA = '849140d6-5dcb-43d9-b9b7-ec6f161baa15' // Cebolla morada (40kcal)

// RELINK: "Cebolla en polvo" -> cebolla fresca real (14 recetas, instrucciones confirman cebolla fresca)
const RELINKS = [
  ['05578bc2-dde4-4412-aeaf-f4762c98fc41', 'a7710219-4159-4955-bc93-ee78d2c2aacd', 'Lentejas estofadas con verduras', CEBOLLA, 'Cebolla'],
  ['c18ae431-360d-40ae-b884-6603b20c52e0', 'e6cac1b5-679f-467f-8c1a-a0ea49957919', 'Crema de calabaza con jengibre', CEBOLLA, 'Cebolla'],
  ['f06da0fe-f94a-40d5-acac-850f5846119e', 'ef3d463d-1dcc-44f1-abe6-7384f7bf5776', 'Ensalada de espinacas con pollo y vinagreta balsámica', CEBOLLA, 'Cebolla'],
  ['767b4b87-de10-4193-b860-0287818523ee', 'e74e1362-27c3-42de-8dad-539a8bc095ac', 'Solomillo de cerdo al horno con manzana', CEBOLLA, 'Cebolla'],
  ['ee4ec959-aab9-48a8-b1a5-94be5f135ec8', 'c2fb3335-da24-433a-9440-3f4de1b06717', 'Pimientos rellenos de pollo y arroz', CEBOLLA, 'Cebolla'],
  ['93d2e0f5-3a08-431a-82c6-318d1df357e9', '0fa9717a-c6b5-48f1-97e3-97cfb10e5dd2', 'Salteado de ternera con brócoli y jengibre', CEBOLLA, 'Cebolla'],
  ['d80ca9fd-5368-43c2-8b14-83a33b8f151e', 'aba951fa-ceeb-4870-b81d-c8f46beba7d5', 'Ensalada templada de garbanzos con bacalao', CEBOLLA_ROJA, 'Cebolla roja'],
  ['045076c8-e092-41b5-87c7-e2c4be9563e0', '4bdd030d-45a3-43e8-9087-ec476976cbf5', 'Tortilla de claras con verduras al horno', CEBOLLA, 'Cebolla'],
  ['b10fc5ae-c901-4040-8940-79fb68bb7570', '9173949b-a7eb-43de-becf-148678347f89', 'Ceviche de corvina con mango', CEBOLLA_ROJA, 'Cebolla roja'],
  ['10ab3d20-3794-422e-b1b3-3d4512981061', 'a9eefce7-67c0-4e1a-9f2b-b23320518a1c', 'Gazpacho de sandía y tomate', CEBOLLA, 'Cebolla'],
  ['030faf79-d542-491f-836f-7182935dcc8a', '069d9981-722c-4146-95bc-65e535a8d7c9', 'Ensalada de lentejas con verduras asadas', CEBOLLA_MORADA, 'Cebolla morada'],
  ['f6a1da99-8ef7-4f96-a01b-42869d72d17a', '35046b95-bc3d-4d6a-a958-d29f169f181f', 'Pizza casera de base de coliflor', CEBOLLA, 'Cebolla'],
  ['b24ce132-f2e7-4260-9a21-d85ad9c54f53', 'e639ece9-e64c-4f5a-afd6-d62e794f3b1c', 'Tartar de salmón con aguacate', CEBOLLA, 'Cebolla'],
  ['a0da05fd-7ec5-45fa-9288-47823b6dc34c', '1868ea87-f9f6-41bc-bc8b-1f912e5ff47a', 'Wrap de lechuga con atún y verduras', CEBOLLA, 'Cebolla'],
]

// CANTIDAD: único caso inequívoco independiente de contexto (levadura química
// no puede ser el 20% del peso de un bizcocho en ningún escenario)
const CANTIDAD_FIXES = [
  // [ingrediente_id, receta_id, receta_nombre, nombre_libre, cantidad_nueva]
  ['id-bizcocho-polvo-hornear', 'PLACEHOLDER', 'Bizcocho proteico con pepitas de chocolate', 'Polvo de hornear', 8],
]

async function recalcularMacros(recetaIds) {
  const ids = [...new Set(recetaIds)]
  console.log(`\nRecalculando macros para ${ids.length} recetas afectadas...`)
  for (const receta_id of ids) {
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
      fib += (a.fibra || 0) * g / 100
    }
    const pesoTotal = (ings || []).reduce((s, i) => s + (i.cantidad_gramos || 0), 0)
    const macros = {
      kcal: Math.round(kcal / porciones * 10) / 10,
      proteinas: Math.round(prot / porciones * 10) / 10,
      carbohidratos: Math.round(carb / porciones * 10) / 10,
      grasas: Math.round(gras / porciones * 10) / 10,
      fibra: Math.round(fib / porciones * 10) / 10,
      kcal_100g: pesoTotal > 0 ? Math.round(kcal / pesoTotal * 100 * 10) / 10 : 0,
      peso_total_g: Math.round(pesoTotal),
    }
    console.log(`  ${DRY ? '(dry)' : 'OK'} ${receta?.nombre}: ${macros.kcal} kcal | P:${macros.proteinas}g | C:${macros.carbohidratos}g | G:${macros.grasas}g`)
    if (!DRY) await sb.from('recetas').update(macros).eq('id', receta_id)
  }
}

async function main() {
  console.log(`T46 foco 2 — fix cantidades/relink cebolla — modo: ${DRY ? 'DRY-RUN' : 'APLICAR'}\n`)
  const recetasAfectadas = []

  console.log('== Relink "Cebolla en polvo" -> cebolla fresca (14 recetas) ==')
  for (const [ingId, recetaId, recetaNombre, destId, destNombre] of RELINKS) {
    const { data: row, error } = await sb.from('receta_ingredientes').select('id, nombre_libre, cantidad_gramos, alimento_id').eq('id', ingId).maybeSingle()
    if (error || !row) { console.error(`  ERROR ${ingId}:`, error?.message || 'no encontrado'); continue }
    if (row.alimento_id === destId) { console.log(`  (ya correcto) ${recetaNombre}`); continue }
    console.log(`  ${DRY ? '[dry]' : '[OK] '} ${recetaNombre} — "${row.nombre_libre}" (${row.cantidad_gramos}g) → ${destNombre} (cantidad sin cambios)`)
    if (!DRY) {
      const { error: upErr } = await sb.from('receta_ingredientes').update({ alimento_id: destId }).eq('id', ingId)
      if (upErr) console.error('    ERROR:', upErr.message)
    }
    recetasAfectadas.push(recetaId)
  }

  console.log('\n== Cantidad absurda inequívoca (Polvo de hornear) ==')
  const { data: bizc } = await sb.from('recetas').select('id').ilike('nombre', '%Bizcocho proteico con pepitas de chocolate%').limit(1)
  if (bizc?.[0]) {
    const { data: ing } = await sb.from('receta_ingredientes').select('id, nombre_libre, cantidad_gramos').eq('receta_id', bizc[0].id).ilike('nombre_libre', '%polvo de hornear%').maybeSingle()
    if (ing) {
      console.log(`  ${DRY ? '[dry]' : '[OK] '} Bizcocho proteico con pepitas de chocolate — "${ing.nombre_libre}" ${ing.cantidad_gramos}g → 8g`)
      if (!DRY) await sb.from('receta_ingredientes').update({ cantidad_gramos: 8 }).eq('id', ing.id)
      recetasAfectadas.push(bizc[0].id)
    }
  }

  await recalcularMacros(recetasAfectadas)
  console.log(`\n${DRY ? 'DRY-RUN completo. Ejecuta con --apply para aplicar.' : 'Cambios aplicados.'}`)
}
main()
