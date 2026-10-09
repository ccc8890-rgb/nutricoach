/**
 * auditar-pasos-ingredientes.mjs — comprueba en TODAS las recetas que los pasos concuerdan con la lista de ingredientes.
 * Solo lectura. Informe: salidas/DD-MM-YYYY_pasos-vs-ingredientes.md
 *   A) ingrediente principal (>15 g) que no aparece en los pasos
 *   B) cantidad (g/ml) citada en los pasos que no existe en la lista (±10 %; el agua se ignora)
 *   C) ingrediente listado que los pasos nombran con otra palabra de alimento incompatible (solo informe)
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 %.,]/g,' ').replace(/\s+/g,' ').trim()
const STOP = new Set('de del la el en con sin para y o al los las un una natural light fresco fresca picado picada troceado rallado molido entero cocido crudo opcional polvo virgen extra'.split(' '))
const GENERICAS = new Set('hoja verde variada mezcla verdura vegetal fino integral blanco rojo negro dulce proteina vainilla sabor'.split(' '))
const claves = s => norm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w) && !GENERICAS.has(w)).map(w => w.replace(/(es|s)$/, ''))
const all = async (t, c, f) => { const o = []; for (let i = 0; ; i += 1000) { let q = sb.from(t).select(c).range(i, i + 999); if (f) q = f(q); const { data, error } = await q; if (error) throw error; o.push(...data); if (data.length < 1000) break } return o }
const R = await all('recetas', 'id,nombre,instrucciones,estado,porciones', q => q.neq('estado', 'descartada'))
const I = await all('receta_ingredientes', 'receta_id,nombre_libre,cantidad_gramos')
const por = new Map(); for (const i of I) (por.get(i.receta_id) ?? por.set(i.receta_id, []).get(i.receta_id)).push(i)
const hall = []
for (const r of R) {
  if (!r.instrucciones) continue
  const ings = por.get(r.id) || [], n = norm(r.instrucciones), e = []
  for (const i of ings) if (i.cantidad_gramos > 15) { const k = claves(i.nombre_libre); if (k.length && !k.some(w => n.includes(w))) e.push(`A: no aparece «${i.nombre_libre}» (${i.cantidad_gramos} g)`) }
  const perm = ings.map(i => i.cantidad_gramos).filter(Boolean)
  for (const m of r.instrucciones.matchAll(/(\d+(?:[.,]\d+)?)\s?(g|gr|gramos|ml)\b/gi)) {
    const v = parseFloat(m[1].replace(',', '.')); const ctx = r.instrucciones.slice(Math.max(0, m.index - 30), m.index + m[0].length)
    if (/agua[^.]{0,25}$/i.test(ctx)) continue
    const total = perm.reduce((a, b) => a + b, 0)
    if (!perm.some(p => Math.abs(p - v) <= Math.max(2, p * 0.1)) && !perm.some(p => Math.abs(p / (r.porciones || 1) - v) <= Math.max(2, v * 0.1)) && Math.abs(total - v) > 5) e.push(`B: cita ${m[0]} que no está en la lista`)
  }
  // F) producto elaborado en la lista que ni el título ni los pasos de la receta mencionan (p. ej. «Bombón almendrado» por «almendras»)
  const ELAB = ['bombon','galleta','bizcocho','brownie','natilla','barrita','magdalena','cereal','helado','bollo','donut','croqueta','hojaldre','napolitana','turron','caramelo','flan','mousse','pizza','snack','pastel','tarta','cono','trenza','sandwich']
  const base = norm(r.nombre + ' ' + r.instrucciones)
  for (const i of ings) { const ni = norm(i.nombre_libre); for (const w of ELAB) if (new RegExp('(^| )' + w).test(ni) && !base.includes(w)) { e.push(`F: «${i.nombre_libre}» (${i.cantidad_gramos} g) parece un producto elaborado que la receta no menciona`); break } }
  if (e.length) hall.push({ id: r.id, nombre: r.nombre, estado: r.estado, e })
}
const cnt = { A: 0, B: 0, F: 0 }; for (const h of hall) for (const x of h.e) cnt[x[0]]++
console.log('recetas con instrucciones:', R.filter(r => r.instrucciones).length, '| con algún hallazgo:', hall.length, cnt)
const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
fs.writeFileSync(`salidas/${fecha}_pasos-vs-ingredientes.md`, '# Pasos que no concuerdan con los ingredientes\n\n' + hall.map(h => `- **${h.nombre}** (${h.estado}): ${h.e.join('; ')}`).join('\n'))
fs.writeFileSync('salidas/pasos-vs-ingredientes.json', JSON.stringify(hall, null, 1))
for (const h of hall.slice(0, 25)) console.log('-', h.nombre.slice(0, 44).padEnd(45), h.e.slice(0, 2).join(' | ').slice(0, 120))
