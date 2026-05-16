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

// ⚠️ Mantener sincronizado con lib/scraping/index.ts → NO_COMESTIBLE_KEYWORDS
const NO_ALIMENTOS_KEYWORDS = [
  // Higiene personal
  'champú', 'champu', 'acondicionador', 'mascarilla capilar', 'sérum capilar',
  'gel de ducha', 'gel ducha', 'desodorante', 'antitranspirante', 'colonia',
  'crema corporal', 'loción corporal', 'sorbete corporal', 'manteca corporal',
  'aceite corporal', 'crema reductora', 'anticelulítico', 'tratamiento reductor',
  'crema facial', 'sérum facial', 'contorno de ojos', 'parches para ojos',
  'gel de afeitar', 'espuma de afeitar', 'aftershave', 'after shave', 'maquinilla',
  'pasta de dientes', 'dentifrico', 'dentífrico', 'cepillo de dientes', 'enjuague bucal', 'hilo dental',
  'jabón de manos', 'champú seco',
  'tampón', 'tampones', 'compresas', 'salvaslip', 'protegeslip', 'copa menstrual',
  'preservativo', 'preservativos', 'lubricante sexual',
  'pañal', 'pañales', 'toallitas bebé', 'biberón', 'chupete', 'tetina', 'cepillo limpiabiberón',
  'maquillaje', 'colorete', 'corrector maquillaje', 'base de maquillaje',
  'máscara de pestañas', 'delineador de ojos', 'sombra de ojos',
  'laca de uñas', 'tratamiento para uñas', 'rizador de pestañas',
  // Cosmética / belleza
  'aftersun', 'after sun', 'agua micelar', 'agua facial', 'agua de peinado',
  'bálsamo labial', 'balsamo labial', 'protector labial',
  'barra labios', 'pintalabios', 'labial ',
  'body spray', 'body mist', 'body lotion', 'body milk',
  'antiestrias', 'anti-estrias', 'antiestrías',
  'protector solar', 'crema solar', 'spray solar', 'spf ',
  'sérum cabello', 'serum cabello', 'ampollas capilares', 'ampollas cabello',
  'ampollas tratamiento', 'ampollas flash',
  'aclarante cabello', 'tinte cabello', 'decolorante cabello',
  'mascarilla facial', 'exfoliante facial', 'desmaquillante',
  'bastoncillos', 'algodón hidrófilo', 'algodón mágico',
  'bandas depilatorias', 'cera depilatoria', 'crema depilatoria',
  'alicate uñas', 'lima uñas', 'cortauñas',
  'espuma cabello', 'fijador cabello',
  'aplicador sombra', 'autobronceador', 'locion reafirmante',
  // Sanidad / farmacia
  'apósitos', 'apositos', 'tiritas', 'vendas',
  'suero fisiológico', 'ampollas suero',
  'arcos dentales', 'irrigador dental',
  'laxante', 'laxforte',
  'lentes de contacto', 'lágrimas hidratantes', 'lagrimas hidratantes',
  'clorhexidina',
  // Limpieza hogar
  'lejía', 'limpiador', 'limpiacristales', 'desengrasante', 'quitamanchas ropa',
  'detergente ropa', 'suavizante ropa', 'pastillas lavavajillas', 'gel lavavajillas',
  'limpiahogar', 'limpiavidrios', 'limpiagafas', 'lavaparabrisas',
  'bayeta', 'estropajo', 'fregona', 'bolsa basura', 'bolsas basura',
  'papel higiénico', 'papel de cocina', 'papel aluminio', 'film transparente',
  'ambientador', 'difusor ambientador', 'insecticida', 'trampa ratas',
  'borrador mágico', 'cera multisuperficies', 'sosa cáustica',
  'alcohol 96', 'agua oxigenada', 'amoniaco',
  'abrillantador', 'quitagrasas', 'desincrustante', 'posavajillas',
  'rasqueta', 'multiusos', 'disuelve manchas', 'limpiajuntas', 'desatascador',
  'escoba', 'escobilla', 'plumero', 'recogedor', 'fregasuelos',
  'absorbeolores', 'antipolilla', 'antipolillas',
  'repelente insectos', 'repelente mosquitos', 'citronela colgador',
  'aditivo textil', 'desinfectante textil', 'quitamanchas desinfectante',
  'recambio mopa', 'limpia mopas', 'gamuzas',
  'blanqueador juntas',
  // Menaje / descartables
  'cuaderno', 'bolígrafo', 'boligrafo', 'pilas', 'bombilla',
  'guantes desechables', 'mascarillas quirúrgicas', 'cubrecalzado',
  'bandeja cartón', 'bandeja carton', 'bol biodegradable', 'plato biodegradable',
  'cubiertos desechables', 'pajitas', 'bolsa isotérmica', 'bolsas reutilizables',
  'barreño', 'sacapuntas', 'almohadilla inferior',
  // Mascotas
  'arena gatos', 'arena para gato', 'pienso', 'comida para gato', 'comida para perro',
  'aritos perro', 'cepillo mascotas', 'toallitas mascotas', 'empapadores mascotas',
  'lecho mascotas', 'pinza animales',
  // Bebé no alimenticio
  'bañador desechable', 'banador desechable', 'babero desechable', 'anillo denticion',
  // Aparatos eléctricos
  'aparato eléctrico', 'aparato ectrico', 'aparato ecttrico', 'recambio eléctrico',
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
