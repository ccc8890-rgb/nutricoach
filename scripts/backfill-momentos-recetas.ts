import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const TIPO_A_MOMENTO: Record<string, string> = {
  Desayuno: 'desayuno',
  Almuerzo: 'media_manana',
  Comida: 'comida',
  Cena: 'cena',
  Merienda: 'merienda',
  Snack: 'merienda',
  Postre: 'merienda',
}

async function main() {
  const aplicar = process.argv.includes('--apply')
  const { data, error } = await supabase
    .from('recetas')
    .select('id,nombre,tipo_plato,categoria,score_calidad')
    .eq('estado', 'aprobada')
    .or('momentos.is.null,momentos.eq.{}')
    .order('tipo_plato', { ascending: true })

  if (error) throw new Error(error.message)

  const candidatas = (data ?? [])
    .map(receta => ({
      ...receta,
      momento: receta.tipo_plato ? TIPO_A_MOMENTO[receta.tipo_plato] : undefined,
    }))
    .filter((receta): receta is typeof receta & { momento: string } => Boolean(receta.momento))

  const omitidas = (data ?? []).length - candidatas.length
  const resumen = candidatas.reduce<Record<string, number>>((acc, receta) => {
    acc[receta.momento] = (acc[receta.momento] ?? 0) + 1
    return acc
  }, {})

  console.log(`${aplicar ? '[APPLY]' : '[DRY-RUN]'} Candidatas: ${candidatas.length} | omitidas sin tipo claro: ${omitidas}`)
  console.log('Resumen:', JSON.stringify(resumen, null, 2))
  for (const receta of candidatas.slice(0, 80)) {
    console.log(`  + ${receta.tipo_plato} -> ${receta.momento} | ${receta.nombre}`)
  }

  if (!aplicar) {
    console.log('\nUsa --apply para escribir momentos.')
    return
  }

  let ok = 0
  let errores = 0
  for (const receta of candidatas) {
    const { error: updateError } = await supabase
      .from('recetas')
      .update({ momentos: [receta.momento] })
      .eq('id', receta.id)

    if (updateError) {
      errores++
      console.error(`  ERROR ${receta.nombre}: ${updateError.message}`)
    } else {
      ok++
    }
  }

  console.log(`\n✅ ${ok} recetas actualizadas | errores: ${errores}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
