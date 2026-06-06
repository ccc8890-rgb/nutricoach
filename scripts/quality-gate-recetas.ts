import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { auditarRecetaProfesional } from '../lib/recetas/auditoria'

type EstadoReceta = 'aprobada' | 'en_revision' | 'borrador' | 'descartada' | 'todas'
type ClienteAuditoria = Parameters<typeof auditarRecetaProfesional>[0]

interface RecetaResumen {
  id: string
  nombre: string | null
  tipo_plato: string | null
  kcal: number | null
  estado: string | null
  created_at: string | null
}

interface ResultadoReceta {
  id: string
  nombre: string
  estado: string | null
  kcal: number | null
  score: number
  aprobable: boolean
  bloqueantes: string[]
  avisos: string[]
}

function cargarEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    process.env[key] ||= value
  }
}

function parseArgs(args: string[]) {
  const json = args.includes('--json')
  const todas = args.includes('--todas')
  const limiteArg = args.find(arg => arg.startsWith('--limite='))
  const estadoArg = args.find(arg => arg.startsWith('--estado='))
  const limite = limiteArg ? Number.parseInt(limiteArg.split('=')[1] || '', 10) : (todas ? 9999 : 50)
  const estado = (todas ? 'todas' : (estadoArg?.split('=')[1] || 'aprobada')) as EstadoReceta

  if (!Number.isFinite(limite) || limite < 1) throw new Error('Usa --limite=N con N mayor que 0.')
  if (!['aprobada', 'en_revision', 'borrador', 'descartada', 'todas'].includes(estado)) {
    throw new Error('Estado inválido. Usa aprobada, en_revision, borrador, descartada o todas.')
  }

  return { json, limite, estado }
}

function fechaDDMMYYYY(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

async function main() {
  cargarEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.')
  }

  const opts = parseArgs(process.argv.slice(2))
  const supabase = createClient(url, serviceKey)

  let query = supabase
    .from('recetas')
    .select('id,nombre,tipo_plato,kcal,estado,created_at')
    .order('created_at', { ascending: false })
    .limit(opts.limite)

  if (opts.estado !== 'todas') query = query.eq('estado', opts.estado)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const recetas = (data || []) as RecetaResumen[]
  const resultados: ResultadoReceta[] = []

  for (const receta of recetas) {
    const audit = await auditarRecetaProfesional(
      supabase as ClienteAuditoria,
      receta.id,
      'quality_gate_script',
      'script_quality_gate_recetas'
    )

    resultados.push({
      id: receta.id,
      nombre: receta.nombre || 'Sin nombre',
      estado: receta.estado,
      kcal: receta.kcal,
      score: audit.score.score,
      aprobable: audit.resumen.aprobable,
      bloqueantes: audit.score.bloqueantes,
      avisos: audit.score.avisos,
    })
  }

  const resumen = {
    revisadas: resultados.length,
    ok: resultados.filter(r => r.bloqueantes.length === 0 && r.avisos.length === 0).length,
    con_issues: resultados.filter(r => r.bloqueantes.length > 0 || r.avisos.length > 0).length,
    con_bloqueantes: resultados.filter(r => r.bloqueantes.length > 0).length,
    con_avisos: resultados.filter(r => r.avisos.length > 0).length,
  }

  if (opts.json) {
    const dir = resolve(process.cwd(), 'salidas')
    mkdirSync(dir, { recursive: true })
    const ruta = resolve(dir, `quality-gate-${fechaDDMMYYYY()}.json`)
    writeFileSync(ruta, JSON.stringify({ generado_at: new Date().toISOString(), opciones: opts, resumen, resultados }, null, 2))
    console.log(JSON.stringify({ ruta, resumen }))
    return
  }

  console.log('Quality gate recetas')
  console.log(`Revisadas: ${resumen.revisadas}`)
  console.log(`OK: ${resumen.ok}`)
  console.log(`Con issues: ${resumen.con_issues}`)
  console.log(`Con bloqueantes: ${resumen.con_bloqueantes}`)
  console.log(`Con avisos: ${resumen.con_avisos}`)

  for (const resultado of resultados.filter(r => r.bloqueantes.length > 0 || r.avisos.length > 0)) {
    console.log(`\n- ${resultado.nombre} (${resultado.estado || 'sin estado'}, ${resultado.kcal ?? '?'} kcal, score ${resultado.score})`)
    for (const bloqueante of resultado.bloqueantes) console.log(`  BLOQUEANTE: ${bloqueante}`)
    for (const aviso of resultado.avisos) console.log(`  AVISO: ${aviso}`)
  }
}

main().catch(error => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
