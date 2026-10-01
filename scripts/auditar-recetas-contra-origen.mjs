/**
 * auditar-recetas-contra-origen.mjs
 *
 * Auditoría read-only (petición de Carlos, 01-10-2026): compara los ingredientes de cada receta del
 * recetario con el TEXTO ORIGINAL de su enlace (pie del vídeo de TikTok/Instagram o página web) y detecta
 * ingredientes inventados (p. ej. "caseína micelar" que el original no lleva), sustituidos (zumo de naranja
 * en vez de limón) o que faltan. NO modifica la base de datos.
 *
 * Fuentes: TikTok y webs funcionan sin sesión. Instagram exige sesión: solo se intenta con
 *   --cookies-from-browser <navegador>   (o --cookies <archivo cookies.txt>)
 *
 * USO:
 *   node scripts/auditar-recetas-contra-origen.mjs                     # TikTok + webs
 *   node scripts/auditar-recetas-contra-origen.mjs --instagram --cookies archivo.txt
 *   node scripts/auditar-recetas-contra-origen.mjs --id=<uuid>         # una receta
 *   node scripts/auditar-recetas-contra-origen.mjs --solo-descargar    # solo guarda los textos de origen
 *
 * Cachea los textos en salidas/origen-recetas/<id>.json y escribe salidas/auditoria-origen-recetas-FECHA.json
 */
import { createClient } from '@supabase/supabase-js'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { generateText } from 'ai'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
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
// El proyecto exige deepseek-v4-pro para recetas (deepseek-chat se queda colgado a veces)
const MODELO = 'deepseek-v4-pro'

const args = process.argv.slice(2)
const flag = n => args.includes(n)
const valor = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : args.find(a => a.startsWith(n + '='))?.split('=')[1] }
const SOLO_ID = valor('--id')
const INSTAGRAM = flag('--instagram')
const COOKIES_NAV = valor('--cookies-from-browser')
const COOKIES_ARCHIVO = valor('--cookies')
const SOLO_DESCARGAR = flag('--solo-descargar')
const CACHE = resolve(root, 'salidas', 'origen-recetas')
mkdirSync(CACHE, { recursive: true })
const pausa = ms => new Promise(r => setTimeout(r, ms))

function tipoFuente(url) {
  if (!/^https?:/.test(url)) return 'manual'
  if (/instagram\.com/.test(url)) return 'instagram'
  if (/tiktok\.com/.test(url)) return 'tiktok'
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube'
  return 'web'
}

function textoDeHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<\/(p|li|h\d|div|br|tr)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#?\w+;/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
}

