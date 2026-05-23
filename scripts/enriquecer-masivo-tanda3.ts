import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

const CAMPOS_MICRO = [
  'vitamina_a_ug', 'vitamina_c_mg', 'vitamina_d_ug', 'vitamina_e_mg',
  'vitamina_k_ug', 'vitamina_b6_mg', 'vitamina_b12_ug',
  'tiamina_mg', 'riboflavina_mg', 'niacina_mg', 'folato_ug',
  'calcio_mg', 'hierro_mg', 'magnesio_mg', 'fosforo_mg',
  'potasio_mg', 'sodio_mg', 'zinc_mg', 'cobre_mg', 'selenio_ug',
  'saturados_g', 'monoinsaturados_g', 'poliinsaturados_g', 'colesterol_mg',
]

const CAMPOS_MACRO = ['calorias', 'proteinas', 'carbohidratos', 'grasas']

interface AlimentoRow {
  id: string
  nombre: string
  categoria: string | null
  calorias: number | null
  proteinas: number | null
  carbohidratos: number | null
  grasas: number | null
  fuente: string | null
}

function construirPrompt(lote: AlimentoRow[]): string {
  const items = lote.map((a, i) => {
    const tieneMacros = (a.calorias ?? 0) > 0 && (a.proteinas ?? 0) > 0
    const macrosStr = tieneMacros
      ? `Macros: ${a.calorias}kc/${a.proteinas}p/${a.carbohidratos}c/${a.grasas}g`
      : `Sin macros conocidos — estima también kcal, proteinas, carbohidratos y grasas`
    return `  [${i + 1}] "${a.nombre}" (${a.categoria || 'sin categoría'}) — ${macrosStr}`
  }).join('\n')

  return `Eres un nutricionista experto. Proporciona datos nutricionales completos por 100g para estos alimentos.

ALIMENTOS:
${items}

Para cada alimento, responde con un JSON con estos campos:
- calorias (kcal), proteinas (g), carbohidratos (g), grasas (g) — SOLO si el alimento no los tiene ya
- vitamina_a_ug, vitamina_c_mg, vitamina_d_ug, vitamina_e_mg, vitamina_k_ug
- vitamina_b6_mg, vitamina_b12_ug, tiamina_mg, riboflavina_mg, niacina_mg, folato_ug
- calcio_mg, hierro_mg, magnesio_mg, fosforo_mg, potasio_mg, sodio_mg
- zinc_mg, cobre_mg, selenio_ug
- saturados_g, monoinsaturados_g, poliinsaturados_g, colesterol_mg

Basado en BEDCA/USDA. Usa 0 si no aplica. NO pongas null — usa 0.

Responde SOLO con un array JSON:
[{"index": 1, "calorias": ..., ...}, {"index": 2, ...}, ...]`
}

async function llamarDeepSeek(prompt: string): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: 'Eres un nutricionista experto en composición de alimentos. Respondes en español, solo con JSON válido.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.15,
      max_tokens: 3000,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${text.substring(0, 200)}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || null
}

function extraerArrayJson(texto: string): Record<string, unknown>[] | null {
  const match = texto.match(/\[[\s\S]*\]/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as Record<string, unknown>[]
  } catch { return null }
}

