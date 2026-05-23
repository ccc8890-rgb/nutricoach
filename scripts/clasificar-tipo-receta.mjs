// scripts/clasificar-tipo-receta.mjs
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const APLICAR = process.argv.includes('--aplicar')

function clasificarReceta(receta) {
  const cat = (receta.categoria ?? '').toLowerCase()
  const tipo = (receta.tipo_plato ?? '').toLowerCase()
  const nombre = (receta.nombre ?? '').toLowerCase()

  if (cat.includes('salsa') || nombre.includes('mayonesa') || nombre.includes('aliño') ||
      nombre.includes('hummus') || nombre.includes('pesto') || nombre.includes('guacamole') ||
      nombre.includes('tahini') || nombre.includes('ketchup') || nombre.includes('vinagreta')) {
    return 'salsa_base'
  }
  if (cat.includes('bebida') || cat.includes('batido') || cat.includes('smoothie') ||
      tipo.includes('bebida') || nombre.includes('batido') || nombre.includes('smoothie') ||
      nombre.includes('zumo') || nombre.includes('agua')) {
    return 'bebida'
  }
  if (cat === 'desayuno' || tipo === 'desayuno' ||
      cat.includes('gofre') || nombre.includes('gofre') || nombre.includes('tortita') ||
      nombre.includes('porridge') || nombre.includes('avena') || nombre.includes('tostada')) {
    return 'desayuno'
  }
  if (cat === 'snack' || cat === 'postre' || cat === 'merienda' ||
      tipo === 'snack' || tipo === 'postre' || tipo === 'merienda' ||
      cat.includes('dulce') || nombre.includes('brownie') || nombre.includes('cookie') ||
      nombre.includes('muffin') || nombre.includes('bite') || nombre.includes('bola')) {
    return 'snack_postre'
  }
  if (cat.includes('ensalada') && !nombre.includes('pollo') && !nombre.includes('atún') &&
      !nombre.includes('salmón') && !nombre.includes('huevo') && !nombre.includes('quinoa')) {
    return 'guarnicion'
  }
  return 'completa'
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN' : APLICAR ? 'APLICAR' : 'PREVIEW'}`)

  const { data: recetas, error } = await supabase
    .from('recetas')
    .select('id, nombre, categoria, tipo_plato, tipo_receta')
    .order('nombre')

  if (error) { console.error('Error:', error.message); process.exit(1) }

  const cambios = []
  const contadores = {}

  for (const r of recetas) {
    const tipoNuevo = clasificarReceta(r)
    contadores[tipoNuevo] = (contadores[tipoNuevo] ?? 0) + 1
    if (r.tipo_receta !== tipoNuevo) {
      cambios.push({ id: r.id, nombre: r.nombre, anterior: r.tipo_receta, nuevo: tipoNuevo })
    }
  }

  console.log(`\nTotal recetas: ${recetas.length}`)
  console.log('Distribución propuesta:')
  Object.entries(contadores).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`))
  console.log(`\nCambios necesarios: ${cambios.length}`)

  if (DRY_RUN || !APLICAR) {
    console.log('\nPrimeros 10 cambios:')
    cambios.slice(0, 10).forEach(c =>
      console.log(`  [${c.anterior ?? 'NULL'} → ${c.nuevo}] ${c.nombre}`)
    )
    if (!APLICAR) {
      console.log('\nEjecuta con --aplicar para guardar los cambios.')
      return
    }
  }

  let ok = 0, err = 0
  for (let i = 0; i < cambios.length; i += 20) {
    const lote = cambios.slice(i, i + 20)
    for (const c of lote) {
      const { error: e } = await supabase
        .from('recetas')
        .update({ tipo_receta: c.nuevo })
        .eq('id', c.id)
      if (e) { console.error(`Error ${c.nombre}:`, e.message); err++ }
      else ok++
    }
    process.stdout.write(`\r  Progreso: ${ok + err}/${cambios.length}`)
  }

  console.log(`\n\n✅ Completado: ${ok} actualizadas, ${err} errores.`)
}

main().catch(e => { console.error(e); process.exit(1) })
