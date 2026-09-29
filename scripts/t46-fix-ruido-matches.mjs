/**
 * t46-fix-ruido-matches.mjs
 *
 * T46 — revisión uno a uno de los ~85 hallazgos de la auditoría de matches
 * 2026-09-28 que en T45 se descartaron como "ruido" sin revisar individualmente.
 *
 * Tras revisar los 85 contra la tabla `alimentos` real, se identificaron 28
 * casos de match genuinamente incorrecto (producto distinto, no solo plural/
 * sinónimo) con candidato claro ya existente en BD. El resto (~57) son ruido
 * real: plurales, singular/plural, sinónimos, o casos donde el alimento_id
 * YA es correcto pese a que el nombre_libre está corrupto (mismo patrón que
 * T43b) — esos NO se tocan aquí.
 *
 * USO:
 *   node scripts/t46-fix-ruido-matches.mjs            # dry-run
 *   node scripts/t46-fix-ruido-matches.mjs --apply    # aplica cambios
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

// [ingrediente_id, receta_id, nombre_libre (referencia), alimento_destino_id, alimento_destino_nombre, motivo]
const FIXES = [
  ['3862d8fc-3561-437e-ae20-66f34611fab6', '3a51f57b-5367-43b7-aff5-3fef4308e9cf', 'leche de almendras sin azúcar', 'e3012f44-f60c-4d62-895e-29608cb8c4f7', 'Leche de almendras (sin azúcar)', 'estaba vinculado a "Barritas de chocolate con leche Hacendado" (golosina, no bebida vegetal)'],
  ['6428a6d0-25de-4215-9bb5-656fc23fab27', '3a51f57b-5367-43b7-aff5-3fef4308e9cf', 'proteína whey sabor vainilla (opcional)', '9076c191-d2a5-4b24-9974-45dda11a5067', 'Proteína en polvo sabor vainilla', 'variante de la wording no cubierta por el patrón "proteína whey vainilla" fijado en T45; mismo bug (natillas Hacendado en vez de proteína en polvo)'],
  ['0d33545d-f5d9-48f0-be8f-d994c8df8459', 'b042f8f1-8690-4f62-a304-1ac17c572012', 'Ajo crudo', '7be57835-0184-4a79-94b9-2d04bcb1a532', 'Ajo crudo', 'existe alimento "Ajo crudo" exacto en BD; estaba vinculado a "Ajo en polvo" (forma distinta, ~2x más calórico/100g)'],
  ['174de5e9-4885-4bd1-9833-f354e24c3ddd', 'a04a426a-1c09-40f6-aed9-1b07b1adf553', 'Aceite de coco', 'c80ea243-1418-4724-b423-3ae3cb554be5', 'Aceite de Coco Virgen Extra', 'vinculado a "Aceite vegetal" — perfil graso muy distinto (coco = grasa saturada, girasol/vegetal = poliinsaturada)'],
  ['497fe897-4c1d-44e5-908a-31f98c12fdcb', 'a04a426a-1c09-40f6-aed9-1b07b1adf553', 'Ajo crudo', '7be57835-0184-4a79-94b9-2d04bcb1a532', 'Ajo crudo', 'mismo caso que arriba en Tacos BigMac (estaba en Ajo en polvo)'],
  ['91c56bab-466b-4633-9853-1e51f5224176', 'd6b14a58-435c-430d-b5bd-800d106b9347', 'Edulcorante apto cocina', '5d6c5dea-ec75-478b-9780-9729f3f61108', 'Edulcorante Eritritol y Sucralosa', 'vinculado a "COCINARTE Seitons tempura" (producto de seitán rebozado, nada que ver con un edulcorante)'],
  ['07adef1f-22e6-489c-85f3-608a66ad18d9', '3af09efa-ba2b-4e7b-89ea-58581ab72343', 'Pasta integral (farfalle)', '79744190-666f-49ef-b30a-2feef9d7de7a', 'Pasta integral (cocida)', 'vinculado a "Pasta de curry rojo" (pasta de condimento tailandesa, no pasta alimenticia)'],
  ['7d6658de-7b46-4f81-9c0b-8192008879a7', 'ead1158d-78d1-4593-91d7-189a5ca4ac1a', 'Aceite de coco', 'c80ea243-1418-4724-b423-3ae3cb554be5', 'Aceite de Coco Virgen Extra', 'vinculado a "Aceite de oliva virgen extra" — producto distinto al indicado'],
  ['7b8a211d-32cc-40e4-8c13-e84f56cb83b6', 'ec67fdbd-91eb-4a94-96dd-b410adf846f2', 'Pasta de trufa', 'be9252c7-129e-4076-9b8c-e312431664e1', 'Salsa de Trufa', 'vinculado a "Pasta" genérica (pasta alimenticia, no pasta/condimento de trufa). No existe "pasta de trufa" en BD — Salsa de Trufa es el candidato más cercano (mismo uso culinario en pequeña cantidad)'],
  ['7f9a8154-02c0-4657-b337-1d11d3f23f2b', '24e95e2b-989f-4d33-afab-9d4f5400d9f6', 'Bebida de almendras sin azúcar', 'ee6bfc00-e603-4792-99a0-5c6a60038845', 'Bebida de Almendras Sin Azúcar Brik', 'vinculado a "Bebida de avena con chocolate sin azucares añadidos" — tipo de bebida vegetal y sabor distintos'],
  ['c74ffc4f-be0f-4891-82f6-771e682bbe3b', '0509ce01-fdc5-4888-a4fd-5608fd47c25f', 'Crema de cacahuete natural sin azúcar', 'c214f46e-b390-4185-bdce-ea21e5771ea5', 'Mantequilla de cacahuete (natural)', 'vinculado a "Crema de avellanas (sin azúcar)" — fruto seco distinto, perfil de macros distinto'],
  ['c8df07d9-9df2-4865-a7fd-7f2b36f6a4c0', '5e1f8020-ec0c-43f3-a4cd-330e99121ce5', 'Queso light en loncha', '2626b88e-2042-4a01-b31d-366c6b6daaae', 'Queso Havarti Light Lonchas', 'vinculado a "Lonchas de Queso Brie" (queso graso completo, no light)'],
  ['beb350d8-ed66-4141-8b93-3e4506dd07c3', 'c957235a-c1df-445d-a593-70bb9110ef94', 'Queso cheddar light en loncha', '2626b88e-2042-4a01-b31d-366c6b6daaae', 'Queso Havarti Light Lonchas', 'vinculado a "Lonchas de Queso Brie" (queso graso completo, no light/cheddar). No hay "cheddar light" en BD — Havarti Light es el candidato light más cercano'],
  ['c66ab3c9-74f5-496f-b5e5-9d4dedcda24f', '290d6fc2-2cca-402c-ab38-61ae8ac06b98', 'melocotón en almíbar (escurrido)', '33c16ea1-f9e5-4534-b333-d2f728eee1b0', 'Melocoton almibar', 'vinculado a "Yogur Líquido Melocotón-Maracuyá" (producto lácteo, no fruta en almíbar)'],
  ['b92cd529-fc82-4d31-9872-9ab7b39586f1', '35436a05-acac-4687-91ff-0a14e5d71340', 'Aceite de coco', 'c80ea243-1418-4724-b423-3ae3cb554be5', 'Aceite de Coco Virgen Extra', 'vinculado a "Aceite de oliva virgen extra" — producto distinto al indicado'],
  ['3ac3724f-0d9f-41f9-9310-04ffbcbf065c', '58ab742c-9e34-4263-b787-e30d56e76c5a', 'Anchoas', '04df93c9-55e2-4032-bd32-9446820a42e0', 'Anchoa del Cantábrico en Aceite Oliva', 'vinculado a "Palito Queso y Anchoa" (snack de picoteo, no anchoas solas)'],
  ['d68ff8a5-2e39-429f-bdd3-86f6010f1391', '35216a61-4ae2-4097-81e9-36d8690cc99b', 'leche de almendras sin azúcar', 'e3012f44-f60c-4d62-895e-29608cb8c4f7', 'Leche de almendras (sin azúcar)', 'mismo bug que #1 en otra receta (vinculado a barritas de chocolate)'],
  ['5d71cfe7-52ee-4e5f-a235-e8cde99a8465', '849b6048-850a-44b6-a679-0963f5c02939', 'pan de proteína (rebanada)', '8c1da789-be62-41d6-9452-60f398de2db3', 'Pan de Molde Proteina', 'en T45 se dejó pendiente por no encontrar candidato — SÍ existe "Pan de Molde Proteina" (230kcal, P15/C30/G5) en BD, candidato claro. Estaba vinculado a natillas Hacendado (postre, no pan)'],
  ['e93d89a0-6dcd-4094-a7c3-f37785e32bef', 'd920649a-14b3-450e-b530-b6db16a27208', 'Agua de coco', '0366414a-04e6-4b4f-b69f-f74d0d263afc', 'Agua de coco Hacendado 100%', 'vinculado a "Agua" (0kcal) — el agua de coco tiene azúcares/electrolitos propios (19kcal/100g), relevante en receta de bebida isotónica casera'],
  ['73763529-b22d-4bfc-b063-a6afd24a1815', '06f947e1-9550-4faa-9e3c-a1aae75a7cd2', 'queso en lonchas bajo en grasa (tipo Edam o Havarti)', '2626b88e-2042-4a01-b31d-366c6b6daaae', 'Queso Havarti Light Lonchas', 'vinculado a "Queso añejo fuerte de oveja" (queso curado fuerte, mucha más grasa) — mismo patrón cottage/queso-añejo de T45 pero con wording distinto no cubierto entonces. El propio nombre_libre menciona "Havarti"'],
  ['2382d6bc-cbd7-44ac-993c-094ff5d644f9', 'e09aeb6a-012c-4b66-b3c9-85edc2e0514c', 'Pasta de maní natural', 'c214f46e-b390-4185-bdce-ea21e5771ea5', 'Mantequilla de cacahuete (natural)', 'vinculado a "Pasta" genérica (pasta alimenticia) — maní = cacahuete, "pasta de maní" es mantequilla de cacahuete'],
  ['39cca280-0731-4fcf-a951-5127a7e39c76', '6e3a6f08-8157-4e06-9d3f-37cfe3167249', 'Crema de leche (nata)', 'aec3e946-62b4-4c5d-b09b-74d725262418', 'Nata para cocinar', 'vinculado a "Leche" (3-4% grasa) — la nata para cocinar tiene ~19% grasa, diferencia real en una salsa'],
  ['9b388b51-f85b-4596-8487-869cd33656e1', '6086ee10-3b7b-46ca-9ebf-be8ef37ab5f0', 'Zumo de naranja natural', 'a7b4fb94-007c-4332-9935-f0415f668012', 'Zumo de naranja natural', 'existe match EXACTO por nombre en BD ("Zumo de naranja natural") pero estaba vinculado a "Zumo de limón"'],
  ['f598f79b-ad0a-4d77-a757-ce8cd1d06b41', '37da0e73-ea0a-4cf8-886a-f55adc15eab5', 'Ajo crudo', '7be57835-0184-4a79-94b9-2d04bcb1a532', 'Ajo crudo', 'mismo caso que arriba en Tofu Empanado (estaba en Ajo en polvo)'],
  ['c273da8f-65c2-4918-bc93-9b5dc75d08fe', '2c5996c2-9b0e-426b-a15e-d551309a6ebb', 'Edulcorante apto cocina', '5d6c5dea-ec75-478b-9780-9729f3f61108', 'Edulcorante Eritritol y Sucralosa', 'mismo caso que Tiramisú (vinculado a "COCINARTE Seitons tempura")'],
  ['fc5aa7b9-aec3-4279-91ca-967cee9a5bd2', '2660f1d0-e51c-4eea-acdf-a6de0d4c0d32', 'Mezcla de lechugas', '0c6996b4-b41f-45ad-86f8-45dd1faf189d', 'Ensalada mezcla tierna lavada', 'vinculado a "Mezcla semillas" (semillas, no hojas de lechuga) — categoría de alimento completamente distinta'],
  ['5b8b0102-d0d8-40bd-b49f-2528dcf01a12', '56677067-9371-409a-88e1-5ce477393e2b', 'Aceite de coco', 'c80ea243-1418-4724-b423-3ae3cb554be5', 'Aceite de Coco Virgen Extra', 'vinculado a "Aceite de oliva virgen extra" — producto distinto al indicado'],
  ['d0292a32-434c-45e0-9061-1f7669f3cf13', 'fe5707b9-620d-4e02-bc81-b8bc983ecd18', 'Bebida de almendras sin azúcar', 'ee6bfc00-e603-4792-99a0-5c6a60038845', 'Bebida de Almendras Sin Azúcar Brik', 'mismo bug que #38 en otra receta (vinculado a bebida de avena con chocolate)'],
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
      fib  += (a.fibra || 0) * g / 100
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
  console.log(`T46 — Fix ruido de matches (28 casos reales) — modo: ${DRY ? 'DRY-RUN' : 'APLICAR'}\n`)
  const recetasAfectadas = []
  for (const [ingId, recetaId, nombreLibre, destId, destNombre, motivo] of FIXES) {
    const { data: row, error } = await sb.from('receta_ingredientes').select('id, nombre_libre, alimento_id, alimentos(nombre)').eq('id', ingId).maybeSingle()
    if (error || !row) { console.error(`  ERROR leyendo ${ingId}:`, error?.message || 'no encontrado'); continue }
    if (row.alimento_id === destId) { console.log(`  (ya correcto) ${row.nombre_libre} → ${destNombre}`); continue }
    console.log(`  ${DRY ? '[dry]' : '[OK] '} "${row.nombre_libre}" — ${row.alimentos?.nombre} → ${destNombre}`)
    console.log(`         motivo: ${motivo}`)
    if (!DRY) {
      const { error: upErr } = await sb.from('receta_ingredientes').update({ alimento_id: destId }).eq('id', ingId)
      if (upErr) console.error('    ERROR update:', upErr.message)
    }
    recetasAfectadas.push(recetaId)
  }
  await recalcularMacros(recetasAfectadas)
  console.log(`\n${DRY ? 'DRY-RUN completo. Ejecuta con --apply para aplicar.' : 'Cambios aplicados.'}`)
}
main()
