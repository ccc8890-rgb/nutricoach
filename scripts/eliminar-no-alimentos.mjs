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
  // Limpieza hogar
  'limpieza', 'bayeta', 'fregona', 'escoba', 'cubo con ruedas', 'mopa', 'rasqueta', 'desatascador', 'desinfectante',
  'lejía', 'cloro', 'alcohol 96', 'lavaparabrisas', 'bolsas basura', 'bolsas de basura', 'bolsas congelación',
  'multiusos ph neutro', 'pastillas desinfectantes', 'recambio mopa', 'disuelve manchas', '70% alcohol',
  'limpiagafas', 'cera multisuperficies', 'pastillas enciende',
  // Higiene personal
  'maquillaje', 'corrector', 'deliplus', 'rimmel', 'polvo suelto', 'perlas faciales', 'serum',
  'corrector fluido', 'corrector mate', 'antiarrugas', 'reafirmante',
  'biberón', 'chupete', 'tetina', 'cepillo limpiabiberón',
  'desodorante', 'antitranspirante', 'agua facial',
  'acondicionador', 'champú', 'champu', 'gel de ducha', 'gel de baño', 'gel de afeitar', 'espuma de afeitar',
  'loción corporal', 'aceite corporal', 'crema corporal', 'sorbete corporal', 'manteca corporal',
  'crema reductora', 'anticelulítico', 'tratamiento reductor', 'tratamiento para uñas',
  'laca de uñas', 'rizador de pestañas', 'máscara de pestañas', 'delineador de ojos', 'colorete',
  'parches para ojos', 'parches faciales', 'tiras faciales',
  'tónico facial', 'perlas faciales', 'sérum reductor', 'sérum reafirmante',
  'jabón de manos', 'pasta de dientes',
  'tampones', 'compresas', 'preservativo', 'preservativos',
  // Accesorios / hogar
  'mascarillas quirúrgicas', 'guantes de látex', 'protector cama', 'protectores para los oídos', 'pulsera de citronela',
  'sacapuntas', 'palo extensible', 'gamuzas', 'esponja de calzado', 'papel hogar', 'plato llano biodegradable',
  'posavajillas', 'pajitas', 'palillos redondos', 'recipiente de plástico', 'bandeja de cartón', 'molde de papel',
  'bandas adhesivas', 'cubo de hielo', 'cubos de hielo', 'estropajo', 'borrador mágico',
  // Mascotas / otros
  'gato adulto', 'caninos', 'delikuit', 'nuske', 'mascotas', 'animales',
  // Medicamentos / suplementos no alimentarios
  'kit analizador', 'roll-on alivio', 'lágrimas hidratantes', 'laxforte', 'cápsulas colagen', 'laxante',
  'cuquis', 'kit esencial', 'cápsulas lax', 'comprimidos vitaminas',
  // Marcas / referencias (solo marcas no alimentarias específicas)
  '3 brujas', 'aquachek', 'bosque verde', 'khanya', 'moldex',
  'higiene personal', 'cuidado personal', 'hogar', 'limpieza del hogar'
]

