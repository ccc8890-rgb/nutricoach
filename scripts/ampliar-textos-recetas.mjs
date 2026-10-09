/**
 * ampliar-textos-recetas.mjs — redacta instrucciones y consejos con IA para recetas con texto pobre,
 * SUPERVISADO: genera → valida automáticamente → guarda propuestas en salidas/ → (tras revisión humana) --aplica.
 *   node scripts/ampliar-textos-recetas.mjs --limite=8                 # genera y valida, NO escribe en la BD
 *   node scripts/ampliar-textos-recetas.mjs --aplica --solo-validas    # escribe las que pasaron validación (copia en salidas/)
 * NO forma parte de la pasada autónoma: siempre bajo supervisión.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const arg = (n, d) => (process.argv.find(a => a.startsWith('--' + n + '='))?.split('=')[1]) ?? d
const LIMITE = Number(arg('limite', 8)), APLICA = process.argv.includes('--aplica'), SOLO_VALIDAS = process.argv.includes('--solo-validas')
const FICHERO = 'salidas/propuestas-textos.json'
const AUDIT = process.argv.includes('--auditoria') // modo (--auditoria): pasos que no mencionan algún ingrediente importante (salidas/pasos-vs-ingredientes.json)
const hechas = new Set(AUDIT && fs.existsSync('salidas/auditoria-textos-hechas.json') ? JSON.parse(fs.readFileSync('salidas/auditoria-textos-hechas.json', 'utf8')) : [])
const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 %.,]/g,' ').replace(/\s+/g,' ').trim()
const STOP = new Set('de del la el en con sin para y o al los las un una natural light fresco fresca picado picada troceado rallado molido entero cocido crudo opcional polvo'.split(' '))
const claves = s => norm(s).split(' ').filter(w => w.length > 3 && !STOP.has(w)).map(w => w.replace(/(es|s)$/, ''))

async function deepseek(prompt) {
  for (let intento = 0; intento < 2; intento++) {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.DEEPSEEK_API_KEY },
      body: JSON.stringify({ model: env.DEEPSEEK_MODEL || 'deepseek-chat', temperature: 0.3, max_tokens: 1200, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Eres un dietista-cocinero español. Respondes SOLO con JSON válido.' }, { role: 'user', content: prompt }] }) })
    if (!r.ok) continue
    const txt = (await r.json()).choices?.[0]?.message?.content || ''
    try { return JSON.parse(txt) } catch { /* JSON mal formado: reintenta una vez */ }
  }
  return null
}

function validar(r, ings, out) {
  const e = []
  if (!out || typeof out.instrucciones !== 'string') return ['JSON inválido o sin instrucciones']
  const txt = out.instrucciones.trim(), n = norm(txt)
  const pasos = txt.split('\n').filter(l => /^\s*\d+[.)]\s+\S/.test(l))
  if (pasos.length < 3 || pasos.length > 9) e.push(`nº de pasos ${pasos.length} (esperado 3-9)`)
  if (txt.length < 200 || txt.length > 1500) e.push(`longitud ${txt.length}`)
  // cada ingrediente principal (>10 g) debe aparecer en los pasos
  for (const i of ings) if (i.g > 10) { const k = claves(i.nombre); if (k.length && !k.some(w => n.includes(w))) e.push(`falta ingrediente en los pasos: ${i.nombre}`) }
  // cantidades citadas en los pasos: deben existir en la lista (±10 %) o ser temperaturas/tiempos
  const permitidas = ings.map(i => i.g).filter(Boolean)
  for (const m of txt.matchAll(/(\d+(?:[.,]\d+)?)\s?(g|gr|gramos|ml)\b/gi)) {
    const v = parseFloat(m[1].replace(',', '.'))
    const contexto = txt.slice(Math.max(0, m.index - 30), m.index + m[0].length)
    if (/agua[^.]{0,25}$/i.test(contexto)) continue // el agua de cocción no es ingrediente
    if (!permitidas.some(p => Math.abs(p - v) <= Math.max(2, p * 0.1))) e.push(`cantidad inventada: ${m[0]}`)
  }
  // ingredientes inventados: palabras de alimentos comunes ausentes de la lista
  const lista = norm(ings.map(i => i.nombre).join(' '))
  for (const x of ['sal','pimienta','aceite','ajo','cebolla','limon','huevo','harina','azucar','mantequilla','leche','queso','nata','vinagre','canela','vainilla','levadura','miel']) if (new RegExp(`\\b${x}(s|es)?\\b`).test(n) && !lista.includes(x)) e.push(`posible ingrediente no listado: ${x}`)
  for (const m of txt.matchAll(/(\d+(?:[.,]\d+)?)\s?g\s+de\s+(?:la |el |los |las )?(sal|pimienta|condimento|especias?|ajo en polvo|cebolla en polvo|piment[oó]n|comino|canela|or[eé]gano)/gi)) if (parseFloat(m[1].replace(',', '.')) > 20) e.push(`cantidad sospechosa: ${m[0]} (¿dato erróneo en la lista?)`)
  if (/v[ií]spera|carrera|recuperaci[oó]n|maratón|competici/.test(n)) e.push('menciona víspera/carrera (regla: textos genéricos)')
  if (/\b(the|and|with|until|minutes)\b/.test(n)) e.push('contiene inglés')
  if (AUDIT && r.instrucciones) { // conservar lo que estaba bien: ≥60 % de las palabras del texto original deben seguir, y la estructura no cambia mucho
    const viejas = [...new Set(norm(r.instrucciones).split(' ').filter(w => w.length > 4))]
    const nuevas = new Set(norm(txt).split(' '))
    const conserva = viejas.length ? viejas.filter(w => nuevas.has(w)).length / viejas.length : 1
    const pasosViejos = r.instrucciones.split('\n').filter(l => /^\s*\d+[.)]/.test(l)).length
    if (conserva < 0.6) e.push(`reescritura excesiva: conserva ${Math.round(conserva * 100)} % del texto original`)
    if (pasosViejos && Math.abs(pasosViejos - pasos.length) > 2) e.push(`cambia el nº de pasos (${pasosViejos} → ${pasos.length})`)
  }
  if (typeof out.consejos === 'string' && out.consejos.length > 400) e.push('consejos demasiado largos')
  return e
}

