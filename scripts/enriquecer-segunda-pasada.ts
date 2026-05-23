import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

interface AlimentoPendiente {
  id: string
  nombre: string
  categoria: string | null
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

// Columnas reales de la tabla alimentos (ver supabase_micronutrientes.sql)
const CAMPOS_MICRO = [
  'vitamina_a_ug', 'vitamina_c_mg', 'vitamina_d_ug', 'vitamina_e_mg',
  'vitamina_k_ug', 'vitamina_b6_mg', 'vitamina_b12_ug',
  'tiamina_mg', 'riboflavina_mg', 'niacina_mg', 'folato_ug',
  'calcio_mg', 'hierro_mg', 'magnesio_mg', 'fosforo_mg',
  'potasio_mg', 'sodio_mg', 'zinc_mg', 'cobre_mg', 'selenio_ug',
  'saturados_g', 'monoinsaturados_g', 'poliinsaturados_g', 'colesterol_mg',
]

function construirPrompt(alimento: AlimentoPendiente, intento: number): string {
  const notas = intento > 1
    ? 'NOTA IMPORTANTE: En el intento anterior no pudiste estimar estos datos. Por favor, proporciona valores aunque sean estimaciones basadas en alimentos similares de BEDCA/USDA. Es preferible un valor estimado a ningún valor.'
    : 'Proporciona valores estimados basados en BEDCA (Base de Datos Española de Composición de Alimentos) o USDA. Si no tienes el valor exacto, estima basándote en alimentos de la misma categoría.'

  return `Eres un nutricionista experto. Proporciona datos de micronutrientes para el siguiente alimento.

Nombre: "${alimento.nombre}"
Categoría: ${alimento.categoria ?? 'No especificada'}
Macros conocidos: ${alimento.calorias} kcal, ${alimento.proteinas}g proteínas, ${alimento.carbohidratos}g carbohidratos, ${alimento.grasas}g grasas

${notas}

Responde SOLO con un JSON válido con estos campos (usa 0 o null si no puedes estimar):
{
  "vitamina_a_ug": <number | null>,
  "vitamina_c_mg": <number | null>,
  "vitamina_d_ug": <number | null>,
  "vitamina_e_mg": <number | null>,
  "vitamina_k_ug": <number | null>,
  "vitamina_b6_mg": <number | null>,
  "vitamina_b12_ug": <number | null>,
  "tiamina_mg": <number | null>,
  "riboflavina_mg": <number | null>,
  "niacina_mg": <number | null>,
  "folato_ug": <number | null>,
  "calcio_mg": <number | null>,
  "hierro_mg": <number | null>,
  "magnesio_mg": <number | null>,
  "fosforo_mg": <number | null>,
  "potasio_mg": <number | null>,
  "sodio_mg": <number | null>,
  "zinc_mg": <number | null>,
  "cobre_mg": <number | null>,
  "selenio_ug": <number | null>,
  "saturados_g": <number | null>,
  "monoinsaturados_g": <number | null>,
  "poliinsaturados_g": <number | null>,
  "colesterol_mg": <number | null>
}`
}

function extraerJson(texto: string): Record<string, unknown> | null {
  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0])
    const result: Record<string, unknown> = {}
    for (const campo of CAMPOS_MICRO) {
      if (campo in parsed) {
        const val = parsed[campo]
        result[campo] = val !== null && val !== undefined && val !== '' ? Number(val) : null
      }
    }
    const nonNull = Object.entries(result).filter(([, v]) => v !== null).length
    if (nonNull === 0) return null
    return result
  } catch {
    return null
  }
}

async function llamarDeepSeek(prompt: string, temperatura: number): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY no configurada. Añádela en .env.local')
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: 'Eres un nutricionista experto en composición de alimentos. Respondes siempre en español, solo con JSON válido.' },
        { role: 'user', content: prompt },
      ],
      temperature: temperatura,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek: respuesta vacía')
  return content
}

async function procesarAlimento(alimento: AlimentoPendiente): Promise<boolean> {
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const prompt = construirPrompt(alimento, intento)
      const temperatura = intento === 1 ? 0.2 : 0.5
      const text = await llamarDeepSeek(prompt, temperatura)

      if (!text) {
        console.log(`  ↳ Intento ${intento}: respuesta vacía`)
        continue
      }

      const datos = extraerJson(text)
      if (!datos) {
        console.log(`  ↳ Intento ${intento}: sin datos válidos`)
        continue
      }

      const { error } = await supabase
        .from('alimentos')
        .update({ ...datos, fuente: 'ia', micros_actualizados_en: new Date().toISOString() })
        .eq('id', alimento.id)

      if (error) {
        console.log(`  ↳ Error DB: ${error.message}`)
        continue
      }

      const conteo = Object.values(datos).filter(v => v !== null).length
      console.log(`  ✅ ${conteo}/${CAMPOS_MICRO.length} campos`)
      return true
    } catch (err) {
      console.log(`  ↳ Intento ${intento} error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return false
}

async function main() {
  console.log('🔍 Buscando alimentos sin micronutrientes usados en recetas...\n')

  const { data: alimentos, error } = await supabase
    .from('alimentos')
    .select('id, nombre, categoria, calorias, proteinas, carbohidratos, grasas')
    .is('vitamina_a_ug', null)
    .in('id', (await supabase
      .from('receta_ingredientes')
      .select('alimento_id')
      .not('alimento_id', 'is', null)
    ).data?.map(r => r.alimento_id) ?? [])

  if (error) {
    console.error('Error consultando alimentos:', error.message)
    process.exit(1)
  }

  if (!alimentos || alimentos.length === 0) {
    console.log('✅ No hay alimentos pendientes.')
    return
  }

  console.log(`📦 ${alimentos.length} alimentos pendientes\n`)

  let ok = 0
  let fail = 0

  for (let i = 0; i < alimentos.length; i++) {
    const a = alimentos[i] as AlimentoPendiente
    process.stdout.write(`[${i + 1}/${alimentos.length}] ${a.nombre}... `)
    const result = await procesarAlimento(a)
    if (result) { ok++ } else { fail++ }
    console.log(result ? '✅ OK' : '❌ FAIL')
    // Pequeña pausa para no rate-limit
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n📊 Resultado: ${ok} OK, ${fail} FAIL de ${alimentos.length}`)

  // Stats finales
  const { count: sinMicros } = await supabase
    .from('alimentos')
    .select('*', { count: 'exact', head: true })
    .is('vitamina_a_ug', null)

  console.log(`📊 Alimentos sin micros restantes: ${sinMicros ?? '?'}`)
}

main().catch(console.error)
