import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
import { createClient } from '@supabase/supabase-js'
import { auditarRecetaProfesional } from '../lib/recetas/auditoria'

const srv = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const { data } = await srv.from('recetas').select('id,nombre').in('estado', ['en_revision', 'borrador'])
  const cuenta: Record<string, number> = {}
  for (const r of data ?? []) {
    try {
      const a = await auditarRecetaProfesional(srv, r.id, 'quality_check', 'refresco_pendientes')
      const b = a.score.bloqueantes as string[]
      console.log(`${r.nombre.slice(0, 44)} [${a.score.score}]`); for (const [k, v] of Object.entries(a.score.detalles ?? {})) console.log(`   ${k}: ${v.join(' ; ')}`)
      for (const x of b) cuenta[x.split(':')[0]] = (cuenta[x.split(':')[0]] ?? 0) + 1
    } catch (e) { console.log(r.nombre, 'ERROR', (e as Error).message) }
  }
  console.log('\nResumen bloqueos:', cuenta)
}
main()