const all = async (t, c, f) => { const o = []; for (let i = 0; ; i += 1000) { let q = sb.from(t).select(c).range(i, i + 999); if (f) q = f(q); const { data, error } = await q; if (error) throw error; o.push(...data); if (data.length < 1000) break } return o }

if (APLICA) {
  const props = JSON.parse(fs.readFileSync(FICHERO, 'utf8')).filter(p => !SOLO_VALIDAS || p.errores.length === 0)
  const copia = `salidas/copia-textos-${new Date().toISOString().replace(/[:.]/g,'-')}.json`
  const previos = []; for (const p of props) { const { data } = await sb.from('recetas').select('id,instrucciones,consejos').eq('id', p.id).single(); previos.push(data) }
  fs.writeFileSync(copia, JSON.stringify(previos, null, 1)); console.log('Copia:', copia)
  if (AUDIT) { const h = [...hechas, ...props.map(p => p.id)]; fs.writeFileSync('salidas/auditoria-textos-hechas.json', JSON.stringify(h)) }
  for (const p of props) { const patch = { instrucciones: p.instrucciones }; if (p.consejos && !p.consejos_previos) patch.consejos = p.consejos; const { error } = await sb.from('recetas').update(patch).eq('id', p.id); console.log(error ? 'ERROR ' + p.nombre : 'ok  ' + p.nombre) }
  process.exit(0)
}

const R = await all('recetas', 'id,nombre,instrucciones,consejos,porciones,tiempo_prep_min,tiempo_coccion_min,tipo_coccion,tipo_plato,estado', q => q.neq('estado', 'descartada'))
const idsAudit = AUDIT ? new Set(JSON.parse(fs.readFileSync('salidas/pasos-vs-ingredientes.json', 'utf8')).filter(h => h.e.some(e => e[0] === 'A' && /\((\d+) g\)/.test(e) && +e.match(/\((\d+) g\)/)[1] >= 30)).map(h => h.id)) : null
const esCand = r => AUDIT ? idsAudit.has(r.id) && !hechas.has(r.id) : (!r.instrucciones || r.instrucciones.length < 150)
const cand = R.filter(esCand).slice(0, LIMITE)
console.log('candidatas totales:', R.filter(esCand).length, '| esta tanda:', cand.length)
const props = []
for (const r of cand) {
  const { data } = await sb.from('receta_ingredientes').select('nombre_libre,cantidad_gramos,cantidad_original,unidad_display,orden,alimentos(nombre)').eq('receta_id', r.id).order('orden')
  const ings = data.map(i => ({ nombre: i.nombre_libre || i.alimentos?.nombre, g: i.cantidad_gramos, eq: i.cantidad_original && i.unidad_display ? `${i.cantidad_original} ${i.unidad_display}` : null }))
  const lista = ings.map(i => `- ${i.nombre}: ${i.g} g${i.eq ? ` (${i.eq})` : ''}`).join('\n')
  const prompt = `Redacta las instrucciones de esta receta para un cliente de nutrición.
RECETA: ${r.nombre} (${r.tipo_plato || 'plato'}, ${r.porciones || 1} raciones${r.tipo_coccion ? ', cocción: ' + r.tipo_coccion : ''}${r.tiempo_prep_min ? ', preparación ' + r.tiempo_prep_min + ' min' : ''})
INGREDIENTES (únicos permitidos, con sus gramos totales de la receta):
${lista}
INSTRUCCIONES ACTUALES (${AUDIT ? 'conserva todo lo que esté bien y su estilo; añade SOLO lo que falte para que aparezcan todos los ingredientes de la lista y corrige incoherencias' : 'muy breves, respétalas y amplíalas'}): ${r.instrucciones || '(ninguna)'}
REGLAS: pasos numerados "1. ...", tantos como la receta necesite de verdad (3 a 6; una receta de montaje simple lleva 3 o 4). PROHIBIDO rellenar con pasos como «comprueba la textura» o frases que se contradigan. Usa SOLO los ingredientes de la lista, sin añadir otros (ni sal, ni aceite, ni especias que no estén). Si citas gramos, usa exactamente los de la lista. Si indicas temperatura o tiempo de cocción, que sean realistas. Español de España, claro y directo, sin adornos, sin mencionar entrenamientos ni competiciones.
Devuelve JSON: {"instrucciones":"1. ...\\n2. ...","consejos":"UNA o DOS frases cortas y útiles (conservación o truco), sin repetir la receta"}`
  const out = await deepseek(prompt)
  const errores = validar(r, ings, out)
  props.push({ id: r.id, nombre: r.nombre, instrucciones_previas: r.instrucciones, instrucciones: out?.instrucciones?.trim() ?? null, consejos: out?.consejos?.trim() ?? null, consejos_previos: r.consejos || null, errores })
  console.log((errores.length ? '✖' : '✔'), r.nombre, errores.length ? '→ ' + errores.join('; ') : '')
}
fs.writeFileSync(FICHERO, JSON.stringify(props, null, 1))
console.log(`\nválidas: ${props.filter(p => !p.errores.length).length}/${props.length} → ${FICHERO} (nada escrito en la BD)`)
