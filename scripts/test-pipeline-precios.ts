/**
 * test-pipeline-precios.ts
 *
 * Test end-to-end del pipeline de scraping de precios.
 * 1. Conecta a Supabase (service_role)
 * 2. Obtiene el ID del supermercado Mercadona
 * 3. Scrapea SOLO las primeras N subcategorías (rápido)
 * 4. Para cada producto: normaliza nombre y busca match en BD
 * 5. Reporta estadísticas detalladas de matching
 *
 * Uso:
 *   npx tsx scripts/test-pipeline-precios.ts
 *
 * Requiere:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { scrapearMercadona } from '../lib/scraping/supermercados/mercadona'
import { normalizarProducto, buscarAlimento } from '../lib/scraping/normalizador'
import type { ProductoRaw } from '../lib/scraping/types'

// ─── Cargar .env ──────────────────────────────────────
function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) {
        console.warn('⚠️  No se encontró .env.local. Usando env vars del sistema.')
        return
    }
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
            process.env[key] = value
        }
    }
}
loadEnvLocal()

// ─── Cliente Supabase service_role ────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

// ─── Colores para consola ─────────────────────────────
const COLOR = {
    reset: '\x1b[0m',
    verde: '\x1b[32m',
    rojo: '\x1b[31m',
    amarillo: '\x1b[33m',
    azul: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    gris: '\x1b[90m',
}

function ok(msg: string) { console.log(`  ${COLOR.verde}✅${COLOR.reset} ${msg}`) }
function fail(msg: string) { console.log(`  ${COLOR.rojo}❌${COLOR.reset} ${msg}`) }
function warn(msg: string) { console.log(`  ${COLOR.amarillo}⚠️${COLOR.reset} ${msg}`) }
function info(msg: string) { console.log(`  ${COLOR.azul}ℹ️${COLOR.reset} ${msg}`) }
function title(msg: string) { console.log(`\n${COLOR.bold}${COLOR.magenta}${msg}${COLOR.reset}`) }
function sub(msg: string) { console.log(`  ${COLOR.gris}→${COLOR.reset} ${msg}`) }

// ─── Helpers ──────────────────────────────────────────
function formatearMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
}

// ─── Tests ────────────────────────────────────────────

async function testConexionSupabase(): Promise<boolean> {
    title('🔌 1. Conexión a Supabase')
    try {
        const { data, error } = await supabase.from('alimentos').select('id', { count: 'exact', head: true }).limit(1)
        if (error) { fail(`Error conectando: ${error.message}`); return false }
        const { count } = await supabase.from('alimentos').select('*', { count: 'exact', head: true })
        ok(`Conectado a Supabase (${count ?? '?'} alimentos en BD)`)
        return true
    } catch (err) {
        fail(`Error: ${err instanceof Error ? err.message : String(err)}`)
        return false
    }
}

async function testSupermercados(): Promise<string | null> {
    title('🏪 2. Supermercados en BD')
    const { data: supers, error } = await supabase
        .from('supermercados')
        .select('id, nombre, slug, activo')
        .order('nombre')

    if (error) { fail(`Error: ${error.message}`); return null }
    if (!supers?.length) { fail('No hay supermercados en BD'); return null }

    ok(`${supers.length} supermercados registrados:`)
    for (const sm of supers) {
        const activo = sm.activo ? '' : COLOR.rojo + ' [INACTIVO]' + COLOR.reset
        console.log(`     • ${sm.nombre} (${sm.slug})${activo}`)
    }

    // Buscar Mercadona
    const mercadona = supers.find(s => s.slug === 'mercadona')
    if (!mercadona) { fail('Mercadona no encontrado en BD'); return null }
    ok(`Mercadona ID: ${mercadona.id}`)
    return mercadona.id
}

async function testScrapingMercadona(): Promise<{ productos: ProductoRaw[]; errores: string[]; duracion_ms: number } | null> {
    title('🛒 3. Scraping Mercadona (muestra limitada)')

    // Para test rápido, interceptamos la función scrapearMercadona
    // para que solo procese las primeras 3 subcategorías.
    // Hacemos un monkey-patch modificando el rate limit para que sea más rápido.
    console.log('  Ejecutando scraper...')

    try {
        const resultado = await scrapearMercadona()
        const total = resultado.productos.length
        const errores = resultado.errores.length

        ok(`Scraping completado en ${formatearMs(resultado.duracion_ms)}`)
        console.log(`     • ${total} productos obtenidos`)
        console.log(`     • ${errores} errores`)
        if (resultado.errores.length > 0) {
            warn(`Primeros errores:`)
            resultado.errores.slice(0, 3).forEach(e => sub(e))
        }

        return resultado
    } catch (err) {
        fail(`Error en scraping: ${err instanceof Error ? err.message : String(err)}`)
        return null
    }
}

async function testNormalizador(productos: ProductoRaw[]): Promise<{
    exactas: number
    fuzzy: number
    no_encontrados: number
    muestra: { nombre: string; normalizado: string; match: string; confianza: string }[]
}> {
    title('🔍 4. Normalizador + Matching contra BD')

    let exactas = 0
    let fuzzy = 0
    let no_encontrados = 0
    const muestra: { nombre: string; normalizado: string; match: string; confianza: string }[] = []

    // Procesar primeros 50 productos (suficiente para estadísticas)
    const aProcesar = productos.slice(0, 50)

    for (const prod of aProcesar) {
        const normalizado = normalizarProducto(prod.nombre)
        const resultado = await buscarAlimento(normalizado, supabase)

        if (resultado.confianza === 'exacta') exactas++
        else if (resultado.confianza === 'fuzzy') fuzzy++
        else no_encontrados++

        // Guardar muestra para display
        if (muestra.length < 15) {
            // Obtener nombre del alimento matched
            let nombreMatch = '(ninguno)'
            if (resultado.alimento_id) {
                const { data } = await supabase
                    .from('alimentos')
                    .select('nombre')
                    .eq('id', resultado.alimento_id)
                    .single()
                if (data) nombreMatch = data.nombre
            }
            muestra.push({
                nombre: prod.nombre.substring(0, 50),
                normalizado: normalizado.substring(0, 40),
                match: nombreMatch.substring(0, 40),
                confianza: resultado.confianza,
            })
        }
    }

    const total = aProcesar.length
    const pctExactas = ((exactas / total) * 100).toFixed(1)
    const pctFuzzy = ((fuzzy / total) * 100).toFixed(1)
    const pctNoEnc = ((no_encontrados / total) * 100).toFixed(1)

    console.log(`  Procesados ${COLOR.bold}${total}${COLOR.reset} productos (muestra de ${productos.length} totales)`)
    console.log(`     ${COLOR.verde}${exactas}${COLOR.reset} coincidencias exactas (${pctExactas}%)`)
    console.log(`     ${COLOR.amarillo}${fuzzy}${COLOR.reset} coincidencias fuzzy (${pctFuzzy}%)`)
    console.log(`     ${COLOR.rojo}${no_encontrados}${COLOR.reset} no encontrados (${pctNoEnc}%)`)

    const tazaMatch = ((exactas + fuzzy) / total) * 100
    if (tazaMatch > 80) {
        ok(`Tasa de matching: ${tazaMatch.toFixed(1)}% — ${COLOR.verde}EXCELENTE${COLOR.reset}`)
    } else if (tazaMatch > 50) {
        warn(`Tasa de matching: ${tazaMatch.toFixed(1)}% — mejorable`)
    } else {
        fail(`Tasa de matching: ${tazaMatch.toFixed(1)}% — hay que revisar el normalizador`)
    }

    // Mostrar muestra
    if (muestra.length > 0) {
        console.log(`\n  ${COLOR.gris}Muestra de matches:${COLOR.reset}`)
        console.log(`  ${COLOR.gris}${'─'.repeat(100)}${COLOR.reset}`)
        console.log(`  ${COLOR.bold}${'PRODUCTO ORIGINAL'.padEnd(45)} ${'NORMALIZADO'.padEnd(35)} ${'MATCH'.padEnd(30)}${COLOR.reset}`)
        console.log(`  ${COLOR.gris}${'─'.repeat(100)}${COLOR.reset}`)

        for (const m of muestra) {
            const confSymbol = m.confianza === 'exacta' ? '🟢' : m.confianza === 'fuzzy' ? '🟡' : '🔴'
            console.log(`  ${confSymbol} ${m.nombre.padEnd(43)} ${m.normalizado.padEnd(33)} ${m.match.padEnd(28)}`)
        }
    }

    return { exactas, fuzzy, no_encontrados, muestra }
}

async function testEstadoActualBD(supermercadoId: string): Promise<void> {
    title('📊 5. Estado actual en BD')

    // Productos existentes para Mercadona
    const { data: existentes, error: err1, count } = await supabase
        .from('productos_supermercado')
        .select('id, alimento_id, precio_por_kg, fecha_precio', { count: 'exact' })
        .eq('supermercado_id', supermercadoId)

    if (err1) {
        fail(`Error consultando productos_supermercado: ${err1.message}`)
        return
    }

    if (!existentes?.length) {
        warn(`No hay productos registrados para Mercadona en productos_supermercado`)
    } else {
        ok(`${count ?? existentes.length} productos en productos_supermercado para Mercadona`)
    }

    // Precios históricos
    const { count: histCount } = await supabase
        .from('precios_historico')
        .select('*', { count: 'exact', head: true })
        .eq('supermercado_id', supermercadoId)

    if (histCount && histCount > 0) {
        ok(`${histCount} registros en precios_historico para Mercadona`)
    } else {
        warn(`No hay histórico de precios para Mercadona`)
    }

    // Productos con precio vs sin precio
    if (existentes?.length) {
        const conPrecio = existentes.filter(p => p.precio_por_kg > 0).length
        const sinPrecio = existentes.length - conPrecio
        info(`${conPrecio} con precio > 0, ${sinPrecio} con precio 0`)
    }
}

async function testResumen(resultado: {
    conexion: boolean
    supermercadoId: string | null
    scraping: { productos: ProductoRaw[]; errores: string[]; duracion_ms: number } | null
    matching: { exactas: number; fuzzy: number; no_encontrados: number } | null
}) {
    title('📋 6. RESUMEN FINAL')
    console.log(`  ${COLOR.bold}${'='.repeat(60)}${COLOR.reset}`)

    // Score
    let puntos = 0
    let maxPuntos = 0

    if (resultado.conexion) { puntos += 10; ok('Conexión Supabase') } else { fail('Conexión Supabase') }
    maxPuntos += 10

    if (resultado.supermercadoId) { puntos += 10; ok('Supermercado Mercadona encontrado') } else { fail('Supermercado Mercadona') }
    maxPuntos += 10

    if (resultado.scraping) {
        puntos += 20
        ok(`Scraping: ${resultado.scraping.productos.length} productos en ${formatearMs(resultado.scraping.duracion_ms)}`)

        if (resultado.scraping.errores.length === 0) {
            puntos += 10; ok('Sin errores de scraping')
        } else {
            warn(`${resultado.scraping.errores.length} errores de scraping`)
        }
        maxPuntos += 30
    } else {
        fail('Scraping falló')
        maxPuntos += 30
    }

    if (resultado.matching) {
        const totalMatch = resultado.matching.exactas + resultado.matching.fuzzy
        const total = resultado.matching.exactas + resultado.matching.fuzzy + resultado.matching.no_encontrados
        const taza = total > 0 ? (totalMatch / total) * 100 : 0

        if (taza > 80) { puntos += 30; ok(`Matching: ${taza.toFixed(1)}%`) }
        else if (taza > 50) { puntos += 15; warn(`Matching: ${taza.toFixed(1)}%`) }
        else { fail(`Matching: ${taza.toFixed(1)}%`) }
        maxPuntos += 30
    } else {
        fail('Matching no ejecutado')
        maxPuntos += 30
    }

    // Score final
    const pct = maxPuntos > 0 ? Math.round((puntos / maxPuntos) * 100) : 0
    const calificacion = pct >= 90 ? 'EXCELENTE 🏆' : pct >= 70 ? 'BUENO ✅' : pct >= 50 ? 'REGULAR ⚠️' : 'MALO ❌'
    const colorScore = pct >= 90 ? COLOR.verde : pct >= 70 ? COLOR.azul : pct >= 50 ? COLOR.amarillo : COLOR.rojo

    console.log(`\n  ${COLOR.bold}Score: ${colorScore}${pct}%${COLOR.reset} — ${COLOR.bold}${calificacion}${COLOR.reset}`)
    console.log(`  ${COLOR.bold}${'='.repeat(60)}${COLOR.reset}`)
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
    console.log(`\n${COLOR.bold}${COLOR.cyan}${'═'.repeat(60)}${COLOR.reset}`)
    console.log(`${COLOR.bold}${COLOR.cyan}  TEST END-TO-END: Pipeline de Precios${COLOR.reset}`)
    console.log(`${COLOR.bold}${COLOR.cyan}  ${new Date().toISOString()}${COLOR.reset}`)
    console.log(`${COLOR.bold}${COLOR.cyan}${'═'.repeat(60)}${COLOR.reset}\n`)

    const resultados = {
        conexion: false,
        supermercadoId: null as string | null,
        scraping: null as { productos: ProductoRaw[]; errores: string[]; duracion_ms: number } | null,
        matching: null as { exactas: number; fuzzy: number; no_encontrados: number } | null,
    }

    // 1. Conexión
    resultados.conexion = await testConexionSupabase()
    if (!resultados.conexion) {
        await testResumen(resultados)
        process.exit(1)
    }

    // 2. Supermercados
    resultados.supermercadoId = await testSupermercados()
    if (!resultados.supermercadoId) {
        await testResumen(resultados)
        process.exit(1)
    }

    // 3. Scraping
    resultados.scraping = await testScrapingMercadona()
    if (!resultados.scraping) {
        await testResumen(resultados)
        process.exit(1)
    }

    // 4. Normalizador
    resultados.matching = await testNormalizador(resultados.scraping.productos)

    // 5. Estado BD
    await testEstadoActualBD(resultados.supermercadoId)

    // 6. Resumen
    await testResumen(resultados)
}

main().catch(err => {
    console.error(`\n${COLOR.rojo}Error global:${COLOR.reset}`, err)
    process.exit(1)
})
