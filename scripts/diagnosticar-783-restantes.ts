import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 1. Total de alimentos sin micros que están en recetas
  const { data: enRecetas } = await supabase
    .from('alimentos')
    .select('id, nombre, fuente, calorias, proteinas, carbohidratos, grasas, categoria')
    .is('vitamina_a_ug', null)
    .in('id', (await supabase
      .from('receta_ingredientes')
      .select('alimento_id')
      .not('alimento_id', 'is', null)
    ).data?.map(r => r.alimento_id) ?? [])

  console.log('=== DIAGNÓSTICO DE 783 RESTANTES ===')
  console.log(`En recetas: ${enRecetas?.length ?? 0}`)
  console.log(`Huérfanos (no en recetas): ${783 - (enRecetas?.length ?? 0)}`)

  // Detalle de los que SÍ están en recetas
  if (enRecetas && enRecetas.length > 0) {
    console.log('\n--- ALIMENTOS EN RECETAS ---')
    for (const a of enRecetas) {
      const tieneMacros = (a.calorias ?? 0) > 0 && (a.proteinas ?? 0) > 0
      console.log(`  [${a.fuente}] ${a.nombre} → ${tieneMacros ? '✅macros' : '❌sinMacros'}`)
    }
  }

  // 2. Stats de los 783 totales
  const { count: total } = await supabase
    .from('alimentos')
    .select('*', { count: 'exact', head: true })
    .is('vitamina_a_ug', null)
  console.log(`\nTotal sin micros (confirmado): ${total}`)

  // 3. Por fuente
  const { data: porFuente } = await supabase
    .from('alimentos')
    .select('fuente')
    .is('vitamina_a_ug', null)

  if (porFuente) {
    const src: Record<string, number> = {}
    for (const a of porFuente) {
      const f = a.fuente || 'null'
      src[f] = (src[f] || 0) + 1
    }
    console.log('\nPor fuente:')
    for (const [f, c] of Object.entries(src).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${f}: ${c}`)
    }
  }
}

main()
