// Auditoría profunda de las recetas que entran por el puente Content Radar → NutriCoach (url_origen http/https).
// Solo lectura. Mide foto, macros, ingredientes, raciones, pasos, nombre y duplicados, y resume los patrones de fallo.
// Uso: npx tsx scripts/auditar-recetas-puente.ts [--desde=AAAA-MM-DD] [--json]
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

for (const l of readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const desde = process.argv.find(a => a.startsWith('--desde='))?.split('=')[1]

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'en', 'y', 'o', 'al', 'un', 'una', 'para', 'tipo', 'estilo', 'fresco', 'fresca', 'natural'])
const sing = (w: string) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)
const tokens = (s: string) => (norm(s).replace(/\([^)]*\)/g, ' ').match(/[a-zñ]+/g)?.filter(w => w.length > 2 && !STOP.has(w)) ?? []).map(sing)
const CLASES = ['galleta', 'galletas', 'barrita', 'barritas', 'snack', 'tortitas', 'cocktail', 'bombon', 'helado', 'turron', 'caramelo', 'papilla', 'pizza', 'cracker', 'grissini', 'chocolate con leche']
const DEFECTO = new Set([80, 100, 60, 150, 200, 120])

type Fallo = { id: string; nombre: string; estado: string; detalle: string }
const fallos: Record<string, Fallo[]> = {}
const anota = (clave: string, r: { id: string; nombre: string; estado: string }, detalle = '') => { (fallos[clave] ??= []).push({ id: r.id, nombre: r.nombre, estado: r.estado, detalle }) }

