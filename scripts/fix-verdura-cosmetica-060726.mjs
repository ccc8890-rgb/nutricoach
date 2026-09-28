/**
 * Corrige el residuo cosmético dejado tras fix-batch-060726-ingredientes.mjs:
 * 6 recetas del lote 07-06-2026 nombran una verdura (zanahoria/judías) que
 * no es la que realmente llevan (calabacín/zanahoria/brócoli según el caso).
 * Bajo impacto nutricional (misma familia de verdura), pero para un
 * recetario "pro" el texto debe ser exacto. Pide a DeepSeek una edición
 * mínima: solo cambiar la verdura mencionada, con concordancia de género,
 * sin tocar nada más de la redacción.
 *
 * Uso:
 *   node scripts/fix-verdura-cosmetica-060726.mjs           (dry-run)
 *   node scripts/fix-verdura-cosmetica-060726.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
function loadEnv() {
  const p = resolve(ROOT, '.env.local')
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

// id -> { real: verdura que sí lleva, falsa: la que menciona el texto }
const CORRECCIONES = {
  'ef652379-179c-492a-92b9-ae2c32d43e7f': { falsa: 'zanahoria', real: 'calabacín' },
  'c877f12b-e165-4bb6-af16-fe1157627449': { falsa: 'zanahoria', real: 'calabacín' },
  '00405c00-5bbe-40e8-8698-11ad816e8f79': { falsa: 'zanahoria', real: 'calabacín' },
  'f13135b5-5f5f-4a4c-a260-594f9fe7a583': { falsa: 'zanahoria', real: 'calabacín' },
  '21e72049-afad-4224-a8a7-e775ae0689dd': { falsa: 'judías verdes', real: 'zanahoria' },
  '1c92381c-3649-4710-88f5-594988c1c44d': { falsa: 'zanahoria', real: 'brócoli' },
}

async function llamarDeepSeek(prompt) {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

async function main() {
  console.log(APPLY ? '✏️  APLICANDO\n' : '🔍 DRY-RUN\n')

  for (const [id, { falsa, real }] of Object.entries(CORRECCIONES)) {
    const { data: receta } = await sb.from('recetas').select('nombre, descripcion, instrucciones').eq('id', id).single()

    const prompt = `Edita este texto de receta en español. El único cambio permitido: donde diga "${falsa}" debe decir "${real}", con la concordancia de género/número correcta en toda la frase (artículos, adjetivos como "glaseada/glaseado", plurales). No cambies nada más: ni el estilo, ni los pasos, ni otros ingredientes, ni la estructura.

NOMBRE: ${receta.nombre}
DESCRIPCIÓN: ${receta.descripcion}
INSTRUCCIONES:
${receta.instrucciones}

Devuelve SOLO este JSON:
{"nombre": "...", "descripcion": "...", "instrucciones": "..."}`

    const corregida = await llamarDeepSeek(prompt)
    console.log(`--- ${receta.nombre}\n    → ${corregida.nombre}`)

    if (APPLY) {
      const { error } = await sb.from('recetas').update(corregida).eq('id', id)
      if (error) console.log(`    ❌ ${error.message}`)
    }
  }

  console.log(APPLY ? '\n✅ Aplicado.' : '\n🔍 Dry-run completo — ejecutar con --apply para escribir.')
}

main().catch(console.error)
