import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const NO_ALIMENTOS_KEYWORDS = [
  'limpieza', 'bayeta', 'fregona', 'escoba', 'cubo con ruedas', 'mopa', 'rasqueta', 'desatascador', 'desinfectante',
  'maquillaje', 'corrector', 'deliplus', 'rimmel', 'polvo suelto', 'perlas faciales', 'serum',
  'lejía', 'cloro', 'alcohol 96', 'lavaparabrisas', 'bolsas basura', 'bolsas de basura', 'bolsas congelación',
  'mascarillas quirúrgicas', 'guantes de látex', 'protector cama', 'protectores para los oídos', 'pulsera de citronela',
  'sacapuntas', 'palo extensible', 'gamuzas', 'esponja de calzado', 'papel hogar', 'plato llano biodegradable',
  'posavajillas', 'pajitas', 'palillos redondos', 'recipiente de plástico', 'bandeja de cartón', 'molde de papel',
  'bandas adhesivas', 'cubo de hielo', 'cubos de hielo',
  'gato adulto', 'caninos', 'delikuit', 'nuske', 'mascotas', 'animales',
  'kit analizador', 'roll-on alivio', 'lágrimas hidratantes', 'laxforte', 'cápsulas colagen', 'laxante',
  'pastillas enciende', 'cuquis', 'kit esencial', 'disuelve manchas', '70% alcohol',
  'multiusos ph neutro', 'pastillas desinfectantes', 'recambio mopa', 'cápsulas lax',
  'comprimidos vitaminas', 'tónico', 'crema', 'corrector fluido', 'corrector mate',
  'gel', 'hidratantes', 'topé', 'antiarrugas', 'reafirmante', 'concentrado',
  '3 brujas', 'yak', 'royal', 'aquachek', 'bosque verde', 'khanya', 'moldex',
  'higiene personal', 'cuidado personal', 'hogar', 'limpieza del hogar'
]

const KEEP_KEYWORDS = [
  'agua mineral', 'agua con gas', 'agua destilada', 'agua de soda', 'agua',
  'bicarbonato', 'colorante alimentario', 'edulcorante', 'gasificante', 'impulsor',
  'sal', 'cápsulas spirulina', 'spirulina', 'vitamina b12',
  'jabón con glicerina'
]

async function main() {
  const { data: alimentos, error: fetchError } = await supabase
    .from('alimentos')
    .select('id, nombre')
    .eq('calorias', 0)

  if (fetchError) {
    console.error('Error fetch:', fetchError.message)
    process.exit(1)
  }

  if (!alimentos || alimentos.length === 0) {
    console.log('✅ No hay alimentos con calorias=0 para revisar')
    return
  }

  // Filtrar: eliminar si tiene keywords NO-ALIMENTOS pero NO tiene KEEP-KEYWORDS
  const paraEliminar = alimentos.filter(a => {
    const nombre = a.nombre.toLowerCase()
    const tieneKeep = KEEP_KEYWORDS.some(kw => nombre.includes(kw.toLowerCase()))
    if (tieneKeep) return false // NUNCA eliminar si debe guardarse
    const tieneNoAlimento = NO_ALIMENTOS_KEYWORDS.some(kw => nombre.includes(kw.toLowerCase()))
    return tieneNoAlimento
  })

  console.log(`📊 Análisis:`)
  console.log(`  Total calorias=0: ${alimentos.length}`)
  console.log(`  Para eliminar: ${paraEliminar.length}`)

  if (paraEliminar.length > 0) {
    console.log(`\n🗑️  Productos a eliminar:`)
    paraEliminar.forEach(a => console.log(`  - "${a.nombre}"`))
  }

  const paraConservar = alimentos.filter(a => !paraEliminar.includes(a))
  if (paraConservar.length > 0) {
    console.log(`\n✅ Productos a conservar:`)
    paraConservar.forEach(a => console.log(`  - "${a.nombre}"`))
  }

  if (paraEliminar.length === 0) {
    console.log('\n✅ Ninguno para eliminar')
    return
  }

  const ids = paraEliminar.map(a => a.id)

  // Eliminar precios primero
  console.log(`\n⏳ Eliminando precios...`)
  const { error: e1, count: c1 } = await supabase
    .from('productos_supermercado')
    .delete()
    .in('alimento_id', ids)

  if (e1) {
    console.error('❌ Error eliminando precios:', e1.message)
    process.exit(1)
  }
  console.log(`  ✅ ${c1 || 0} registros de precios eliminados`)

  // Eliminar alimentos
  console.log(`⏳ Eliminando alimentos...`)
  const { error: e2, count: c2 } = await supabase
    .from('alimentos')
    .delete()
    .in('id', ids)

  if (e2) {
    console.error('❌ Error eliminando alimentos:', e2.message)
    process.exit(1)
  }
  console.log(`  ✅ ${c2 || 0} alimentos eliminados`)

  console.log(`\n✅ Limpieza completada: ${paraEliminar.length} productos no alimentarios removidos`)
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message)
  process.exit(1)
})
