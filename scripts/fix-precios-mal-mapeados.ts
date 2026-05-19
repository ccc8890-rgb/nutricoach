/**
 * fix-precios-mal-mapeados.ts — Corrección retroactiva (TODOS los supermercados)
 *
 * BUG: precio_actual guardado en precio_por_kg en vez de precio_unidad.
 * Ahora arreglamos TODOS los supermercados.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const CONCURRENCIA = 50

async function fixTable(
    table: 'productos_supermercado' | 'precios_historico',
    supermercadoId: string,
    nombre: string
): Promise<number> {
    const { data: rows, error } = await supabase
        .from(table)
        .select('id, precio_por_kg')
        .eq('supermercado_id', supermercadoId)
        .is('precio_unidad', null)
        .not('precio_por_kg', 'is', null)
        .gt('precio_por_kg', 0)
        .limit(10000)

    if (error) { console.error(`  ${nombre} [${table}] Error: ${error.message}`); return 0 }
    if (!rows?.length) { console.log(`  ${nombre} [${table}]: 0 afectados`); return 0 }

    console.log(`  ${nombre} [${table}]: ${rows.length} afectados, corrigiendo...`)

    let ok = 0
    let errs = 0

    for (let i = 0; i < rows.length; i += CONCURRENCIA) {
        const batch = rows.slice(i, i + CONCURRENCIA)
        const results = await Promise.allSettled(
            batch.map(row =>
                supabase
                    .from(table)
                    .update({
                        precio_unidad: row.precio_por_kg,
                        precio_por_kg: 0,
                    })
                    .eq('id', row.id)
            )
        )

        for (const r of results) {
            if (r.status === 'fulfilled' && !r.value.error) ok++
            else errs++
        }

        if ((i + CONCURRENCIA) % 200 === 0 || i + CONCURRENCIA >= rows.length) {
            console.log(`    ${Math.min(i + CONCURRENCIA, rows.length)}/${rows.length} (ok=${ok}, err=${errs})`)
        }
    }

    console.log(`  ✅ ${nombre} [${table}]: ${ok}/${rows.length} corregidos (${errs} errores)`)
    return ok
}

async function main() {
    const { data: sm } = await supabase
        .from('supermercados')
        .select('id, slug, nombre')

    if (!sm) { console.error('No supermarkets found'); return }

    let total = 0

    for (const s of sm) {
        console.log(`\n═══ ${s.nombre} ═══`)
        total += await fixTable('productos_supermercado', s.id, s.nombre)
        total += await fixTable('precios_historico', s.id, s.nombre)
    }

    console.log(`\n═══════════════════════════════`)
    console.log(`Total registros corregidos: ${total}`)
}

main().catch(console.error)
