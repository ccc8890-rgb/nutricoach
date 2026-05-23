#!/usr/bin/env node
/**
 * MERGE INTELIGENTE de duplicados en alimentos.
 * Busca por similitud de nombre (ilike) para encontrar el canónico con precio real.
 * 
 * DRY_RUN por defecto. Pasa --apply para ejecutar.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve('.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const DRY_RUN = !process.argv.includes('--apply')
const REF_ID = '11111111-1111-4111-8111-111111111111'

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  console.log('═'.repeat(70))
  console.log('  MERGE INTELIGENTE DE DUPLICADOS EN ALIMENTOS')
  console.log('═'.repeat(70))

  // Cargar datos
  const { data: supers } = await sb.from('supermercados').select('id, nombre, slug')
  const realIds = new Set(supers.filter(s => s.id !== REF_ID).map(s => s.id))

  const { data: ri } = await sb.from('receta_ingredientes').select('alimento_id').not('alimento_id', 'is', null)
  const alimentoIds = [...new Set(ri.map(r => r.alimento_id))]

  const alimentos = []
  for (let i = 0; i < alimentoIds.length; i += 100) {
    const { data } = await sb.from('alimentos').select('id, nombre, categoria').in('id', alimentoIds.slice(i, i + 100))
    if (data) alimentos.push(...data)
  }

  const { data: allProds } = await sb.from('productos_supermercado')
    .select('alimento_id, supermercado_id')
    .gt('precio_por_kg', 0)

  const foodSup = new Map()
  for (const p of allProds || []) {
    if (!foodSup.has(p.alimento_id)) foodSup.set(p.alimento_id, new Set())
    foodSup.get(p.alimento_id).add(p.supermercado_id)
  }

  const usoCount = {}
  for (const r of ri) usoCount[r.alimento_id] = (usoCount[r.alimento_id] || 0) + 1

  // Identificar solo-ref
  const soloRef = alimentos.filter(a => {
    const sups = foodSup.get(a.id)
    if (!sups) return true
    return ![...sups].some(sid => realIds.has(sid))
  }).map(a => ({ ...a, usos: usoCount[a.id] || 0 }))
    .sort((a, b) => b.usos - a.usos)

  console.log(`\n  Alimentos solo-referencia: ${soloRef.length}`)

  // Construir mapping de merges con reglas SEMÁNTICAS
  const MANUAL_RULES = [
    // [regexOrigen, nombreDestinoMustInclude, descripción]
    { from: /pimienta negra$/i, toMust: 'Pimienta negra molida', label: 'pimienta negra → molida' },
    { from: /^pimienta$/i, toMust: 'Pimienta negra molida', label: 'pimienta → molida' },
    { from: /aceite de oliva/i, toMust: 'aceite', label: 'aceite oliva → aceite genérico' },
    { from: /cebolla cruda/i, toMust: 'Cebolla', label: 'cebolla cruda → cebolla' },
    { from: /cebolla roja/i, toMust: 'Cebolla', label: 'cebolla roja → cebolla' },
    { from: /zanahoria/i, toMust: 'Zanahoria', label: 'zanahoria → zanahoria' },
    { from: /pan integral/i, toMust: 'Pan', label: 'pan integral → pan' },
    { from: /avena\s*\(copos\)/i, toMust: 'Avena', label: 'avena copos → avena' },
    { from: /laurel/i, toMust: 'Hoja de laurel', label: 'laurel → hoja laurel' },
    { from: /vinagre/i, toMust: 'Vinagre', label: 'vinagre → vinagre' },
    { from: /pechuga de pollo/i, toMust: 'Pollo', label: 'pechuga pollo → pollo' },
    { from: /canela/i, toMust: 'canela molida', label: 'canela → canela molida' },
    { from: /huevo duro/i, toMust: 'Huevo', label: 'huevo duro → huevo' },
    { from: /garbanzos cocidos/i, toMust: 'Garbanzos', label: 'garbanzos cocidos → garbanzos' },
    { from: /arroz/i, toMust: 'Arroz', label: 'arroz → arroz' },
    { from: /cacao en polvo/i, toMust: 'Cacao polvo taza', label: 'cacao polvo → cacao polvo taza' },
    { from: /gelatina en lámina/i, toMust: 'gelatina neutra en polvo', label: 'gelatina láminas → gelatina polvo' },
    { from: /tomate triturado/i, toMust: 'Tomate', label: 'tomate triturado → tomate' },
    { from: /lechuga/i, toMust: 'Lechuga', label: 'lechuga → lechuga' },
    { from: /bacalao/i, toMust: 'Bacalao', label: 'bacalao → bacalao' },
    { from: /langostino/i, toMust: 'Langostino cocido', label: 'langostino → langostino cocido' },
    { from: /boquerón/i, toMust: 'Boquerón', label: 'boquerón → boquerón' },
    { from: /pasta integral/i, toMust: 'Pasta', label: 'pasta integral → pasta' },
    { from: /cuscús/i, toMust: 'Cuscús integral', label: 'cuscús → cuscús integral' },
    { from: /azúcar moreno/i, toMust: 'Azúcar', label: 'azúcar moreno → azúcar' },
    { from: /azucar glas|azúcar glass/i, toMust: 'Azúcar', label: 'azúcar glas → azúcar' },
    { from: /azúcar\s*\(para brulé\)/i, toMust: 'Azúcar', label: 'azúcar brulé → azúcar' },
    { from: /polvo de hornear/i, toMust: 'Levadura', label: 'polvo hornear → levadura' },
    { from: /bicarbonato/i, toMust: 'Bicarbonato', label: 'bicarbonato → bicarbonato' },
    { from: /maicena/i, toMust: 'Maíz', label: 'maicena → maíz' },
    { from: /dátiles secos/i, toMust: 'Dátiles', label: 'dátiles secos → dátiles' },
    { from: /frambuesa/i, toMust: 'Frambuesa', label: 'frambuesa → frambuesa' },
    { from: /arándano/i, toMust: 'Arándanos rojos deshidratados', label: 'arándanos → arándanos rojos' },
    { from: /manzana\s*\(con piel\)/i, toMust: 'Manzana', label: 'manzana piel → manzana' },
    { from: /queso rallado/i, toMust: 'Queso rallado emmental', label: 'queso rallado → queso rallado emmental' },
    { from: /queso gruyer/i, toMust: 'Queso rallado emmental', label: 'queso gruyer → queso rallado emmental' },
    { from: /yogur de proteína/i, toMust: 'Yogur', label: 'yogur proteína → yogur' },
    { from: /leche en polvo/i, toMust: 'Leche', label: 'leche polvo → leche' },
    { from: /leche de almendras/i, toMust: 'Almendras', label: 'leche almendras → almendras' },
    { from: /leche de coco/i, toMust: 'Leche de coco', label: 'leche coco → leche coco' },
    { from: /pimentón/i, toMust: 'Pimentón', label: 'pimentón → pimentón' },
    { from: /orégano/i, toMust: 'Orégano', label: 'orégano → orégano' },
    { from: /tomillo/i, toMust: 'Tomillo', label: 'tomillo → tomillo' },
    { from: /romero/i, toMust: 'Romero', label: 'romero → romero' },
    { from: /cilantro/i, toMust: 'Cilantro', label: 'cilantro → cilantro' },
    { from: /perejil/i, toMust: 'Perejil', label: 'perejil → perejil' },
    { from: /albahaca/i, toMust: 'Albahaca', label: 'albahaca → albahaca' },
    { from: /eneldo/i, toMust: 'Eneldo', label: 'eneldo → eneldo' },
    { from: /comino/i, toMust: 'comino', label: 'comino → comino' },
    { from: /curry/i, toMust: 'Curry', label: 'curry → curry' },
    { from: /jengibre/i, toMust: 'Jengibre molido', label: 'jengibre → jengibre molido' },
    { from: /nuez moscada/i, toMust: 'Nuez', label: 'nuez moscada → nuez' },
    { from: /harina de almendra/i, toMust: 'Almendras Molidas', label: 'harina almendra → almendras molidas' },
    { from: /pasta de almendras/i, toMust: 'Almendras Molidas', label: 'pasta almendras → almendras molidas' },
    { from: /semillas de sésamo/i, toMust: 'Semillas de lino', label: 'sésamo → lino' },
    { from: /cacahuetes\s*\(sin sal\)/i, toMust: 'Cacahuetes', label: 'cacahuetes sin sal → cacahuetes' },
    { from: /anacardos\s*\(sin sal\)/i, toMust: 'Anacardos', label: 'anacardos sin sal → anacardos' },
    { from: /almendra/i, toMust: 'Almendras', label: 'almendra → almendras' },
    { from: /nuez/i, toMust: 'Nuez', label: 'nuez → nuez' },
    { from: /pistacho/i, toMust: 'Pistachos', label: 'pistacho → pistachos' },
    { from: /salsa de tomate zero/i, toMust: 'Tomate', label: 'salsa tomate → tomate' },
    { from: /kétchup|ketchup/i, toMust: 'Kétchup', label: 'kétchup → kétchup' },
    { from: /salsa sriracha/i, toMust: 'Sriracha', label: 'sriracha → sriracha' },
    { from: /salsa barbacoa/i, toMust: 'Barbacoa', label: 'barbacoa → barbacoa' },
    { from: /mostaza/i, toMust: 'Mostaza', label: 'mostaza → mostaza' },
    { from: /salsa de soja/i, toMust: 'Soja', label: 'soja → soja' },
    { from: /salsa teriyaki/i, toMust: 'Teriyaki', label: 'teriyaki → teriyaki' },
    { from: /salsa de tomate$/i, toMust: 'Tomate', label: 'salsa tomate simple → tomate' },
    { from: /maíz dulce/i, toMust: 'Maíz', label: 'maíz dulce → maíz' },
    { from: /espárrago/i, toMust: 'Espárrago', label: 'espárrago → espárrago' },
    { from: /berenjena/i, toMust: 'Berenjena', label: 'berenjena → berenjena' },
    { from: /calabacín/i, toMust: 'Calabacín', label: 'calabacín → calabacín' },
    { from: /pimiento rojo/i, toMust: 'Pimiento', label: 'pimiento rojo → pimiento' },
    { from: /pimiento italiano/i, toMust: 'Pimiento', label: 'pimiento italiano → pimiento' },
    { from: /patata/i, toMust: 'Patata', label: 'patata → patata' },
    { from: /boniato/i, toMust: 'Boniato', label: 'boniato → boniato' },
    { from: /cebollino/i, toMust: 'Cebolla', label: 'cebollino → cebolla' },
    { from: /jalapeño/i, toMust: 'Jalapeño', label: 'jalapeño → jalapeño' },
    { from: /pollo picado/i, toMust: 'Pollo', label: 'pollo picado → pollo' },
    { from: /muslos de pollo/i, toMust: 'Pollo', label: 'muslos pollo → pollo' },
    { from: /hígado de pollo/i, toMust: 'Pollo', label: 'hígado pollo → pollo' },
    { from: /pavo/i, toMust: 'Pavo', label: 'pavo → pavo' },
    { from: /jamon/i, toMust: 'Jamón', label: 'jamón → jamón' },
    { from: /tortilla de maíz|tortita de arroz|tortilla trigo/i, toMust: 'Tortilla', label: 'tortilla → tortilla' },
    { from: /chocolate con avellanas/i, toMust: 'Chocolate con leche Milka', label: 'chocolate avellanas → chocolate leche' },
    { from: /chocolate con leche/i, toMust: 'Chocolate con leche Milka', label: 'chocolate leche → chocolate leche Milka' },
    { from: /cacao puro/i, toMust: 'Cacao polvo taza', label: 'cacao puro → cacao polvo taza' },
    { from: /proteína.*polvo|whey|caseína|proteina.*suero/i, toMust: 'Proteína', label: 'proteína polvo → proteína' },
    { from: /levadura fresca/i, toMust: 'Levadura', label: 'levadura fresca → levadura' },
    { from: /levadura química/i, toMust: 'Levadura', label: 'levadura química → levadura' },
    { from: /esencia de vainilla/i, toMust: 'Vainilla', label: 'esencia vainilla → vainilla' },
    { from: /estevia|eritritol|edulcorante/i, toMust: 'Edulcorante', label: 'edulcorante → edulcorante' },
    { from: /sal de ajo/i, toMust: 'Sal', label: 'sal de ajo → sal' },
    { from: /yogur griego/i, toMust: 'Yogur', label: 'yogur griego → yogur' },
    { from: /queso fresco/i, toMust: 'Queso fresco', label: 'queso fresco → queso fresco' },
    { from: /pato\s*\(/i, toMust: 'Pato', label: 'pato → pato' },
    { from: /tomate$/i, toMust: 'Tomate', label: 'tomate → tomate' },
    { from: /pepino/i, toMust: 'Pepino', label: 'pepino → pepino' },
    { from: /plátano/i, toMust: 'Plátano', label: 'plátano → plátano' },
    { from: /mango/i, toMust: 'Mango', label: 'mango → mango' },
    { from: /naranja/i, toMust: 'Naranja', label: 'naranja → naranja' },
    { from: /limón|lima/i, toMust: 'Limón', label: 'limón → limón' },
    { from: /fresa/i, toMust: 'Fresa', label: 'fresa → fresa' },
    { from: /pomelo/i, toMust: 'Pomelo', label: 'pomelo → pomelo' },
    { from: /kiwi/i, toMust: 'Kiwi', label: 'kiwi → kiwi' },
    { from: /piña/i, toMust: 'Piña', label: 'piña → piña' },
    { from: /sandía/i, toMust: 'Sandía', label: 'sandía → sandía' },
    { from: /melón/i, toMust: 'Melón', label: 'melón → melón' },
    { from: /pera/i, toMust: 'Pera', label: 'pera → pera' },
    { from: /uva/i, toMust: 'Uva', label: 'uva → uva' },
    { from: /cereza/i, toMust: 'Cereza', label: 'cereza → cereza' },
    { from: /papaya/i, toMust: 'Papaya', label: 'papaya → papaya' },
    { from: /higo/i, toMust: 'Higo', label: 'higo → higo' },
    { from: /ciruela/i, toMust: 'Ciruela', label: 'ciruela → ciruela' },
    { from: /granada/i, toMust: 'Granada', label: 'granada → granada' },
    { from: /aguacate/i, toMust: 'Aguacate', label: 'aguacate → aguacate' },
    { from: /brócoli|brocoli/i, toMust: 'Brócoli', label: 'brócoli → brócoli' },
    { from: /coliflor/i, toMust: 'Coliflor', label: 'coliflor → coliflor' },
    { from: /espinaca/i, toMust: 'Espinaca', label: 'espinaca → espinaca' },
    { from: /rucula/i, toMust: 'Rúcula', label: 'rúcula → rúcula' },
    { from: /apio/i, toMust: 'Apio', label: 'apio → apio' },
    { from: /kale/i, toMust: 'Kale', label: 'kale → kale' },
    { from: /alcachofa/i, toMust: 'Alcachofa', label: 'alcachofa → alcachofa' },
    { from: /salmón/i, toMust: 'Salmón', label: 'salmón → salmón' },
    { from: /merluza/i, toMust: 'Merluza', label: 'merluza → merluza' },
    { from: /atún/i, toMust: 'Atún', label: 'atún → atún' },
    { from: /gamba|camarón/i, toMust: 'Gamba', label: 'gamba → gamba' },
    { from: /sepia|calamar/i, toMust: 'Sepia', label: 'sepia → sepia' },
    { from: /corvina/i, toMust: 'Corvina', label: 'corvina → corvina' },
    { from: /lubina/i, toMust: 'Lubina', label: 'lubina → lubina' },
    { from: /dorada/i, toMust: 'Dorada', label: 'dorada → dorada' },
    { from: /ternera|carne picada/i, toMust: 'Ternera', label: 'ternera → ternera' },
    { from: /cerdo/i, toMust: 'Cerdo', label: 'cerdo → cerdo' },
    { from: /conejo/i, toMust: 'Conejo', label: 'conejo → conejo' },
    { from: /cordero/i, toMust: 'Cordero', label: 'cordero → cordero' },
    { from: /huevo$/i, toMust: 'Huevo', label: 'huevo → huevo' },
    { from: /huevos/i, toMust: 'Huevo', label: 'huevos → huevo' },
  ]

  const validMerges = []

  for (const a of soloRef) {
    const n = norm(a.nombre)
    let matched = false

    for (const rule of MANUAL_RULES) {
      if (rule.from.test(n)) {
        // Buscar el alimento destino en BD por nombre
        const { data: destCandidates } = await sb.from('alimentos')
          .select('id, nombre, categoria')
          .ilike('nombre', `%${rule.toMust}%`)
          .limit(5)

        if (!destCandidates || destCandidates.length === 0) continue

        // Elegir el que tenga precio real (o el primero)
        const dest = destCandidates.find(d => {
          const sups = foodSup.get(d.id)
          return sups && [...sups].some(sid => realIds.has(sid))
        }) || destCandidates[0]

        // Verificar que el destino tiene precio REAL
        const destSups = foodSup.get(dest.id)
        const destHasReal = destSups && [...destSups].some(sid => realIds.has(sid))

        if (destHasReal && dest.id !== a.id) {
          const supList = [...destSups].filter(sid => realIds.has(sid))
            .map(sid => supers.find(s => s.id === sid)?.slug).filter(Boolean)

          validMerges.push({
            from: a,
            to: dest,
            usos: a.usos,
            supermercados: supList,
            rule: rule.label
          })
          matched = true
          break
        }
      }
    }

    if (!matched && a.usos >= 5) {
      console.log(`  ⚠️  "${a.nombre}" (${a.usos} usos) → SIN MATCH`)
    }
  }

  // Mostrar resultados
  console.log(`\n  MERGES VÁLIDOS (${validMerges.length}):\n`)
  validMerges.sort((a, b) => b.usos - a.usos).forEach((m, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. [${m.usos} usos] "${m.from.nombre}"`)
    console.log(`     → "${m.to.nombre}" [${m.rule}] (en: ${m.supermercados.join(', ') || '?'})`)
  })

  const totalUsos = validMerges.reduce((s, m) => s + m.usos, 0)
  console.log(`\n  Total ingredientes a re-vincular: ${totalUsos}`)

  // APLICAR (solo si --apply)
  if (!DRY_RUN && validMerges.length > 0) {
    console.log('\n' + '═'.repeat(70))
    console.log('  APLICANDO MIGRACIÓN')
    console.log('═'.repeat(70))

    let ok = 0, err = 0
    for (const m of validMerges) {
      // Re-vincular ingredientes
      const { data: ings } = await sb.from('receta_ingredientes')
        .select('id').eq('alimento_id', m.from.id)
      if (ings && ings.length > 0) {
        const { error } = await sb.from('receta_ingredientes')
          .update({ alimento_id: m.to.id })
          .eq('alimento_id', m.from.id)
        if (error) { err++; console.log(`  ❌ Error: ${error.message}`); continue }
      }

      // Migrar precios
      const { data: prods } = await sb.from('productos_supermercado')
        .select('supermercado_id, precio_por_kg, precio_unidad, unidad, url_producto, fecha_precio, notas')
        .eq('alimento_id', m.from.id).gt('precio_por_kg', 0)
      if (prods && prods.length > 0) {
        const { data: existing } = await sb.from('productos_supermercado')
          .select('supermercado_id').eq('alimento_id', m.to.id)
        const existingSup = new Set(existing?.map(p => p.supermercado_id) || [])
        for (const prod of prods) {
          if (existingSup.has(prod.supermercado_id)) continue
          await sb.from('productos_supermercado').insert({
            supermercado_id: prod.supermercado_id, alimento_id: m.to.id,
            precio_por_kg: prod.precio_por_kg, precio_unidad: prod.precio_unidad,
            unidad: prod.unidad, url_producto: prod.url_producto,
            fecha_precio: prod.fecha_precio, notas: prod.notas ? prod.notas + ' (migrado)' : 'migrado'
          }).maybeSingle()
        }
        await sb.from('productos_supermercado').delete().eq('alimento_id', m.from.id)
      }

      // Eliminar duplicado
      await sb.from('alimentos').delete().eq('id', m.from.id).catch(() => { })
      ok++
    }
    console.log(`\n  ✅ ${ok} merges aplicados, ${err} errores`)
  }

  if (DRY_RUN) {
    console.log(`\n  Para aplicar: node scripts/merge-duplicados-alimentos.mjs --apply`)
  }

  process.exit(0)
}

main().catch(e => { console.error('Error:', e); process.exit(1) })