async function obtenerOrigen(receta) {
  const f = resolve(CACHE, `${receta.id}.json`)
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf-8'))
  const tipo = tipoFuente(receta.url_origen)
  let texto = '', error = null
  try {
    if (tipo === 'web') {
      const res = await fetch(receta.url_origen, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      texto = textoDeHtml(await res.text()).slice(0, 9000)
    } else if (tipo === 'tiktok' || tipo === 'youtube' || tipo === 'instagram') {
      const extra = COOKIES_ARCHIVO ? ['--cookies', COOKIES_ARCHIVO] : COOKIES_NAV ? ['--cookies-from-browser', COOKIES_NAV] : []
      const out = execFileSync('yt-dlp', ['-q', '--no-warnings', '--skip-download', '--dump-single-json', ...extra, receta.url_origen], { encoding: 'utf-8', timeout: 60000, maxBuffer: 20 * 1024 * 1024 })
      const d = JSON.parse(out)
      texto = [d.title, d.description].filter(Boolean).join('\n').slice(0, 9000)
    }
  } catch (e) { error = String(e.message ?? e).split('\n')[0].slice(0, 200) }
  const origen = { id: receta.id, url: receta.url_origen, tipo, texto, error }
  if (texto || !error) writeFileSync(f, JSON.stringify(origen, null, 1))
  return origen
}

function prompt(receta, ingredientes, origen) {
  return `Compara una receta guardada en una base de datos con su TEXTO ORIGINAL (pie del vídeo o página web, puede estar en italiano, inglés o español).

TEXTO ORIGINAL:
"""
${origen.texto}
"""

RECETA EN LA BASE DE DATOS: "${receta.nombre}" (${receta.porciones ?? 1} porciones)
Ingredientes (cantidades totales de la receta):
${ingredientes.map(i => `- ${i.nombre_libre} ${i.cantidad_gramos} g`).join('\n')}

Revisa SOLO los ingredientes. Responde un JSON con esta forma exacta:
{"origen_tiene_ingredientes": true|false,
 "inventados": [{"ingrediente": "...", "motivo": "no aparece en el original"}],
 "sustituidos": [{"base_datos": "...", "original": "...", "motivo": "..."}],
 "faltan": [{"original": "...", "motivo": "..."}],
 "resumen": "una frase"}

Reglas:
- "origen_tiene_ingredientes" = false si el texto original NO lista los ingredientes (p. ej. solo hashtags o "receta en el vídeo"). En ese caso deja las demás listas vacías: no se puede juzgar.
- inventado = ingrediente de la base de datos que el original no menciona en absoluto. Sal, pimienta, agua y aceite para untar NO cuentan.
- sustituido = el original pide X y la base de datos lleva otro Y (p. ej. zumo de limón vs zumo de naranja, harina 00 vs harina de avena). Una adaptación fit razonable (harina de trigo → avena, azúcar → edulcorante) se anota igualmente como "sustituido" con motivo "adaptación".
- faltan = ingrediente del original que no está en la base de datos (p. ej. levadura/polvo de hornear).
- Ignora diferencias de cantidad y de marca. Responde SOLO el JSON.`
}

async function main() {
  let q = db.from('recetas').select('id, nombre, estado, url_origen, porciones').not('url_origen', 'is', null).eq('estado', 'aprobada')
  if (SOLO_ID) q = db.from('recetas').select('id, nombre, estado, url_origen, porciones').eq('id', SOLO_ID)
  const { data: recetas, error } = await q
  if (error) throw error
  const candidatas = (recetas ?? []).filter(r => {
    const t = tipoFuente(r.url_origen)
    return t === 'tiktok' || t === 'youtube' || t === 'web' || (t === 'instagram' && INSTAGRAM)
  })
  console.log(`Recetas con enlace: ${recetas.length} · a revisar ahora: ${candidatas.length}${INSTAGRAM ? '' : ' (sin Instagram)'}`)

  const resultados = []
  let i = 0
  for (const r of candidatas) {
    i++
    const origen = await obtenerOrigen(r)
    if (origen.tipo === 'instagram') await pausa(4000)
    if (!origen.texto) { console.log(`[${i}/${candidatas.length}] ${r.nombre} — sin texto de origen (${origen.error ?? 'vacío'})`); resultados.push({ receta: r.nombre, receta_id: r.id, url: r.url_origen, estado: 'sin_origen', error: origen.error }); continue }
    if (SOLO_DESCARGAR) { console.log(`[${i}/${candidatas.length}] ${r.nombre} — origen guardado (${origen.texto.length} car.)`); continue }
    const { data: ings } = await db.from('receta_ingredientes').select('nombre_libre, cantidad_gramos').eq('receta_id', r.id)
    try {
      const { text } = await generateText({ model: deepseek(MODELO), prompt: prompt(r, ings ?? [], origen), temperature: 0.1, maxOutputTokens: 8000, abortSignal: AbortSignal.timeout(240000) })
      const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0])
      const hallazgos = (json.inventados?.length ?? 0) + (json.sustituidos?.length ?? 0) + (json.faltan?.length ?? 0)
      resultados.push({ receta: r.nombre, receta_id: r.id, url: r.url_origen, estado: json.origen_tiene_ingredientes ? 'comparada' : 'origen_sin_ingredientes', ...json })
      console.log(`[${i}/${candidatas.length}] ${r.nombre} — ${json.origen_tiene_ingredientes ? `${hallazgos} diferencias` : 'el original no lista ingredientes'}`)
    } catch (e) {
      console.log(`[${i}/${candidatas.length}] ${r.nombre} — error IA: ${String(e.message).slice(0, 80)}`)
      resultados.push({ receta: r.nombre, receta_id: r.id, url: r.url_origen, estado: 'error_ia' })
    }
  }
  if (!SOLO_DESCARGAR) {
    const salida = resolve(root, 'salidas', `auditoria-origen-recetas-${new Date().toISOString().slice(0, 10)}.json`)
    writeFileSync(salida, JSON.stringify(resultados, null, 1))
    const comp = resultados.filter(x => x.estado === 'comparada')
    console.log(`\nComparadas: ${comp.length} · con diferencias: ${comp.filter(x => (x.inventados?.length ?? 0) + (x.sustituidos?.length ?? 0) + (x.faltan?.length ?? 0) > 0).length} · sin ingredientes en el original: ${resultados.filter(x => x.estado === 'origen_sin_ingredientes').length} · sin origen: ${resultados.filter(x => x.estado === 'sin_origen').length}`)
    console.log('Informe:', salida)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
