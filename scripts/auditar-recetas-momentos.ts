import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { auditarRecetaProfesional } from '../lib/recetas/auditoria'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const MOMENTOS_DEFAULT = ['pre_entreno', 'post_entreno', 'carga_cho', 'tapering']

function parseListArg(prefix: string) {
  const arg = process.argv.find(a => a.startsWith(prefix))
  return arg
    ? arg.slice(prefix.length).split(',').map(v => v.trim()).filter(Boolean)
    : null
}

async function main() {
  const momentos = parseListArg('--momentos=') ?? MOMENTOS_DEFAULT
  const estados = parseListArg('--estados=') ?? ['en_revision']
  const aplicar = process.argv.includes('--apply')
  const reauditar = process.argv.includes('--reauditar')

  const ids = new Map<string, { id: string; nombre: string; estado: string }>()
  for (const momento of momentos) {
    let query = supabase
      .from('recetas')
      .select('id,nombre,estado')
      .in('estado', estados)
      .contains('momentos', [momento])
      .order('nombre', { ascending: true })

    if (!reauditar) query = query.is('score_calidad', null)

    const { data, error } = await query

    if (error) throw new Error(error.message)
    for (const receta of data ?? []) {
      ids.set(receta.id, receta as { id: string; nombre: string; estado: string })
    }
  }

  const recetas = [...ids.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  console.log(`${aplicar ? '[APPLY]' : '[DRY-RUN]'} Recetas a auditar: ${recetas.length}`)
  if (!aplicar) {
    recetas.forEach(r => console.log(`  · ${r.estado} | ${r.nombre}`))
    console.log('\nUsa --apply para actualizar score_calidad y quality_estado_sugerido. Añade --reauditar para incluir recetas ya auditadas.')
    return
  }

  let ok = 0
  let errores = 0
  const resumen: Record<string, number> = {}

  for (const receta of recetas) {
    try {
      const resultado = await auditarRecetaProfesional(supabase, receta.id, 'quality_check_peri_entreno', 'auditar-recetas-momentos')
      ok++
      const estado = resultado.resumen.estado_sugerido
      resumen[estado] = (resumen[estado] ?? 0) + 1
      console.log(`  [${ok + errores}/${recetas.length}] ${resultado.score.score} · ${estado} · ${receta.nombre}`)
    } catch (error) {
      errores++
      console.error(`  [${ok + errores}/${recetas.length}] ERROR · ${receta.nombre}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log('\nResumen:', JSON.stringify({ ok, errores, estados: resumen }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
