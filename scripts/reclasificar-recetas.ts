/**
 * Reclasifica con las reglas corregidas (18-10-2026): alcohol sin vinagres, postre por nombre/categoría,
 * contexto_uso según momentos, y momentos carga_cho/tapering por composición.
 * Simula por defecto. --apply escribe guardando antes la copia. No toca recetas con clasificacion_manual.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { clasificarRecetaProfesional } from '../lib/recetas/profesional'
import { cumpleCargaCho, cumpleTapering } from '../lib/recetas/criterios-momento-entreno'

const APPLY = process.argv.includes('--apply')
const env = Object.fromEntries(readFileSync(resolve('.env.local'), 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
type R = Record<string, any>
const arr = (x: unknown): string[] => (Array.isArray(x) ? (x as string[]) : [])
const clave = (t: string) => t.toLowerCase().replace(/[\s_-]+/g, '')
const cuenta = new Map<string, number>()
const suma = (k: string) => cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
const detalle: string[] = []

async function main() {
  const filas: R[] = []
  for (let d = 0; ; d += 1000) {
    const { data, error } = await db.from('recetas').select('id, nombre, descripcion, instrucciones, estado, categoria, tipo_plato, tipo_receta, kcal, proteinas, carbohidratos, grasas, fibra, porciones, nivel_fit, tipo_uso, contexto_uso, apta_cliente, alcohol_culinario, momentos, tags, intolerancias, clasificacion_manual, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre)').neq('estado', 'descartada').range(d, d + 999)
    if (error) throw new Error(error.message)
    filas.push(...(data as R[]))
    if (!data || data.length < 1000) break
  }

  const cambios: Array<{ id: string; nombre: string; antes: R; despues: R }> = []
  for (const r of filas) {
    const patch: R = {}
    // carga_cho / tapering por composición
    let m = arr(r.momentos)
    const tags = arr(r.tags).map(clave)
    const quita = (mo: string, ok: boolean) => { if (m.includes(mo) && !ok) { m = m.filter(x => x !== mo); suma(`quita ${mo} (no cumple)`); detalle.push(`${r.nombre}: ya no ${mo}`) } }
    const anade = (mo: string, tag: string, ok: boolean) => { if (!m.includes(mo) && tags.includes(tag) && ok && r.estado === 'aprobada') { m = [...m, mo]; suma(`añade ${mo} (tag + composición)`); detalle.push(`${r.nombre}: AÑADE ${mo}`) } }
    quita('carga_cho', cumpleCargaCho(r)); quita('tapering', cumpleTapering(r))
    anade('carga_cho', 'cargacho', cumpleCargaCho(r)); anade('tapering', 'tapering', cumpleTapering(r))
    // Promoción por composición (cobertura mínima del recetario: carga 15, tapering 12). Los umbrales son estrictos,
    // así que no hace falta que el tag lo pida. Se excluyen postres, guarniciones y salsas.
    // Antes de una prueba: comida conocida y suave, sin crudos, picantes ni fritos («no estrenar nada», Jeukendrup 2017)
    const NO_PREPRUEBA = /\b(ceviche|crudo|tartar|tataki|poke|sushi|picante|picantes|chipotle|curry|shawarma|kebab|kebaprol|frito|frita|fritos|rebozad[oa]s?|crujiente|crujientes|wok|teriyaki|barbacoa)\b/i
    const comp = r.estado === 'aprobada' && r.categoria !== 'Postre' && !['guarnicion', 'salsa_base'].includes(r.tipo_receta) && Number(r.kcal) >= 250 && !NO_PREPRUEBA.test(r.nombre)
    if (comp && !m.includes('carga_cho') && cumpleCargaCho(r)) { m = [...m, 'carga_cho']; suma('añade carga_cho (composición)'); detalle.push(`${r.nombre}: AÑADE carga_cho (composición)`) }
    const pctC = Number(r.kcal) > 0 ? (Number(r.carbohidratos) * 4) / Number(r.kcal) : 0
    if (comp && r.tipo_receta === 'completa' && ['Comida', 'Cena'].includes(r.categoria) && !m.includes('tapering') && cumpleTapering(r) && Number(r.proteinas) >= 25 && Number(r.grasas) <= 15 && pctC >= 0.5) { m = [...m, 'tapering']; suma('añade tapering (composición)'); detalle.push(`${r.nombre}: AÑADE tapering (composición)`) }
    if (JSON.stringify(m) !== JSON.stringify(arr(r.momentos))) patch.momentos = m
    const tagsNuevos = arr(r.tags).filter(t => !['cargacho', 'tapering'].includes(clave(t)))
    if (tagsNuevos.length !== arr(r.tags).length) { patch.tags = tagsNuevos; suma('quita tag carga_cho/tapering (ya en momentos)') }

    // clasificación con las reglas corregidas
    if (!r.clasificacion_manual) {
      const c = clasificarRecetaProfesional({
        nombre: r.nombre, descripcion: r.descripcion, instrucciones: r.instrucciones, categoria: r.categoria, tipo_plato: r.tipo_plato,
        kcal: r.kcal, proteinas: r.proteinas, grasas: r.grasas, fibra: r.fibra, porciones: r.porciones, intolerancias: r.intolerancias,
        tags: r.tags, momentos: m.length ? m : null, ingredientes: arr(r.receta_ingredientes?.map?.((i: R) => i.nombre_libre)).map(nombre_libre => ({ nombre_libre })),
      })
      for (const k of ['nivel_fit', 'tipo_uso', 'apta_cliente', 'alcohol_culinario'] as const) {
        if (c[k] !== r[k]) { patch[k] = c[k]; suma(`${k} ${r[k]} → ${c[k]}`) }
      }
      // contexto_uso: respetar el recién corregido por momentos (pre/post); el resto lo decide la regla
      const ctx = c.contexto_uso
      if (ctx !== r.contexto_uso) { patch.contexto_uso = ctx; suma(`contexto_uso ${r.contexto_uso} → ${ctx}`) }
    }
    if (Object.keys(patch).length) cambios.push({ id: r.id, nombre: r.nombre, antes: Object.fromEntries(Object.keys(patch).map(k => [k, r[k] ?? null])), despues: patch })
  }

  console.log(`Recetas leídas: ${filas.length} · con cambios: ${cambios.length}\n`)
  for (const [k, v] of [...cuenta.entries()].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k)
  console.log('\nCarga / tapering:'); for (const d of detalle) console.log(' -', d)
  const sello = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
  const archivo = resolve(`salidas/${sello}_copia-reclasificacion-recetas.json`)
  if (cambios.length) { writeFileSync(archivo, JSON.stringify(cambios, null, 1)); console.log(`\nCopia previa: ${archivo}`) }
  if (!APPLY) { console.log('\nSimulación: no se ha escrito nada. Usa --apply para aplicar.'); return }
  let ok = 0
  for (const c of cambios) {
    const { error } = await db.from('recetas').update(c.despues).eq('id', c.id)
    if (error) throw new Error(`${c.nombre}: ${error.message} (aplicadas ${ok})`)
    ok++
  }
  console.log(`\nAplicadas ${ok}. Para revertir: reescribir 'antes' de ${archivo}`)
}
main().catch(e => { console.error(e); process.exit(1) })
