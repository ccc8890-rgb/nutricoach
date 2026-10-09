/**
 * rellenar-campos-ia.mjs — rellena consejos / tiempo de preparación con IA, SUPERVISADO:
 * genera → valida → propuestas en salidas/ → (tras revisión) --aplica. NO es autónomo.
 *   node scripts/rellenar-campos-ia.mjs --campo=consejos|tiempo [--limite=30]
 *   node scripts/rellenar-campos-ia.mjs --campo=consejos --aplica --solo-validas
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const arg = (n, d) => (process.argv.find(a => a.startsWith('--' + n + '='))?.split('=')[1]) ?? d
const CAMPO = arg('campo', 'consejos'), LIMITE = Number(arg('limite', 30)), APLICA = process.argv.includes('--aplica'), SOLO_VALIDAS = process.argv.includes('--solo-validas')
const FICHERO = `salidas/propuestas-${CAMPO}.json`
const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
async function deepseek(prompt) {
  for (let i = 0; i < 2; i++) {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.DEEPSEEK_API_KEY },
      body: JSON.stringify({ model: env.DEEPSEEK_MODEL || 'deepseek-chat', temperature: 0.2, max_tokens: 400, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Eres un dietista-cocinero español. Respondes SOLO con JSON válido.' }, { role: 'user', content: prompt }] }) })
    if (!r.ok) continue
    try { return JSON.parse((await r.json()).choices?.[0]?.message?.content || '') } catch { /* reintenta */ }
  }
  return null
}
if (APLICA) {
  const props = JSON.parse(fs.readFileSync(FICHERO, 'utf8')).filter(p => !SOLO_VALIDAS || !p.errores.length)
  const col = CAMPO === 'tiempo' ? 'tiempo_prep_min' : 'consejos'
  const previos = []; for (const p of props) { const { data } = await sb.from('recetas').select('id,' + col).eq('id', p.id).single(); previos.push(data) }
  const copia = `salidas/copia-${CAMPO}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`; fs.writeFileSync(copia, JSON.stringify(previos, null, 1)); console.log('Copia:', copia)
  for (const p of props) { const { error } = await sb.from('recetas').update({ [col]: p.valor }).eq('id', p.id); console.log(error ? 'ERROR ' + p.nombre : 'ok  ' + p.nombre) }
  process.exit(0)
}
const R = []; for (let f = 0; ; f += 1000) { const { data } = await sb.from('recetas').select('id,nombre,tipo_plato,porciones,tipo_coccion,instrucciones,consejos,tiempo_prep_min,tiempo_coccion_min,estado').range(f, f + 999); R.push(...data); if (data.length < 1000) break }
const cand = R.filter(r => r.estado !== 'descartada' && (CAMPO === 'tiempo' ? !r.tiempo_prep_min : !r.consejos)).slice(0, LIMITE)
console.log('candidatas', R.filter(r => r.estado !== 'descartada' && (CAMPO === 'tiempo' ? !r.tiempo_prep_min : !r.consejos)).length, '| esta tanda', cand.length)
const props = []
for (const r of cand) {
  const { data } = await sb.from('receta_ingredientes').select('nombre_libre,cantidad_gramos').eq('receta_id', r.id)
  const lista = data.map(i => `${i.nombre_libre} ${i.cantidad_gramos} g`).join(', ')
  let valor = null, errores = []
  if (CAMPO === 'consejos') {
    const out = await deepseek(`Receta: ${r.nombre} (${r.tipo_plato}). Ingredientes: ${lista}.\nPasos: ${(r.instrucciones || '').replace(/\n/g, ' ')}\nEscribe UN consejo útil para quien la cocina: conservación (plazo realista en nevera, máximo 3 días) o un truco de TÉCNICA (punto de cocción, textura, cómo recalentar). PROHIBIDO proponer añadir, sustituir o quitar ingredientes (nada de «añade una cucharada de…» ni «marina con…»). Nunca recomiendes dejar alimentos cocinados fuera de la nevera más de 1 hora. UNA o DOS frases cortas (máx. 250 caracteres), sin repetir los pasos, sin promesas de salud, sin mencionar entrenamientos ni competiciones.\nJSON: {"consejos":"..."}`)
    valor = out?.consejos?.trim() ?? null
    if (!valor) errores.push('sin texto / JSON inválido')
    else {
      const frases = valor.split(/(?<=[.!?])\s+/).filter(Boolean).length
      if (valor.length < 40 || valor.length > 280) errores.push('longitud ' + valor.length)
      if (frases > 3) errores.push('demasiadas frases ' + frases)
      if (/v[ií]spera|carrera|recuperaci[oó]n|marat[oó]n|competici|entreno|entrenamiento/.test(norm(valor))) errores.push('menciona entreno/carrera')
      if (/\b(cura|previene|adelgaza|quema grasa|detox)\b/.test(norm(valor))) errores.push('promesa de salud')
      if (/\b(the|and|with|until)\b/.test(norm(valor))) errores.push('inglés')
      const lista = norm(data.map(i => i.nombre_libre).join(' '))
      for (const x of ['mozzarella','pesto','yogur','limon','mantequilla','aceite','vinagre','queso','nata','cacao','miel','azucar','sal','pimienta','ajo','cebolla','leche','harina','huevo','tomate','perejil','soja','mostaza','tahini','almendra','nuez','nueces','canela','vainilla','mermelada','aguacate','platano','fresa'])
        if (new RegExp(`\\b${x}(s|es)?\\b`).test(norm(valor)) && !lista.includes(x)) errores.push('ingrediente no listado: ' + x)
      if (/(a|al) temperatura ambiente/.test(norm(valor)) && /(arroz|pollo|pavo|pescado|huevo|carne|nata|queso|yogur)/.test(lista)) errores.push('seguridad: temperatura ambiente con alimento perecedero')
      if (/enfr[ií]a(lo|la)?[^.]*hora/.test(norm(valor))) errores.push('seguridad: enfriado prolongado')
      const dias = [...norm(valor).matchAll(/(\d+)\s*dias/g)].map(m => +m[1]); if (dias.some(d => d > 3)) errores.push('plazo de conservación >3 días')
    }
  } else {
    const out = await deepseek(`Receta: ${r.nombre} (${r.tipo_plato}, ${r.porciones || 1} raciones${r.tipo_coccion ? ', cocción: ' + r.tipo_coccion : ''}). Ingredientes: ${lista}.\nPasos: ${(r.instrucciones || '').replace(/\n/g, ' ')}\nEstima los MINUTOS de preparación activa (sin contar reposos largos ni la cocción pasiva) para una persona con práctica normal. Entero.\nJSON: {"minutos":N}`)
    const m = Number(out?.minutos); valor = Number.isFinite(m) ? Math.round(m) : null
    if (valor == null) errores.push('sin número')
    else if (valor < 2 || valor > 90) errores.push('fuera de rango ' + valor)
  }
  props.push({ id: r.id, nombre: r.nombre, valor, errores, contexto: CAMPO === 'tiempo' ? `${r.tipo_coccion || '-'} | coc ${r.tiempo_coccion_min ?? '-'} min` : undefined })
  console.log(errores.length ? '✖' : '✔', r.nombre, errores.length ? '→ ' + errores.join('; ') : '')
}
fs.writeFileSync(FICHERO, JSON.stringify(props, null, 1))
console.log(`\nválidas: ${props.filter(p => !p.errores.length).length}/${props.length} → ${FICHERO} (nada escrito en la BD)`)
