/**
 * Script de limpieza masiva de categorías.
 * Ejecuta updates individuales por categoría via REST API.
 * 
 * Uso: npx tsx scripts/run-fix-categorias.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function patchCat(nuevaCat: string, catActual: string): Promise<number> {
  const { error } = await supabase
    .from('alimentos')
    .update({ categoria: nuevaCat })
    .eq('categoria', catActual)
    .eq('es_comestible', true)
  if (error) { console.error(`  ❌ ${catActual} -> ${nuevaCat}: ${error.message}`); return 0 }
  return 0
}

async function patchNoCom(categoria: string): Promise<number> {
  const { error } = await supabase
    .from('alimentos')
    .update({ es_comestible: false })
    .eq('categoria', categoria)
    .eq('es_comestible', true)
  if (error) { console.error(`  ❌ ${categoria}: ${error.message}`); return 0 }
  return 0
}

async function countCat(cat: string): Promise<number> {
  const { count } = await supabase
    .from('alimentos')
    .select('*', { count: 'exact', head: true })
    .eq('categoria', cat)
    .eq('es_comestible', true)
  return count ?? 0
}

async function main() {
  console.log('==========================================')
  console.log(' LIMPIEZA MASIVA DE CATEGORÍAS')
  console.log('==========================================')

  // ─── BLOQUE 0: ACEITUNAS de Pescados → Condimentos ───
  console.log('\n📌 ACEITUNAS mal categorizadas:')
  const { data: aceitunas } = await supabase
    .from('alimentos')
    .update({ categoria: 'Condimentos' })
    .eq('categoria', 'Pescados')
    .eq('es_comestible', true)
    .or('nombre.ilike.%aceituna%,nombre.ilike.%olivada%')
    .select('id')
  if (aceitunas?.length) console.log(`  ✅ ${aceitunas.length} aceitunas → Condimentos`)

  // ─── BLOQUE 1: NO COMESTIBLES ───
  const NO_COMESTIBLES = [
    'Bazar', 'Absorbe olores y antihumedad', 'Aditivos para el lavado',
    'Antical', 'Anti hormigas y cucarachicidas', 'Arenas e higiene',
    'Barbacoa, carbón y encendido', 'Bolsas de conservación', 'Botiquín',
    'Cepillos de dientes', 'Cepillos y esponjas', 'Cera ', 'Cera suelos',
    'Complementos higiene', 'Cubiertos, vajilla y mantel', 'Cuchilla',
    'Detergente lavado a mano', 'Encendedores, velas y carbón', 'Esponjas',
    'Espuma y laca', 'Herméticos y moldes', 'Multiusos y otros',
    'Papel y bolsas de conservación', 'Pañuelos', 'Pilas', 'Planchado',
    'Quitamanchas', 'Rollo cocina', 'Servilletas', 'Tratamiento piscina',
    'Activador y antical lavadora', 'Aerosol spray o pistola',
    'Ambientador eléctrico', 'Bandas protectoras adhesivas', 'Algodón',
    'A mano y jabón común', 'Aseo íntimo', 'Aseo y cuidado', 'After shave',
    'Body-lociones', 'Brillos', 'Crema de cara', 'Crema pies',
    'Crema y gel de cara', 'Cuidado de uñas y complementos', 'Lotes mujer',
    'Perfumes y colonias', 'Retoca raíces y otros', 'Sérum y otros',
    'Sérum y ampollas', 'Arreglos', 'Alimentación húmeda',
  ]
  console.log('\n📌 MARCANDO NO COMESTIBLES:')
  for (const cat of NO_COMESTIBLES) {
    const n = await countCat(cat)
    if (n > 0) {
      await patchNoCom(cat)
      console.log(`  ✅ ${cat}: ${n} → no comestible`)
    }
  }

  // ─── BLOQUE 2: RE-CATEGORIZAR ───
  console.log('\n📌 RE-CATEGORIZANDO:')

  const MAPS: [string, string[]][] = [
    ['Condimentos', ['Aceitunas con hueso', 'Aceitunas sin hueso', 'Banderillas y cocktails']],
    ['Dulces y bollería', [
      'Bombones', 'Tarrinas', 'Granizados y helados de hielo', 'Cremas de untar', 'Cucuruchos',
      'Bollería envasada', 'Bollería dulce', 'Bollería rellena y donuts', 'Bollería salada',
      'Pastelitos surtidos', 'Pastelitos', 'Magdalenas', 'Tartas y bizcochos', 'Cocas y bizcochos',
      'Barras de helado y barquillos', 'Barritas y galletas', 'Galletas surtidas',
      'Con chocolate y rellenas', 'Chocolate a la taza', 'Chocolate con leche', 'Chocolatinas',
      'Berlinas', 'Bloques, tartas y Nata', 'Tortitas', 'Hojaldres', 'Cremas de desayuno',
    ]],
    ['Frutas deshidratadas', ['Fruta desecada', 'Frutas en almíbar y en su jugo']],
    ['Bebidas', [
      'Infusiones', 'Té', 'Lima limón', 'Tónica y bitter', 'Bitter y ginger ale', 'Energético',
      'Otros licores', 'Vino lambrusco y espumoso', 'Cafés refrigerados', 'Café Grano',
      'Café Molido descafeinado', 'Café Molido mezcla', 'Café Molido natural',
      'Bebidas refrescantes', 'Agua con gas', 'Agua con sabores', 'Bebidas vegetales',
      'Bífidus', 'Bífidus de sabores',
    ]],
    ['Pescados', ['Sardinas', 'Atún y bonito', 'Base pescado', 'Pescado', 'Trucha', 'Salazones', 'Berberechos y almejas']],
    ['Mariscos', ['Almejas, berberechos y navajas']],
    ['Pan y cereales', ['Pan rebanado', 'Barra de pan', 'Pan de bocadillo', 'Pan tostado', 'Pan rallado', 'Picatostes', 'Galletas saladas', 'Barritas de cereales']],
    ['Platos preparados', ['Caldo liquido', 'Caldo líquido', 'Caldo en pastillas', 'Sopas en sobre', 'Fideos y sopas', 'Platos calientes', 'Pizzas refrigeradas', 'Platos de cuchara', 'Base de pizza', 'Hummus y otros', 'Empanados y elaborados', 'Hamburguesas']],
    ['Snacks', ['Patatas fritas', 'Maíz tostado y cocktail', 'Snacks y otros aperitivos']],
    ['Frutas frescas', ['Otras frutas', 'Melón y sandía', 'Piña', 'Fruta', 'Tarritos de fruta', 'Cítricos']],
    ['Verduras y hortalizas', ['Calabacín y pimiento', 'Cebolla y ajo', 'Otras verduras y hortalizas', 'Tomate natural', 'Conservas verdura', 'Setas y champiñones']],
    ['Carnes', ['Cerdo', 'Pavo y otras aves', 'Aves']],
    ['Lácteos', ['Leche', 'Leche desnatada', 'Leche Infantil', 'Yogures desnatados', 'Queso fresco', 'Queso especialidades', 'Postres de soja', 'Otros postres']],
    ['Arroces y pastas', ['Arroz especial', 'Arroz', 'Arroz cocido', 'Pasta', 'Pasta fresca', 'Pasta al huevo', 'Pasta sin gluten', 'Pasta ensaladas', 'Spaghetti y tallarines', 'Masas']],
    ['Condimentos', ['Especias', 'Otras especias', 'Ketchup', 'Mayonesa', 'Allioli', 'Mermelada', 'Salsas', 'Otras salsas', 'Salsas frías', 'Vinagre y aliños', 'Sazonadores', 'Azúcar', 'Edulcorantes', 'Resto de encurtidos', 'Levadura y preparado repostería', 'Paté']],
    ['Frutos secos y semillas', ['Nueces', 'Otros frutos secos', 'Frutos Secos']],
    ['Aceites y grasas', ['Aceite de oliva intenso y suave', 'Aceite de oliva virgen', 'Aceites y Grasas']],
  ]

  for (const [nuevaCat, cats] of MAPS) {
    for (const cat of cats) {
      const n = await countCat(cat)
      if (n > 0) {
        await patchCat(nuevaCat, cat)
        console.log(`  ✅ ${cat} (${n}) → ${nuevaCat}`)
      }
    }
  }

  // ─── BLOQUE 3: SUPERMERCADO ───
  console.log('\n📌 LIMPIANDO SUPERMERCADO:')

  const superRecats: [string, string][] = [
    ['Bebidas', 'agua'], ['Bebidas', 'zumo'], ['Bebidas', 'cola'],
    ['Verduras y hortalizas', 'calabacín'], ['Verduras y hortalizas', 'cebolla'],
    ['Verduras y hortalizas', 'tomate'], ['Verduras y hortalizas', 'lechuga'],
    ['Verduras y hortalizas', 'espárrago'], ['Verduras y hortalizas', 'esparrago'],
    ['Verduras y hortalizas', 'berenjena'], ['Verduras y hortalizas', 'pimiento'],
    ['Verduras y hortalizas', 'zanahoria'], ['Verduras y hortalizas', 'acelga'],
    ['Verduras y hortalizas', 'espinaca'], ['Verduras y hortalizas', 'brócoli'],
    ['Verduras y hortalizas', 'brocoli'], ['Verduras y hortalizas', 'calabaza'],
    ['Frutas frescas', 'manzana'], ['Frutas frescas', 'pera'],
    ['Frutas frescas', 'plátano'], ['Frutas frescas', 'platano'],
    ['Frutas frescas', 'naranja'], ['Frutas frescas', 'fresa'],
    ['Frutas frescas', 'kiwi'], ['Frutas frescas', 'limón'],
    ['Frutas frescas', 'limon'], ['Frutas frescas', 'mango'],
    ['Frutas frescas', 'aguacate'], ['Frutas frescas', 'melón'],
    ['Frutas frescas', 'melon'], ['Frutas frescas', 'sandía'],
    ['Frutas frescas', 'sandia'], ['Carnes', 'jamón'], ['Carnes', 'jamon'],
    ['Carnes', 'pollo'], ['Carnes', 'ternera'], ['Carnes', 'cerdo'],
    ['Carnes', 'pavo'], ['Pescados', 'merluza'], ['Pescados', 'bacalao'],
    ['Pescados', 'salmón'], ['Pescados', 'salmon'], ['Pescados', 'atún'],
    ['Pescados', 'atun'],
  ]

  for (const [nuevaCat, keyword] of superRecats) {
    const { data } = await supabase
      .from('alimentos')
      .update({ categoria: nuevaCat })
      .eq('categoria', 'Supermercado')
      .eq('es_comestible', true)
      .ilike('nombre', `%${keyword}%`)
      .select('id')
    if (data?.length) console.log(`  ✅ Supermercado "${keyword}" (${data.length}) → ${nuevaCat}`)
  }

  // Lo que quede sin kcal → no comestible
  const { data: superResto } = await supabase
    .from('alimentos')
    .update({ es_comestible: false })
    .eq('categoria', 'Supermercado')
    .eq('es_comestible', true)
    .or('calorias.is.null,calorias.eq.0')
    .select('id')
  if (superResto?.length) console.log(`  ✅ Supermercado sin kcal (${superResto.length}) → no comestible`)

  // ─── BLOQUE 4: CATEGORÍAS INVÁLIDAS RESTANTES ───
  console.log('\n📌 LIMPIANDO CATEGORÍAS INVÁLIDAS RESTANTES:')

  const VALIDAS = [
    'Carnes', 'Pescados', 'Huevos', 'Lácteos', 'Verduras', 'Frutas', 'Legumbres',
    'Cereales', 'Tubérculos', 'Grasas', 'Frutos secos', 'Semillas', 'Condimentos',
    'Bebidas', 'Suplementos', 'Otros', 'Supermercado', 'Carnes blancas', 'Carnes rojas',
    'Pescado blanco', 'Pescado azul', 'Mariscos', 'Lácteos enteros', 'Lácteos semidesnatados',
    'Lácteos desnatados', 'Verduras y hortalizas', 'Patatas y tubérculos',
    'Frutos secos y semillas', 'Aceites y grasas', 'Salsas y condimentos',
    'Dulces y bollería', 'Frutas frescas', 'Frutas deshidratadas', 'Pan y cereales',
    'Arroces y pastas', 'Platos preparados', 'Snacks',
  ]

  // Sacar las categorías que aún son comestibles y no están en la lista
  const { data: restantes } = await supabase
    .from('alimentos')
    .select('categoria')
    .eq('es_comestible', true)

  const catsRestantes = [...new Set((restantes ?? []).map(r => r.categoria).filter(Boolean))]
    .filter(c => !VALIDAS.includes(c))

  for (const cat of catsRestantes) {
    const n = await countCat(cat)
    if (n > 0) {
      await patchNoCom(cat)
      console.log(`  ✅ ${cat} (${n}) → no comestible`)
    }
  }

  // ─── RESUMEN ───
  console.log('\n═══════════════════════════════════════')
  console.log('✅ LIMPIEZA COMPLETADA')
  console.log('═══════════════════════════════════════')
}

main().catch(console.error)
