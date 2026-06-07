import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
import { createClient } from '@supabase/supabase-js'
import { validarVocabulario } from '../lib/recetas/agente-recetario/vocabulary-guard'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const hoy = new Date().toISOString().split('T')[0]
  const { data: aprobadas } = await db.from('recetas').select('id, nombre, tipo_plato, kcal, proteinas, tags').eq('estado', 'aprobada').gte('created_at', hoy)

  console.log('✅ Aprobadas hoy:', aprobadas?.length)

  const sinKcal = aprobadas?.filter(r => !r.kcal || r.kcal === 0) ?? []
  console.log(sinKcal.length === 0 ? '✅ Todas tienen kcal' : '❌ Sin kcal: ' + sinKcal.length)

  let vocabBad = 0
  for (const r of aprobadas ?? []) {
    const v = validarVocabulario({ nombre: r.nombre, descripcion: '', instrucciones: [] })
    if (!v.valido) { vocabBad++; console.log('  ❌', r.nombre, '->', v.violaciones.map(x => x.patron).join(', ')) }
  }
  console.log(vocabBad === 0 ? '✅ 0 violaciones vocabulario' : '❌ Violaciones: ' + vocabBad)

  const tipos = new Set(aprobadas?.map(r => r.tipo_plato))
  console.log('✅ Tipos cubiertos:', [...tipos].sort().join(', '))

  console.log('\nMuestra de macros:')
  aprobadas?.filter(r => r.kcal).slice(0, 8).forEach(r =>
    console.log(' ', r.tipo_plato.padEnd(10), String(r.kcal).padStart(4) + ' kcal |', String(r.proteinas ?? '?').padStart(3) + 'g P |', r.nombre.substring(0, 40))
  )
}
main().catch(console.error)
