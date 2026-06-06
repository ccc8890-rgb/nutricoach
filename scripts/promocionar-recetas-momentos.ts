import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const MOMENTOS_DEFAULT = ['pre_entreno', 'post_entreno', 'carga_cho', 'tapering']

function normalizarNombre(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseListArg(prefix: string) {
  const arg = process.argv.find(a => a.startsWith(prefix))
  return arg
    ? arg.slice(prefix.length).split(',').map(v => v.trim()).filter(Boolean)
    : null
}

async function main() {
  const momentos = parseListArg('--momentos=') ?? MOMENTOS_DEFAULT
  const aplicar = process.argv.includes('--apply')
  const minScoreArg = process.argv.find(a => a.startsWith('--min-score='))
  const minScore = minScoreArg ? Number(minScoreArg.slice('--min-score='.length)) : 75

  const porId = new Map<string, {
    id: string
    nombre: string
    score_calidad: number | null
    momentos: string[] | null
  }>()
  const nombresYaAprobados = new Set<string>()

  for (const momento of momentos) {
    const { data: aprobadas, error: aprobadasError } = await supabase
      .from('recetas')
      .select('nombre')
      .eq('estado', 'aprobada')
      .contains('momentos', [momento])

    if (aprobadasError) throw new Error(aprobadasError.message)
    for (const receta of aprobadas ?? []) {
      nombresYaAprobados.add(normalizarNombre(receta.nombre))
    }

    const { data, error } = await supabase
      .from('recetas')
      .select('id,nombre,score_calidad,momentos')
      .eq('estado', 'en_revision')
      .eq('quality_estado_sugerido', 'aprobada')
      .gte('score_calidad', minScore)
      .contains('momentos', [momento])

    if (error) throw new Error(error.message)
    for (const receta of data ?? []) {
      if (nombresYaAprobados.has(normalizarNombre(receta.nombre))) continue
      porId.set(receta.id, receta as { id: string; nombre: string; score_calidad: number | null; momentos: string[] | null })
    }
  }

  const grupos = new Map<string, Array<typeof porId extends Map<string, infer T> ? T : never>>()
  for (const receta of porId.values()) {
    const key = normalizarNombre(receta.nombre)
    grupos.set(key, [...(grupos.get(key) ?? []), receta])
  }

  const seleccionadas = [...grupos.values()].map(grupo =>
    grupo.sort((a, b) => (b.score_calidad ?? 0) - (a.score_calidad ?? 0) || a.nombre.localeCompare(b.nombre))[0]
  ).sort((a, b) => a.nombre.localeCompare(b.nombre))

  const duplicadas = [...grupos.values()].flatMap(grupo => grupo.slice(1))

  console.log(`${aplicar ? '[APPLY]' : '[DRY-RUN]'} Promocionables únicas: ${seleccionadas.length} | duplicadas retenidas: ${duplicadas.length} | minScore=${minScore}`)
  for (const receta of seleccionadas) {
    console.log(`  + ${receta.score_calidad} · ${receta.nombre}`)
  }
  if (duplicadas.length) {
    console.log('\nDuplicadas retenidas en revisión:')
    for (const receta of duplicadas) console.log(`  · ${receta.score_calidad} · ${receta.nombre}`)
  }

  if (!aplicar) {
    console.log('\nUsa --apply para cambiar estado a aprobada.')
    return
  }

  if (!seleccionadas.length) return

  const { error } = await supabase
    .from('recetas')
    .update({ estado: 'aprobada' })
    .in('id', seleccionadas.map(r => r.id))

  if (error) throw new Error(error.message)
  console.log(`\n✅ ${seleccionadas.length} recetas promocionadas a aprobada.`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
