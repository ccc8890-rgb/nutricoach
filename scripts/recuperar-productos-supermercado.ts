/**
 * Script de recuperación: backfill productos_supermercado desde precios_historico.
 *
 * Los batch inserts de productos_supermercado fallaron porque el payload incluía
 * 'url_imagen' (columna que NO existe en la tabla).
 * Pero los alimentos y precios_historico se guardaron correctamente.
 *
 * Este script:
 * 1. Lee todos los registros de precios_historico de HOY
 * 2. Para cada uno, busca/crea un registro en productos_supermercado
 * 3. Evita duplicados (mismo supermercado + mismo nombre_producto)
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Cargar env
const envPath = path.resolve(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
}

async function main() {
    console.log('🔄 Recuperando productos_supermercado desde precios_historico...\n')

    const supabase = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Obtener todos los supermercados
    const { data: supermercados } = await supabase.from('supermercados').select('id, nombre')
    if (!supermercados) { console.error('No hay supermercados'); return }
    const supermap = Object.fromEntries(supermercados.map(s => [s.id, s.nombre]))
    console.log(`📦 ${supermercados.length} supermercados en BD\n`)

    // 2. Para cada supermercado, procesar histórico de HOY
    const hoy = new Date().toISOString().split('T')[0]

    for (const sm of supermercados) {
        console.log(`━━━ ${sm.nombre} ━━━`)

        // Obtener históricos de hoy para este supermercado
        const { data: historicos, error } = await supabase
            .from('precios_historico')
            .select('*')
            .eq('supermercado_id', sm.id)
            .gte('created_at', hoy)

        if (error) { console.error(`  Error: ${error.message}`); continue }
        if (!historicos || historicos.length === 0) {
            console.log(`  Sin registros hoy\n`)
            continue
        }

        console.log(`  ${historicos.length} registros en histórico de hoy`)

        // Obtener productos existentes de este supermercado
        const { data: existentes } = await supabase
            .from('productos_supermercado')
            .select('id, nombre_original')
            .eq('supermercado_id', sm.id)

        const existentesMap = new Map<string, string>()
        if (existentes) {
            for (const e of existentes) existentesMap.set(e.nombre_original, e.id)
        }
        console.log(`  ${existentesMap.size} productos ya existentes`)

        let insertados = 0
        let omitidos = 0
        let errores = 0
        const LOTE = 100

        for (let i = 0; i < historicos.length; i += LOTE) {
            const lote = historicos.slice(i, i + LOTE)
            const inserts: any[] = []

            for (const h of lote) {
                // Si ya existe, skip
                if (existentesMap.has(h.nombre_producto)) {
                    omitidos++
                    continue
                }

                const metadatos = h.metadatos as Record<string, unknown> | null
                inserts.push({
                    supermercado_id: sm.id,
                    alimento_id: h.alimento_id,
                    nombre_original: h.nombre_producto,
                    marca: metadatos?.marca || null,
                    precio_por_kg: h.precio_por_kg,
                    precio_unidad: h.precio_unidad,
                    unidad: 'kg',
                    url_producto: h.url_producto,
                    fecha_precio: hoy,
                })
            }

            if (inserts.length === 0) continue

            const { error: insertError } = await supabase
                .from('productos_supermercado')
                .insert(inserts)

            if (insertError) {
                // Reintentar uno por uno si falla batch
                console.warn(`  Error batch: ${insertError.message}, reintentando individual...`)
                for (const ins of inserts) {
                    const { error: e2 } = await supabase
                        .from('productos_supermercado')
                        .insert(ins)
                    if (e2) {
                        console.error(`    Error insertando "${ins.nombre_original}": ${e2.message}`)
                        errores++
                    } else {
                        insertados++
                    }
                }
            } else {
                insertados += inserts.length
            }
        }

        console.log(`  ✅ Insertados: ${insertados} | Omitidos: ${omitidos} | Errores: ${errores}\n`)
    }

    // 3. Stats finales
    const { count: prodCount } = await supabase
        .from('productos_supermercado')
        .select('*', { count: 'exact', head: true })
    const { count: histCount } = await supabase
        .from('precios_historico')
        .select('*', { count: 'exact', head: true })
    const { count: alimCount } = await supabase
        .from('alimentos')
        .select('*', { count: 'exact', head: true })

    console.log('═══════════════════════════════')
    console.log('📊 Stats finales:')
    console.log('  alimentos:', alimCount)
    console.log('  productos_supermercado:', prodCount)
    console.log('  precios_historico:', histCount)
    console.log('═══════════════════════════════')
}

main().catch(console.error)
