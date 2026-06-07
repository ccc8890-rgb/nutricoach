import * as dotenv from 'dotenv'
import * as path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { detectarHuecosRecetario } from '../lib/recetas/agente-recetario/coverage'
import { generarCandidatasDesdeHueco } from '../lib/recetas/agente-recetario/generator'
import { prepararImagenPendiente } from '../lib/recetas/agente-recetario/image'
import { resolverIngredientesCandidata, type AlimentoLigero } from '../lib/recetas/agente-recetario/matcher'
import { validarCandidataConservadora } from '../lib/recetas/agente-recetario/validator'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function arg(name: string, fallback = '') {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`))
  return found ? found.split('=').slice(1).join('=') : fallback
}

const objetivo = arg('objetivo', 'rendimiento')
const deporte = arg('deporte', 'running')
const momento = arg('momento', 'tapering')
const cantidad = Number(arg('cantidad', '3'))
const apply = process.argv.includes('--apply')

async function cargarAlimentos(): Promise<AlimentoLigero[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return []
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const alimentos: AlimentoLigero[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('alimentos')
      .select('id,nombre')
      .eq('es_comestible', true)
      .order('nombre', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    alimentos.push(...data)
    if (data.length < pageSize) break
  }

  return alimentos
}

async function main() {
  if (apply) {
    console.error('ERROR: --apply no esta implementado en la fase dry-run conservadora.')
    process.exit(1)
  }

  const gaps = detectarHuecosRecetario([{ objetivo, deporte, momento, actuales: 0 }])
  const gap = gaps[0]

  if (!gap) {
    console.log('AgenteRecetarioPro')
    console.log('Modo: dry-run')
    console.log('Sin huecos detectados para los filtros indicados.')
    return
  }

  const alimentos = await cargarAlimentos()
  const candidatas = generarCandidatasDesdeHueco(gap, { cantidad })
  const matcheadas = candidatas.map((receta) => resolverIngredientesCandidata(receta, alimentos))
  const validadas = matcheadas.map((match) => ({
    receta: match.receta,
    match,
    validacion: validarCandidataConservadora(match.receta),
    imagen: prepararImagenPendiente(match.receta),
  }))

  console.log('AgenteRecetarioPro')
  console.log('Modo: dry-run')
  console.log(`Objetivo: ${objetivo}`)
  console.log(`Deporte: ${deporte}`)
  console.log(`Momento: ${momento}`)
  console.log(`Hueco: ${gap.motivo}`)
  console.log(`Alimentos cargados: ${alimentos.length}`)
  console.log(`Generadas: ${candidatas.length}`)
  console.log(`Validas para en_revision: ${validadas.filter((item) => item.validacion.valida).length}`)
  console.log(`Descartadas: ${validadas.filter((item) => !item.validacion.valida).length}`)
  console.log('Insertadas: 0')

  for (const item of validadas) {
    console.log(`- ${item.receta.nombre} -> ${item.validacion.estado}`)
    for (const error of item.match.errores) {
      console.log(`  match: ${error}`)
    }
    for (const error of item.validacion.errores) {
      console.log(`  validacion: ${error}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
