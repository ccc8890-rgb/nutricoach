#!/usr/bin/env node
/**
 * Script para poblar micronutrientes de alimentos vía DeepSeek API
 * Se conecta directamente a Supabase con service_role key
 *
 * Uso: node scripts/poblar-micronutrientes.mjs [--alimento-id=<id>] [--batch=<n>]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

// ── Cargar .env.local ───────────────────────────────────────
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
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
}
if (!DEEPSEEK_API_KEY) {
    console.error('❌ Falta DEEPSEEK_API_KEY en .env.local')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Parse args ──────────────────────────────────────────────
const args = process.argv.slice(2)
const ALIMENTO_ID = args.find(a => a.startsWith('--alimento-id='))?.split('=')[1] || null
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '5', 10)

// ── Logging helpers ─────────────────────────────────────────
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

function log(...args) { console.log(`[${new Date().toLocaleTimeString()}]`, ...args) }
function ok(msg) { log(`${GREEN}✓${RESET} ${msg}`) }
function warn(msg) { log(`${YELLOW}⚠${RESET} ${msg}`) }
function err(msg) { log(`${RED}✗${RESET} ${msg}`) }

// ── Sleep helper ────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Get foods to process ────────────────────────────────────
async function getAlimentos() {
    let query = supabase
        .from('alimentos')
        .select('id, nombre, categoria, calorias, proteinas, carbohidratos, grasas')
        .or('vitamina_a_ug.is.null,vitamina_a_ug.eq.0')
        .neq('fuente', 'bedca')

    if (ALIMENTO_ID) {
        query = query.eq('id', ALIMENTO_ID)
    }

    const { data, error } = await query
    if (error) {
        console.error('❌ Error querying alimentos:', error.message)
        process.exit(1)
    }
    return data || []
}

// ── Call DeepSeek for one food ─────────────────────────────
async function poblarUnAlimento(alimento) {
    const prompt = `Genera micronutrientes por 100g para "${alimento.nombre}" (${alimento.categoria}).
Macros: ${alimento.calorias}kcal, P${alimento.proteinas}g, C${alimento.carbohidratos}g, G${alimento.grasas}g.
Basado en BEDCA/USDA. Responde SOLO JSON:`

    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [
                { role: 'system', content: 'Eres un nutricionista experto. Siempre respondes ÚNICAMENTE con JSON válido, sin markdown, sin razonamiento, sin explicaciones. Devuelve el JSON exacto solicitado.' },
                { role: 'user', content: prompt },
                { role: 'assistant', content: '{"vitamina_a_ug":' }
            ],
            temperature: 0.05,
            max_tokens: 4096,
        }),
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`DeepSeek API error ${response.status}: ${text.substring(0, 200)}`)
    }

    const json = await response.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('No content in DeepSeek response')

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')

    const micros = JSON.parse(jsonMatch[0])

    // Validate and sanitize values
    const campos = [
        'vitamina_a_ug', 'vitamina_c_mg', 'vitamina_d_ug', 'vitamina_e_mg',
        'vitamina_k_ug', 'vitamina_b6_mg', 'vitamina_b12_ug',
        'tiamina_mg', 'riboflavina_mg', 'niacina_mg', 'folato_ug',
        'calcio_mg', 'hierro_mg', 'magnesio_mg', 'fosforo_mg',
        'potasio_mg', 'sodio_mg', 'zinc_mg', 'cobre_mg', 'selenio_ug',
        'saturados_g', 'monoinsaturados_g', 'poliinsaturados_g', 'colesterol_mg',
    ]

    const updateData = {}
    for (const campo of campos) {
        const val = micros[campo]
        if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
            updateData[campo] = Math.max(0, Math.round(val * 100) / 100)
        } else {
            updateData[campo] = 0
        }
    }

    const { error: updateError } = await supabase
        .from('alimentos')
        .update(updateData)
        .eq('id', alimento.id)

    if (updateError) throw new Error(updateError.message)

    return true
}

// ── Main ────────────────────────────────────────────────────
async function main() {
    log(`${CYAN}🔬 Poblando micronutrientes de alimentos vía DeepSeek${RESET}`)
    log(`Modelo: ${DEEPSEEK_MODEL}`)
    log(`Batch: ${BATCH_SIZE} alimentos por lote`)
    log('')

    const alimentos = await getAlimentos()
    if (alimentos.length === 0) {
        log('✅ Todos los alimentos ya tienen micronutrientes. No hay nada que procesar.')
        return
    }

    log(`📊 Total alimentos a procesar: ${alimentos.length}`)
    log('')

    let processed = 0
    let errors = []
    let totalTokens = 0

    // Procesamiento secuencial con reintentos para evitar rate limits
    for (let i = 0; i < alimentos.length; i++) {
        const a = alimentos[i]
        const pctTotal = Math.round((i / alimentos.length) * 100)
        log(`${CYAN}[${i + 1}/${alimentos.length} (${pctTotal}%)]${RESET} ${a.nombre}...`)

        // Intentar hasta 2 veces
        let success = false
        for (let attempt = 0; attempt < 2 && !success; attempt++) {
            try {
                await poblarUnAlimento(a)
                ok(`${a.nombre} ✅`)
                processed++
                success = true
            } catch (e) {
                if (attempt < 1) {
                    warn(`${a.nombre} — reintentando... (${e.message?.substring(0, 60)})`)
                    await sleep(1000)
                } else {
                    err(`${a.nombre} ❌ — ${e.message?.substring(0, 80)}`)
                    errors.push(`${a.nombre}: ${e.message || 'Error'}`)
                }
            }
        }

        // Pequeña pausa entre cada alimento para evitar rate limits
        await sleep(300)
    }

    log('═══════════════════════════════════════════════')
    log(`${GREEN}✅ Completado${RESET}`)
    log(`   Procesados: ${processed}`)
    log(`   Errores: ${errors.length}`)
    if (errors.length > 0) {
        log(`   Primeros errores:`)
        errors.slice(0, 5).forEach(e => log(`     • ${e}`))
    }
}

main().catch(e => {
    console.error('💥 Fatal:', e.message)
    process.exit(1)
})