// Bebidas alcohólicas — se eliminan independientemente de las calorías
// Excepciones gestionadas por ALCOHOL_FOOD_EXCEPTIONS
const ALCOHOL_KEYWORDS = [
  // Cerveza (español + catalán)
  'cerveza', 'cervesa',
  // Vinos — solo cuando son la categoría principal del producto
  'vino tinto', 'vino blanco', 'vino rosado', 'vino espumoso', 'vino dulce',
  'vino de jerez', 'vino generoso', 'vino ecologico', 'vino ecológico',
  'vi negre', 'vi blanc', 'vi rosat', 'vi escumós', 'vi dolc', 'vi ranci',
  'caixa vi ', // cajas de vino (catalán)
  // Cava / espumosos
  'cava brut', 'cava semi', 'cava rosado', 'cava rosat', 'cava nature',
  'cava benjamín', 'cava pack',
  // Destilados
  'whisky', 'whiskey', 'bourbon',
  'vodka',
  'ginebra', ' gin ',
  'tequila', 'mezcal',
  'brandy', 'coñac', 'cognac',
  'amaretto', 'absenta', 'absinthe',
  'ron añejo', 'ron blanco', 'ron negro', 'ron dorado', 'ron de caña',
  // Licores
  'licor de café', 'licor de menta', 'licor de hierbas', 'licor de naranja',
  'licor de almendra', 'licor de anís', 'aperitivo licor',
  'anís seco', 'anís dulce', 'anisete',
  // Vinos fortificados / aperitivos
  'vermut', 'vermouth',
  'moscatel',
  'jerez fino', 'jerez oloroso', 'jerez amontillado',
  'oporto',
  // Champagne
  'champán', 'champagne',
  // Sidra alcohólica
  'sidra',
  // Combinados / RTD
  'sangría', 'sangria',
  'tinto de verano',
  'bebida preparada de ron', 'bebida preparada de vodka', 'bebida preparada de gin',
  'carajillo de ron',
]

// Si el nombre contiene alguna de estas frases, NO se elimina aunque tenga keyword de alcohol
// (son platos cocinados o alimentos que usan alcohol como ingrediente)
const ALCOHOL_FOOD_EXCEPTIONS = [
  'al vino', 'en vino', 'con vino', 'estofado', 'guiso',
  'al licor', 'bombones', 'trufas', 'pralinés',
  'al ron', 'flambead',
  'vinagre',   // vinagre no es alcohol
  'vitamina',  // vitamina no es vino
  'pasas',     // pasas moscatel son fruta seca
  'uva moscatel', 'uvas moscatel', // uvas de variedad moscatel
]

const KEEP_KEYWORDS = [
  'agua mineral', 'agua con gas', 'agua destilada', 'agua de soda', 'agua',
  'bicarbonato', 'colorante alimentario', 'edulcorante', 'gasificante', 'impulsor',
  'sal', 'cápsulas spirulina', 'spirulina', 'vitamina b12',
  'jabón con glicerina'
]

async function fetchAllAlimentos() {
  const todos = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('alimentos')
      .select('id, nombre, calorias')
      .range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    if (!data || data.length === 0) break
    todos.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return { data: todos, error: null }
}

function esAlcohol(nombre) {
  const n = nombre.toLowerCase()
  const tieneExcepcion = ALCOHOL_FOOD_EXCEPTIONS.some(ex => n.includes(ex))
  if (tieneExcepcion) return false
  return ALCOHOL_KEYWORDS.some(kw => n.includes(kw.toLowerCase()))
}

