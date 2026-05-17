/**
 * Script de test para verificar escandallo end-to-end
 * Llama directamente a Supabase con service role para testear la lógica
 *
 * Uso: npx tsx scripts/test-escandallo.ts
 *
 * NOTA: Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { createClient } from '@supabase/supabase-js'

import 'dotenv/config'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
    console.log('='.repeat(60))
    console.log('🧪 TEST ESCANDALLO END-TO-END')
    console.log('='.repeat(60))

    // 1. Verificar schema de clientes
    console.log('\n📋 1. SCHEMA DE CLIENTES')
    const { data: clientesRaw } = await supabase.from('clientes').select('*').limit(3)
    if (clientesRaw && clientesRaw.length > 0) {
        console.log('  Columnas disponibles:', Object.keys(clientesRaw[0]).join(', '))
        console.log('  Muestra:', JSON.stringify(clientesRaw[0], null, 4))
    } else {
        console.log('  ⚠️  No hay clientes en DB')
        // Intentar consulta sin restricciones
        const { count } = await supabase.from('clientes').select('*', { count: 'exact', head: true })
        console.log(`  Total registros: ${count ?? '?'}`)
    }

    // 2. Verificar planes_nutricion
    console.log('\n📋 2. PLANES NUTRICIÓN')
    const { data: planes } = await supabase.from('planes_nutricion').select('*').limit(5)
    if (planes && planes.length > 0) {
        console.log('  Columnas:', Object.keys(planes[0]).join(', '))
        planes.forEach(p => console.log(`  - ${p.nombre || 'sin nombre'} (activo: ${p.activo}, cliente: ${p.cliente_id})`))
    } else {
        console.log('  ⚠️  No hay planes')
        const { count } = await supabase.from('planes_nutricion').select('*', { count: 'exact', head: true })
        console.log(`  Total: ${count ?? '?'}`)
    }

    // 3. Verificar vista mejores_precios_por_alimento en detalle
    console.log('\n📊 3. VISTA mejores_precios_por_alimento — DIAGNÓSTICO')
    const { data: vistaCols } = await supabase.from('mejores_precios_por_alimento').select('*').limit(1)
    if (vistaCols && vistaCols.length > 0) {
        console.log('  Columnas:', Object.keys(vistaCols[0]).join(', '))
    }

    const { data: conteo, error: errConteo } = await supabase
        .from('mejores_precios_por_alimento')
        .select('supermercado_nombre')

    if (conteo) {
        const porSuper = new Map<string, number>()
        conteo.forEach(c => porSuper.set(c.supermercado_nombre, (porSuper.get(c.supermercado_nombre) || 0) + 1))
        console.log('\n  Conteo por supermercado:')
        for (const [nombre, total] of porSuper) console.log(`    ${nombre}: ${total}`)
        console.log(`  TOTAL: ${conteo.length}`)
    }

    // 4. Ver si hay productos NO comestibles en la vista
    console.log('\n🔍 4. PRODUCTOS SOSPECHOSOS (no comestibles)')
    const { data: muestra } = await supabase
        .from('mejores_precios_por_alimento')
        .select('alimento_nombre, producto_nombre_original, supermercado_nombre, precio_por_kg')
        .limit(30)

    if (muestra) {
        const sospechosas = ['gel', 'champú', 'chicle', 'crema', 'jabón', 'detergente', 'suavizante', 'cepillo', 'cuchilla', 'pañal', 'compresa', 'ambientador', 'lente', 'maquillaje', 'colonia', 'perfume', 'desodorante', 'pasta dentífrica', 'enjuague']
        muestra.forEach(p => {
            const esSospechoso = sospechosas.some(s => p.producto_nombre_original?.toLowerCase().includes(s))
            const icono = esSospechoso ? '⚠️' : '✅'
            console.log(`  ${icono} ${p.alimento_nombre?.padEnd(30)} → ${p.producto_nombre_original?.padEnd(40)} | ${p.supermercado_nombre}: ${p.precio_por_kg?.toFixed(2)} €/kg`)
        })
    }

    // 5. Simular cálculo con alimentos REALES (filtrar no comestibles manualmente)
    console.log('\n🧮 5. SIMULACIÓN CON ALIMENTOS REALES')

    // Buscar alimentos que SÍ son comida
    const terminosComida = ['pollo', 'huevo', 'arroz', 'leche', 'pan', 'aceite', 'tomate', 'manzana', 'plátano', 'yogur', 'queso', 'pasta', 'lenteja', 'garbanzo', 'atún', 'merluza', 'sal', 'azúcar', 'harina', 'cebolla', 'ajo', 'pimiento', 'zanahoria', 'patata', 'fresa', 'naranja', 'limón']

    for (const termino of terminosComida) {
        const { data: alimentos } = await supabase
            .from('mejores_precios_por_alimento')
            .select('*')
            .ilike('alimento_nombre', `%${termino}%`)
            .limit(5)

        if (alimentos && alimentos.length > 0) {
            const primerAlimento = alimentos[0]
            console.log(`\n  🥩 ${primerAlimento.alimento_nombre} (${primerAlimento.supermercado_nombre}): ${primerAlimento.precio_por_kg?.toFixed(2)} €/kg`)
            if (alimentos.length > 1) {
                alimentos.slice(1).forEach(a => console.log(`     También en ${a.supermercado_nombre}: ${a.precio_por_kg?.toFixed(2)} €/kg`))
            }
        }
    }

    // 6. Construir simulación realista de un plan de 1 día
    console.log('\n\n🍽️  6. SIMULACIÓN PLAN 1 DÍA (con datos reales de Supabase)')

    const alimentosPlan = [
        { nombre: 'huevo', gramos: 100, categoria: 'Proteinas' },
        { nombre: 'arroz', gramos: 150, categoria: 'Carbohidratos' },
        { nombre: 'pollo', gramos: 200, categoria: 'Proteinas' },
        { nombre: 'aceite', gramos: 15, categoria: 'Grasas' },
        { nombre: 'manzana', gramos: 200, categoria: 'Frutas' },
        { nombre: 'leche', gramos: 200, categoria: 'Lacteos' },
        { nombre: 'pan', gramos: 80, categoria: 'Carbohidratos' },
        { nombre: 'tomate', gramos: 100, categoria: 'Verduras' },
    ]

    // Para Consum (el que más datos tiene)
    const consumId = '965e60c1-8030-4fbe-a44a-0214bce61781'
    const mercadonaId = '7a742169-14dd-4a61-b4d0-b7af7f20a182'

    for (const [superId, superNombre] of [[consumId, 'Consum'], [mercadonaId, 'Mercadona']]) {
        console.log(`\n  📍 Supermercado: ${superNombre}`)
        let total = 0

        for (const al of alimentosPlan) {
            const { data: precios } = await supabase
                .from('mejores_precios_por_alimento')
                .select('*')
                .eq('supermercado_id', superId)
                .ilike('alimento_nombre', `%${al.nombre}%`)
                .limit(1)

            if (precios && precios.length > 0) {
                const p = precios[0]
                // Filtrar no comestibles
                if (p.producto_nombre_original?.toLowerCase().includes('gel') ||
                    p.producto_nombre_original?.toLowerCase().includes('chicle')) {
                    console.log(`    ⚠️  ${al.nombre}: producto sospechoso "${p.producto_nombre_original}" — ignorando`)
                    continue
                }
                const coste = (al.gramos / 1000) * (p.precio_por_kg || 0)
                total += coste
                console.log(`    ✅ ${al.nombre.padEnd(10)} ${al.gramos}g × ${(p.precio_por_kg || 0).toFixed(2)} €/kg = ${coste.toFixed(2)} € (${p.producto_nombre_original})`)
            } else {
                // Buscar en otro supermercado o sin filtro
                const { data: fallback } = await supabase
                    .from('mejores_precios_por_alimento')
                    .select('*')
                    .ilike('alimento_nombre', `%${al.nombre}%`)
                    .limit(1)

                if (fallback && fallback.length > 0) {
                    console.log(`    ❌ ${al.nombre}: sin precio en ${superNombre} (sí en ${fallback[0].supermercado_nombre}: ${fallback[0].precio_por_kg?.toFixed(2)} €/kg)`)
                } else {
                    console.log(`    ❌ ${al.nombre}: sin precio en ningún supermercado`)
                }
            }
        }
        console.log(`    ─────────────────────────`)
        console.log(`    🏆 TOTAL ${superNombre}: ${total.toFixed(2)} €/día → ${(total * 7).toFixed(2)} €/semana`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ TEST COMPLETADO')
    console.log('='.repeat(60))
}

main().catch(console.error)
