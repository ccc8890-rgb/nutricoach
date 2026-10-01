// Solo lectura: mide cuántas recetas distintas ve el motor por franja para un cliente y dónde se pierde variedad.
// Uso: npx tsx scripts/medir-variedad-franja.ts [cliente_id_prefijo]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

// Copia de las constantes de lib/plan-recetas.ts (no exportadas)
const SLOT_CATEGORIAS: Record<string, string[]> = {
  'Desayuno': ['Desayuno', 'Gofres', 'Bowls fruta'],
  'Media mañana': ['Snack', 'Merienda', 'Postres'],
  'Comida': ['Comida', 'Platos variados', 'Carnes', 'Pescados', 'Bowls', 'Ensaladas', 'Burritos', 'Fajitas/Tacos', 'Entrante'],
  'Merienda': ['Merienda', 'Snack', 'Desayuno', 'Postres'],
  'Cena': ['Cena', 'Comida', 'Platos variados', 'Carnes', 'Pescados', 'Ensaladas'],
}
const SLOT_TIPOS: Record<string, string[]> = {
  'Desayuno': ['desayuno', 'completa'], 'Media mañana': ['snack_postre', 'desayuno', 'guarnicion'],
  'Comida': ['completa'], 'Merienda': ['snack_postre', 'desayuno'], 'Cena': ['completa', 'guarnicion'],
}
const ALERGENO: Record<string, string[]> = {
  'sin gluten': ['Gluten'], 'sin lactosa': ['Lácteos'], 'sin huevo': ['Huevos'], 'sin frutos secos': ['Frutos Secos', 'Cacahuetes'],
  'sin soja': ['Soja'], 'sin mariscos': ['Crustáceos', 'Moluscos'], 'vegetariano': ['Pescado', 'Crustáceos', 'Moluscos'],
  'vegano': ['Lácteos', 'Huevos', 'Pescado', 'Crustáceos', 'Moluscos'],
}

type R = {
  id: string; nombre: string; kcal: number; proteinas: number; carbohidratos: number; grasas: number; categoria: string
  tipo_receta: string | null; intolerancias: string[] | null; verificacion: string | null; score_calidad: number | null
  apto_rendimiento: boolean | null; tiempo_prep_min: number | null
  receta_ingredientes: { nombre_libre: string | null; alimento: { nombre: string | null } | null }[]
}

