/**
 * agent-browser.ts — Browser Agent usando Vercel AI SDK + Playwright
 *
 * Combina DeepSeek (razonamiento) con Playwright (ejecución en navegador)
 * para scraping inteligente de supermercados.
 *
 * FLUJO:
 *   1. DeepSeek analiza la URL y decide qué extraer
 *   2. Playwright navega a la página y ejecuta las instrucciones
 *   3. DeepSeek procesa los datos extraídos y los estructura
 *   4. Se devuelven los productos formateados
 */

import { createDeepSeek } from '@ai-sdk/deepseek'
import { generateText } from 'ai'
import { chromium } from 'playwright'
import type { ProductoRaw } from './scraping/types'

const deepseek = createDeepSeek()
const MODELO = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'

export interface BrowserAgentResult {
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
    pasos: string[]
}

/**
 * Navega a una URL de supermercado usando Playwright y extrae productos
 * usando selectores determinados por DeepSeek.
 */
export async function browserAgentScrape(
    url: string,
    supermercado: string,
    marcasSugeridas?: string[]
): Promise<BrowserAgentResult> {
    const inicio = Date.now()
    const pasos: string[] = []
    const errores: string[] = []
    const productos: ProductoRaw[] = []

    let browser
    try {
        pasos.push(`[1/4] Analizando URL con DeepSeek: ${url}`)

        // Fase 1: DeepSeek analiza la URL y sugiere selectores
        const { text: analisis } = await generateText({
            model: deepseek(MODELO),
            prompt: `Eres un experto en scraping web. Analiza esta URL de supermercado y determina:
1. ¿Qué tipo de página es? (listado de productos, categoría, búsqueda, detalle)
2. ¿Qué selectores CSS probarías para extraer productos?
3. ¿Qué patrones de HTML suelen usar supermercados españoles como ${supermercado}?

URL: ${url}

Responde en formato JSON:
{
  "tipo_pagina": "categoria | busqueda | listado",
  "selectores_sugeridos": {
    "producto": "selector css para el contenedor de cada producto",
    "nombre": "selector css para el nombre",
    "precio": "selector css para el precio",
    "precio_kg": "selector css para precio por kg (opcional)",
    "imagen": "selector css para la imagen (opcional)"
  },
  "estrategia": "explicación breve de cómo extraer los datos"
}`,
            temperature: 0.1,
            maxOutputTokens: 1000,
        })

        pasos.push(`[2/4] DeepSeek analizó la página. Estrategia: ${analisis.slice(0, 200)}...`)

        // Extraer JSON del análisis
        const jsonMatch = analisis.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            throw new Error('DeepSeek no devolvió JSON válido')
        }
        const sugerencias = JSON.parse(jsonMatch[0])
        const selectores = sugerencias.selectores_sugeridos || {}

        // Fase 2: Playwright navega y extrae datos
        pasos.push(`[3/4] Lanzando Playwright para navegar a la URL...`)

        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
        })

        const page = await context.newPage()
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

        // Intentar extraer con los selectores sugeridos
        let prodsExtraidos: any[] = []

        if (selectores.producto) {
            prodsExtraidos = await page.evaluate((sel) => {
                const items = document.querySelectorAll(sel.producto || '')
                return Array.from(items).slice(0, 50).map(item => ({
                    nombre: item.querySelector(sel.nombre || '')?.textContent?.trim() || '',
                    precio: (() => {
                        const el = item.querySelector(sel.precio || '')
                        return el?.textContent?.trim() || ''
                    })(),
                    imagen: (() => {
                        const el = item.querySelector(sel.imagen || '')
                        return (el as HTMLImageElement)?.src || ''
                    })(),
                    html: item.innerHTML.slice(0, 300),
                }))
            }, selectores)
        }

        // Si no se encontraron productos, extraer HTML para que DeepSeek lo analice
        if (prodsExtraidos.length === 0) {
            pasos.push('  → No se encontraron productos con selectores sugeridos. Extrayendo HTML...')

            const htmlSamples = await page.evaluate(() => {
                const contenedores = document.querySelectorAll('[class*="product"], [class*="item"], [class*="card"], article, li')
                return Array.from(contenedores).slice(0, 10).map(el => ({
                    className: el.className,
                    html: el.innerHTML.slice(0, 500),
                    text: el.textContent?.trim().slice(0, 200),
                }))
            })

            // Fase 3: DeepSeek analiza el HTML real
            pasos.push(`[4/4] DeepSeek analizando HTML real para extraer productos...`)

            const { text: extraccion } = await generateText({
                model: deepseek(MODELO),
                prompt: `Analiza este HTML de supermercado y extrae los productos.

                HTML samples de la página:
                ${JSON.stringify(htmlSamples, null, 2)}

                URL: ${url}
                Supermercado: ${supermercado}

                Devuelve un array JSON con los productos encontrados:
                [
                  {
                    "nombre": "nombre del producto",
                    "precio": 0.00,
                    "precio_kg": 0.00 (opcional),
                    "imagen": "url de imagen" (opcional)
                  }
                ]
                
                Si no hay productos claros, devuelve array vacío [].`,
                temperature: 0.1,
                maxOutputTokens: 2000,
            })

            const prodMatch = extraccion.match(/\[[\s\S]*\]/)
            if (prodMatch) {
                const parsed = JSON.parse(prodMatch[0])
                prodsExtraidos = Array.isArray(parsed) ? parsed : [parsed]
            }
        } else {
            pasos.push(`[4/4] Productos extraídos con Playwright: ${prodsExtraidos.length} encontrados`)
        }

        // Convertir a ProductoRaw
        for (const p of prodsExtraidos) {
            const precio = typeof p.precio === 'number' ? p.precio : parseFloat(String(p.precio).replace(/[^\d.,]/g, '').replace(',', '.'))
            if (p.nombre && precio > 0) {
                productos.push({
                    nombre: String(p.nombre).trim(),
                    precio_actual: precio,
                    precio_por_kg: typeof p.precio_kg === 'number' ? p.precio_kg :
                        p.precio_kg ? parseFloat(String(p.precio_kg).replace(/[^\d.,]/g, '').replace(',', '.')) : undefined,
                    unidad: 'kg',
                    url_producto: url,
                    imagen_url: p.imagen || undefined,
                    marca: marcasSugeridas?.[0] || supermercado,
                    disponible: true,
                })
            }
        }

        await browser.close()
        browser = undefined

        pasos.push(`✅ Procesados ${productos.length} productos de ${supermercado}`)

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error en browser agent: ${msg}`)
        console.error('[BrowserAgent] Error:', msg)
    } finally {
        if (browser) await browser.close()
    }

    return { productos, errores, duracion_ms: Date.now() - inicio, pasos }
}