async function main() {
  const { data: alimentos, error: fetchError } = await fetchAllAlimentos()

  if (fetchError) {
    console.error('Error fetch:', fetchError.message)
    process.exit(1)
  }

  if (!alimentos || alimentos.length === 0) {
    console.log('✅ No hay alimentos para revisar')
    return
  }

  // Filtrar no-alimentos: solo los que tienen calorias=0
  const paraEliminarHigiene = alimentos.filter(a => {
    const nombre = a.nombre.toLowerCase()
    if ((a.calorias ?? 0) > 0) return false // no tocar alimentos ya enriquecidos por esta vía
    const tieneKeep = KEEP_KEYWORDS.some(kw => nombre.includes(kw.toLowerCase()))
    if (tieneKeep) return false
    return NO_ALIMENTOS_KEYWORDS.some(kw => nombre.includes(kw.toLowerCase()))
  })

  // Filtrar bebidas alcohólicas: todos los alimentos (con o sin calorías)
  const paraEliminarAlcohol = alimentos.filter(a => {
    if (paraEliminarHigiene.includes(a)) return false // ya marcado
    return esAlcohol(a.nombre)
  })

  const paraEliminar = [...paraEliminarHigiene, ...paraEliminarAlcohol]

  console.log(`📊 Análisis:`)
  console.log(`  Total alimentos en BD: ${alimentos.length}`)
  console.log(`  No-alimentos (higiene/hogar): ${paraEliminarHigiene.length}`)
  console.log(`  Bebidas alcohólicas: ${paraEliminarAlcohol.length}`)
  console.log(`  Total a eliminar: ${paraEliminar.length}`)

  if (paraEliminarAlcohol.length > 0) {
    console.log(`\n🍺 Bebidas alcohólicas a eliminar (primeros 30):`)
    paraEliminarAlcohol.slice(0, 30).forEach(a => console.log(`  - "${a.nombre}" (${a.calorias} kcal)`))
    if (paraEliminarAlcohol.length > 30) console.log(`  ... y ${paraEliminarAlcohol.length - 30} más`)
  }

  if (paraEliminarHigiene.length > 0) {
    console.log(`\n🧹 Higiene/hogar a eliminar:`)
    paraEliminarHigiene.forEach(a => console.log(`  - "${a.nombre}"`))
  }

  if (paraEliminar.length === 0) {
    console.log('\n✅ Ninguno para eliminar')
    return
  }

  const BATCH = 200

  // Excluir alimentos que están en recetas (no borrar ingredientes usados)
  console.log(`\n🔍 Verificando referencias en recetas...`)
  const idsParaEliminar = paraEliminar.map(a => a.id)
  const enRecetasAll = []
  for (let i = 0; i < idsParaEliminar.length; i += BATCH) {
    const chunk = idsParaEliminar.slice(i, i + BATCH)
    const { data } = await supabase
      .from('receta_ingredientes')
      .select('alimento_id')
      .in('alimento_id', chunk)
    if (data) enRecetasAll.push(...data)
  }
  const idsEnRecetas = new Set(enRecetasAll.map(r => r.alimento_id))
  if (idsEnRecetas.size > 0) {
    console.log(`  ⚠️  ${idsEnRecetas.size} alimentos excluidos por estar en recetas (se conservan)`)
    const nombresEnRecetas = paraEliminar.filter(a => idsEnRecetas.has(a.id)).map(a => a.nombre)
    nombresEnRecetas.forEach(n => console.log(`    - "${n}"`))
  }
  const ids = idsParaEliminar.filter(id => !idsEnRecetas.has(id))
  console.log(`  ✅ ${ids.length} alimentos elegibles para borrar`)

  if (ids.length === 0) {
    console.log('\n✅ Nada que borrar (todos están en recetas)')
    return
  }

  // Eliminar precios primero (en lotes)
  console.log(`\n⏳ Eliminando precios...`)
  let totalPrecios = 0
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const { error, count } = await supabase
      .from('productos_supermercado')
      .delete({ count: 'exact' })
      .in('alimento_id', chunk)
    if (error) { console.error('❌ Error eliminando precios:', error.message); process.exit(1) }
    totalPrecios += count || 0
  }
  console.log(`  ✅ ${totalPrecios} registros de precios eliminados`)

  // Eliminar de la cola de enriquecimiento
  console.log(`⏳ Eliminando de cola de enriquecimiento...`)
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    await supabase.from('alimentos_enriquecimiento_cola').delete().in('alimento_id', chunk)
  }
  console.log(`  ✅ Eliminados de la cola`)

  // Eliminar alimentos (en lotes)
  console.log(`⏳ Eliminando alimentos...`)
  let totalAlimentos = 0
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const { error, count } = await supabase
      .from('alimentos')
      .delete({ count: 'exact' })
      .in('id', chunk)
    if (error) { console.error('❌ Error eliminando alimentos:', error.message); process.exit(1) }
    totalAlimentos += count || 0
  }
  console.log(`  ✅ ${totalAlimentos} alimentos eliminados`)

  console.log(`\n✅ Limpieza completada: ${totalAlimentos} productos no alimentarios removidos`)
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message)
  process.exit(1)
})
