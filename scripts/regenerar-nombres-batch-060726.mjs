/**
 * Regenera nombre/descripción/instrucciones de las recetas del lote
 * 07-06-2026 cuyo nombre no tiene relación real con sus ingredientes
 * (ver TAREAS.md T43c). A diferencia del generador original
 * (generar-recetas-desde-esqueletos.ts), este prompt obliga a DeepSeek a
 * mencionar EXPLÍCITAMENTE cada ingrediente real y prohíbe inventar
 * ninguno que no esté en la lista — la causa raíz del bug era justo la
 * falta de esa restricción.
 *
 * Uso:
 *   node scripts/regenerar-nombres-batch-060726.mjs           (dry-run)
 *   node scripts/regenerar-nombres-batch-060726.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
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

const IDS_A_REGENERAR = [
  'fecae054-c976-4156-bdbd-9e213c30bd9e', // Caballa al horno... -> en realidad brócoli+salmón+pimiento
  'b4f96511-0a9d-4b74-bf52-56fc58899456', // Tortilla cremosa de tomate y queso fresco -> en realidad yogur+avena+frutos rojos+proteína
  '3afd4e90-2a09-4ac6-b315-3b8a3577d8e1', // Atún a la plancha con arroz blanco...
  'babade0d-4864-456a-91d4-53244ad25cab', // Atún a la plancha con arroz y judías...
  'c061b5a3-d027-4656-9e7a-3c78a3a76576', // Pollo jugoso con espárragos y quinoa...
  '57b0e607-9e7f-4900-a192-48e04faa987e', // Manzana cremosa con yogur...
  'f8a2c738-18d5-41c2-acde-fbafdc29e86b', // Salmón al horno con avena cremosa...
  '2f02214e-bf74-4d6d-a540-fa4f848bbb75', // Salmón al horno con brócoli y pimiento asado
  'dbece859-f525-4f39-bbfb-fb76c6a4fb26', // Pollo al horno con quinoa crujiente...
  'cd5d8094-91b4-46b1-9381-0762879ceb76', // Avena cremosa con manzana y nueces
]

async function llamarDeepSeek(prompt) {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

function construirPrompt(ingredientes) {
  const lista = ingredientes.map(i => `- ${i.gramos}g de ${i.nombre}`).join('\n')
  return `Eres un chef de cocina mediterránea española experto en nutrición deportiva.
Escribe una receta atractiva en castellano de España que use EXACTAMENTE estos ingredientes, ni uno más ni uno menos:

${lista}

REGLA ABSOLUTA E INNEGOCIABLE: el nombre y la descripción deben mencionar explícitamente el ingrediente principal (el de más peso) y no pueden mencionar ningún ingrediente, proteína o plato que NO esté en la lista de arriba. Si la lista tiene pollo, el nombre debe decir pollo — nunca salmón, atún, merluza ni ningún otro sustituto, por muy apetecible que suene.

Otras reglas:
- NUNCA uses: tapering, pre-entreno, post-entreno, carga, carga de carbohidratos, TDEE, macros, proteico, fit, healthy (como adjetivo), bowl, RPE, RIR, HRV, FODMAP
- El nombre debe sonar a receta casera mediterránea española apetecible
- Vocabulario permitido: meloso, cremoso, jugoso, tierno, crujiente, especiado, al horno, a la plancha, al vapor, guisado, estofado, en salsa, con sofrito, al ajillo, mediterráneo, casero

Devuelve SOLO este JSON (sin texto extra):
{
  "nombre": "...",
  "descripcion": "...",
  "instrucciones": ["paso 1", "paso 2", "paso 3", "paso 4"],
  "consejos": "..."
}`
}

async function main() {
  console.log(APPLY ? '✏️  APLICANDO\n' : '🔍 DRY-RUN\n')
  const resultados = []

  for (const id of IDS_A_REGENERAR) {
    const { data: receta } = await sb.from('recetas').select('id, nombre').eq('id', id).single()
    const { data: ings } = await sb.from('receta_ingredientes')
      .select('cantidad_gramos, nombre_libre')
      .eq('receta_id', id)
      .order('cantidad_gramos', { ascending: false })

    const ingredientes = ings.map(i => ({ gramos: i.cantidad_gramos, nombre: i.nombre_libre }))
    const prompt = construirPrompt(ingredientes)
    const generada = await llamarDeepSeek(prompt)

    console.log(`--- ${receta.nombre}  →  ${generada.nombre}`)
    console.log(`    ingredientes reales: ${ingredientes.map(i => i.nombre).join(', ')}`)
    resultados.push({ id, nombre_anterior: receta.nombre, ...generada })

    if (APPLY) {
      const { error } = await sb.from('recetas').update({
        nombre: generada.nombre,
        descripcion: generada.descripcion,
        instrucciones: generada.instrucciones.join('\n'),
        consejos: generada.consejos,
      }).eq('id', id)
      if (error) console.log(`    ❌ ${error.message}`)
    }
  }

  writeFileSync(resolve(ROOT, 'salidas/regenerado-batch-060726.json'), JSON.stringify(resultados, null, 2))
  console.log(APPLY ? '\n✅ Aplicado.' : '\n🔍 Dry-run completo — ejecutar con --apply para escribir.')
}

main().catch(console.error)
