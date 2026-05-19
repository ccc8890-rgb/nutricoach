#!/usr/bin/env node
/**
 * Auditoría CONSOLIDADA de cobertura nutricional completa
 *
 * Muestra el estado global de todos los campos enriquecidos:
 * - Macros base (calorías, proteinas, carbohidratos, grasas)
 * - Perfil lipídico (saturados, monoinsaturados, poliinsaturados, colesterol)
 * - Azúcares y sodio
 * - Fibra
 * - Micronutrientes (20 campos: vitaminas + minerales)
 * - Fuentes (BEDCA vs. enriquecido vs. scraping)
 *
 * Uso:
 *   node scripts/auditar-cobertura-consolidada.mjs
 *   node scripts/auditar-cobertura-consolidada.mjs --full   # Muestra top 10 por categoría
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(PROJECT_ROOT, '.env.local')
    if (!existsSync(envPath)) {
        console.error('❌ No se encuentra .env.local en', envPath)
        process.exit(1)
    }
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        process.env[key] = value
    }
}

loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

const args = process.argv.slice(2)
const FULL = args.includes('--full')

function bar(pct, ancho = 30) {
    const llena = Math.round((pct / 100) * ancho)
    const vacia = ancho - llena
    const color = pct >= 80 ? GREEN : pct >= 50 ? YELLOW : RED
    return `${color}${'█'.repeat(llena)}${'░'.repeat(vacia)}${RESET} ${pct.toFixed(1)}%`
}

async function main() {
    console.log(`\n${MAGENTA}${BOLD}═══════════════════════════════════════════════════════════════${RESET}`)
    console.log(`${MAGENTA}${BOLD}  📊 AUDITORÍA CONSOLIDADA DE COBERTURA NUTRICIONAL${RESET}`)
    console.log(`${MAGENTA}${BOLD}═══════════════════════════════════════════════════════════════${RESET}`)
    console.log(`Fecha: ${new Date().toISOString().split('T')[0]}\n`)

    // 1. Cargar todos los alimentos (con paginación REST API)
    console.log(`${CYAN}📥 Cargando datos...${RESET}`)

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    async function fetchAllAlimentos() {
        let all = []
        let from = 0
        const pageSize = 1000
        while (true) {
            const url = `${SUPABASE_URL}/rest/v1/alimentos?select=*&offset=${from}`
            const res = await fetch(url, {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Accept': 'application/json',
                }
            })
            if (!res.ok) {
                const text = await res.text()
                throw new Error(`Supabase error ${res.status}: ${text.substring(0, 200)}`)
            }
            const data = await res.json()
            if (!data || data.length === 0) break
            all = all.concat(data)
            from += pageSize
        }
        return all
    }

    const todos = await fetchAllAlimentos()

    const total = todos.length
    console.log(`   Total alimentos: ${total}\n`)

    // 2. Cobertura de macros base
    console.log(`${BOLD}📐 MACROS BASE${RESET}`)
    const macros = [
        { key: 'calorias', label: 'Calorías', umbral: 0 },
        { key: 'proteinas', label: 'Proteínas', umbral: 0 },
        { key: 'carbohidratos', label: 'Carbohidratos', umbral: 0 },
        { key: 'grasas', label: 'Grasas', umbral: 0 },
    ]
    for (const m of macros) {
        const conDatos = todos.filter(a => (a[m.key] ?? 0) > m.umbral).length
        const pct = (conDatos / total) * 100
        console.log(`   ${m.label.padEnd(25)} ${String(conDatos).padStart(6)}/${total} ${bar(pct)}`)
    }

    // 3. Cobertura de perfil lipídico
    console.log(`\n${BOLD}🥩 PERFIL LIPÍDICO${RESET}`)
    const lipidos = [
        { key: 'saturados_g', label: 'Saturados', umbral: 0 },
        { key: 'monoinsaturados_g', label: 'Monoinsaturados', umbral: 0 },
        { key: 'poliinsaturados_g', label: 'Poliinsaturados', umbral: 0 },
        { key: 'colesterol_mg', label: 'Colesterol', umbral: 0 },
    ]
    for (const l of lipidos) {
        const conDatos = todos.filter(a => (a[l.key] ?? 0) > l.umbral).length
        const pct = (conDatos / total) * 100
        console.log(`   ${l.label.padEnd(25)} ${String(conDatos).padStart(6)}/${total} ${bar(pct)}`)
    }

    // 4. Cobertura de azúcares, sodio, fibra
    console.log(`\n${BOLD}🍬 AZÚCARES, SODIO Y FIBRA${RESET}`)
    const extra = [
        { key: 'azucares', label: 'Azúcares (g)', umbral: 0 },
        { key: 'sodio_mg', label: 'Sodio (mg)', umbral: 0 },
        { key: 'fibra', label: 'Fibra (g)', umbral: 0 },
    ]
    for (const e of extra) {
        const conDatos = todos.filter(a => (a[e.key] ?? 0) > e.umbral).length
        const pct = (conDatos / total) * 100
        const suma = todos.reduce((s, a) => s + (a[e.key] || 0), 0)
        const media = conDatos > 0 ? (suma / conDatos).toFixed(1) : 'N/A'
        console.log(`   ${e.label.padEnd(25)} ${String(conDatos).padStart(6)}/${total} ${bar(pct)}  (media: ${media})`)
    }

    // 5. Cobertura de micronutrientes (vitaminas + minerales)
    console.log(`\n${BOLD}🧪 MICRONUTRIENTES${RESET}`)
    const micros = [
        { key: 'vitamina_a_ug', label: 'Vitamina A (µg)', umbral: 0 },
        { key: 'vitamina_c_mg', label: 'Vitamina C (mg)', umbral: 0 },
        { key: 'vitamina_d_ug', label: 'Vitamina D (µg)', umbral: 0 },
        { key: 'vitamina_e_mg', label: 'Vitamina E (mg)', umbral: 0 },
        { key: 'vitamina_k_ug', label: 'Vitamina K (µg)', umbral: 0 },
        { key: 'vitamina_b6_mg', label: 'Vitamina B6 (mg)', umbral: 0 },
        { key: 'vitamina_b12_ug', label: 'Vitamina B12 (µg)', umbral: 0 },
        { key: 'tiamina_mg', label: 'Tiamina B1 (mg)', umbral: 0 },
        { key: 'riboflavina_mg', label: 'Riboflavina B2 (mg)', umbral: 0 },
        { key: 'niacina_mg', label: 'Niacina B3 (mg)', umbral: 0 },
        { key: 'folato_ug', label: 'Folato B9 (µg)', umbral: 0 },
        { key: 'calcio_mg', label: 'Calcio (mg)', umbral: 0 },
        { key: 'hierro_mg', label: 'Hierro (mg)', umbral: 0 },
        { key: 'magnesio_mg', label: 'Magnesio (mg)', umbral: 0 },
        { key: 'fosforo_mg', label: 'Fósforo (mg)', umbral: 0 },
        { key: 'potasio_mg', label: 'Potasio (mg)', umbral: 0 },
        { key: 'zinc_mg', label: 'Zinc (mg)', umbral: 0 },
        { key: 'cobre_mg', label: 'Cobre (mg)', umbral: 0 },
        { key: 'selenio_ug', label: 'Selenio (µg)', umbral: 0 },
    ]
    for (const m of micros) {
        const conDatos = todos.filter(a => (a[m.key] ?? 0) > m.umbral).length
        const pct = (conDatos / total) * 100
        console.log(`   ${m.label.padEnd(25)} ${String(conDatos).padStart(6)}/${total} ${bar(pct)}`)
    }

    // 6. Resumen general
    console.log(`\n${BOLD}📊 RESUMEN GENERAL${RESET}`)
    const camposTodos = [
        ...macros.map(m => m.key),
        ...lipidos.map(l => l.key),
        ...extra.map(e => e.key),
        ...micros.map(m => m.key),
    ]
    let totalCamposPosibles = camposTodos.length * total
    let totalCamposConDatos = 0
    for (const a of todos) {
        for (const key of camposTodos) {
            if ((a[key] ?? 0) > 0) totalCamposConDatos++
        }
    }
    const coberturaGlobal = (totalCamposConDatos / totalCamposPosibles) * 100
    console.log(`   Cobertura global: ${totalCamposConDatos}/${totalCamposPosibles} campos ${bar(coberturaGlobal)}`)

    // 7. Por fuente de datos
    console.log(`\n${BOLD}📦 DISTRIBUCIÓN POR FUENTE${RESET}`)
    /** @type {Record<string, number>} */
    const fuentes = {}
    for (const a of todos) {
        const f = a.fuente || 'desconocida'
        fuentes[f] = (fuentes[f] || 0) + 1
    }
    for (const [f, count] of Object.entries(fuentes).sort((a, b) => b[1] - a[1])) {
        const pct = (count / total) * 100
        console.log(`   ${f.padEnd(20)} ${String(count).padStart(6)} ${bar(pct)}`)
    }

    // 8. Fecha de última actualización
    console.log(`\n${BOLD}🕐 ÚLTIMA ACTUALIZACIÓN${RESET}`)
    const conFecha = todos.filter(a => a.micros_actualizados_en).length
    const pctFecha = (conFecha / total) * 100
    console.log(`   Con micros_actualizados_en: ${conFecha}/${total} ${bar(pctFecha)}`)

    // 9. Por categoría (si --full)
    if (FULL) {
        console.log(`\n${BOLD}📁 TOP CATEGORÍAS POR COBERTURA DE MICROS${RESET}`)
        /** @type {Record<string, {total: number, conMicros: number}>} */
        const cats = {}
        for (const a of todos) {
            const cat = a.categoria || 'sin categoría'
            if (!cats[cat]) cats[cat] = { total: 0, conMicros: 0 }
            cats[cat].total++
            // Consideramos "con micros" si tiene al menos 2 micronutrientes > 0
            const microsCount = micros.filter(m => (a[m.key] ?? 0) > 0).length
            if (microsCount >= 2) cats[cat].conMicros++
        }
        const sorted = Object.entries(cats).sort((a, b) => b[1].total - a[1].total)
        for (const [cat, datos] of sorted.slice(0, 15)) {
            const pct = (datos.conMicros / datos.total) * 100
            console.log(`   ${cat.padEnd(25)} ${String(datos.conMicros).padStart(5)}/${String(datos.total).padStart(5)} ${bar(pct)}`)
        }
    }

    console.log(`\n${MAGENTA}${BOLD}═══════════════════════════════════════════════════════════════${RESET}`)
    console.log(`${GREEN}✅ AUDITORÍA COMPLETADA${RESET}\n`)
}

main().catch(e => {
    console.error('💥 Fatal:', e.message)
    process.exit(1)
})
