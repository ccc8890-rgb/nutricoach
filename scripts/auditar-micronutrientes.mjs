#!/usr/bin/env node
/**
 * Script de diagnóstico — Auditoría de cobertura de micronutrientes
 *
 * Muestra estadísticas detalladas de qué alimentos tienen/dónde falta
 * cada vitamina y mineral. Analiza cobertura por categoría, fuente y
 * presenta un ranking de alimentos prioritarios.
 *
 * Uso:
 *   node scripts/auditar-micronutrientes.mjs
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Colors ──────────────────────────────────────────────────
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const RESET = '\x1b[0m'

// ── Lista completa de campos de micronutrientes ─────────────
const CAMPOS_MICRO = [
    { key: 'vitamina_a_ug', label: 'Vitamina A', unit: 'ug', tipo: 'vitamina' },
    { key: 'vitamina_c_mg', label: 'Vitamina C', unit: 'mg', tipo: 'vitamina' },
    { key: 'vitamina_d_ug', label: 'Vitamina D', unit: 'ug', tipo: 'vitamina' },
    { key: 'vitamina_e_mg', label: 'Vitamina E', unit: 'mg', tipo: 'vitamina' },
    { key: 'vitamina_k_ug', label: 'Vitamina K', unit: 'ug', tipo: 'vitamina' },
    { key: 'vitamina_b6_mg', label: 'Vitamina B6', unit: 'mg', tipo: 'vitamina' },
    { key: 'vitamina_b12_ug', label: 'Vitamina B12', unit: 'ug', tipo: 'vitamina' },
    { key: 'tiamina_mg', label: 'Tiamina (B1)', unit: 'mg', tipo: 'vitamina' },
    { key: 'riboflavina_mg', label: 'Riboflavina (B2)', unit: 'mg', tipo: 'vitamina' },
    { key: 'niacina_mg', label: 'Niacina (B3)', unit: 'mg', tipo: 'vitamina' },
    { key: 'folato_ug', label: 'Folato (B9)', unit: 'ug', tipo: 'vitamina' },
    { key: 'calcio_mg', label: 'Calcio', unit: 'mg', tipo: 'mineral' },
    { key: 'hierro_mg', label: 'Hierro', unit: 'mg', tipo: 'mineral' },
    { key: 'magnesio_mg', label: 'Magnesio', unit: 'mg', tipo: 'mineral' },
    { key: 'fosforo_mg', label: 'Fósforo', unit: 'mg', tipo: 'mineral' },
    { key: 'potasio_mg', label: 'Potasio', unit: 'mg', tipo: 'mineral' },
    { key: 'sodio_mg', label: 'Sodio', unit: 'mg', tipo: 'mineral' },
    { key: 'zinc_mg', label: 'Zinc', unit: 'mg', tipo: 'mineral' },
    { key: 'cobre_mg', label: 'Cobre', unit: 'mg', tipo: 'mineral' },
    { key: 'selenio_ug', label: 'Selenio', unit: 'ug', tipo: 'mineral' },
]

// ── Helpers ─────────────────────────────────────────────────
async function fetchAll(query) {
    let all = []
    let from = 0
    const limit = 1000
    while (true) {
        const url = `${SUPABASE_URL}/rest/v1/${query}&offset=${from}`
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
        from += limit
    }
    return all
}

function pct(num, total) {
    if (total === 0) return '0.0%'
    return `${((num / total) * 100).toFixed(1)}%`
}

// Probar si un alimento tiene un campo de micronutrientes > 0
function tieneMicro(a, campo) {
    const val = a[campo]
    return typeof val === 'number' && val > 0
}

// ── Main ────────────────────────────────────────────────────
async function main() {
    console.log(`${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)
    console.log(`${MAGENTA}  🥦 AUDITORÍA DE COBERTURA — MICRONUTRIENTES${RESET}`)
    console.log(`${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)

    // 1. Obtener todos los alimentos con calorías > 0
    const todos = await fetchAll(
        'alimentos?select=id,nombre,categoria,calorias,proteinas,carbohidratos,grasas,fuente,' +
        'vitamina_a_ug,vitamina_c_mg,vitamina_d_ug,vitamina_e_mg,vitamina_k_ug,' +
        'vitamina_b6_mg,vitamina_b12_ug,tiamina_mg,riboflavina_mg,niacina_mg,folato_ug,' +
        'calcio_mg,hierro_mg,magnesio_mg,fosforo_mg,potasio_mg,sodio_mg,zinc_mg,cobre_mg,selenio_ug'
    )
    const total = todos.length
    console.log(`\n📦 Total alimentos en DB: ${total}`)

    // 2. Alimentos con calorías (los que deberían tener micros)
    const conCalorias = todos.filter(a => (a.calorias ?? 0) > 0)
    const sinCalorias = todos.filter(a => (a.calorias ?? 0) <= 0)
    console.log(`\n── 1. COBERTURA BÁSICA ──`)
    console.log(`   Con calorías > 0:     ${String(conCalorias.length).padStart(5)} (${pct(conCalorias.length, total)})`)
    console.log(`   Sin calorías o =0:    ${String(sinCalorias.length).padStart(5)} (${pct(sinCalorias.length, total)})`)

    // 3. Cobertura por campo individual (de alimentos con calorías)
    console.log(`\n── 2. COBERTURA POR MICRONUTRIENTE ──`)

    // Vitaminas
    console.log(`\n   ${CYAN}VITAMINAS:${RESET}`)
    const camposVitamina = CAMPOS_MICRO.filter(c => c.tipo === 'vitamina')
    for (const c of camposVitamina) {
        const conDato = conCalorias.filter(a => tieneMicro(a, c.key)).length
        const color = conDato === 0 ? RED : (conDato < conCalorias.length * 0.5 ? YELLOW : GREEN)
        console.log(`   ${color}${c.label.padEnd(20)}${RESET} ${String(conDato).padStart(6)}/${String(conCalorias.length).padStart(5)} (${pct(conDato, conCalorias.length)})`)
    }

    // Minerales
    console.log(`\n   ${CYAN}MINERALES:${RESET}`)
    const camposMineral = CAMPOS_MICRO.filter(c => c.tipo === 'mineral')
    for (const c of camposMineral) {
        const conDato = conCalorias.filter(a => tieneMicro(a, c.key)).length
        const color = conDato === 0 ? RED : (conDato < conCalorias.length * 0.5 ? YELLOW : GREEN)
        console.log(`   ${color}${c.label.padEnd(20)}${RESET} ${String(conDato).padStart(6)}/${String(conCalorias.length).padStart(5)} (${pct(conDato, conCalorias.length)})`)
    }

    // 4. Resumen general: alimentos con ALGÚN micronutriente
    const conCualquierMicro = conCalorias.filter(a =>
        CAMPOS_MICRO.some(c => tieneMicro(a, c.key))
    )
    const conTodosMicros = conCalorias.filter(a =>
        CAMPOS_MICRO.every(c => tieneMicro(a, c.key))
    )
    const sinNingunMicro = conCalorias.filter(a =>
        CAMPOS_MICRO.every(c => !tieneMicro(a, c.key))
    )

    console.log(`\n── 3. RESUMEN GENERAL (alimentos con calorías) ──`)
    console.log(`   ${GREEN}Con algún micronutriente:${RESET}  ${String(conCualquierMicro.length).padStart(5)} (${pct(conCualquierMicro.length, conCalorias.length)})`)
    console.log(`   ${RED}Sin ningún micronutriente:${RESET} ${String(sinNingunMicro.length).padStart(5)} (${pct(sinNingunMicro.length, conCalorias.length)}) ⚠️`)
    console.log(`   Todos los 20 campos:    ${String(conTodosMicros.length).padStart(5)} (${pct(conTodosMicros.length, conCalorias.length)})`)

    // 5. Por fuente
    const fuentes = {}
    for (const a of conCalorias) {
        const f = a.fuente || 'sin-fuente'
        if (!fuentes[f]) fuentes[f] = { total: 0, conMicros: 0, conTodos: 0 }
        fuentes[f].total++
        if (CAMPOS_MICRO.some(c => tieneMicro(a, c.key))) fuentes[f].conMicros++
        if (CAMPOS_MICRO.every(c => tieneMicro(a, c.key))) fuentes[f].conTodos++
    }

    console.log(`\n── 4. COBERTURA POR FUENTE ──`)
    for (const [fuente, datos] of Object.entries(fuentes).sort((a, b) => b[1].total - a[1].total)) {
        const color = datos.conMicros === 0 ? RED : (datos.conMicros < datos.total * 0.5 ? YELLOW : GREEN)
        console.log(`   ${color}${fuente.padEnd(18)}${RESET} ${String(datos.total).padStart(6)} → ${String(datos.conMicros).padStart(5)} con micros (${pct(datos.conMicros, datos.total)}) | ${String(datos.conTodos).padStart(4)} completos`)
    }

    // 6. Por categoría (top 20)
    const cats = {}
    for (const a of conCalorias) {
        const cat = a.categoria || 'sin categoría'
        if (!cats[cat]) cats[cat] = { total: 0, conMicros: 0 }
        cats[cat].total++
        if (CAMPOS_MICRO.some(c => tieneMicro(a, c.key))) cats[cat].conMicros++
    }

    console.log(`\n── 5. COBERTURA POR CATEGORÍA (TOP 20) ──`)
    const sorted = Object.entries(cats).sort((a, b) => b[1].total - a[1].total)
    for (const [cat, datos] of sorted.slice(0, 20)) {
        const pctCobertura = pct(datos.conMicros, datos.total)
        const barra = datos.conMicros === 0 ? RED : datos.conMicros === datos.total ? GREEN : YELLOW
        console.log(`   ${barra}${cat.padEnd(22)}${RESET} ${String(datos.total).padStart(5)} → ${String(datos.conMicros).padStart(5)} cubiertos (${pctCobertura})`)
    }

    // 7. Top 20 alimentos con más calorías SIN micronutrientes
    const sinMicros = conCalorias
        .filter(a => CAMPOS_MICRO.every(c => !tieneMicro(a, c.key)))
        .sort((a, b) => (b.calorias ?? 0) - (a.calorias ?? 0))

    console.log(`\n── 6. TOP 20 ALIMENTOS CON MÁS CALORÍAS SIN MICRONUTRIENTES ──`)
    console.log(`   (${sinMicros.length} alimentos en total sin ningún micronutriente)`)
    for (const a of sinMicros.slice(0, 20)) {
        const grasasStr = a.grasas ? `g:${a.grasas}g` : ''
        const protStr = a.proteinas ? `p:${a.proteinas}g` : ''
        const chStr = a.carbohidratos ? `c:${a.carbohidratos}g` : ''
        console.log(`   ${String(Math.round(a.calorias ?? 0)).padStart(5)} kcal  [${(a.categoria || '?').padEnd(15)}] ${a.nombre.padEnd(40)} ${protStr} ${chStr} ${grasasStr}`)
    }

    // 8. Estado de la tanda en background
    console.log(`\n── 7. ESTADO DE TANDA EN EJECUCIÓN ──`)
    const actualizadosHoy = todos.filter(a => {
        const fecha = a.micros_actualizados_en
        return fecha && fecha.startsWith('2026-05-18')
    }).length
    console.log(`   Actualizados hoy (${'2026-05-18'}): ${actualizadosHoy} alimentos`)

    // 9. Resumen ejecutivo
    const pendientes = sinNingunMicro.length
    console.log(`\n${MAGENTA}══ RESUMEN ══${RESET}`)
    console.log(`   Total alimentos:                ${total}`)
    console.log(`   Con calorías > 0:               ${conCalorias.length}`)
    console.log(`   Con algún micronutriente:       ${conCualquierMicro.length}`)
    console.log(`   ${pendientes > 0 ? RED : GREEN}Sin ningún micronutriente:        ${pendientes}${RESET}`)
    console.log(`   Peor vitamina:                  ${camposVitamina.reduce((worst, c) => {
        const n = conCalorias.filter(a => tieneMicro(a, c.key)).length
        return n < worst.n ? { ...c, n } : worst
    }, { label: '', n: Infinity }).label} (${pct(
        conCalorias.filter(a => tieneMicro(a, camposVitamina.reduce((worst, c) => {
            const n = conCalorias.filter(a2 => tieneMicro(a2, c.key)).length
            return n < worst.n ? { ...c, n } : worst
        }, { label: '', n: Infinity }).key)).length,
        conCalorias.length
    )})`)

    if (pendientes > 0) {
        console.log(`\n📋 Para enriquecer:`)
        console.log(`   node scripts/poblar-micronutrientes-masivo.mjs --fast`)
        console.log(`   node scripts/poblar-micronutrientes-masivo.mjs --dry-run`)
    }

    // 10. Referencia BEDCA (valores reales)
    const bedcaConMicros = todos.filter(a => a.fuente === 'bedca' && tieneMicro(a, 'vitamina_a_ug'))
    console.log(`\n── 8. REFERENCIA BEDCA (${bedcaConMicros.length} alimentos con micros completos) ──`)
    for (const a of bedcaConMicros.slice(0, 8)) {
        const vals = camposVitamina.slice(0, 4).map(c => `${c.label.split(' ')[0]}:${a[c.key] ?? 0}`).join(' ')
        console.log(`   ${a.nombre.padEnd(30)} ${vals}`)
    }
    if (bedcaConMicros.length > 8) {
        console.log(`   ... y ${bedcaConMicros.length - 8} más`)
    }
}

main().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})
