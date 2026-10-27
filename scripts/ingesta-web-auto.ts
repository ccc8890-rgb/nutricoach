// Ingesta automática de recetas desde webs (JSON-LD): traduce, pasa a gramos con IA, vincula cada ingrediente a un alimento exacto
// con las reglas de calidad del recetario y escribe un lote para `importar-lote-verificado.ts` (que contrasta la kcal con la web).
//   npx tsx scripts/ingesta-web-auto.ts <urls.txt|url…> [--lote=nombre] [--max=N] [--kcal=100-650] [--prot=8]
// Solo escribe scripts/lotes/<fecha>_<lote>.json y salidas/ingesta/<fecha>_<lote>_rechazadas.json. Después:
//   npx tsx scripts/importar-lote-verificado.ts scripts/lotes/<fichero> [--apply --coach-email ccc8890@gmail.com]
// La IA solo traduce y estima gramos; la kcal de la web es el contraste final y los ingredientes sin vínculo fiable rechazan la receta.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3)
const entradas = process.argv.slice(2).filter(a => !a.startsWith('--'))
const urls = entradas.flatMap(a => fs.existsSync(a) ? fs.readFileSync(a, 'utf8').split('\n').map(s => s.trim()).filter(s => s.startsWith('http')) : [a])
const MAX = Number(arg('max')) || 999
const [KCAL_MIN, KCAL_MAX] = (arg('kcal') ?? '100-650').split('-').map(Number)
const PROT_MIN = Number(arg('prot') ?? 8)
const hoy = new Date().toISOString().slice(0, 10)
const nombreLote = arg('lote') ?? 'web-auto'

const flat = (n: any): any[] => Array.isArray(n) ? n.flatMap(flat) : n && n['@graph'] ? flat(n['@graph']) : [n]
const iso = (s: any) => { const m = String(s || '').match(/P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/); return m ? (+m[1] || 0) * 60 + (+m[2] || 0) : null }
const num = (v: any) => v == null ? null : parseFloat(String(v).replace(',', '.'))
const pasos = (ri: any): string[] => (Array.isArray(ri) ? ri : [ri]).filter(Boolean).flatMap((x: any) => x.itemListElement ? pasos(x.itemListElement) : typeof x === 'string' ? [x] : [x.text || x.name]).filter(Boolean)

async function leerWeb(url: string) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'es,en' }, signal: AbortSignal.timeout(25000) })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const html = await r.text()
  const bloques = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => { try { return JSON.parse(m[1].trim()) } catch { return null } }).filter(Boolean)
  const rec = bloques.flatMap(flat).find((n: any) => n && [].concat(n['@type'] || []).includes('Recipe'))
  if (!rec) throw new Error('sin JSON-LD Recipe')
  const n = rec.nutrition || {}
  return {
    url, nombre: String(rec.name), autor: rec.author?.name || (Array.isArray(rec.author) ? rec.author[0]?.name : null) || null,
    porciones: rec.recipeYield ? [].concat(rec.recipeYield).map(String).join(' / ') : null,
    total_min: iso(rec.totalTime), ingredientes: ([] as string[]).concat(rec.recipeIngredient || []), pasos: pasos(rec.recipeInstructions),
    kcal: num(n.calories), proteina: num(n.proteinContent),
  }
}

const SISTEMA = `Eres dietista en España. Conviertes una receta web a una ficha en castellano de España para una app de nutrición.
Devuelve SOLO un JSON: {"nombre","descripcion","tipo_plato","porciones","tiempo_prep_min","ingredientes":[{"busqueda","gramos","rol","origen","alergenos"}],"instrucciones","consejos"}.
- nombre: título corto en castellano, sin marcas ni nombres de autor. descripcion: 1-2 frases. tipo_plato: Desayuno | Comida | Cena | Merienda | Snack.
- porciones: número entero de raciones de la receta tal como está escrita.
- ingredientes: TODOS los que aportan comida, con "gramos" TOTALES de la receta entera (convierte tazas, cucharadas, onzas, libras: 1 taza harina≈125 g, 1 cda aceite≈14 g, 1 oz=28 g, 1 lb=454 g, 1 taza líquido≈240 ml). Un huevo≈50 g, un diente de ajo≈4 g. "busqueda" = nombre GENÉRICO del alimento en castellano de 1-3 palabras, sin marcas ni preparación (ej. "pechuga de pollo", "aceite de oliva", "queso feta", "yogur griego natural"). Ignora agua, hielo, papel de aluminio, spray antiadherente y adornos sin cantidad; sal y pimienta solo si hay cantidad (si no, 1 g de sal).
- rol (uno de): carbohidrato_base, proteina_principal, grasa_saludable, verdura_volumen, fruta_complemento, lacteo_complemento, salsa_condimento, especias_aromaticos.
- origen (uno de): vegetal, huevo, lacteo, miel, carne, cerdo, pescado, marisco. alergenos: lista de entre Gluten, Lácteos, Huevos, Pescado, Crustáceos, Moluscos, Soja, Frutos Secos, Cacahuetes, Sésamo (vacía si ninguno).
- instrucciones: pasos numerados "1. …\\n2. …" en castellano, temperaturas en °C, cantidades en g/ml o en unidades. Sin enlaces ni marcas. consejos: 1 frase útil o "".
No inventes ingredientes ni pasos que no estén en la receta.`

