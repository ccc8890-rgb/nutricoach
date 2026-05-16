/**
 * limpiar-falsos-positivos.ts — Elimina falsos positivos reales de la BD
 *
 * Solo elimina productos que SABEMOS que no son comida (verificados).
 * No toca productos sospechosos no confirmados.
 *
 * Uso: npx tsx --env-file=.env.local scripts/limpiar-falsos-positivos.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

interface ProductoAEliminar {
    id: string
    nombre: string
    supermercado: string
    razon: string
}

async function main() {
    console.log('\n╔═══════════════════════════════════════════════════╗')
    console.log('║  LIMPIAR FALSOS POSITIVOS VERIFICADOS            ║')
    console.log('╚═══════════════════════════════════════════════════╝\n')

    // 1. Obtener supermercados
    const { data: supermercados } = await supabase
        .from('supermercados')
        .select('id, nombre, slug')
        .order('nombre')

    if (!supermercados?.length) { console.log('No hay supermercados.'); return }

    const smMap = new Map(supermercados.map(s => [s.id, s]))
    const aEliminar: ProductoAEliminar[] = []

    // 2. Buscar productos no comestibles VERIFICADOS
    const NO_COMESTIBLE = [
        'pájaro decorativo', 'pajaro decorativo',
    ]

    for (const sm of supermercados) {
        const { data: productos } = await supabase
            .from('productos_supermercado')
            .select('id, nombre_original, url_producto')
            .eq('supermercado_id', sm.id)

        if (!productos?.length) continue

        for (const p of productos) {
            const lower = (p.nombre_original ?? '').toLowerCase()
            const match = NO_COMESTIBLE.find(kw => lower.includes(kw))
            if (match) {
                aEliminar.push({
                    id: p.id,
                    nombre: p.nombre_original ?? '(sin nombre)',
                    supermercado: sm.nombre,
                    razon: `keyword: "${match}"`
                })
            }
        }
    }

    if (aEliminar.length === 0) {
        console.log('✅ No hay falsos positivos verificados que eliminar.')
        console.log('   (Los 17 detectados previamente eran comida real — sabor barbacoa, leche con colágeno, etc.)\n')
        return
    }

    console.log(`Se eliminarán ${aEliminar.length} productos:\n`)
    for (const p of aEliminar) {
        console.log(`  ❌ [${p.supermercado}] ${p.nombre} (${p.razon})`)
    }

    // 3. Eliminar de precios_historico y productos_supermercado
    console.log('\nEliminando...')
    for (const p of aEliminar) {
        // Eliminar de precios_historico
        await supabase
            .from('precios_historico')
            .delete()
            .eq('supermercado_id', supermercados.find(s => s.nombre === p.supermercado)?.id ?? '')
            .eq('nombre_producto', p.nombre)

        // Eliminar de productos_supermercado
        const { error } = await supabase
            .from('productos_supermercado')
            .delete()
            .eq('id', p.id)

        if (error) {
            console.log(`  ⚠️  Error eliminando "${p.nombre}": ${error.message}`)
        } else {
            console.log(`  ✅ Eliminado: ${p.nombre}`)
        }
    }

    console.log(`\n✅ ${aEliminar.length} falsos positivos eliminados correctamente.`)
}

main().catch(console.error)
