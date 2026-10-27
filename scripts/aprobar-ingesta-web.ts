// Aprueba en lote las recetas de ingesta web (fuente_tipo='web', en revisión) que pasan el control de calidad, igual que «Aprobar aprobables».
// Simula por defecto: npx tsx scripts/aprobar-ingesta-web.ts [--apply]. Las bloqueadas se quedan en revisión con su motivo.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
async function main() {
  const { auditarRecetaProfesional } = await import('../lib/recetas/auditoria')
  const { marcarFotoRevisada } = await import('../lib/recetas/imagen-revision')
  const { salirDelCircuito } = await import('../lib/recetas/revisor/revisar')
  const { verificarRecetasCompletas } = await import('../lib/recetas/verificacion-auto')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: rs } = await db.from('recetas').select('id, nombre').eq('fuente_tipo', 'web').eq('estado', 'en_revision').like('fuente', 'web:%').not('imagen_url', 'is', null)
  const aprobables: string[] = []
  for (const r of rs ?? []) {
    const a = await auditarRecetaProfesional(db as any, r.id, 'revision_lote_quality', 'ingesta_web')
    if (a.score.bloqueantes.length) console.log('✗', r.nombre, '→', a.score.bloqueantes.join(' | ').slice(0, 140))
    else aprobables.push(r.id)
  }
  console.log(`\n${aprobables.length} aprobables de ${rs?.length ?? 0}`)
  if (!process.argv.includes('--apply')) { console.log('simulación; usa --apply'); return }
  for (let i = 0; i < aprobables.length; i += 50) {
    const lote = aprobables.slice(i, i + 50)
    const { error } = await db.from('recetas').update({ estado: 'aprobada' }).in('id', lote)
    if (error) throw error
    await marcarFotoRevisada(db as any, lote).catch(() => null)
    await salirDelCircuito(db as any, lote, 'aprobada').catch(() => null)
  }
  const v = await verificarRecetasCompletas(db as any, aprobables).catch(() => ({ verificadas: 0, incompletas: [] as unknown[] }))
  console.log('aprobadas', aprobables.length, '· verificadas para el planificador', v.verificadas, '· incompletas', (v.incompletas as unknown[]).length)
}
main().catch(e => { console.error(e); process.exit(1) })
