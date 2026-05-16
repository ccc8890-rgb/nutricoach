/**
 * Script de limpieza de no-comestibles v2.
 * A diferencia de la v1, escanea TODOS los alimentos (no solo calorias=0),
 * porque DeepSeek puede haber asignado macros incorrectos a productos no alimentarios.
 *
 * USO:
 *   node scripts/limpiar-no-comestibles-v2.mjs             --dry-run (por defecto)
 *   node scripts/limpiar-no-comestibles-v2.mjs --aplicar   elimina de verdad
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
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

const APLICAR = process.argv.includes('--aplicar')

// ─── Keywords de no-comestibles (incluye items que pueden tener calorías asignadas por error) ───

const NO_COMESTIBLE_KEYWORDS = [
  // Filtros y accesorios de café
  'filtro de café', 'filtros de café', 'filtro cafe', 'filtros cafe',
  'papel filtro', 'filtro papel', 'cápsulas compatibles nespresso',
  'cápsulas dolce gusto', 'capsulas compatibles', 'capsula compatible',
  'vaso de papel', 'vasos de papel', 'vaso termico',
  // Papel y embalaje
  'papel higiénico', 'papel de cocina', 'papel aluminio', 'film transparente',
  'papel vegetal', 'papel de horno', 'papel encerado', 'bolsa de papel',
  'bolsa congelación', 'bolsas congelación', 'bolsa basura', 'bolsas basura',
  'bolsas de basura', 'bolsa zip', 'bolsas zip', 'papel para envolver',
  'servilleta de papel', 'servilletas de papel', 'pañuelo de papel', 'pañuelos de papel',
  'rollo de cocina', 'rollos de cocina', 'papel tissue',
  'bandeja de aluminio', 'molde desechable', 'molde de aluminio',
  'film de plástico', 'papel kraft', 'bolsa kraft',
  // Limpieza hogar
  'lejía', 'limpiador', 'desengrasante', 'quitamanchas',
  'detergente ropa', 'detergente lavadora', 'suavizante ropa', 'suavizante lavadora',
  'pastillas lavavajillas', 'gel lavavajillas', 'sal lavavajillas',
  'limpiahogar', 'limpiavidrios', 'limpiagafas', 'lavaparabrisas',
  'bayeta', 'estropajo', 'fregona', 'escoba', 'mopa', 'fregosuelo',
  'ambientador', 'difusor ambientador', 'varillas ambientador',
  'insecticida', 'trampa ratas', 'trampa cucarachas', 'raticida',
  'borrador mágico', 'cera multisuperficies', 'sosa cáustica',
  'alcohol 96', 'agua oxigenada sanitaria', 'amoniaco', 'acetona',
  'pastillas enciende', 'pastillas encender',
  'desatascador', 'desinfectante hogar', 'desinfectante superficies',
  'spray desinfectante', 'recambio mopa', 'cubo de fregar',
  'esponja cocina', 'guantes limpieza', 'guantes fregona',
  // Higiene personal
  'champú', 'champu', 'acondicionador cabello', 'mascarilla capilar',
  'gel de ducha', 'gel ducha', 'gel de baño',
  'desodorante', 'antitranspirante', 'colonia', 'perfume',
  'crema corporal', 'loción corporal', 'sorbete corporal', 'manteca corporal',
  'aceite corporal', 'crema reductora', 'anticelulítico', 'tratamiento reductor',
  'crema facial', 'sérum facial', 'contorno de ojos', 'parches para ojos',
  'gel de afeitar', 'espuma de afeitar', 'aftershave', 'maquinilla afeitar',
  'pasta de dientes', 'cepillo de dientes', 'enjuague bucal', 'hilo dental',
  'jabón de manos', 'jabón en barra higiene', 'champú seco',
  'tampón', 'tampones', 'compresas', 'salvaslip', 'copa menstrual',
  'preservativo', 'preservativos', 'lubricante sexual',
  'pañal', 'pañales', 'toallitas bebé', 'biberón', 'chupete', 'tetina',
  'cepillo limpiabiberón',
  'maquillaje', 'colorete', 'base de maquillaje', 'corrector maquillaje',
  'máscara de pestañas', 'delineador de ojos', 'sombra de ojos',
  'laca de uñas', 'esmalte de uñas', 'tratamiento uñas',
  'rizador de pestañas', 'rizador de pelo', 'plancha de pelo',
  'sérum capilar', 'mascarilla facial', 'tónico facial',
  // Accesorios y utensilios
  'palillos de dientes', 'mondadientes', 'palillo redondo',
  'pajita', 'pajitas', 'cañitas',
  'recipiente plástico', 'táper', 'fiambrera', 'tupper',
  'bandeja cartón', 'plato de cartón', 'plato desechable',
  'cubiertos desechables', 'tenedor desechable', 'cuchara desechable',
  'vela aromática', 'velas aromáticas', 'difusor esencia', 'palo extensible',
  'soporte móvil', 'funda móvil', 'cable cargador',
  'pulsera mosquitera', 'pulsera citronela', 'repelente mosquitos spray',
  'cubo de hielo plástico', 'molde hielo',
  // Mascotas
  'pienso', 'alimento para gato', 'alimento para perro',
  'comida para gato', 'comida para perro', 'comida gato', 'comida perro',
  'snack para perro', 'snack para gato', 'arena para gato', 'arenilla gato',
  'cama para gato', 'cama para perro', 'juguete mascota',
  // Medicamentos / parafarmacia
  'comprimidos', 'pastillas antiácidas', 'laxante',
  'lágrimas hidratantes', 'colirio', 'suero fisiológico nasal',
  'tiras reactivas', 'kit analizador glucosa', 'medidor tensión',
  // Marcas/referencias no alimentarias específicas
  'bosque verde', 'deliplus',
]

// ─── Keywords que NUNCA eliminar (pueden sonar como no-comestibles pero lo son) ───

const KEEP_KEYWORDS = [
  'agua mineral', 'agua con gas', 'agua sin gas', 'agua destilada',
  'agua de soda', 'agua tónica', 'agua de coco', 'agua de azahar',
  'bicarbonato sódico', 'bicarbonato', 'colorante alimentario',
  'edulcorante', 'levadura', 'gasificante', 'impulsor para repostería',
  'sal marina', 'sal fina', 'sal gruesa', 'sal ahumada', 'flor de sal',
  'cápsulas de café', 'café en cápsulas', 'café soluble', 'café molido',
  'cápsulas spirulina', 'spirulina', 'clorela',
  'vitamina b12', 'vitamina d', 'vitamina c', 'omega 3',
  'proteína en polvo', 'whey protein', 'proteína whey',
  'crema de cacao', 'crema de avellanas',
  'aceite esencial alimentario', 'aceite de orégano',
  'vinagre de manzana', 'vinagre balsámico',
  'guantes cocina', 'guantes horno',
  'papel sulfurizado', 'papel de horno antiadherente',
  'caldo en pastilla', 'pastilla de caldo',
  'azúcar de caña', 'azúcar moreno',
  'bollería', 'pastelería', 'repostería',
  'extracto de vainilla', 'esencia de vainilla',
  'aceite de coco', 'aceite de palma',
  'queso servilleta',   // Queso español drenado en tela de servilleta
  'paté', 'pate',       // Paté es comida aunque venga en monodosis
  'mermelada',          // Mermelada monodosis es comida
  'crema agria', 'crema de leche',
  'gelatina sin sabor', 'gelatina alimentaria',
]

// ─── Funciones ───────────────────────────────────────────────────────────────

function esNoComestible(nombre) {
  const lower = nombre.toLowerCase()
  const tieneKeep = KEEP_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()))
  if (tieneKeep) return false
  return NO_COMESTIBLE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()))
}

async function fetchTodos() {
  const todos = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('alimentos')
      .select('id, nombre, calorias, categoria')
      .range(from, from + pageSize - 1)
      .order('nombre')
    if (error) return { data: null, error }
    if (!data || data.length === 0) break
    todos.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return { data: todos, error: null }
}

async function main() {
  console.log('🧹 LIMPIEZA DE NO-COMESTIBLES v2')
  console.log(`📋 Modo: ${APLICAR ? '⚠️  APLICAR (borrará de BD)' : '🔍 DRY RUN (solo muestra)'}\n`)

  const { data: alimentos, error } = await fetchTodos()
  if (error) { console.error('❌ Error:', error.message); process.exit(1) }

  console.log(`📊 Total alimentos en BD: ${alimentos.length}`)

  const paraEliminar = alimentos.filter(a => esNoComestible(a.nombre))

  if (paraEliminar.length === 0) {
    console.log('✅ No se detectaron no-comestibles.')
    return
  }

  console.log(`\n🗑️  Detectados ${paraEliminar.length} no-comestibles:\n`)
  paraEliminar.forEach(a =>
    console.log(`  - [${a.categoria}] "${a.nombre}" (${a.calorias} kcal)`)
  )

  if (!APLICAR) {
    console.log(`\n💡 Para eliminarlos: node scripts/limpiar-no-comestibles-v2.mjs --aplicar`)
    return
  }

  const ids = paraEliminar.map(a => a.id)

  // Eliminar precios asociados
  const { count: c1 } = await supabase
    .from('productos_supermercado')
    .delete()
    .in('alimento_id', ids)
  console.log(`\n✅ ${c1 ?? 0} registros de precios eliminados`)

  // Eliminar alimentos
  const { error: e2, count: c2 } = await supabase
    .from('alimentos')
    .delete()
    .in('id', ids)
  if (e2) { console.error('❌ Error eliminando:', e2.message); process.exit(1) }
  console.log(`✅ ${c2 ?? 0} no-comestibles eliminados de la BD`)
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1) })
