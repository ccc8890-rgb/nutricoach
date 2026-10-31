/**
 * organizar-fases-recetas.mjs — agrupa en FASES (bizcocho, salsa, topping…) los ingredientes y pasos de las recetas
 * que tienen varias piezas. SUPERVISADO: la IA solo decide la agrupación; los textos no se reescriben.
 *   node scripts/organizar-fases-recetas.mjs --limite=10            # propone y valida, NO escribe en la BD
 *   node scripts/organizar-fases-recetas.mjs --aplica --solo-validas # escribe las que pasaron (copia en salidas/)
 *   node scripts/organizar-fases-recetas.mjs --auto --limite=15     # propone y aplica solo las válidas (lo usa la pasada autónoma; recuerda lo ya decidido)
 * Requiere la migración 20261019100000 (columna receta_ingredientes.grupo). NO forma parte de la pasada autónoma.
 * Validación: cada ingrediente en exactamente una fase; el texto de los pasos queda idéntico (solo se insertan líneas «## Fase»).
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const arg = (n, d) => (process.argv.find(a => a.startsWith('--' + n + '='))?.split('=')[1]) ?? d
const LIMITE = Number(arg('limite', 10)), APLICA = process.argv.includes('--aplica'), SOLO_VALIDAS = process.argv.includes('--solo-validas')
const AUTO = process.argv.includes('--auto')
const TODAS = true // sin exigir palabras clave en los pasos: la IA decide si hay varias piezas (las de una sola se anotan y no se repiten)
const FICHERO = 'salidas/propuestas-fases.json'
// Lo ya decidido (una sola pieza / aplicada / intentos fallidos) para no gastar IA otra vez con la misma receta
const DECIDIDAS = 'salidas/fases-decididas.json'
const decididas = fs.existsSync(DECIDIDAS) ? JSON.parse(fs.readFileSync(DECIDIDAS, 'utf8')) : {}
const guardarDecididas = () => fs.writeFileSync(DECIDIDAS, JSON.stringify(decididas))
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const SENAL = /\b(para (el|la|los|las) (bizcocho|base|masa|salsa|crema|relleno|cobertura|glaseado|topping|toppings|aliño|marinada|frosting|ganache|mousse|bols?)|bizcocho|ganache|frosting|glaseado|topping|cobertura|relleno|marinad|aliño|aderezo|salsa)\b/

async function deepseek(prompt) {
  for (let intento = 0; intento < 2; intento++) {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.DEEPSEEK_API_KEY },
      body: JSON.stringify({ model: env.DEEPSEEK_MODEL || 'deepseek-chat', temperature: 0.1, max_tokens: 2500, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Eres un cocinero español. Respondes SOLO con JSON válido.' }, { role: 'user', content: prompt }] }) })
    if (!r.ok) continue
    try { return JSON.parse((await r.json()).choices?.[0]?.message?.content || '') } catch { /* reintenta */ }
  }
  return null
}