async function main() {
  let q = db.from('recetas').select('id,nombre,estado,kcal,proteinas,carbohidratos,grasas,porciones,instrucciones,descripcion,imagen_url,imagen_tipo,tipo_plato,tipo_receta,categoria,tags,intolerancias,url_origen,created_at,fuente_tipo')
    .like('url_origen', 'http%').order('created_at', { ascending: false }).limit(1000)
  if (desde) q = q.gte('created_at', desde)
  const { data: recetas, error } = await q
  if (error) throw error
  const rs = (recetas ?? []).filter(r => r.estado !== 'descartada')
  const ids = rs.map(r => r.id)
  const ingPorReceta = new Map<string, any[]>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await db.from('receta_ingredientes').select('receta_id,nombre_libre,cantidad_gramos,cantidad_original,alimento_id,alimento:alimentos(nombre,calorias,es_comestible)').in('receta_id', ids.slice(i, i + 100))
    for (const x of data ?? []) (ingPorReceta.get(x.receta_id) ?? ingPorReceta.set(x.receta_id, []).get(x.receta_id)!).push(x)
  }
  const porUrl = new Map<string, number>(); const porNombre = new Map<string, number>()
  for (const r of rs) { porUrl.set(r.url_origen, (porUrl.get(r.url_origen) ?? 0) + 1); porNombre.set(norm(r.nombre), (porNombre.get(norm(r.nombre)) ?? 0) + 1) }

  for (const r of rs) {
    const ings = ingPorReceta.get(r.id) ?? []
    const kc = r.kcal ?? 0
    if (!r.imagen_url) anota('foto_ausente', r)
    if (r.imagen_url && r.imagen_tipo === 'txt2img') anota('foto_inventada_txt2img', r)
    if (r.kcal == null || kc <= 0) anota('macros_ausentes', r)
    if (kc > 0 && r.porciones === 1 && kc > 800) anota('racion_unica_calorica_>800', r, `${Math.round(kc)} kcal`)
    if (kc > 1100) anota('kcal_por_racion_>1100', r, `${Math.round(kc)} kcal/${r.porciones}`)
    if (kc > 0 && kc < 60) anota('kcal_por_racion_<60', r, `${Math.round(kc)} kcal`)
    if (ings.length === 0) anota('sin_ingredientes', r)
    else if (ings.length < 3) anota('menos_de_3_ingredientes', r, String(ings.length))
    const sinEnlace = ings.filter(i => !i.alimento_id)
    if (sinEnlace.length) anota('ingredientes_sin_enlazar', r, sinEnlace.map(i => i.nombre_libre).join(', '))
    const conTraza = ings.some(i => i.cantidad_original != null)
    const estimadas = ings.filter(i => i.cantidad_original == null)
    if (conTraza && estimadas.length / ings.length >= 0.6) anota('mayoria_cantidades_estimadas', r, `${estimadas.length}/${ings.length} estimadas`)
    const defecto = ings.filter(i => i.cantidad_original == null && DEFECTO.has(Number(i.cantidad_gramos)))
    if (!conTraza && ings.length >= 3 && defecto.length / ings.length >= 0.6) anota('cantidades_posiblemente_por_defecto', r, `${defecto.length}/${ings.length} (receta anterior a la trazabilidad)`)
    for (const i of ings) {
      const a = i.alimento
      if (!a) continue
      if (a.es_comestible === false) anota('alimento_no_comestible_enlazado', r, `${i.nombre_libre} → ${a.nombre}`)
      const ti = new Set(tokens(i.nombre_libre)); const ta = tokens(a.nombre)
      const comunes = ta.filter(t => ti.has(t)).length
      const cobertura = ti.size ? comunes / ti.size : 1
      const extra = CLASES.find(c => norm(a.nombre).includes(c) && !norm(i.nombre_libre).includes(c))
      if (cobertura < 0.5 || extra) anota('enlace_sospechoso', r, `${i.nombre_libre} → ${a.nombre}${extra ? ` (clase «${extra}»)` : ''}`)
      if (/^azucar\b/.test(norm(i.nombre_libre)) && Number(i.cantidad_gramos) === 80) anota('azucar_80g_por_defecto', r, `${i.nombre_libre} 80 g`)
      if (Number(i.cantidad_gramos) > 0 && Number(i.cantidad_gramos) < 0.5) anota('cantidad_irreal_<0.5g', r, `${i.nombre_libre} ${i.cantidad_gramos} g`)
      if (/^(sal|glutamato|pimienta)\b/.test(norm(i.nombre_libre)) && Number(i.cantidad_gramos) >= 20) anota('condimento_cantidad_absurda', r, `${i.nombre_libre} ${i.cantidad_gramos} g`)
    }
    const txt = (r.instrucciones ?? '').trim()
    const pasos = (txt.match(/(^|\n)\s*\d+[.)]/g) ?? []).length
    if (txt.length < 80) anota('sin_instrucciones', r, `${txt.length} car.`)
    else if (pasos < 3) anota('menos_de_3_pasos', r, `${pasos} pasos`)
    if (!r.tipo_plato) anota('sin_tipo_plato', r)
    if (r.estado !== 'descartada' && /^(salsa|mayonesa|aceite|marinado|chili)/.test(norm(r.nombre)) && r.tipo_receta === 'completa') anota('salsa_marcada_como_plato_completo', r)
    if (!r.categoria) anota('sin_categoria', r)
    if (!(r.tags ?? []).length) anota('sin_tags', r)
    if (/^(video by|#|receta sin t)/i.test(r.nombre) || /#\w+/.test(r.nombre) || /[\u{1F300}-\u{1FAFF}]/u.test(r.nombre) || (r.nombre === r.nombre.toUpperCase() && r.nombre.length > 12)) anota('nombre_sucio', r)
    if (r.nombre.length > 80) anota('nombre_demasiado_largo', r, String(r.nombre.length))
    if (porUrl.get(r.url_origen)! > 1) anota('url_origen_duplicada', r, r.url_origen)
    if (porNombre.get(norm(r.nombre))! > 1) anota('nombre_duplicado', r)
    if (!(r.intolerancias ?? []).length) anota('sin_intolerancias', r)
  }

  const resumen = Object.entries(fallos).map(([clave, lista]) => ({ clave, n: lista.length, pct: Math.round(100 * lista.length / rs.length) })).sort((a, b) => b.n - a.n)
  const perfectas = rs.filter(r => !Object.values(fallos).some(l => l.some(f => f.id === r.id && !['sin_tags', 'sin_intolerancias', 'sin_categoria'].includes(''))))
  const idsConFallo = new Set(Object.entries(fallos).filter(([k]) => !['sin_tags', 'sin_categoria', 'sin_intolerancias'].includes(k)).flatMap(([, l]) => l.map(f => f.id)))
  console.log(`Recetas del puente auditadas: ${rs.length} (desde ${desde ?? 'siempre'}) · sin ningún fallo grave: ${rs.length - idsConFallo.size} (${Math.round(100 * (rs.length - idsConFallo.size) / rs.length)} %)\n`)
  for (const x of resumen) console.log(`${String(x.n).padStart(4)}  ${String(x.pct).padStart(3)} %  ${x.clave}`)
  const salida = { generado: new Date().toISOString(), total: rs.length, sin_fallos_graves: rs.length - idsConFallo.size, resumen, fallos }
  mkdirSync(resolve(process.cwd(), 'salidas'), { recursive: true })
  const ruta = resolve(process.cwd(), 'salidas', '08-10-2026_auditoria-recetas-puente.json')
  writeFileSync(ruta, JSON.stringify(salida, null, 2)); console.log(`\nDetalle: ${ruta}`)
  void perfectas
}
main().catch(e => { console.error(e); process.exit(1) })
