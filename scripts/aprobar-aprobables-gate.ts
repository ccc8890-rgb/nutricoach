/**
 * Aprueba las recetas en revisión que el quality gate marca como aprobables (sin bloqueantes y con score suficiente).
 * Uso: npx tsx scripts/quality-gate-recetas.ts --estado=en_revision --limite=300 --json
 *      npx tsx scripts/aprobar-aprobables-gate.ts --desde=2026-10-01          # simula
 *      npx tsx scripts/aprobar-aprobables-gate.ts --desde=2026-10-01 --apply  # escribe
 * Lee el informe más reciente de salidas/quality-gate-*.json. Nunca toca recetas que no estén en_revision.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { auditarLoteRecetas } from '../lib/recetas/post-import-audit'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
const desde = process.argv.find(a => a.startsWith('--desde='))?.split('=')[1] ?? '1970-01-01'

async function main() {
  const dir = join(__dirname, '..', 'salidas')
  const informe = readdirSync(dir).filter(f => /^quality-gate-.*\.json$/.test(f)).sort((a, b) => statSync(join(dir, a)).mtimeMs - statSync(join(dir, b)).mtimeMs).pop()
  if (!informe) throw new Error('No hay informe quality-gate en salidas/. Ejecuta primero quality-gate-recetas.ts --json')
  const j = JSON.parse(readFileSync(join(dir, informe), 'utf8'))
  const resultados: { id: string; nombre: string; aprobable: boolean }[] = j.resultados ?? Object.values(j).find(Array.isArray)

  const { data: enRevision, error } = await db.from('recetas').select('id, nombre, created_at').eq('estado', 'en_revision').gte('created_at', desde)
  if (error) throw error
  const ids = new Set((enRevision ?? []).map(r => r.id))
  const aprobables = resultados.filter(r => r.aprobable && ids.has(r.id))
  const excluidas = resultados.filter(r => !r.aprobable && ids.has(r.id))

  console.log(`Informe: ${informe} · en revisión desde ${desde}: ${ids.size} · aprobables: ${aprobables.length} · excluidas: ${excluidas.length}`)
  excluidas.forEach(r => console.log(`  se queda en revisión: ${r.nombre}`))
  if (!APPLY) { console.log('SIMULACIÓN. Añade --apply para escribir.'); return }
  const { error: e2 } = await db.from('recetas').update({ estado: 'aprobada' }).in('id', aprobables.map(r => r.id)).eq('estado', 'en_revision')
  if (e2) throw e2
  console.log(`Aprobadas ${aprobables.length} recetas.`)
  await auditarLoteRecetas(db as never, aprobables.map(r => r.id), 'script_aprobar_gate', 'aprobada_lote')   // deja el evento en recetas_auditoria
  console.log('Eventos de auditoría registrados.')
}
main().catch(e => { console.error(e); process.exit(1) })
