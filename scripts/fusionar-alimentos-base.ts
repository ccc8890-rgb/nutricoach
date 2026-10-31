// Fusiona duplicados DENTRO de los alimentos base: mismo alimento con otro nombre y los mismos valores nutricionales
// («Tomate» / «Tomate maduro» / «Tomate fresco», «Avena (copos)» / «Avena en copos», «Aceite de oliva extra virgen» / «virgen extra»).
// Criterio de Carlos (31-10-2026): se funden si solo cambia un matiz que no altera la nutrición; NO si cambia el estado o la forma
// (crudo ≠ cocido, copos ≠ harina, con sal ≠ sin sal).
//   npx tsx scripts/fusionar-alimentos-base.ts            → simula y lista los grupos
//   npx tsx scripts/fusionar-alimentos-base.ts --aplica   → repunta todas las referencias, copia en salidas/ y borra el duplicado
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { recalcularMacrosReceta } from '../lib/recetas/elaboraciones-db'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APLICA = process.argv.includes('--aplica')

type Al = { id: string; nombre: string; fuente: string | null; calorias: number | null; proteinas: number | null; carbohidratos: number | null; grasas: number | null; es_base: boolean }
const sin = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const STOP = new Set(['de', 'del', 'la', 'el', 'en', 'al', 'y', 'o', 'un', 'una'])
// Palabras que no cambian el alimento (variedad o estado de madurez); el resto de matices (crudo, cocido, seco, light, sin sal…) SÍ separan
const NEUTRAS = new Set(['fresco', 'fresca', 'frescos', 'frescas', 'maduro', 'madura', 'maduros', 'maduras'])
const clave = (n: string) => [...new Set(sin(n).replace(/[^a-z0-9% ]/g, ' ').split(/\s+/).filter(t => t && !STOP.has(t) && !NEUTRAS.has(t)))].sort().join(' ')
const FUENTE: Record<string, number> = { bedca: 0, curada: 1, coach: 1, openfoodfacts: 2, ia: 3 }
// Mismos valores nutricionales: kcal ±6 % (o ±6 kcal) y cada macro ±10 % (o ±1,5 g)
const cerca = (a: number | null, b: number | null, rel: number, abs: number) => Math.abs((a ?? 0) - (b ?? 0)) <= Math.max(abs, rel * Math.max(a ?? 0, b ?? 0))
const mismosValores = (a: Al, b: Al) => cerca(a.calorias, b.calorias, 0.06, 6) && cerca(a.proteinas, b.proteinas, 0.1, 1.5) && cerca(a.carbohidratos, b.carbohidratos, 0.1, 1.5) && cerca(a.grasas, b.grasas, 0.1, 1.5)

const TABLAS: [string, string][] = [
  ['receta_ingredientes', 'alimento_id'], ['comida_alimentos', 'alimento_id'], ['selecciones_lista_compra', 'alimento_id'],
  ['intercambios_historial', 'alimento_original_id'], ['intercambios_historial', 'alternativa_elegida_id'],
  ['productos_supermercado', 'alimento_id'], ['precios_historico', 'alimento_id'],
]
const BORRAR: [string, string][] = [['alimentos_enriquecimiento_cola', 'alimento_id'], ['alimentos_nutricion_audit', 'alimento_id'], ['dedup_revision', 'alimento_a_id'], ['dedup_revision', 'alimento_b_id']]

async function todas<T>(f: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; ; i += 1000) { const { data, error } = await f(i, i + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if ((data ?? []).length < 1000) break }
  return out
}

async function main() {
  const al = await todas<Al>((a, b) => db.from('alimentos').select('id, nombre, fuente, calorias, proteinas, carbohidratos, grasas, es_base').eq('es_comestible', true).eq('es_base', true).range(a, b))
  const usos = new Map<string, number>()
  for (const t of ['receta_ingredientes', 'comida_alimentos']) for (const r of await todas<{ alimento_id: string }>((a, b) => db.from(t).select('alimento_id').not('alimento_id', 'is', null).range(a, b))) usos.set(r.alimento_id, (usos.get(r.alimento_id) ?? 0) + 1)
  const porClave = new Map<string, Al[]>()
  for (const a of al) { const k = clave(a.nombre); (porClave.get(k) ?? porClave.set(k, []).get(k)!).push(a) }
  type Grupo = { canon: Al; duplicados: Al[] }
  const grupos: Grupo[] = []
  for (const miembros of porClave.values()) {
    if (miembros.length < 2) continue
    // canónico: fuente más fiable, más usado, nombre más corto
    const orden = [...miembros].sort((x, y) => (FUENTE[x.fuente ?? 'ia'] ?? 3) - (FUENTE[y.fuente ?? 'ia'] ?? 3) || (usos.get(y.id) ?? 0) - (usos.get(x.id) ?? 0) || x.nombre.length - y.nombre.length)
    const canon = orden[0]
    const duplicados = orden.slice(1).filter(d => mismosValores(canon, d))
    if (duplicados.length) grupos.push({ canon, duplicados })
  }
  console.log(`Alimentos base: ${al.length} · grupos a fundir: ${grupos.length} · duplicados: ${grupos.reduce((n, g) => n + g.duplicados.length, 0)}\n`)
  for (const g of grupos) console.log(`  ${g.canon.nombre} (${Math.round(g.canon.calorias ?? 0)} kcal, ${g.canon.fuente}) ← ${g.duplicados.map(d => `${d.nombre} (${Math.round(d.calorias ?? 0)})`).join(' · ')}`)
  if (!APLICA) { console.log('\nSimulación. Añade --aplica.'); return }

  const copia: unknown[] = []
  const recetasAfectadas = new Set<string>()
  let fundidos = 0
  for (const g of grupos) for (const d of g.duplicados) {
    let ok = true
    const guardado: unknown[] = []
    for (const [tabla, col] of TABLAS) {
      const { data: filas } = await db.from(tabla).select('*').eq(col, d.id)
      if (!filas?.length) continue
      guardado.push({ tabla, col, de: d.id, a: g.canon.id, filas })
      if (tabla === 'receta_ingredientes') for (const f of filas as { receta_id: string }[]) recetasAfectadas.add(f.receta_id)
      const { error } = await db.from(tabla).update({ [col]: g.canon.id }).eq(col, d.id)
      if (error) { console.log(`  ⚠️ ${d.nombre}: ${tabla}.${col}: ${error.message} (no se funde)`); ok = false; break }
    }
    if (!ok) continue
    for (const [tabla, col] of BORRAR) {
      const { data: filas } = await db.from(tabla).select('*').eq(col, d.id)
      if (filas?.length) { guardado.push({ tabla, col, de: d.id, borrado: true, filas }); await db.from(tabla).delete().eq(col, d.id) }
    }
    const { error } = await db.from('alimentos').delete().eq('id', d.id)
    if (error) { console.log(`  ⚠️ ${d.nombre}: no se pudo borrar (${error.message}); queda con sus referencias ya repuntadas`); continue }
    copia.push({ alimento_borrado: d, canonico: g.canon.id, referencias: guardado })
    fundidos++
  }
  writeFileSync(join(__dirname, '..', 'salidas', '31-10-2026_BACKUP-fusion-alimentos-base.json'), JSON.stringify(copia, null, 1))
  for (const id of recetasAfectadas) await recalcularMacrosReceta(db as any, id)
  console.log(`\nFundidos ${fundidos} duplicados · ${recetasAfectadas.size} recetas recalculadas · copia en salidas/31-10-2026_BACKUP-fusion-alimentos-base.json`)
}
main().catch(e => { console.error(e.message); process.exit(1) })
