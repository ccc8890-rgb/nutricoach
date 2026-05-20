/**
 * el-corte-ingles.ts — Scraper para El Corte Inglés Supermercado
 *
 * ✅ REPARADO (20-05-2026) — Redirige a hipercor.es
 *
 * NOTA IMPORTANTE: El Corte Inglés ha unificado su plataforma de supermercado
 * con Hipercor. La URL elcorteingles.es/supermercado/ redirige a la homepage
 * sin productos. Los productos se sirven desde hipercor.es con el mismo DOM.
 *
 * Este scraper reutiliza la lógica de Hipercor (mismo Puppeteer-extra+stealth,
 * mismos selectores .food-product-preview-responsive) pero etiqueta los
 * productos como "El Corte Inglés".
 *
 * Web: https://www.elcorteingles.es/supermercado/ (redirige a hipercor.es)
 */

import type { ProductoRaw } from '../types'

// Re-exportamos la función de Hipercor, pero con marca El Corte Inglés
import { scrapearHipercor } from './hipercor'

export const configElCorteIngles = {
    supermercado: {
        id: '',
        nombre: 'El Corte Inglés' as const,
        slug: 'el-corte-ingles' as const,
    },
    metodo: 'playwright' as const,
    url_base: 'https://www.elcorteingles.es/supermercado',
    rate_limit_ms: 2000,
    timeout_ms: 45000,
}

/**
 * Scrapea El Corte Inglés usando la misma plataforma que Hipercor.
 *
 * Hipercor y El Corte Inglés comparten exactamente el mismo backend de
 * supermercado. Llamamos a scrapearHipercor() y cambiamos la marca de
 * "Hipercor" a "El Corte Inglés" en los productos.
 */
export async function scrapearElCorteIngles(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []

    console.log('[El Corte Inglés] Usando plataforma Hipercor (mismo backend)...')

    try {
        const result = await scrapearHipercor()
        errores.push(...result.errores)

        // Re-etiquetar productos como El Corte Inglés
        for (const p of result.productos) {
            productos.push({
                ...p,
                marca: p.marca === 'Hipercor' ? 'El Corte Inglés' : p.marca,
            })
        }

        console.log(`[El Corte Inglés] ${productos.length} productos (vía Hipercor)`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[El Corte Inglés] Error:', msg)
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}
