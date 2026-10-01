/**
 * proponer-reconstruccion-recetas.mjs
 *
 * Para las recetas más alejadas de su original (auditoría contra origen, 01-10-2026) reextrae los ingredientes
 * del texto original con IA, los vincula a la tabla alimentos y genera una PROPUESTA con diferencias y macros
 * antes/después. NO modifica la base de datos: el resultado se revisa y se aplica aparte.
 *
 * USO: node scripts/proponer-reconstruccion-recetas.mjs [--n=12] [--id=<uuid>]
 * Salida: salidas/propuestas-recetas-FECHA.json y salidas/propuestas-recetas-FECHA.md
 */
import { createClient } from '@supabase/supabase-js'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { generateText } from 'ai'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const env = {}
for (const line of readFileSync(resolve(root, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
process.env.DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY
const deepseek = createDeepSeek()
const MODELO = 'deepseek-v4-pro'
const args = process.argv.slice(2)
const N = parseInt(args.find(a => a.startsWith('--n='))?.split('=')[1] ?? '12', 10)
const SOLO_ID = args.find(a => a.startsWith('--id='))?.split('=')[1]
const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const SIN_KCAL = /^(sal|agua|hielo|pimienta|salt|water)\b/
const hoy = new Date().toISOString().slice(0, 10)

// DeepSeek v4-pro por defecto; si no hay saldo (o se pide con --ia=gemini) usa Gemini 2.5 Flash
let usarGemini = args.includes('--ia=gemini')
async function llamarIA(texto) {
  if (!usarGemini) {
    try {
      const { text } = await generateText({ model: deepseek(MODELO), prompt: texto, temperature: 0.1, maxOutputTokens: 16000, abortSignal: AbortSignal.timeout(300000) })
      return text
    } catch (e) {
      if (!/Insufficient Balance/i.test(String(e.message))) throw e
      console.log('   (DeepSeek sin saldo: se usa Gemini)'); usarGemini = true
    }
  }
  const key = env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(180000),
    body: JSON.stringify({ contents: [{ parts: [{ text: texto }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 16000 } }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 120)}`)
  const j = await res.json()
  return j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ?? ''
}

function prompt(r, ings, origen) {
  return `Reconstruye la lista de ingredientes de una receta a partir de su TEXTO ORIGINAL (pie de un vídeo o página web; puede estar en italiano, inglés o español).

TEXTO ORIGINAL:
"""
${origen.texto}
"""

LO QUE HAY AHORA EN LA BASE DE DATOS para "${r.nombre}" (${r.porciones ?? 1} porciones, cantidades de la receta ENTERA):
${ings.map(i => `- ${i.nombre_libre} ${i.cantidad_gramos} g`).join('\n')}

Responde SOLO un JSON:
{"porciones": <nº de raciones que indica el original, o null si no lo dice>,
 "ingredientes": [{"nombre": "nombre en español, genérico y corto (p. ej. 'Carne picada', 'Harina de trigo')", "gramos": <número, receta ENTERA>, "origen": "cómo lo dice el original (p. ej. '2 cucharadas')", "estimada": true|false}],
 "instrucciones": "pasos numerados en español («1. …\\n2. …»), basados SOLO en el texto original; null si el original no describe la preparación",
 "comentarios": "una frase sobre qué cambia respecto a la base de datos"}

Reglas:
- Incluye TODOS los ingredientes del original, también condimentos, salsas y masas que se mencionen. No inventes ninguno que no aparezca.
- Convierte medidas a gramos de la receta entera: 1 cucharada ≈ 15 g (aceite 14 g), 1 cucharadita ≈ 5 g, 1 taza ≈ 240 g (harina 120 g, azúcar 200 g), 1 huevo ≈ 55 g, 1 diente de ajo ≈ 5 g, 1 cebolla mediana ≈ 150 g, 1 limón ≈ 60 g de zumo si pide zumo. Líquidos en ml ≈ g.
- Si el original no da cantidad ("a ojo", "al gusto"), pon una cantidad típica y pequeña y marca "estimada": true.
- Si el original lista varias partes (masa, salsa…), junta todo en una sola lista.
- Las instrucciones deben coincidir con la lista de ingredientes: no nombres ningún ingrediente que no esté en ella ni pongas cantidades (las cantidades van en la lista). Conserva el orden y la técnica del original.
- Si el texto original no contiene ingredientes, responde {"ingredientes": [], "comentarios": "el original no lista ingredientes"}.`
}

const SINONIMOS = [[/camarones?/g, 'gambas'], [/\bjugo\b/g, 'zumo'], [/\bcilantro\b/g, 'cilantro'], [/tortillas? de ma[ií]z o trigo/g, 'tortilla de trigo']]
const ENVASE = /\b(paquete|botella|frasco|bandeja|hacendado|eroski|lidl|carrefour|mercadona|alcampo|consum|pack|lata|tarrito|brik|bote|bolsa|caja|ultracongelad[oa]|congelad[oa])\b/
async function buscarAlimento(nombre, reuso) {
  let limpio = nombre.toLowerCase().trim()
  for (const [re, nuevo] of SINONIMOS) limpio = limpio.replace(re, nuevo)
  const n = norm(limpio)
  // 1) reutiliza el ingrediente que ya tenía la receta si se parece
  const toks = n.split(' ').filter(t => t.length > 2)
  const hit = reuso.find(i => { const m = norm(i.nombre_libre); return m === n || (toks.length > 0 && toks.every(t => m.includes(t))) })
  if (hit?.alimento) return { alimento: hit.alimento, via: 'existente' }
  const campos = 'id, nombre, calorias, proteinas, carbohidratos, grasas, fibra'
  const valido = a => SIN_KCAL.test(n) || a.calorias > 0
  // 2) nombre exacto (sin distinguir mayúsculas ni tildes)
  const { data: exactos } = await db.from('alimentos').select(campos).eq('es_comestible', true).ilike('nombre', limpio).limit(20)
  const exacto = (exactos ?? []).filter(valido).sort((a, b) => a.nombre.length - b.nombre.length)[0]
  if (exacto) return { alimento: exacto, via: 'exacto' }
  // 3) todas las palabras (con sus tildes en la consulta), palabras completas, sin envases y lo más genérico
  const palabrasConTilde = limpio.replace(/[^a-záéíóúñü0-9 ]/g, ' ').split(/\s+/).filter(t => t.length > 2).slice(0, 3)
  if (palabrasConTilde.length === 0) return null
  let q = db.from('alimentos').select(campos).eq('es_comestible', true).limit(1000)
  for (const p of palabrasConTilde) q = q.ilike('nombre', `%${p}%`)
  const { data } = await q
  const palabras = palabrasConTilde.map(norm)
  const ok = (data ?? []).filter(a => valido(a) && palabras.every(p => norm(a.nombre).split(' ').includes(p)))
  ok.sort((a, b) => (ENVASE.test(norm(a.nombre)) ? 1 : 0) - (ENVASE.test(norm(b.nombre)) ? 1 : 0) || a.nombre.length - b.nombre.length)
  return ok[0] ? { alimento: ok[0], via: 'catalogo' } : null
}

const macros = (items, porciones) => {
  const t = items.reduce((a, i) => i.alimento ? { kcal: a.kcal + i.alimento.calorias * i.gramos / 100, p: a.p + i.alimento.proteinas * i.gramos / 100, c: a.c + i.alimento.carbohidratos * i.gramos / 100, g: a.g + i.alimento.grasas * i.gramos / 100 } : a, { kcal: 0, p: 0, c: 0, g: 0 })
  const por = Math.max(1, porciones ?? 1)
  return { kcal: Math.round(t.kcal / por), p: Math.round(t.p / por), c: Math.round(t.c / por), g: Math.round(t.g / por) }
}

async function main() {
  const auditoria = JSON.parse(readFileSync(resolve(root, 'salidas', `auditoria-origen-recetas-${hoy === '2026-10-02' ? '2026-10-01' : hoy}.json`), 'utf-8'))
  let objetivo = auditoria.filter(x => x.estado === 'comparada')
    .map(x => ({ ...x, puntos: (x.inventados?.length ?? 0) * 2 + (x.sustituidos ?? []).filter(s => !/adaptaci/i.test(s.motivo ?? '')).length + (x.faltan?.length ?? 0) }))
    .sort((a, b) => b.puntos - a.puntos).slice(0, N)
  if (SOLO_ID) objetivo = auditoria.filter(x => x.receta_id === SOLO_ID)
  console.log(`Reconstruyendo ${objetivo.length} recetas…\n`)

  const propuestas = []
  for (const [i, x] of objetivo.entries()) {
    const f = resolve(root, 'salidas', 'origen-recetas', `${x.receta_id}.json`)
    if (!existsSync(f)) { console.log(`[${i + 1}] ${x.receta} — sin texto de origen en caché`); continue }
    const origen = JSON.parse(readFileSync(f, 'utf-8'))
    const { data: r } = await db.from('recetas').select('id, nombre, porciones, kcal, proteinas, carbohidratos, grasas').eq('id', x.receta_id).single()
    const { data: ings } = await db.from('receta_ingredientes').select('id, nombre_libre, cantidad_gramos, alimento_id, alimento:alimentos(id, nombre, calorias, proteinas, carbohidratos, grasas, fibra)').eq('receta_id', r.id)
    let json = null
    for (let t = 0; t < 3 && !json; t++) {
      try {
        const text = await llamarIA(prompt(r, ings ?? [], origen))
        const m = text.match(/\{[\s\S]*\}/); if (m) json = JSON.parse(m[0])
      } catch (e) { console.log('   error IA:', String(e.message).slice(0, 160)) }
    }
    if (!json || !json.ingredientes?.length) { console.log(`[${i + 1}] ${r.nombre} — sin propuesta (${json?.comentarios ?? 'error IA'})`); continue }

    const nuevos = []
    for (const ing of json.ingredientes) {
      const m = await buscarAlimento(ing.nombre, ings ?? [])
      nuevos.push({ nombre: ing.nombre, gramos: Number(ing.gramos), origen: ing.origen, estimada: !!ing.estimada, alimento: m?.alimento ?? null, via: m?.via ?? null })
    }
    const porciones = json.porciones ?? r.porciones ?? 1
    const antes = { kcal: Math.round(r.kcal), p: Math.round(r.proteinas), c: Math.round(r.carbohidratos), g: Math.round(r.grasas) }
    const despues = macros(nuevos, porciones)
    const sinVincular = nuevos.filter(n => !n.alimento).map(n => n.nombre)
    const usados = new Set(nuevos.map(n => n.alimento?.id).filter(Boolean))
    const quitar = (ings ?? []).filter(a => !usados.has(a.alimento_id)).map(a => `${a.nombre_libre} ${a.cantidad_gramos} g`)
    propuestas.push({ receta_id: r.id, receta: r.nombre, url: origen.url, porciones_actual: r.porciones, porciones_propuesta: porciones, antes, despues, comentarios: json.comentarios, instrucciones: json.instrucciones ?? null, quitar, sin_vincular: sinVincular,
      ingredientes: nuevos.map(n => ({ nombre: n.nombre, gramos: n.gramos, origen: n.origen, estimada: n.estimada, alimento_id: n.alimento?.id ?? null, alimento: n.alimento?.nombre ?? null, via: n.via })) })
    console.log(`[${i + 1}/${objetivo.length}] ${r.nombre} — ${nuevos.length} ingredientes, ${sinVincular.length} sin vincular · kcal/ración ${antes.kcal} → ${despues.kcal}`)
  }

  writeFileSync(resolve(root, 'salidas', `propuestas-recetas-${hoy}.json`), JSON.stringify(propuestas, null, 1))
  const md = propuestas.map(p => `## ${p.receta}\n${p.url}\n\n- Raciones: ${p.porciones_actual} → ${p.porciones_propuesta}\n- kcal/ración: ${p.antes.kcal} → **${p.despues.kcal}** · P ${p.antes.p}→${p.despues.p} · C ${p.antes.c}→${p.despues.c} · G ${p.antes.g}→${p.despues.g}\n- ${p.comentarios}\n- Ingredientes propuestos:\n${p.ingredientes.map(i => `  - ${i.nombre} ${i.gramos} g${i.estimada ? ' (estimada)' : ''} ← «${i.origen}» → ${i.alimento ?? '⚠ SIN VINCULAR'}`).join('\n')}\n- Se quitarían: ${p.quitar.join(', ') || 'nada'}\n`).join('\n')
  writeFileSync(resolve(root, 'salidas', `propuestas-recetas-${hoy}.md`), md)
  console.log(`\nPropuestas: ${propuestas.length} · salidas/propuestas-recetas-${hoy}.md`)
}
main().catch(e => { console.error(e); process.exit(1) })