async function main() {
  const prefijo = process.argv[2] ?? '04cc53b3'
  const { data: cls } = await db.from('clientes').select('id, restricciones_alimentarias, profile:profiles!profile_id(nombre)')
  const cliente = (cls ?? []).find(c => c.id.startsWith(prefijo))
  if (!cliente) throw new Error(`Cliente ${prefijo} no encontrado`)
  const clienteId = cliente.id
  const [{ data: plan }, { data: onb }, { data: perfil }] = await Promise.all([
    db.from('planes_nutricion').select('id, nombre, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo').eq('cliente_id', clienteId).eq('activo', true).maybeSingle(),
    db.from('onboarding_responses').select('*').eq('cliente_id', clienteId).maybeSingle(),
    db.from('perfil_entreno_cliente').select('sport_modality').eq('cliente_id', clienteId).maybeSingle(),
  ])
  const restricciones: string[] = [...new Set([...(onb?.restricciones ?? []), ...((cliente.restricciones_alimentarias as string[] | null) ?? [])])]
  const evitarRaw = (onb as Record<string, unknown> | null)?.alimentos_no_gustan
  const evitar: string[] = Array.isArray(evitarRaw) ? evitarRaw as string[] : typeof evitarRaw === 'string' ? evitarRaw.split(',').map(s => s.trim()).filter(Boolean) : []
  const tiempoMax: number | null = onb?.tiempo_cocina_min ?? null
  const esAtleta = onb?.objetivo === 'rendimiento' || (onb?.dias_entreno ?? 0) >= 4
  console.log(`Cliente ${(cliente as any).profile?.nombre ?? clienteId} · plan "${plan?.nombre}" ${plan?.kcal_objetivo} kcal P${plan?.proteinas_objetivo} C${plan?.carbohidratos_objetivo} G${plan?.grasas_objetivo}`)
  console.log(`Objetivo: ${onb?.objetivo} · deporte: ${perfil?.sport_modality} · restricciones: [${restricciones.join(', ')}] · evitar: [${evitar.join(', ')}] · tiempo máx: ${tiempoMax ?? '—'} · atleta(rendimiento): ${esAtleta}\n`)

  const { data: inter } = await db.from('receta_interacciones_cliente').select('receta_id, tipo, created_at').eq('cliente_id', clienteId)
  const hace14 = Date.now() - 14 * 864e5
  const recientes = new Set((inter ?? []).filter(i => i.tipo === 'asignada_plan' && new Date(i.created_at).getTime() >= hace14).map(i => i.receta_id))
  const dislikes = new Set((inter ?? []).filter(i => i.tipo === 'dislike').map(i => i.receta_id))
  console.log(`Interacciones: ${(inter ?? []).length} · asignadas últimos 14 d: ${recientes.size} · dislikes: ${dislikes.size}\n`)

  // Proporción objetivo de macros del plan (las cantidades se reescalan, importa la proporción)
  const kObj = plan?.kcal_objetivo ?? 0
  const objP = kObj ? ((plan?.proteinas_objetivo ?? 0) * 4) / kObj : 0, objC = kObj ? ((plan?.carbohidratos_objetivo ?? 0) * 4) / kObj : 0, objG = kObj ? ((plan?.grasas_objetivo ?? 0) * 9) / kObj : 0
  const encaje = (r: R) => !r.kcal ? 9 : 2 * Math.abs((r.proteinas * 4) / r.kcal - objP) + Math.abs((r.carbohidratos * 4) / r.kcal - objC) + Math.abs((r.grasas * 9) / r.kcal - objG)

  const todas: R[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from('recetas')
      .select('id, nombre, kcal, proteinas, carbohidratos, grasas, categoria, tipo_receta, intolerancias, verificacion, score_calidad, apto_rendimiento, tiempo_prep_min, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre, alimento:alimentos(nombre))')
      .eq('estado', 'aprobada').gt('kcal', 0).range(from, from + 499)
    if (error) throw error
    todas.push(...(data as unknown as R[]))
    if (data.length < 500) break
  }
  console.log(`Aprobadas con kcal>0: ${todas.length}\n`)

  const alergenos = [...new Set(restricciones.flatMap(r => ALERGENO[r.toLowerCase()] ?? [r]))]
  const tagsPos = restricciones.map(r => ({ vegano: 'Vegano', vegetariano: 'Vegetariano' } as Record<string, string>)[r.toLowerCase()]).filter(Boolean)
  const evitarL = evitar.map(a => a.toLowerCase())

  const cab = ['Franja', 'cat+tipo', 'tope80', 'restricc.', 'verific.', 'no-recient', 'rendim.', 'encaje≤0.35', 'POOL final', 'vs 7 días']
  console.log(cab.map((c, i) => c.padEnd(i === 0 ? 14 : 11)).join(''))
  const detalle: Record<string, R[]> = {}
  for (const franja of Object.keys(SLOT_CATEGORIAS)) {
    let pool = todas.filter(r => SLOT_CATEGORIAS[franja].includes(r.categoria) && (r.tipo_receta == null || SLOT_TIPOS[franja].includes(r.tipo_receta)))
    if (tiempoMax) pool = pool.filter(r => r.tiempo_prep_min == null || r.tiempo_prep_min <= tiempoMax)
    const nCatTipo = pool.length
    const tope = pool.slice(0, 80) // el motor lee 80 filas sin ORDER BY
    let c = tope.filter(r => {
      const it = r.intolerancias ?? []
      if (alergenos.length && alergenos.some(a => it.includes(a))) return false
      if (tagsPos.length && !tagsPos.every(t => it.includes(t))) return false
      if (evitarL.length) {
        const txt = [r.nombre, ...r.receta_ingredientes.flatMap(i => [i.nombre_libre ?? '', i.alimento?.nombre ?? ''])].join('|').toLowerCase()
        if (evitarL.some(t => txt.includes(t))) return false
      }
      return !dislikes.has(r.id)
    })
    const nRestr = c.length
    const ver = c.filter(r => r.verificacion != null); if (ver.length >= 3) c = ver
    const nVer = c.length
    const cal = c.filter(r => (r.score_calidad ?? 50) >= 50); if (cal.length >= 3) c = cal
    const sinRec = c.filter(r => !recientes.has(r.id)); if (sinRec.length >= 3) c = sinRec
    const nRec = c.length
    if (esAtleta) { const t = c.filter(r => r.apto_rendimiento === true); if (t.length >= 3) c = t }
    const nRend = c.length
    const buenEncaje = c.filter(r => encaje(r) <= 0.35)
    detalle[franja] = c
    // misma pool pero sin el tope de 80, para ver cuánto recorta
    console.log([franja.padEnd(14), String(nCatTipo).padEnd(11), String(tope.length).padEnd(11), String(nRestr).padEnd(11), String(nVer).padEnd(11), String(nRec).padEnd(11), String(nRend).padEnd(11), String(buenEncaje.length).padEnd(11), String(c.length).padEnd(11), c.length >= 7 ? 'OK' : `FALTAN ${7 - c.length}`].join(''))
  }

  console.log('\nSin el tope de 80 (si se ordenara por encaje antes de cortar):')
  for (const franja of Object.keys(SLOT_CATEGORIAS)) {
    const base = todas.filter(r => SLOT_CATEGORIAS[franja].includes(r.categoria) && (r.tipo_receta == null || SLOT_TIPOS[franja].includes(r.tipo_receta)))
    const ok = base.filter(r => {
      const it = r.intolerancias ?? []
      if (alergenos.length && alergenos.some(a => it.includes(a))) return false
      if (tagsPos.length && !tagsPos.every(t => it.includes(t))) return false
      if (evitarL.length) {
        const txt = [r.nombre, ...r.receta_ingredientes.flatMap(i => [i.nombre_libre ?? '', i.alimento?.nombre ?? ''])].join('|').toLowerCase()
        if (evitarL.some(t => txt.includes(t))) return false
      }
      return !dislikes.has(r.id)
    })
    const v = ok.filter(r => r.verificacion != null)
    console.log(`  ${franja.padEnd(13)} categoría+tipo ${String(base.length).padStart(3)} · tras restricciones ${String(ok.length).padStart(3)} · verificadas ${String(v.length).padStart(3)} · verificadas con encaje≤0.35 ${String(v.filter(r => encaje(r) <= 0.35).length).padStart(3)}`)
  }

  console.log('\nTop 5 de cada franja por encaje (pool final):')
  for (const [franja, c] of Object.entries(detalle)) {
    console.log(`  ${franja}: ` + [...c].sort((a, b) => encaje(a) - encaje(b)).slice(0, 5).map(r => `${r.nombre} (${r.kcal}kcal, e=${encaje(r).toFixed(2)})`).join(' | '))
  }
}
main().catch(e => { console.error(e); process.exit(1) })
