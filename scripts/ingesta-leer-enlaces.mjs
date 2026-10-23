// Lee recetas de enlaces web (schema.org Recipe en JSON-LD) y las vuelca normalizadas.
// Uso: node scripts/ingesta-leer-enlaces.mjs <url|archivo.txt con una url por linea> [...]  -> salidas/ingesta/<fecha>_fuentes.json
import fs from 'fs'
const args = process.argv.slice(2)
const urls = args.flatMap(a => fs.existsSync(a) ? fs.readFileSync(a,'utf8').split('\n').map(s=>s.trim()).filter(s=>s.startsWith('http')) : [a])
const iso = s => { const m = String(s||'').match(/P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/); return m ? (+m[1]||0)*60+(+m[2]||0) : null }
const flat = n => Array.isArray(n) ? n.flatMap(flat) : n && n['@graph'] ? flat(n['@graph']) : [n]
const pasos = ri => (Array.isArray(ri)?ri:[ri]).filter(Boolean).flatMap(x => x.itemListElement ? pasos(x.itemListElement) : typeof x==='string' ? [x] : [x.text||x.name]).filter(Boolean)
const out = []
for (const url of urls) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'es,en' }, signal: AbortSignal.timeout(25000) })
    if (!r.ok) { out.push({ url, error: 'HTTP '+r.status }); continue }
    const html = await r.text()
    const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>{try{return JSON.parse(m[1].trim())}catch{return null}}).filter(Boolean)
    const rec = blocks.flatMap(flat).find(n => n && [].concat(n['@type']||[]).includes('Recipe'))
    if (!rec) { out.push({ url, error: 'sin JSON-LD Recipe' }); continue }
    const n = rec.nutrition || {}
    const num = v => v==null?null:parseFloat(String(v).replace(',','.'))
    out.push({ url, nombre: rec.name, autor: rec.author?.name || (Array.isArray(rec.author)?rec.author[0]?.name:null) || null,
      descripcion: rec.description||null, porciones: rec.recipeYield ? [].concat(rec.recipeYield).map(String).join(' / ') : null,
      prep_min: iso(rec.prepTime), coccion_min: iso(rec.cookTime), total_min: iso(rec.totalTime),
      ingredientes: [].concat(rec.recipeIngredient||[]), pasos: pasos(rec.recipeInstructions),
      nutricion_web: { kcal: num(n.calories), proteina: num(n.proteinContent), carbos: num(n.carbohydrateContent), grasa: num(n.fatContent), fibra: num(n.fiberContent), porcion: n.servingSize||null },
      imagen_web: [].concat(rec.image||[]).map(i=>i.url||i)[0]||null, keywords: rec.keywords||null })
  } catch (e) { out.push({ url, error: String(e.message||e) }) }
}
const f = `salidas/ingesta/${new Date().toISOString().slice(0,10)}_fuentes.json`
fs.writeFileSync(f, JSON.stringify(out, null, 1))
for (const o of out) console.log(o.error ? `✗ ${o.url} (${o.error})` : `✓ ${o.nombre} | ${o.ingredientes.length} ing | ${o.pasos.length} pasos | web kcal ${o.nutricion_web.kcal ?? '—'} | ${o.autor ?? ''}`)
console.log('->', f)
