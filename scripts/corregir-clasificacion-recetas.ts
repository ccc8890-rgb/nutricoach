/**
 * Fase 2-3 de la migración de taxonomía: corrige la clasificación mal asignada.
 * Simula por defecto. Con --apply escribe, guardando ANTES la copia de las filas afectadas.
 *
 *   npx tsx scripts/corregir-clasificacion-recetas.ts          # simula
 *   npx tsx scripts/corregir-clasificacion-recetas.ts --apply  # aplica
 *
 * Reglas y motivos: salidas/17-10-2026_auditoria-taxonomia-recetario.md
 * Criterio pre/post: lib/recetas/criterios-momento-entreno.ts (fuentes citadas allí).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inferirTipoReceta } from '../lib/recetas/tipo-receta'
import { cumplePreEntreno, cumplePostEntreno } from '../lib/recetas/criterios-momento-entreno'
import { completarTaxonomia } from '../lib/recetas/taxonomia-auto'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync(resolve('.env.local'), 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const COLS = 'id, nombre, estado, categoria, tipo_plato, tipo_receta, kcal, proteinas, carbohidratos, grasas, fibra, nivel_fit, momentos, deportes, objetivos, estilos, tags, es_pre_entreno, es_post_entreno, contexto_uso, intolerancias, tiempo_prep_min, tiempo_coccion_min, apto_rendimiento, clasificacion_manual'
type R = Record<string, any>
const arr = (x: unknown): string[] => (Array.isArray(x) ? (x as string[]) : [])
const clave = (t: string) => t.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').replace(/[\s_-]+/g, '')
const MOMENTO_CATEGORIA: Record<string, string> = { Desayuno: 'desayuno', Comida: 'comida', Cena: 'cena', Merienda: 'merienda', Snack: 'merienda', Postre: 'postre' }
const OPUESTOS: Array<[string, string]> = [['Sin Gluten', 'Gluten'], ['Sin Lactosa', 'Lácteos'], ['Sin Huevo', 'Huevos'], ['Sin Pescado', 'Pescado'], ['Sin Frutos Secos', 'Frutos Secos'], ['Sin Soja', 'Soja']]

const motivos = new Map<string, number>()
const cuenta = (m: string) => motivos.set(m, (motivos.get(m) ?? 0) + 1)
const detalle: string[] = []

function corregir(r: R): R {
  const patch: R = {}
  let tipo = r.tipo_receta as string

  // 1. tipo_receta: solo se revisan los tipos que el script antiguo asignaba por subcadena
  if (tipo === 'bebida' || tipo === 'salsa_base' || (tipo === 'snack_postre' && ['Comida', 'Cena'].includes(r.categoria))) {
    const nuevo = inferirTipoReceta(r as any)
    if (nuevo !== tipo) { patch.tipo_receta = nuevo; cuenta(`tipo_receta ${tipo} → ${nuevo}`); detalle.push(`${r.nombre}: tipo_receta ${tipo} → ${nuevo}`); tipo = nuevo }
  }

  // 2. momentos
  let m = arr(r.momentos).map(x => (x === 'snack' ? 'merienda' : x)).filter(x => x !== 'comida_social')
  if (tipo === 'salsa_base') m = []
  else {
    const base = MOMENTO_CATEGORIA[r.categoria]
    if (base && !m.includes(base)) { m.push(base); cuenta(`momentos: añade «${base}» (categoría ${r.categoria})`) }
  }
  const ctx = { ...r, tipo_receta: tipo }
  const tagsPrePost = arr(r.tags).map(clave)
  if (m.includes('pre_entreno') && !cumplePreEntreno(ctx)) { m = m.filter(x => x !== 'pre_entreno'); cuenta('quita pre_entreno (no cumple composición)'); detalle.push(`${r.nombre}: ya no pre_entreno`) }
  if (m.includes('post_entreno') && !cumplePostEntreno(ctx)) { m = m.filter(x => x !== 'post_entreno'); cuenta('quita post_entreno (no cumple composición)'); detalle.push(`${r.nombre}: ya no post_entreno`) }
  if (tagsPrePost.includes('postentreno') && !m.includes('post_entreno') && cumplePostEntreno(ctx) && tipo !== 'salsa_base' && !arr(r.momentos).includes('post_entreno') && r.estado === 'aprobada') { m.push('post_entreno'); cuenta('añade post_entreno (tag + composición)'); detalle.push(`${r.nombre}: AÑADE post_entreno`) }
  if (tagsPrePost.includes('preentreno') && !m.includes('pre_entreno') && cumplePreEntreno(ctx) && tipo !== 'salsa_base' && !arr(r.momentos).includes('pre_entreno') && r.estado === 'aprobada') { m.push('pre_entreno'); cuenta('añade pre_entreno (tag + composición)'); detalle.push(`${r.nombre}: AÑADE pre_entreno`) }
  m = [...new Set(m)]
  if (JSON.stringify(m) !== JSON.stringify(arr(r.momentos))) patch.momentos = m
  const pre = m.includes('pre_entreno'), post = m.includes('post_entreno')
  if (!!r.es_pre_entreno !== pre) { patch.es_pre_entreno = pre; cuenta('es_pre_entreno alineado con momentos') }
  if (!!r.es_post_entreno !== post) { patch.es_post_entreno = post; cuenta('es_post_entreno alineado con momentos') }

  // 3. contexto_uso: pre/post solo si la composición lo respalda
  if (!r.clasificacion_manual) {
    let c = r.contexto_uso as string
    if (post) c = 'post_entreno'
    else if (pre) c = 'pre_entreno'
    else if (c === 'post_entreno' || c === 'pre_entreno') {
      const t = arr(r.tags).map(x => x.toLowerCase())
      const total = (Number(r.tiempo_prep_min) || 0) + (Number(r.tiempo_coccion_min) || 0)
      c = t.some(x => x.startsWith('tupper')) ? 'tupper'
        : r.categoria === 'Cena' && Number(r.kcal) <= 450 ? 'cena_ligera'
        : r.categoria === 'Desayuno' && Number(r.kcal) <= 450 && total <= 20 ? 'desayuno_rapido'
        : 'general'
    }
    if (c !== r.contexto_uso) { patch.contexto_uso = c; cuenta(`contexto_uso ${r.contexto_uso} → ${c}`) }
  }

  // 4. tipo_plato sigue a categoria (categoria es lo que usan el listado y el planificador)
  if (r.categoria && r.tipo_plato !== r.categoria) { patch.tipo_plato = r.categoria; cuenta('tipo_plato = categoria') }

  // 5. tags de pre/post: la fuente de verdad pasa a ser `momentos`
  const tags = arr(r.tags).filter(t => !['postentreno', 'preentreno'].includes(clave(t)))
  if (tags.length !== arr(r.tags).length) { patch.tags = tags; cuenta('quita tag pre/post (ya en momentos)') }

  // 6. alérgenos contradictorios: se retira la afirmación «Sin X» (el lado seguro)
  let intol = arr(r.intolerancias)
  for (const [sin, con] of OPUESTOS) if (intol.includes(sin) && intol.includes(con)) { intol = intol.filter(x => x !== sin); cuenta(`intolerancias: quita «${sin}» (contradice «${con}»)`); detalle.push(`${r.nombre}: quita ${sin}`) }
  if (intol.length !== arr(r.intolerancias).length) patch.intolerancias = intol

  // 7. vocabulario de deportes
  if (arr(r.deportes).includes('entreno_fuerza')) { patch.deportes = [...new Set(arr(r.deportes).map(d => (d === 'entreno_fuerza' ? 'fuerza' : d)))]; cuenta('deportes: entreno_fuerza → fuerza') }

  // 8. huecos: objetivos y estilos vacíos
  const comp = completarTaxonomia({ ...r, momentos: m, deportes: [], objetivos: [], estilos: [] } as any)
  if (!arr(r.objetivos).length && comp.objetivos.length) { patch.objetivos = comp.objetivos; cuenta('objetivos vacíos rellenados') }
  if (!arr(r.estilos).length && comp.estilos.length) { patch.estilos = comp.estilos; cuenta('estilos vacíos rellenados (rápida/batch/tupper)') }

  return patch
}

async function main() {
  const filas: R[] = []
  for (let d = 0; ; d += 1000) {
    const { data, error } = await db.from('recetas').select(COLS).neq('estado', 'descartada').range(d, d + 999)
    if (error) throw new Error(error.message)
    filas.push(...(data as R[]))
    if (!data || data.length < 1000) break
  }
  const cambios = filas.map(r => ({ r, patch: corregir(r) })).filter(c => Object.keys(c.patch).length)
  console.log(`Recetas leídas: ${filas.length} · con cambios: ${cambios.length}\n`)
  for (const [k, v] of [...motivos.entries()].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k)
  console.log('\nDetalle de cambios de criterio (tipo, pre/post, alérgenos):')
  for (const d of detalle) console.log(' -', d)

  const copia = cambios.map(({ r, patch }) => ({ id: r.id, nombre: r.nombre, antes: Object.fromEntries(Object.keys(patch).map(k => [k, r[k] ?? null])), despues: patch }))
  const sello = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
  const archivo = resolve(`salidas/${sello}_copia-clasificacion-recetas.json`)
  if (copia.length) { writeFileSync(archivo, JSON.stringify(copia, null, 1)); console.log(`\nCopia previa: ${archivo}`) }
  if (!APPLY) { console.log('\nSimulación: no se ha escrito nada. Usa --apply para aplicar.'); return }

  let ok = 0
  for (const c of copia) {
    const { error } = await db.from('recetas').update(c.despues).eq('id', c.id)
    if (error) throw new Error(`${c.nombre}: ${error.message} (aplicadas ${ok}; la copia permite revertir)`)
    ok++
  }
  console.log(`\nAplicadas ${ok} recetas. Para revertir: reescribir los campos 'antes' de ${archivo}`)
}
main().catch(e => { console.error(e); process.exit(1) })
