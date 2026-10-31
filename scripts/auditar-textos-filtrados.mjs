/**
 * auditar-textos-filtrados.mjs
 * Busca en los textos que ve el público (nombre, descripción, instrucciones, consejos, líneas de ingredientes) restos
 * internos que no deben llegar al recetario: avisos de borrador, enlaces a reels, marcas de IA, hashtags, @usuarios,
 * llamadas a redes («link en bio», «sígueme»), placeholders («undefined», «{{», «TODO») y texto cortado.
 *   node scripts/auditar-textos-filtrados.mjs            → solo informa (con detalle por receta)
 *   node scripts/auditar-textos-filtrados.mjs --aplica   → vacía la DESCRIPCIÓN si lleva un resto de gravedad «alta»
 *                                                          (copia previa en salidas/); el resto solo se informa
 * Solo toca `descripcion`: pasos, consejos y nombres se corrigen a mano (o con el motor de correcciones).
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const aplica = process.argv.includes('--aplica')
const todo = async (t, c) => { const o = []; for (let f = 0; ; f += 1000) { const { data, error } = await sb.from(t).select(c).range(f, f + 999); if (error) throw error; o.push(...data); if (data.length < 1000) break } return o }

// [nombre, regex, gravedad]
const REGLAS = [
  ['aviso-borrador', /BORRADOR AUTOM|PROPUESTA INTUIDA|propuesta intuida|confianza de la propuesta|Completar y verificar con el reel/i, 'alta'],
  ['aviso-emoji', /⚠️|🚧|❗️?\s*(?:revisar|completar)/i, 'alta'],
  ['enlace', /https?:\/\/|www\.|\b(?:vm|vt)\.tiktok\.com|instagram\.com\/|youtu\.?be/i, 'alta'],
  ['marca-ia', /como (?:modelo|inteligencia)|asistente de ia|\bGPT-?\d|DeepSeek|Claude|OpenAI|lorem ipsum/i, 'alta'],
  ['placeholder', /\bundefined\b|\bnull\b|\bNaN\b|\{\{|\}\}|\[object|\bTODO\b|\bXXX\b|\bPENDIENTE\b/, 'alta'],
  ['llamada-redes', /link en (?:la )?bio|enlace en (?:la )?bio|s[ií]gueme|suscr[ií]bete|comenta ["“«]?\w+["”»]? y te|mi canal|dale like|guarda este reel/i, 'alta'],
  ['hashtag-usuario', /(?:^|\s)#[\p{L}\d_]{3,}|(?:^|\s)@[\w.]{3,}/u, 'media'],
  ['video-sin-titulo', /^(?:Video by|Receta sin t[ií]tulo)|\.\.\.$|…$/i, 'media'],
  ['markdown-suelto', /\*\*|`{1,3}|^#\s/m, 'media'], // «## Fase» es válido (fases de la receta),
]
const CAMPOS = ['nombre', 'descripcion', 'instrucciones', 'consejos']

const recetas = await todo('recetas', 'id,nombre,estado,descripcion,instrucciones,consejos')
const lineas = await todo('receta_ingredientes', 'receta_id,nombre_libre')
const porReceta = new Map(); for (const l of lineas) (porReceta.get(l.receta_id) ?? porReceta.set(l.receta_id, []).get(l.receta_id)).push(l)

const hallazgos = []
for (const r of recetas) {
  const textos = Object.fromEntries(CAMPOS.map(c => [c, typeof r[c] === 'string' ? r[c] : '']))
  for (const l of porReceta.get(r.id) ?? []) { textos[`ingrediente:${l.nombre_libre ?? ''}`] = [l.nombre_libre].filter(x => typeof x === 'string').join(' ') }
  for (const [campo, t] of Object.entries(textos)) {
    if (!t) continue
    for (const [regla, re, grav] of REGLAS) if (re.test(t)) hallazgos.push({ id: r.id, nombre: r.nombre, estado: r.estado, campo: campo.startsWith('ingrediente:') ? 'ingrediente' : campo, regla, grav, muestra: (t.match(re)?.[0] ?? '').slice(0, 60) })
  }
}
// Defectos visibles que no son «restos», solo se informan
const norm = x => (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
for (const r of recetas) {
  const add = (campo, regla, muestra) => hallazgos.push({ id: r.id, nombre: r.nombre, estado: r.estado, campo, regla, grav: 'media', muestra })
  if (/\s{2,}/.test(r.nombre || '')) add('nombre', 'doble-espacio', r.nombre)
  if (/\p{Extended_Pictographic}/u.test(r.nombre || '')) add('nombre', 'emoji-en-nombre', r.nombre)
  if ((r.nombre || '').length > 6 && r.nombre === r.nombre.toUpperCase()) add('nombre', 'todo-mayusculas', r.nombre)
  if (r.descripcion && norm(r.descripcion) === norm(r.nombre)) add('descripcion', 'descripcion-igual-al-titulo', r.descripcion.slice(0, 40))
  if (r.descripcion && r.descripcion.trim().split(/\s+/).length < 3) add('descripcion', 'descripcion-demasiado-corta', r.descripcion)
  if (r.estado === 'aprobada' && (r.instrucciones || '').trim().length < 30) add('instrucciones', 'aprobada-sin-pasos', (r.instrucciones || '').slice(0, 30))
  if (r.estado === 'aprobada' && /[,;:(]\s*$/.test((r.instrucciones || '').trim())) add('instrucciones', 'pasos-cortados', (r.instrucciones || '').trim().slice(-30))
}
const por = {}; for (const h of hallazgos) { const k = `${h.regla}/${h.campo}`; por[k] = (por[k] || 0) + 1 }
const publicos = hallazgos.filter(h => h.estado === 'aprobada')
console.log(`Recetas: ${recetas.length} | hallazgos: ${hallazgos.length} (${new Set(hallazgos.map(h => h.id)).size} recetas) | en aprobadas: ${publicos.length} | gravedad alta: ${hallazgos.filter(h => h.grav === 'alta').length}`)
for (const [k, n] of Object.entries(por).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`)
if (process.argv.includes('--detalle') || !aplica) for (const h of hallazgos.slice(0, 60)) console.log(`  [${h.grav}] ${h.estado} | ${h.nombre} | ${h.campo} | ${h.regla} | «${h.muestra}»`)

if (aplica) {
  const ids = [...new Set(hallazgos.filter(h => h.grav === 'alta' && h.campo === 'descripcion').map(h => h.id))]
  if (ids.length) {
    fs.mkdirSync('salidas', { recursive: true })
    fs.writeFileSync(`salidas/31-10-2026_BACKUP-textos-filtrados-${Date.now()}.json`, JSON.stringify(recetas.filter(r => ids.includes(r.id)).map(r => ({ id: r.id, descripcion: r.descripcion })), null, 1))
    for (const id of ids) { const { error } = await sb.from('recetas').update({ descripcion: null }).eq('id', id); if (error) console.log('  ERROR', id, error.message) }
  }
  console.log(`Descripciones vaciadas: ${ids.length}`)
  // Arreglos triviales: dobles espacios del nombre y descripción que solo repite el título
  let menores = 0
  for (const h of hallazgos) {
    const r = recetas.find(x => x.id === h.id)
    const patch = h.regla === 'doble-espacio' ? { nombre: r.nombre.replace(/\s{2,}/g, ' ').trim() } : h.regla === 'descripcion-igual-al-titulo' ? { descripcion: null } : null
    if (!patch) continue
    const { error } = await sb.from('recetas').update(patch).eq('id', h.id); if (error) console.log('  ERROR', h.id, error.message); else menores++
  }
  console.log(`Arreglos menores: ${menores}`)
}
