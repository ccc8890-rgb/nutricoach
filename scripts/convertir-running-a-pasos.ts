// scripts/convertir-running-a-pasos.ts
// Uso: npx tsx scripts/convertir-running-a-pasos.ts [--cliente=<uuid>] [--apply]
// Pone `pasos` en las sesiones de running ya sembradas (plantillas y, con --cliente, las sesiones de su plan).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { PASOS_RUNNING } from '../lib/entrenos/running-plantillas'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
const clienteArg = process.argv.find(a => a.startsWith('--cliente='))?.split('=')[1]

async function main() {
  let ids: string[] = []
  if (clienteArg) {
    const { data: planes } = await db.from('planes_entrenamiento').select('id').eq('cliente_id', clienteArg)
    ids = (planes ?? []).map(p => p.id as string)
  }
  for (const [nombre, pasos] of Object.entries(PASOS_RUNNING)) {
    const { data: plantillas } = await db.from('plantilla_sesiones').select('id').eq('nombre', nombre)
    console.log(`Plantilla «${nombre}»: ${plantillas?.length ?? 0} sesión(es)`)
    if (APPLY && plantillas?.length) {
      const { error } = await db.from('plantilla_sesiones').update({ pasos }).eq('nombre', nombre)
      if (error) throw error
    }
    if (clienteArg) {
      const { data: sesiones } = ids.length
        ? await db.from('sesiones_entrenamiento').select('id').eq('nombre', nombre).in('plan_id', ids)
        : { data: [] as { id: string }[] }
      console.log(`  Cliente ${clienteArg}: ${sesiones?.length ?? 0} sesión(es)`)
      if (APPLY && sesiones?.length) {
        const { error } = await db.from('sesiones_entrenamiento').update({ pasos }).eq('nombre', nombre).in('plan_id', ids)
        if (error) throw error
      }
    }
  }
  console.log(APPLY ? '✅ Aplicado.' : 'Simulación: nada escrito. Usa --apply.')
}
main().catch(e => { console.error('❌', e.message ?? e); process.exit(1) })