type Cand = { id: string; nombre: string; calorias: number; fuente: string | null }
const FIABLE = ['bedca', 'coach', 'curada']

async function main() {
  const { llamarIA } = await import('../lib/ia/enrutador')
  const { calidadVinculo, raicesBusqueda, aliasAlimento, limpiarNombreIngrediente } = await import('../lib/recetas/reconstruccion-segura')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const cache = new Map<string, Cand | null>()
  const lista = new Map<string, Cand[]>()
  async function resolver(busqueda: string): Promise<Cand | null> {
    const k = busqueda.toLowerCase().trim()
    if (cache.has(k)) return cache.get(k)!
    const limpio = limpiarNombreIngrediente(busqueda)
    const alias = aliasAlimento(limpio)
    let cands: Cand[] = []
    if (alias) { const { data } = await db.from('alimentos').select('id,nombre,calorias,fuente').eq('nombre', alias).eq('es_comestible', true); cands = (data ?? []) as Cand[] }
    if (!cands.length) {
      const { data: exacto } = await db.from('alimentos').select('id,nombre,calorias,fuente').eq('es_comestible', true).ilike('nombre', limpio.replace(/[%_]/g, ''))
      cands = ((exacto ?? []) as Cand[]).filter(a => a.calorias > 0 || /^(sal|agua)$/i.test(a.nombre))
    }
    if (!cands.length) {
      const vistos = new Map<string, Cand>()
      for (const raiz of raicesBusqueda(limpio)) {
        const { data } = await db.from('alimentos').select('id,nombre,calorias,fuente').eq('es_comestible', true).ilike('nombre_busqueda', `%${raiz}%`).limit(80)
        for (const a of (data ?? []) as Cand[]) vistos.set(a.id, a)
      }
      cands = [...vistos.values()]
    }
    const rango = { exacta: 3, buena: 2, dudosa: 1, sin: 0 } as const
    const buenos = cands
      .filter(a => a.nombre.length < 60 && (a.calorias > 0 || /agua/i.test(a.nombre)))
      .map(a => ({ a, c: alias ? 'exacta' as const : calidadVinculo(limpio, a.nombre) }))
      .filter(x => x.c === 'exacta' || x.c === 'buena')
      .sort((x, y) => (rango[y.c] - rango[x.c]) || (Number(FIABLE.includes(y.a.fuente ?? '')) - Number(FIABLE.includes(x.a.fuente ?? ''))) || (x.a.nombre.length - y.a.nombre.length))
    const r = buenos[0]?.a ?? null
    const toks = limpio.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(t => t.length > 2)
    const puntua = (a: Cand) => toks.filter(t => a.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(t)).length * 10 + (FIABLE.includes(a.fuente ?? '') ? 3 : 0) - a.nombre.length / 20
    lista.set(k, cands.filter(a => a.nombre.length < 60 && a.calorias > 0).sort((x, y) => puntua(y) - puntua(x)).slice(0, 10))
    cache.set(k, r)
    return r
  }

  // Segunda opinión: para lo que las reglas no vinculan, la IA elige entre candidatos REALES del catálogo (o ninguno)
  async function elegirConIA(pendientes: string[]): Promise<Record<string, Cand | null>> {
    const out: Record<string, Cand | null> = {}
    const items = pendientes.map(b => ({ b, ops: lista.get(b.toLowerCase().trim()) ?? [] })).filter(x => x.ops.length)
    for (const p of pendientes) out[p] = null
    if (!items.length) return out
    const usuario = items.map((x, n) => `${n + 1}. «${x.b}»\n` + x.ops.map((o, i) => `   ${i}: ${o.nombre} (${o.calorias} kcal/100 g)`).join('\n')).join('\n')
    const ia = await llamarIA('texto_barato', { sistema: 'Eliges el alimento de un catálogo que corresponde a un ingrediente de receta. Elige solo si es el mismo alimento o una variante genérica equivalente (misma especie y forma culinaria; p. ej. «limón» → un zumo de limón sirve; «leche» → leche semidesnatada o entera sirve). Si ningún candidato es equivalente (otro producto, sabor, plato preparado, otra especie) responde -1. Devuelve SOLO JSON {"1": índice, "2": índice…} con la numeración de los ingredientes.', usuario, json: true, maxTokens: 800 })
    tokens += (ia.usoTotal?.entrada ?? 0) + (ia.usoTotal?.salida ?? 0)
    const r = JSON.parse(ia.texto)
    items.forEach((x, n) => { const i = Number(r[String(n + 1)]); out[x.b] = Number.isInteger(i) && i >= 0 && i < x.ops.length ? x.ops[i] : null })
    return out
  }

  const lote: any = { lote: `${nombreLote}-${hoy}`, tipo_plato: 'Comida', tipo_receta: 'completa', fuente: 'lote_verificado', alimentos: {}, recetas: [] }
  const rechazadas: { url: string; motivo: string }[] = []
  let procesadas = 0, tokens = 0

  for (const url of urls) {
    if (lote.recetas.length >= MAX) break
    try {
      const { count } = await db.from('recetas').select('id', { count: 'exact', head: true }).eq('url_origen', url)
      if (count) { rechazadas.push({ url, motivo: 'ya existe' }); continue }
      const w = await leerWeb(url)
      if (w.kcal == null) throw new Error('sin nutrición en la web')
      if (w.kcal < KCAL_MIN || w.kcal > KCAL_MAX) throw new Error(`kcal web ${w.kcal} fuera de ${KCAL_MIN}-${KCAL_MAX}`)
      if (w.proteina != null && w.proteina < PROT_MIN) throw new Error(`proteína web ${w.proteina} g < ${PROT_MIN}`)
      procesadas++

      const usuario = `RECETA WEB (${w.url})\nNombre: ${w.nombre}\nRaciones: ${w.porciones}\nTiempo total: ${w.total_min ?? '?'} min\nIngredientes:\n${w.ingredientes.map(i => '- ' + i).join('\n')}\nPasos:\n${w.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      const ia = await llamarIA('texto_barato', { sistema: SISTEMA, usuario, json: true, maxTokens: 4000 })
      tokens += (ia.usoTotal?.entrada ?? 0) + (ia.usoTotal?.salida ?? 0)
      const f = JSON.parse(ia.texto)
      if (!Array.isArray(f.ingredientes) || f.ingredientes.length < 3 || !f.instrucciones) throw new Error('la IA no devolvió una ficha válida')

      const ingredientes: [string, number][] = []
      const claves: Record<string, any> = {}
      const faltan: string[] = []
      const resueltos: { i: any; al: Cand | null }[] = []
      for (const i of f.ingredientes) {
        const g = Number(i.gramos)
        if (!(g > 0)) continue
        resueltos.push({ i, al: await resolver(String(i.busqueda)) })
      }
      const sin = [...new Set(resueltos.filter(x => !x.al && x.i.gramos > 2).map(x => String(x.i.busqueda)))]
      if (sin.length) { const elegidos = await elegirConIA(sin); for (const x of resueltos) if (!x.al && elegidos[String(x.i.busqueda)]) { x.al = elegidos[String(x.i.busqueda)]; cache.set(String(x.i.busqueda).toLowerCase().trim(), x.al) } }
      for (const { i, al } of resueltos) {
        const g = Number(i.gramos)
        if (!al) { if (g > 4 && !/^(sal|pimienta)\b/i.test(String(i.busqueda))) faltan.push(`${i.busqueda} (${g} g)`); continue } // una pizca de especia sin alimento se omite; lo demás rechaza
        const clave = al.id.slice(0, 8)
        claves[clave] = { nombre: al.nombre, prefijo: al.id.slice(0, 8), rol: i.rol, alergenos: i.alergenos ?? [], origen: i.origen }
        const ya = ingredientes.find(x => x[0] === clave)
        if (ya) ya[1] += g; else ingredientes.push([clave, Math.round(g * 10) / 10])
      }
      if (faltan.length) throw new Error('sin alimento fiable: ' + faltan.join(', '))
      if (ingredientes.length < 3) throw new Error('menos de 3 ingredientes vinculados')

      Object.assign(lote.alimentos, claves)
      lote.recetas.push({
        nombre: String(f.nombre).slice(0, 120), descripcion: String(f.descripcion ?? ''), tiempo_prep_min: Number(f.tiempo_prep_min) || w.total_min || 30,
        porciones: Math.max(1, Math.round(Number(f.porciones) || 1)), tipo_plato: ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack'].includes(f.tipo_plato) ? f.tipo_plato : 'Comida', tipo_receta: 'completa',
        ingredientes, instrucciones: String(f.instrucciones), consejos: String(f.consejos ?? ''),
        origen_web: { url: w.url, autor: w.autor, kcal_web: w.kcal },
      })
      console.log('✓', f.nombre, `(${w.kcal} kcal web, ${ingredientes.length} ing)`)
    } catch (e: any) {
      rechazadas.push({ url, motivo: String(e.message ?? e) })
      console.log('✗', url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 70), '→', String(e.message ?? e).slice(0, 110))
    }
  }

  if (lote.recetas.length) {
    const f = `scripts/lotes/${hoy}_${nombreLote}.json`
    fs.writeFileSync(f, JSON.stringify(lote, null, 2))
    console.log(`\nLote: ${f} · ${lote.recetas.length} recetas`)
  }
  fs.mkdirSync('salidas/ingesta', { recursive: true })
  fs.writeFileSync(`salidas/ingesta/${hoy}_${nombreLote}_rechazadas.json`, JSON.stringify(rechazadas, null, 1))
  console.log(`Leídas con IA: ${procesadas} · rechazadas: ${rechazadas.length} · tokens ≈ ${tokens.toLocaleString('es-ES')}`)
}
main().catch(e => { console.error(e); process.exit(1) })
