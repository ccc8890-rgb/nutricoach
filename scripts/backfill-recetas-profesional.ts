import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { auditarRecetaProfesional } from '../lib/recetas/auditoria'

const envPath = resolve(process.cwd(), '.env.local')
const envRaw = readFileSync(envPath, 'utf-8')
for (const line of envRaw.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const limiteArg = process.argv.find(arg => arg.startsWith('--limite='))
const limite = limiteArg ? Number(limiteArg.split('=')[1]) : 500

async function main() {
  const { data: recetas, error } = await supabase
    .from('recetas')
    .select('id,nombre')
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error) throw error

  let ok = 0
  let errores = 0
  const resumen = new Map<string, number>()

  for (const receta of recetas || []) {
    try {
      const audit = await auditarRecetaProfesional(supabase, receta.id, 'backfill_profesional', 'script_backfill')
      ok++
      resumen.set(audit.clasificacion.nivel_fit, (resumen.get(audit.clasificacion.nivel_fit) || 0) + 1)
    } catch (err) {
      errores++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`ERROR ${receta.nombre}: ${msg}`)
    }
  }

  console.log(`Backfill profesional completado: ${ok} OK / ${errores} errores`)
  for (const [nivel, count] of [...resumen.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${nivel}: ${count}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