const all = async (t, c, f) => { const o = []; for (let i = 0; ; i += 1000) { let q = sb.from(t).select(c).range(i, i + 999); if (f) q = f(q); const { data, error } = await q; if (error) throw error; o.push(...data); if (data.length < 1000) break } return o }
const sinCabeceras = t => t.split('\n').filter(l => !/^\s*#{2,3}\s/.test(l)).map(l => l.trim()).filter(Boolean).join('\n')

async function aplicar(p, copia) {
  const { data: r } = await sb.from('recetas').select('id, instrucciones').eq('id', p.id).single()
  if (!r || sinCabeceras(r.instrucciones || '') !== sinCabeceras(p.instrucciones_original)) { console.log('SALTADA (la receta cambió):', p.nombre); return false }
  copia.push({ id: p.id, instrucciones: r.instrucciones, grupos: p.grupos_antes })
  for (const [id, grupo] of Object.entries(p.grupo_por_ingrediente)) await sb.from('receta_ingredientes').update({ grupo }).eq('id', id)
  await sb.from('recetas').update({ instrucciones: p.instrucciones_con_fases }).eq('id', p.id)
  console.log('aplicada:', p.nombre, '→', p.fases.join(' / '))
  return true
}
const guardarCopia = copia => { if (copia.length) fs.writeFileSync(`salidas/copia-fases-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify(copia, null, 1)) }

if (APLICA) {
  const props = JSON.parse(fs.readFileSync(FICHERO, 'utf8')).filter(p => p.fases && (!SOLO_VALIDAS || p.errores.length === 0))
  const copia = []
  for (const p of props) await aplicar(p, copia)
  guardarCopia(copia)
  process.exit(0)
}

const recetas = await all('recetas', 'id, nombre, categoria, instrucciones', q => q.in('estado', ['aprobada', 'en_revision'])) // también las fichas en revisión: así se revisan ya con sus fases
const ings = await all('receta_ingredientes', 'id, receta_id, nombre_libre, cantidad_gramos, orden, grupo, alimento:alimentos(nombre)')
const porReceta = new Map()
for (const i of ings) { if (!porReceta.has(i.receta_id)) porReceta.set(i.receta_id, []); porReceta.get(i.receta_id).push(i) }

// Candidatas: sin fases ya puestas, con bastantes ingredientes y señales de varias piezas en el texto
const candidatas = recetas.filter(r => {
  const li = porReceta.get(r.id) ?? []
  if (li.length < 5 || li.some(i => i.grupo)) return false
  if (decididas[r.id] === 'una_pieza' || decididas[r.id] === 'aplicada' || (decididas[r.id] ?? 0) >= 2) return false
  const txt = norm(r.instrucciones)
  return (TODAS || SENAL.test(txt)) && !/^\s*#{2,3}\s/m.test(r.instrucciones || '')
}).sort((a, b) => (porReceta.get(b.id).length - porReceta.get(a.id).length))
console.log(`${candidatas.length} candidatas de ${recetas.length}; se procesan ${Math.min(LIMITE, candidatas.length)}`)

const salida = []
for (const r of candidatas.slice(0, LIMITE)) {
  const li = (porReceta.get(r.id)).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  const lista = li.map((i, n) => `${n + 1}. ${i.nombre_libre || i.alimento?.nombre} (${Math.round(i.cantidad_gramos)} g)`).join('\n')
  const out = await deepseek(`Receta: ${r.nombre}
Ingredientes:
${lista}

Pasos:
${r.instrucciones}

Decide si la receta tiene 2 o más PIEZAS que se preparan por separado (p. ej. bizcocho + crema + topping; base + salsa; masa + relleno). Si es una sola preparación, o la división sería forzada, responde {"fases": null}.
Si hay piezas, responde {"fases": [{"nombre": "Bizcocho", "ingredientes": [números de la lista]}], "pasos_por_fase": [{"nombre": "Bizcocho", "desde_paso": 1}]}.
Reglas: nombres cortos (1-3 palabras, sin «Para el»), cada ingrediente en UNA sola fase, "pasos_por_fase" en el orden en que aparecen en los pasos y "desde_paso" es el número del primer paso de esa fase (el primero debe ser 1). Los ingredientes comunes de decorar/servir van a una fase "Montaje" o "Topping". No cambies ningún texto.`)
  const errores = []
  let p = { id: r.id, nombre: r.nombre, fases: null, errores }
  if (!out) errores.push('sin respuesta de la IA')
  else if (out.fases) {
    const fases = out.fases, grupo_por_ingrediente = {}, vistos = new Set()
    if (fases.length < 2 || fases.length > 5) errores.push(`nº de fases ${fases.length}`)
    for (const f of fases) {
      if (!f.nombre || f.nombre.length > 28) errores.push(`nombre de fase raro: ${f.nombre}`)
      for (const n of f.ingredientes ?? []) {
        const ing = li[n - 1]
        if (!ing) { errores.push(`ingrediente inexistente: ${n}`); continue }
        // Un ingrediente compartido (sal, aceite) se queda en la primera fase que lo cita
        if (vistos.has(n)) continue
        vistos.add(n); grupo_por_ingrediente[ing.id] = f.nombre
      }
    }
    if (vistos.size !== li.length) errores.push(`faltan ${li.length - vistos.size} ingredientes por asignar`)
    // Pasos: se insertan líneas «## Fase» sin tocar el texto
    const lineas = (r.instrucciones || '').split('\n'), pasosIdx = []
    lineas.forEach((l, i) => { if (/^\s*(?:Paso\s*)?\d+[.)\-:]/.test(l)) pasosIdx.push(i) })
    const marcas = (out.pasos_por_fase ?? []).map(x => ({ nombre: x.nombre, desde: Number(x.desde_paso) }))
    if (pasosIdx.length < 2) errores.push('los pasos no están numerados')
    if (!marcas.length || marcas[0].desde !== 1) errores.push('los pasos no empiezan en la primera fase')
    if (marcas.some((m, i) => !fases.some(f => f.nombre === m.nombre) || m.desde > pasosIdx.length || (i && m.desde <= marcas[i - 1].desde))) errores.push('pasos por fase incoherentes')
    let conFases = r.instrucciones
    if (!errores.length) {
      const nuevas = [...lineas]
      for (const m of [...marcas].reverse()) nuevas.splice(pasosIdx[m.desde - 1], 0, `## ${m.nombre}`)
      conFases = nuevas.join('\n')
      if (sinCabeceras(conFases) !== sinCabeceras(r.instrucciones)) errores.push('el texto de los pasos cambió')
    }
    p = { ...p, fases: fases.map(f => f.nombre), grupo_por_ingrediente, grupos_antes: li.map(i => ({ id: i.id, grupo: i.grupo ?? null })), instrucciones_original: r.instrucciones, instrucciones_con_fases: conFases, resumen: fases.map(f => `${f.nombre}: ${(f.ingredientes ?? []).map(n => li[n - 1]?.nombre_libre).join(', ')}`) }
  }
  salida.push(p)
  if (AUTO) {
    if (!p.fases && out) decididas[r.id] = 'una_pieza'
    else if (p.fases && !errores.length) { const copia = []; if (await aplicar(p, copia)) decididas[r.id] = 'aplicada'; guardarCopia(copia) }
    else decididas[r.id] = (typeof decididas[r.id] === 'number' ? decididas[r.id] : 0) + 1
    guardarDecididas()
  }
  console.log(`${p.fases ? (errores.length ? '✗' : '✓') : '·'} ${r.nombre}${p.fases ? ' → ' + p.fases.join(' / ') : ' (una sola pieza)'}${errores.length ? '  ' + errores.join('; ') : ''}`)
}
fs.writeFileSync(FICHERO, JSON.stringify(salida, null, 1))
console.log(`\nPropuestas en ${FICHERO}: ${salida.filter(p => p.fases && !p.errores.length).length} válidas, ${salida.filter(p => p.fases && p.errores.length).length} con errores, ${salida.filter(p => !p.fases).length} de una sola pieza.`)
