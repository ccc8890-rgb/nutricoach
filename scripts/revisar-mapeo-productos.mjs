/**
 * REVISIÓN: Mapeo alimentos canónicos vs alimentos antiguos con productos
 * 
 * Muestra exactamente qué productos se migrarían a cada alimento canónico.
 * Solo lectura — no modifica nada.
 * 
 * Uso: node --env-file=.env.local scripts/revisar-mapeo-productos.mjs
 */
import { createClient } from '@supabase/supabase-js'

const sup = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ Faltan env vars')
    process.exit(1)
}

async function main() {
    console.log('═══════════════════════════════════════════════════════')
    console.log('  REVISIÓN: Migración de productos a alimentos canónicos')
    console.log('  Solo lectura — NO se modifica nada')
    console.log('═══════════════════════════════════════════════════════\n')

    // ─────────────────────────────────────────────────────────────
    // CONFIG: Alimentos canónicos y sus fuentes
    // ─────────────────────────────────────────────────────────────
    const MAPEOS = [
        {
            canónico: { id: '23ec40c0', nombre: 'Harina de almendra' },
            fuentes: [
                { id: 'b3431bcf', nombre: 'Almendra molida' },
                { id: '078d1fc3', nombre: 'Almendras Molidas' },
                { id: '453d07f7', nombre: 'Almendra Molida Bolsa' },
            ]
        },
        {
            canónico: { id: '385eb0e5', nombre: 'Mantequilla de cacahuete' },
            fuentes: [
                { id: '6328f4b9', nombre: 'Crema de cacahuete (natural)' },
                { id: '8694be48', nombre: 'Crema de cacahuete (sin azúcar)' },
                { id: 'cc0bde05', nombre: 'Mantequilla de cacahuete (natural)' },
                { id: '019796da', nombre: 'Crema de cacahuete 100%' },
                { id: 'dc146530', nombre: 'Crema de Cacahuete Crujiente 100%' },
                { id: 'e37964c0', nombre: 'Crema Cacahuete Cremosa' },
                { id: '14f2e187', nombre: 'Crema de Cacahuete Cremosa 100%' },
                { id: 'c214f46e', nombre: 'Mantequilla de cacahuete (natural)' },
                { id: '2d648116', nombre: 'Mantequilla de cacahuete (natural)' },
            ]
        },
        {
            canónico: { id: '2628d64e', nombre: 'Salsa barbacoa' },
            fuentes: [
                { id: '8ffa965e', nombre: 'Salsa Barbacoa' },
                { id: 'd8b01947', nombre: 'Salsa barbacoa' },
                { id: '6f081483', nombre: 'Salsa barbacoa' },
                { id: '8de2232a', nombre: 'Salsa barbacoa' },
                { id: '29408249', nombre: 'Salsa Barbacoa Bull\'s-Eye' },
                { id: '16d019ac', nombre: 'Salsa Barbacoa Classic Pet' },
                { id: '645c190a', nombre: 'Salsa Barbacoa Pet' },
            ]
        },
        {
            canónico: { id: '8b2907a0', nombre: 'Yogur de proteína (alto en proteínas)' },
            fuentes: [
                { id: '810513e3', nombre: 'Yogur 0%0% Proteína Sabor Stracciatella' },
                { id: 'f811b501', nombre: 'Yogur 0%0% Proteína Fresa' },
                { id: '317388cb', nombre: 'Yogur Líquido 0%0% Proteína sabor Tropical' },
                { id: '61d5af83', nombre: 'Yogur 0%0% Proteína Mango' },
                { id: '4526f3c6', nombre: 'Yogur Líquido 0%0% Proteína sabor Coco' },
            ]
        },
        {
            canónico: { id: '6a545c87', nombre: 'Crema de avellanas (sin azúcar)' },
            fuentes: [
                { id: '0925e63f', nombre: 'Crema de avellanas (sin azúcar)' },
                { id: '2441f95b', nombre: 'Crema de avellanas (sin azúcar)' },
            ]
        },
    ]

    let totalProductosMigrables = 0

    for (const mapeo of MAPEOS) {
        const { canónico, fuentes } = mapeo
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        console.log(`  📦 CANÓNICO: "${canónico.nombre}" [${canónico.id}]`)
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

        // Verificar que el canónico existe
        const { data: canon } = await sup
            .from('alimentos')
            .select('id, nombre, categoria, proteinas, grasas, carbohidratos, calorias')
            .eq('id', canónico.id)
            .single()

        if (!canon) {
            console.log(`  ❌ ALIMENTO CANÓNICO NO EXISTE EN BD`)
            console.log(`  ⚠️  Habría que crearlo primero`)
            continue
        }

        console.log(`  ✅ Existe: "${canon.nombre}" [${canon.categoria}]`)
        console.log(`     Macros: P:${canon.proteinas} G:${canon.grasas} C:${canon.carbohidratos} Kcal:${canon.calorias}\n`)

        // Verificar recetas vinculadas al canónico
        const { data: recetasCanon, count: countRecetasCanon } = await sup
            .from('receta_ingredientes')
            .select('receta_id', { count: 'exact' })
            .eq('alimento_id', canónico.id)

        console.log(`  📋 Recetas vinculadas al canónico: ${countRecetasCanon}`)
        if (recetasCanon && recetasCanon.length > 0) {
            const recetaIds = [...new Set(recetasCanon.map(r => r.receta_id))]
            for (const rid of recetaIds.slice(0, 5)) {
                const { data: rec } = await sup.from('recetas').select('id, titulo').eq('id', rid).single()
                if (rec) console.log(`     • "${rec.titulo}"`)
            }
            if (recetaIds.length > 5) console.log(`     ... y ${recetaIds.length - 5} más`)
        }

        // Productos actuales del canónico
        const { data: prodsCanon, count: countProdsCanon } = await sup
            .from('productos_supermercado')
            .select('id', { count: 'exact' })
            .eq('alimento_id', canónico.id)

        console.log(`  💰 Productos ACTUALES del canónico: ${countProdsCanon}`)

        // Ahora revisar cada fuente
        console.log(`\n  📎 FUENTES a migrar:`)
        let totalFuenteProds = 0

        for (const fuente of fuentes) {
            const { data: fAlimento } = await sup
                .from('alimentos')
                .select('id, nombre, categoria')
                .eq('id', fuente.id)
                .single()

            if (!fAlimento) {
                console.log(`     ❌ [${fuente.id}] "${fuente.nombre}" — NO EXISTE EN BD`)
                continue
            }

            const { data: fProds, count: fCount } = await sup
                .from('productos_supermercado')
                .select('id, nombre_original, supermercado_id, precio_por_kg, precio_unidad, url_producto, marca, preferido, fecha_precio', { count: 'exact' })
                .eq('alimento_id', fuente.id)

            const { data: fRecetas, count: fRecCount } = await sup
                .from('receta_ingredientes')
                .select('receta_id', { count: 'exact' })
                .eq('alimento_id', fuente.id)

            if (fCount > 0 || fRecCount > 0) {
                console.log(`\n     📍 [${fuente.id.slice(0, 8)}] "${fAlimento.nombre}" [${fAlimento.categoria}]`)

                if (fCount > 0) {
                    console.log(`        🛒 Productos a migrar: ${fCount}`)
                    for (const p of fProds || []) {
                        console.log(`           → "${p.nombre_original}" | ${p.precio_por_kg}€/kg | ${p.precio_unidad ? p.precio_unidad + '€' : '—'} | sup:${p.supermercado_id.slice(0, 8)}${p.preferido ? ' ⭐' : ''}`)
                    }
                    totalFuenteProds += fCount
                }
                if (fRecCount > 0) {
                    console.log(`        📋 Recetas a re-vincular: ${fRecCount}`)
                    const ridSet = [...new Set(fRecetas.map(r => r.receta_id))]
                    for (const rid of ridSet.slice(0, 3)) {
                        const { data: rec } = await sup.from('recetas').select('id, titulo').eq('id', rid).single()
                        if (rec) console.log(`           → "${rec.titulo}"`)
                    }
                    if (ridSet.length > 3) console.log(`           ... y ${ridSet.length - 3} más`)
                }
            } else {
                console.log(`     ⬜ [${fuente.id.slice(0, 8)}] "${fAlimento.nombre}" — 0 productos, 0 recetas (ignorar)`)
            }
        }

        console.log(`\n  🔢 TOTAL productos a migrar a "${canónico.nombre}": ${totalFuenteProds}`)
        totalProductosMigrables += totalFuenteProds
    }

    // ─────────────────────────────────────────────────────────────
    // ALIMENTOS NUEVOS QUE FALTAN CREAR
    // ─────────────────────────────────────────────────────────────
    console.log(`\n\n═══════════════════════════════════════════════════════`)
    console.log(`  ALIMENTOS "NUEVOS" QUE MENCIONA FIX-MATCHES`)
    console.log(`  PERO QUE NO SE CREARON`)
    console.log(`═══════════════════════════════════════════════════════`)

    const faltantes = [
        { nombre: 'Yogur de proteína', similar: '8b2907a0' },
        { nombre: 'Crema de avellanas', similar: '6a545c87' },
    ]

    for (const f of faltantes) {
        const { data: existente } = await sup
            .from('alimentos')
            .select('id, nombre, categoria')
            .ilike('nombre', f.nombre)
            .limit(5)

        if (existente && existente.length > 0) {
            console.log(`\n  ✅ "${f.nombre}" ya existe como:`)
            for (const e of existente) {
                console.log(`     [${e.id.slice(0, 8)}] "${e.nombre}" [${e.categoria}]`)
            }
        } else {
            console.log(`\n  ❌ "${f.nombre}" NO EXISTE en BD`)
            // Check if we should use the similar one instead
            const { data: sim } = await sup.from('alimentos').select('id, nombre, categoria').eq('id', f.similar).single()
            if (sim) {
                console.log(`     Alternativa cercana: [${sim.id.slice(0, 8)}] "${sim.nombre}" [${sim.categoria}]`)
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // RESUMEN
    // ─────────────────────────────────────────────────────────────
    console.log(`\n\n═══════════════════════════════════════════════════════`)
    console.log(`  📊 RESUMEN GLOBAL`)
    console.log(`═══════════════════════════════════════════════════════`)
    console.log(`  Total productos a migrar: ${totalProductosMigrables}`)
    console.log(`\n  ⚠️  WARNING: Migrar un producto de un alimento a otro`)
    console.log(`     DESTRUYE la vinculación anterior. Si hay`)
    console.log(`     recetas vinculadas al alimento fuente,`)
    console.log(`     perderán la referencia al producto con precio.`)
    console.log(`\n  ✅ RECOMENDACIÓN: Solo migrar productos,`)
    console.log(`     NO eliminar los alimentos fuente.`)
    console.log(`     Así las recetas antiguas siguen funcionando.`)
}
main().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})
