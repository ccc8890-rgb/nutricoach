/**
 * limpiar-mercadona.ts — Limpia datos de Mercadona
 *
 * 1. Productos sin nombre_original → extraer nombre desde la URL
 * 2. Duplicados exactos (mismo nombre, distinta fecha) → eliminar el más antiguo
 *
 * Uso: npx tsx --env-file=.env.local scripts/limpiar-mercadona.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

/**
 * Convierte un slug de URL de Mercadona a nombre legible
 * Ejemplo: "papilla-tres-frutas-con-yogur-8-meses-" → "Papilla tres frutas con yogur 8 meses"
 */
function slugToName(slug: string): string {
    return slug
        .replace(/^product\//, '') // quitar prefijo /product/ si existe
        .replace(/^\d+\//, '')     // quitar el ID numérico
        .replace(/-/g, ' ')        // guiones → espacios
        .replace(/\s+/g, ' ')      // espacios múltiples → uno
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase()) // Capitalize first letter of each word
        .replace(/ De /g, ' de ')
        .replace(/ Del /g, ' del ')
        .replace(/ La /g, ' la ')
        .replace(/ El /g, ' el ')
        .replace(/ Los /g, ' los ')
        .replace(/ Las /g, ' las ')
        .replace(/ Y /g, ' y ')
        .replace(/ En /g, ' en ')
        .replace(/ Con /g, ' con ')
        .replace(/ Sin /g, ' sin ')
        .replace(/ Para /g, ' para ')
        .replace(/ Por /g, ' por ')
        .replace(/ Al /g, ' al ')
        .replace(/ A /g, ' a ')
}

async function getAllMercadona(): Promise<any[]> {
    const { data: sm } = await supabase
        .from('supermercados')
        .select('id')
        .eq('slug', 'mercadona')
        .single()

    const all: any[] = []
    let page = 0
    while (true) {
        const from = page * 1000
        const to = from + 999
        const { data } = await supabase
            .from('productos_supermercado')
            .select('id, nombre_original, url_producto, created_at')
            .eq('supermercado_id', sm!.id)
            .order('nombre_original')
            .range(from, to)
        if (!data || data.length === 0) break
        all.push(...data)
        page++
        if (data.length < 1000) break
    }
    return all
}

async function main() {
    console.log('\n╔════════════════════════════════════════╗')
    console.log('║  LIMPIEZA MERCADONA                     ║')
    console.log('╚════════════════════════════════════════╝\n')

    const productos = await getAllMercadona()
    console.log(`Total productos Mercadona: ${productos.length}`)

    // ── FASE 1: Rellenar nombres vacíos ────────────────────
    const vacios = productos.filter(p => !p.nombre_original || p.nombre_original.trim() === '')
    console.log(`\n📝 FASE 1: ${vacios.length} productos sin nombre\n`)

    let rellenados = 0
    for (const p of vacios) {
        if (!p.url_producto) continue

        // Extraer slug de la URL: .../product/12345/nombre-del-producto-
        const match = p.url_producto.match(/\/product\/\d+\/(.+?)(?:\/|$)/)
        if (!match) continue

        const slug = match[1]
        const nombre = slugToName(slug)
        if (!nombre || nombre.length < 3) continue

        const { error } = await supabase
            .from('productos_supermercado')
            .update({ nombre_original: nombre })
            .eq('id', p.id)

        if (error) {
            console.error(`  Error actualizando ${p.id}: ${error.message}`)
        } else {
            rellenados++
            if (rellenados <= 5) console.log(`  ✅ ${nombre}`)
        }
    }
    console.log(`\n  Rellenados: ${rellenados} / ${vacios.length}`)

    // ── FASE 2: Limpiar duplicados exactos (mismo nombre, misma URL) ──
    console.log(`\n🗑️  FASE 2: Eliminar duplicados\n`)

    const freq = new Map<string, any[]>()
    for (const p of productos) {
        const key = (p.nombre_original ?? '').toLowerCase().trim()
        if (!key) continue // skip vacíos (ya rellenados arriba)
        if (!freq.has(key)) freq.set(key, [])
        freq.get(key)!.push(p)
    }

    const dups = Array.from(freq.entries()).filter(([, g]) => g.length > 1)
    console.log(`Nombres duplicados: ${dups.length}`)
    let eliminados = 0

    for (const [nombre, grupo] of dups) {
        // Ordenar por fecha descendente (más reciente primero)
        grupo.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        // Quedarse con el más reciente, eliminar el resto
        const aEliminar = grupo.slice(1)

        for (const p of aEliminar) {
            const { error } = await supabase
                .from('productos_supermercado')
                .delete()
                .eq('id', p.id)

            if (error) {
                console.error(`  Error eliminando ${p.id}: ${error.message}`)
            } else {
                eliminados++
                if (eliminados <= 10) {
                    console.log(`  🗑️  Eliminado: "${nombre}" (${p.created_at?.substring(0, 10)})`)
                }
            }
        }
    }
    console.log(`\n  Eliminados: ${eliminados}`)

    // ── RESUMEN ────────────────────────────────────────────
    const trasLimpieza = await getAllMercadona()
    console.log(`\n╔════════════════════════════════════════╗`)
    console.log(`║  RESUMEN FINAL                          ║`)
    console.log(`╚════════════════════════════════════════╝`)
    console.log(`  Antes:  ${productos.length}`)
    console.log(`  Después: ${trasLimpieza.length}`)
    console.log(`  Diferencia: ${productos.length - trasLimpieza.length}`)
    console.log(`\nFin.`)
}

main().catch(console.error)