async function procesarLote(lote: AlimentoRow[]): Promise<{ ok: number; fail: number }> {
  // Si solo hay 1, usar prompt individual (más fiable)
  const prompt = lote.length === 1
    ? construirPromptIndividual(lote[0])
    : construirPrompt(lote)

  for (let intento = 1; intento <= 2; intento++) {
    try {
      const text = await llamarDeepSeek(prompt)
      if (!text) continue

      const resultados = extraerArrayJson(text)
      if (!resultados || resultados.length === 0) {
        // Reintentar con prompt individual si falló el lote
        if (lote.length > 1) return await procesarLoteIndividual(lote)
        continue
      }

      let okCount = 0
      for (const item of resultados) {
        const idx = Number(item.index) - 1
        if (idx < 0 || idx >= lote.length) continue

        const alimento = lote[idx]
        const updates: Record<string, unknown> = {}

        // Si no tiene macros, estimarlos
        if (!(alimento.calorias ?? 0) || !(alimento.proteinas ?? 0)) {
          for (const campo of CAMPOS_MACRO) {
            if (item[campo] !== undefined && item[campo] !== null) {
              updates[campo] = Number(item[campo])
            }
          }
        }

        // Micros siempre
        for (const campo of CAMPOS_MICRO) {
          if (item[campo] !== undefined && item[campo] !== null) {
            updates[campo] = Number(item[campo])
          }
        }

        updates.micros_actualizados_en = new Date().toISOString()
        // Solo marcar como 'ia' si no tenía fuente o era openfoodfacts/curada sin micros
        if (alimento.fuente !== 'ia') updates.fuente = 'ia'

        const microCount = CAMPOS_MICRO.filter(c => updates[c] !== undefined && updates[c] !== null).length
        if (microCount < 5) continue // mínimo 5 micros para considerar éxito

        const { error } = await supabase.from('alimentos').update(updates).eq('id', alimento.id)
        if (!error) okCount++
      }

      return { ok: okCount, fail: lote.length - okCount }
    } catch (err) {
      console.log(`  ↳ Intento ${intento} error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Fallback: procesar uno por uno
  return await procesarLoteIndividual(lote)
}

async function procesarLoteIndividual(lote: AlimentoRow[]): Promise<{ ok: number; fail: number }> {
  let ok = 0
  for (const a of lote) {
    const prompt = construirPromptIndividual(a)
    try {
      const text = await llamarDeepSeek(prompt)
      if (!text) { await sleep(500); continue }

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) { await sleep(500); continue }

      const data = JSON.parse(jsonMatch[0])
      const updates: Record<string, unknown> = {}

      if (!(a.calorias ?? 0) || !(a.proteinas ?? 0)) {
        for (const c of CAMPOS_MACRO) {
          if (data[c] !== undefined) updates[c] = Number(data[c])
        }
      }

      let microCount = 0
      for (const c of CAMPOS_MICRO) {
        if (data[c] !== undefined && data[c] !== null) {
          updates[c] = Number(data[c])
          microCount++
        }
      }

      updates.micros_actualizados_en = new Date().toISOString()
      if (a.fuente !== 'ia') updates.fuente = 'ia'

      if (microCount >= 5) {
        const { error } = await supabase.from('alimentos').update(updates).eq('id', a.id)
        if (!error) ok++
      }
    } catch { /* skip */ }
    await sleep(500)
  }
  return { ok, fail: lote.length - ok }
}

function construirPromptIndividual(a: AlimentoRow): string {
  const tieneMacros = (a.calorias ?? 0) > 0 && (a.proteinas ?? 0) > 0
  const notasMacros = tieneMacros
    ? `Macros conocidos: ${a.calorias} kcal, ${a.proteinas}g proteínas, ${a.carbohidratos}g carbohidratos, ${a.grasas}g grasas`
    : 'No tengo sus macros — por favor estima también: calorias, proteinas, carbohidratos, grasas'

  return `Eres un nutricionista experto. Proporciona datos nutricionales por 100g de "${a.nombre}" (categoría: ${a.categoria || 'desconocida'}).

${notasMacros}

Responde SOLO con JSON (sin markdown):
{
  ${tieneMacros ? '' : '"calorias": 0, "proteinas": 0, "carbohidratos": 0, "grasas": 0,'}
  "vitamina_a_ug": 0, "vitamina_c_mg": 0, "vitamina_d_ug": 0, "vitamina_e_mg": 0, "vitamina_k_ug": 0,
  "vitamina_b6_mg": 0, "vitamina_b12_ug": 0, "tiamina_mg": 0, "riboflavina_mg": 0,
  "niacina_mg": 0, "folato_ug": 0,
  "calcio_mg": 0, "hierro_mg": 0, "magnesio_mg": 0, "fosforo_mg": 0, "potasio_mg": 0, "sodio_mg": 0,
  "zinc_mg": 0, "cobre_mg": 0, "selenio_ug": 0,
  "saturados_g": 0, "monoinsaturados_g": 0, "poliinsaturados_g": 0, "colesterol_mg": 0
}

Basado en BEDCA/USDA. Valores redondeados. Usa 0 si no aplica.`
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  console.log('🔍 Cargando todos los alimentos sin micronutrientes...\n')

  const { data: alimentos, error } = await supabase
    .from('alimentos')
    .select('id, nombre, categoria, calorias, proteinas, carbohidratos, grasas, fuente')
    .is('vitamina_a_ug', null)
    .order('id')

  if (error) { console.error('Error:', error.message); process.exit(1) }
  if (!alimentos || alimentos.length === 0) { console.log('✅ No hay pendientes.'); return }

  const total = alimentos.length
  console.log(`📦 ${total} alimentos pendientes`)
  console.log(`  • ${alimentos.filter(a => (a.calorias ?? 0) > 0).length} con macros ✅`)
  console.log(`  • ${alimentos.filter(a => !(a.calorias ?? 0)).length} sin macros ❌`)

  // Batching: grupos de 5
  const BATCH_SIZE = 5
  const lotes: AlimentoRow[][] = []
  for (let i = 0; i < alimentos.length; i += BATCH_SIZE) {
    lotes.push(alimentos.slice(i, i + BATCH_SIZE))
  }

  console.log(`\n📦 ${lotes.length} lotes de ${BATCH_SIZE} alimentos cada uno`)
  console.log('')

  let totalOk = 0
  let totalFail = 0
  let errores = 0

  for (let l = 0; l < lotes.length; l++) {
    const lote = lotes[l]
    const nombres = lote.map(a => a.nombre.substring(0, 30)).join(', ')
    process.stdout.write(`[${l + 1}/${lotes.length}] Lote ${nombres}... `)

    try {
      const { ok, fail } = await procesarLote(lote)
      totalOk += ok
      totalFail += fail
      console.log(`${ok}✅ ${fail}❌`)
    } catch (err) {
      errores++
      console.log(`ERROR: ${err instanceof Error ? err.message.slice(0, 80) : 'desconocido'}`)
      // Procesar individualmente como fallback
      const { ok, fail } = await procesarLoteIndividual(lote)
      totalOk += ok
      totalFail += fail
    }

    await sleep(600) // rate limiting
  }

  console.log(`\n📊 TOTAL: ${totalOk} OK, ${totalFail} FAIL, ${errores} errores de lote`)

  // Stats finales
  const { count: restantes } = await supabase
    .from('alimentos')
    .select('*', { count: 'exact', head: true })
    .is('vitamina_a_ug', null)
  console.log(`📊 Restantes sin micros: ${restantes ?? '?'}`)
}

main().catch(console.error)
