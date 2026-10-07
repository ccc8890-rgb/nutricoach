// Deshace una reconstrucción: restaura ingredientes y campos de la receta desde salidas/copia-receta-<id>.json.
// Simula por defecto; --apply escribe. Uso: npx tsx scripts/restaurar-receta.ts <receta_id> [--apply]
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const id = process.argv[2]
const APPLY = process.argv.includes('--apply')

async function main() {
  const ruta = join(__dirname, '..', 'salidas', `copia-receta-${id}.json`)
  if (!id || !existsSync(ruta)) throw new Error(`No hay copia en ${ruta}`)
  const { receta, ingredientes } = JSON.parse(readFileSync(ruta, 'utf8')) as { receta: Record<string, unknown>; ingredientes: Record<string, unknown>[] }
  console.log(`${receta.nombre}: se restauran ${ingredientes.length} ingredientes y ${Math.round(Number(receta.kcal))} kcal/ración`)
  if (!APPLY) { console.log('Simulación: nada escrito. Usa --apply.'); return }
  const { id: _rid, ...campos } = receta
  const { error: e1 } = await db.from('receta_ingredientes').delete().eq('receta_id', id)
  if (e1) throw e1
  const { error: e2 } = await db.from('receta_ingredientes').insert(ingredientes.map(({ id: _i, ...x }) => x))
  if (e2) throw e2
  const { error: e3 } = await db.from('recetas').update(campos).eq('id', id)
  if (e3) throw e3
  console.log('✅ restaurada')
}
main().catch(e => { console.error('❌', e.message ?? e); process.exit(1) })
