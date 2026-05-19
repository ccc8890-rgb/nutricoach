#!/usr/bin/env node
/**
 * Script de diagnóstico — Auditoría de cobertura de perfil lipídico
 *
 * Muestra estadísticas detalladas de qué alimentos tienen/donde falta
 * el perfil lipídico (saturados, monoinsaturados, poliinsaturados, colesterol).
 *
 * Uso:
 *   node scripts/auditar-perfil-lipidico.mjs
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

// ── Main ────────────────────────────────────────────────────
async function main() {
    console.log(`${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)
    console.log(`${MAGENTA}  📊 AUDITORÍA DE COBERTURA — PERFIL LIPÍDICO${RESET}`)
    console.log(`${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)

    // 1. Total alimentos
    const todos = await fetchAll('alimentos?select=id,nombre,categoria,calorias,proteinas,carbohidratos,grasas,saturados_g,monoinsaturados_g,poliinsaturados_g,colesterol_mg,fuente')
    const total = todos.length
    console.log(`\n📦 Total alimentos en DB: ${total}`)

    // 2. Alimentos con grasas
    const conGrasas = todos.filter(a => (a.grasas ?? 0) > 0)
    const sinGrasasOMacroCero = todos.filter(a => (a.grasas ?? 0) <= 0)
    console.log(`\n── 1. COBERTURA BÁSICA ──`)
    console.log(`   Con grasas > 0:       ${String(conGrasas.length).padStart(5)} (${pct(conGrasas.length, total)})`)
    console.log(`   Sin grasas o =0:      ${String(sinGrasasOMacroCero.length).padStart(5)} (${pct(sinGrasasOMacroCero.length, total)})`)

    // 3. Alimentos CON perfil lipídico (cualquier campo > 0)
    const conSaturados = conGrasas.filter(a => (a.saturados_g ?? 0) > 0)
    const conMono = conGrasas.filter(a => (a.monoinsaturados_g ?? 0) > 0)
    const conPoli = conGrasas.filter(a => (a.poliinsaturados_g ?? 0) > 0)
    const conColesterol = conGrasas.filter(a => (a.colesterol_mg ?? 0) > 0)
    const conCualquierLipido = conGrasas.filter(a =>
        (a.saturados_g ?? 0) > 0 || (a.monoinsaturados_g ?? 0) > 0 ||
        (a.poliinsaturados_g ?? 0) > 0 || (a.colesterol_mg ?? 0) > 0
    )

    console.log(`\n── 2. COBERTURA DE PERFIL LIPÍDICO ──`)
    console.log(`   Con saturados > 0:           ${String(conSaturados.length).padStart(5)} (${pct(conSaturados.length, conGrasas.length)} de alimentos con grasas)`)
    console.log(`   Con monoinsaturados > 0:     ${String(conMono.length).padStart(5)} (${pct(conMono.length, conGrasas.length)})`)
    console.log(`   Con poliinsaturados > 0:     ${String(conPoli.length).padStart(5)} (${pct(conPoli.length, conGrasas.length)})`)
    console.log(`   Con colesterol > 0:          ${String(conColesterol.length).padStart(5)} (${pct(conColesterol.length, conGrasas.length)})`)
    console.log(`   Con cualquier lípido:        ${String(conCualquierLipido.length).padStart(5)} (${pct(conCualquierLipido.length, conGrasas.length)})`)
    console.log(`   SIN ningún dato lipídico:    ${String(conGrasas.length - conCualquierLipido.length).padStart(5)} (${pct(conGrasas.length - conCualquierLipido.length, conGrasas.length)}) ⚠️`)

    // 4. Por fuente
    const fuentes = {}
    for (const a of todos) {
        const f = a.fuente || 'sin-fuente'
        if (!fuentes[f]) fuentes[f] = { total: 0, conLipidos: 0 }
        fuentes[f].total++
        if ((a.saturados_g ?? 0) > 0) fuentes[f].conLipidos++
    }

    console.log(`\n── 3. COBERTURA POR FUENTE ──`)
    for (const [fuente, datos] of Object.entries(fuentes).sort((a, b) => b[1].total - a[1].total)) {
        console.log(`   ${fuente.padEnd(15)} ${String(datos.total).padStart(6)} alimentos → ${String(datos.conLipidos).padStart(6)} con lípidos (${pct(datos.conLipidos, datos.total)})`)
    }

    // 5. Por categoría (top 15)
    const cats = {}
    for (const a of conGrasas) {
        const cat = a.categoria || 'sin categoría'
        if (!cats[cat]) cats[cat] = { total: 0, conLipidos: 0 }
        cats[cat].total++
        if ((a.saturados_g ?? 0) > 0) cats[cat].conLipidos++
    }

    console.log(`\n── 4. COBERTURA POR CATEGORÍA (TOP 20) ──`)
    const sorted = Object.entries(cats).sort((a, b) => b[1].total - a[1].total)
    for (const [cat, datos] of sorted.slice(0, 20)) {
        const pctCobertura = pct(datos.conLipidos, datos.total)
        const barra = datos.conLipidos === 0 ? RED : datos.conLipidos === datos.total ? GREEN : YELLOW
        console.log(`   ${barra}${cat.padEnd(22)}${RESET} ${String(datos.total).padStart(5)} → ${String(datos.conLipidos).padStart(5)} cubiertos (${pctCobertura})`)
    }

    // 6. Alimentos destacados SIN perfil lipídico (top grasas)
    const sinPerfil = conGrasas
        .filter(a => !(a.saturados_g ?? 0) > 0)
        .sort((a, b) => (b.grasas ?? 0) - (a.grasas ?? 0))

    console.log(`\n── 5. TOP 20 ALIMENTOS CON MÁS GRASA SIN PERFIL LIPÍDICO ──`)
    for (const a of sinPerfil.slice(0, 20)) {
        console.log(`   ${String(a.grasas ?? 0).padStart(6)}g  [${a.categoria?.padEnd(15) || '?'}] ${a.nombre}`)
    }
    if (sinPerfil.length > 20) {
        console.log(`   ... y ${sinPerfil.length - 20} más`)
    }

    // 7. Resumen
    const pendientes = conGrasas.length - conCualquierLipido.length
    console.log(`\n${MAGENTA}══ RESUMEN ══${RESET}`)
    console.log(`   Total alimentos:             ${total}`)
    console.log(`   Con grasas > 0:              ${conGrasas.length}`)
    console.log(`   Con perfil lipídico:         ${conCualquierLipido.length}`)
    console.log(`   ${pendientes > 0 ? RED : GREEN}PENDIENTES:                   ${pendientes}${RESET}`)

    if (pendientes > 0) {
        console.log(`\n📋 Para enriquecer:`)
        console.log(`   node scripts/poblar-perfil-lipidico-masivo.mjs`)
        console.log(`   node scripts/poblar-perfil-lipidico-masivo.mjs --dry-run`)
    }

    // 8. Alimentos con BEDCA que SÍ tienen perfil (referencia)
    const bedcaConLipidos = todos.filter(a => a.fuente === 'bedca' && (a.saturados_g ?? 0) > 0)
    console.log(`\n── 6. REFERENCIA BEDCA (${bedcaConLipidos.length} alimentos con perfil lipídico completo) ──`)
    for (const a of bedcaConLipidos.slice(0, 10)) {
        console.log(`   ${a.nombre.padEnd(30)} S:${a.saturados_g} M:${a.monoinsaturados_g} P:${a.poliinsaturados_g} Col:${a.colesterol_mg}mg`)
    }
    if (bedcaConLipidos.length > 10) {
        console.log(`   ... y ${bedcaConLipidos.length - 10} más`)
    }
}

main().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})
