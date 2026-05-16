import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

const LIDL_UUID = '29d40fe3-c49d-40c9-b61b-5072f704ec35'

async function main() {
    // 1. Get all Lidl products
    const { data: productos, error: err1 } = await supabase
        .from('productos_supermercado')
        .select('alimento_id, precio_por_kg, precio_unidad, url_producto, nombre_original, marca, created_at')
        .eq('supermercado_id', LIDL_UUID)

    if (err1 || !productos) {
        console.error('Error fetching products:', err1)
        return
    }
    console.log('\n=== TOTAL PRODUCTOS LIDL:', productos.length, '===\n')

    // 2. Get alimento names
    const alimentoIds = productos.map(p => p.alimento_id)
    const { data: alimentos } = await supabase
        .from('alimentos')
        .select('id, nombre, categoria')
        .in('id', alimentoIds)

    const alimentoMap = new Map(alimentos?.map(a => [a.id, a]) ?? [])

    // 3. Distribution by category
    const catsMap: Record<string, number> = {}
    for (const p of productos) {
        const a = alimentoMap.get(p.alimento_id)
        const cat = a?.categoria ?? 'sin categoría'
        catsMap[cat] = (catsMap[cat] || 0) + 1
    }

    console.log('=== DISTRIBUCIÓN POR CATEGORÍA ===')
    Object.entries(catsMap)
        .sort(([, a], [, b]) => b - a)
        .forEach(([cat, count]) => {
            console.log(`  ${cat.padEnd(35)} ${count}`)
        })

    // 4. Suspicious non-food products
    const sospechosos: { nombre_original: string; alimento: string; categoria: string; precio: number }[] = []
    for (const p of productos) {
        const a = alimentoMap.get(p.alimento_id)
        if (!a) continue
        const nombre = a.nombre.toLowerCase()
        const orig = p.nombre_original?.toLowerCase() ?? ''
        const patrones = [
            'perro', 'gato', 'planta', 'jabón', 'limpiador', 'detergente',
            'vela', 'decoración', 'juguete', 'batería', 'pilas', 'bombilla',
            'cable', 'adaptador', 'fund(a|e)', 'cepillo', 'escoba',
            'fregona', 'cubo ', 'bolsa de basura', 'menaje', 'herramienta',
            'tijeras', 'cuchillo de cocina', 'cafetera', 'batidora',
            'freidora', 'microondas', 'plancha'
        ]
        if (patrones.some(p => new RegExp(p).test(nombre) || new RegExp(p).test(orig))) {
            sospechosos.push({
                nombre_original: p.nombre_original ?? a.nombre,
                alimento: a.nombre,
                categoria: a.categoria ?? '?',
                precio: p.precio_por_kg ?? 0
            })
        }
    }

    if (sospechosos.length > 0) {
        console.log('\n⚠️  POSIBLES FALSOS POSITIVOS (' + sospechosos.length + ')')
        console.log('  (revisar si son realmente no comestibles)')
        sospechosos.forEach(s => {
            console.log(`  ⚠️  [${s.categoria.padEnd(18)}] ${s.nombre_original.padEnd(50)} ${s.precio.toFixed(2)}€/kg`)
        })
    } else {
        console.log('\n✅ No se detectaron falsos positivos evidentes')
    }

    // 5. Random sample of 10
    console.log('\n=== MUESTRA ALEATORIA (10 productos) ===')
    const shuffled = [...productos].sort(() => Math.random() - 0.5).slice(0, 10)
    for (const p of shuffled) {
        const a = alimentoMap.get(p.alimento_id)
        if (!a) continue
        const precio = p.precio_por_kg ?? p.precio_unidad ?? 0
        console.log(`  ${(a.nombre).padEnd(40)} ${precio.toFixed(2).padStart(8)}€/kg  ${p.marca ?? '?'}  ${p.created_at?.slice(0, 10) ?? '?'}`)
    }

    // 6. Stats summary
    const conPrecio = productos.filter(p => p.precio_por_kg !== null).length
    const conUrl = productos.filter(p => p.url_producto).length
    const precios = productos.filter(p => p.precio_por_kg !== null).map(p => p.precio_por_kg!)
    const precioMin = Math.min(...precios)
    const precioMax = Math.max(...precios)
    const precioAvg = precios.reduce((a, b) => a + b, 0) / precios.length

    console.log('\n=== ESTADÍSTICAS ===')
    console.log(`  Productos con precio:       ${conPrecio}/${productos.length}`)
    console.log(`  Productos con URL:          ${conUrl}/${productos.length}`)
    console.log(`  Precio mínimo:              ${precioMin.toFixed(2)}€/kg`)
    console.log(`  Precio máximo:              ${precioMax.toFixed(2)}€/kg`)
    console.log(`  Precio promedio:            ${precioAvg.toFixed(2)}€/kg`)
}

main().catch(console.error)
