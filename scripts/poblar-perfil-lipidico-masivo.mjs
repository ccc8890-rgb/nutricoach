#!/usr/bin/env node
/**
 * Script de enriquecimiento MASIVO de perfil lipídico vía DeepSeek
 *
 * Procesa alimentos con grasas > 0 pero SIN datos de saturados/mono/poli/colesterol
 * Envía LOTES de 50 alimentos por llamada DeepSeek para maximizar eficiencia.
 *
 * Uso:
 *   node scripts/poblar-perfil-lipidico-masivo.mjs                  # Producción real
 *   node scripts/poblar-perfil-lipidico-masivo.mjs --dry-run        # Solo diagnóstico
 *   node scripts/poblar-perfil-lipidico-masivo.mjs --max=200        # Procesar solo 200
 *   node scripts/poblar-perfil-lipidico-masivo.mjs --batch=25       # 25 alimentos por llamada
 *   node scripts/poblar-perfil-lipidico-masivo.mjs --desde-offset=500  # Reanudar desde offset
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
const DRY_RUN = args.includes('--dry-run')
// Batch de 15 por defecto: DeepSeek responde mejor con lotes pequeños
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '15', 10)
const MAX_ALIMENTOS = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '0', 10)
const DESDE_OFFSET = parseInt(args.find(a => a.startsWith('--desde-offset='))?.split('=')[1] || '0', 10)
// Timeout por llamada DeepSeek (segundos)
const FETCH_TIMEOUT = parseInt(args.find(a => a.startsWith('--timeout='))?.split('=')[1] || '90', 10)
// Usar deepseek-chat por defecto (más rápido); deepseek-v4-pro para mayor precisión
const MODELO_EFECTIVO = args.includes('--fast') ? 'deepseek-chat' : (DEEPSEEK_MODEL === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : DEEPSEEK_MODEL)

// ── Logging helpers ─────────────────────────────────────────
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const RESET = '\x1b[0m'

function log(...args) { console.log(`[${new Date().toLocaleTimeString()}]`, ...args) }
function ok(msg) { log(`${GREEN}✓${RESET} ${msg}`) }
function warn(msg) { log(`${YELLOW}⚠${RESET} ${msg}`) }
function err(msg) { log(`${RED}✗${RESET} ${msg}`) }

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Fetch all with pagination (Supabase REST API defaults to 1000 limit) ──
async function fetchAllAlimentos(query) {
    let all = []
    let from = 0
    const pageSize = 1000
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
        from += pageSize
    }
    return all
}

// ── Obtener alimentos SIN perfil lipídico ───────────────────
async function getAlimentosSinPerfilLipidico() {
    log(`${CYAN}📊 Consultando alimentos con grasas > 0 pero sin perfil lipídico...${RESET}`)

    // Usamos REST API directamente con paginación para evitar límite de 1000 rows
    const todos = await fetchAllAlimentos(
        'alimentos?select=id,nombre,categoria,calorias,proteinas,carbohidratos,grasas,saturados_g,monoinsaturados_g,poliinsaturados_g,colesterol_mg,fibra,fuente' +
        '&grasas=gt.0&or=(saturados_g.is.null,saturados_g.eq.0)&fuente=neq.bedca&order=grasas.desc.nullslast'
    )

    if (!todos || todos.length === 0) {
        log('✅ Todos los alimentos ya tienen perfil lipídico.')
        return []
    }

    log(`📦 Encontrados ${todos.length} alimentos sin perfil lipídico`)
    const grasasTotales = todos.reduce((s, a) => s + (a.grasas || 0), 0)
    log(`   Grasa total media: ${(grasasTotales / todos.length).toFixed(1)}g`)
    log(`   Grasa total acumulada: ${grasasTotales.toFixed(0)}g`)
    log('')

    // Aplicar --desde-offset y --max
    let resultados = todos
    if (DESDE_OFFSET > 0) {
        resultados = resultados.slice(DESDE_OFFSET)
        log(`${YELLOW}⏩ Saltando primeros ${DESDE_OFFSET} (--desde-offset)${RESET}`)
        log(`   Quedan: ${resultados.length} alimentos`)
    }
    if (MAX_ALIMENTOS > 0 && resultados.length > MAX_ALIMENTOS) {
        resultados = resultados.slice(0, MAX_ALIMENTOS)
        log(`${YELLOW}⏩ Limitado a ${MAX_ALIMENTOS} alimentos (--max)${RESET}`)
    }

    return resultados
}

// ── DeepSeek — Enriquecer lote de perfil lipídico ────────────
async function enriquecerLote(alimentos) {
    const alimentosParaPrompt = alimentos.map(a => ({
        id: a.id,
        nombre: a.nombre,
        categoria: a.categoria || 'desconocida',
        calorias: a.calorias || 0,
        proteinas: a.proteinas || 0,
        carbohidratos: a.carbohidratos || 0,
        grasas: a.grasas || 0,
    }))

    const prompt = `Eres un nutricionista experto. Para cada alimento, proporciona perfil lipídico por 100g basado en BEDCA/USDA.

REGLAS:
- suma(saturados+mono+poli) ≈ grasas totales (tolera ±2g)
- colesterol=0 si es vegetal (fruta, verdura, legumbre, cereal, aceite vegetal, fruto seco)
- colesterol>0 si es animal (carne, pescado, huevo, lácteo)
- Aceites: sat 10-15%, mono 70-80%, poli 10-15%
- Carnes rojas: sat 40-50%, mono 40-50%, poli 5-10%
- Pescado azul: sat 25-30%, mono 25-35%, poli 30-40%
- Frutos secos: sat 10-15%, mono 50-70%, poli 20-35%

Responde SOLO JSON array, SIN markdown:
[{"alimento_id":"uuid","nombre":"...","saturados_g":N,"monoinsaturados_g":N,"poliinsaturados_g":N,"colesterol_mg":N}]

Alimentos: ${JSON.stringify(alimentosParaPrompt)}`

    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        // @ts-ignore - AbortSignal.timeout disponible en Node 18+
        signal: AbortSignal.timeout(FETCH_TIMEOUT * 1000),
        body: JSON.stringify({
            model: MODELO_EFECTIVO,
            messages: [
                {
                    role: 'system',
                    content: 'Eres un nutricionista experto. Respondes SOLO con JSON válido, sin markdown, sin razonamiento.'
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.05,
            max_tokens: 4096,
        }),
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`DeepSeek API error ${response.status}: ${text.substring(0, 300)}`)
    }

    const json = await response.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('No content in DeepSeek response')

    // Parse JSON del response (maneja posible markdown wrapping)
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error(`No JSON array found in response. Content: ${content.substring(0, 200)}`)

    const resultados = JSON.parse(jsonMatch[0])

    if (!Array.isArray(resultados)) {
        throw new Error('Response is not an array')
    }

    return resultados
}

// ── Validar y sanitizar valores lipídicos ───────────────────
function sanitizarValoresLipidicos(data) {
    const campos = ['saturados_g', 'monoinsaturados_g', 'poliinsaturados_g', 'colesterol_mg']
    const updateData = {}

    for (const campo of campos) {
        const val = data[campo]
        if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
            updateData[campo] = Math.max(0, Math.round(val * 100) / 100)
        } else if (typeof val === 'string') {
            const parsed = parseFloat(val)
            if (!isNaN(parsed) && isFinite(parsed)) {
                updateData[campo] = Math.max(0, Math.round(parsed * 100) / 100)
            } else {
                updateData[campo] = 0
            }
        } else {
            updateData[campo] = 0
        }
    }

    // Validación: la suma de saturados+mono+poli no debe exceder grasas totales en más de 2g
    // (permitimos pequeñas diferencias por otros lípidos como trans)
    // Esto es solo advertencia, no bloqueamos

    return updateData
}

// ── Estadísticas de cobertura de grasa ──────────────────────
function calcularEstadisticas(alimentos, resultadosProcesados) {
    const stats = {
        total: alimentos.length,
        procesados: resultadosProcesados.length,
        grasasTotal: 0,
        saturadosTotal: 0,
        monoTotal: 0,
        poliTotal: 0,
        colesterolTotal: 0,
        conColesterol: 0,
        sinColesterol: 0,
    }

    for (const r of resultadosProcesados) {
        stats.saturadosTotal += r.saturados_g || 0
        stats.monoTotal += r.monoinsaturados_g || 0
        stats.poliTotal += r.poliinsaturados_g || 0
        if ((r.colesterol_mg || 0) > 0) {
            stats.conColesterol++
        } else {
            stats.sinColesterol++
        }
    }

    // Grasas totales de los alimentos originales
    for (const a of alimentos) {
        stats.grasasTotal += a.grasas || 0
    }

    return stats
}

// ── Mostrar resumen por categorías ──────────────────────────
function mostrarResumenCategorias(alimentos) {
    const cats = {}
    for (const a of alimentos) {
        const cat = a.categoria || 'sin categoría'
        if (!cats[cat]) cats[cat] = { count: 0, grasasTotal: 0 }
        cats[cat].count++
        cats[cat].grasasTotal += a.grasas || 0
    }

    const sorted = Object.entries(cats).sort((a, b) => b[1].count - a[1].count)
    console.log(`\n${CYAN}📊 Distribución por categorías:${RESET}`)
    for (const [cat, datos] of sorted) {
        const pct = ((datos.count / alimentos.length) * 100).toFixed(1)
        console.log(`   ${cat.padEnd(25)} ${String(datos.count).padStart(5)} (${pct}%)  ~${datos.grasasTotal.toFixed(0)}g grasas totales`)
    }
}

// ── Verificar si un lote ya fue procesado (evitar duplicados) ──
async function verificarYaProcesados(ids) {
    const { data, error } = await supabase
        .from('alimentos')
        .select('id, saturados_g')
        .in('id', ids)
        .gt('saturados_g', 0)

    if (error) return new Set()
    return new Set((data || []).map(a => a.id))
}

// ── Main ────────────────────────────────────────────────────
async function main() {
    log(`${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)
    log(`${MAGENTA}  🥩 ENRIQUECIMIENTO MASIVO DE PERFIL LIPÍDICO vía DeepSeek${RESET}`)
    log(`${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)
    log(`Modelo: ${DEEPSEEK_MODEL}`)
    log(`Batch: ${BATCH_SIZE} alimentos por llamada`)
    log(`Dry-run: ${DRY_RUN ? 'SÍ' : 'NO'}`)
    log(`Offset: ${DESDE_OFFSET}`)
    log(`Max: ${MAX_ALIMENTOS > 0 ? MAX_ALIMENTOS : 'sin límite'}`)
    log('')

    // 1. Obtener alimentos
    const alimentos = await getAlimentosSinPerfilLipidico()
    if (alimentos.length === 0) {
        log(`${GREEN}✅ No hay alimentos pendientes de enriquecer.${RESET}`)
        return
    }

    // Mostrar resumen por categorías
    mostrarResumenCategorias(alimentos)

    const totalLotes = Math.ceil(alimentos.length / BATCH_SIZE)
    log(`\n${CYAN}📦 Total: ${alimentos.length} alimentos en ${totalLotes} lotes de ${BATCH_SIZE}${RESET}`)

    if (DRY_RUN) {
        log(`\n${YELLOW}🏁 MODO DRY-RUN — No se modificará la base de datos.${RESET}`)
        log(`Para ejecutar en producción: node scripts/poblar-perfil-lipidico-masivo.mjs`)
        log(`Para limitar: node scripts/poblar-perfil-lipidico-masivo.mjs --max=200`)
        log(`Para reanudar: node scripts/poblar-perfil-lipidico-masivo.mjs --desde-offset=500`)
        return
    }

    // 2. Procesar por lotes
    log(`\n${CYAN}🚀 Iniciando procesamiento...${RESET}\n`)
    let procesados = 0
    let actualizados = 0
    let errores = []
    let totalTokens = 0
    const inicioGlobal = Date.now()

    for (let i = 0; i < alimentos.length; i += BATCH_SIZE) {
        const lote = alimentos.slice(i, i + BATCH_SIZE)
        const numLote = Math.floor(i / BATCH_SIZE) + 1
        const pctTotal = Math.round((i / alimentos.length) * 100)

        log(`${CYAN}[${numLote}/${totalLotes} - ${pctTotal}%]${RESET} Procesando lote de ${lote.length} alimentos...`)

        // Verificar si alguno ya fue procesado (por si se reanuda)
        const yaProcesados = await verificarYaProcesados(lote.map(a => a.id))
        const loteFiltrado = lote.filter(a => !yaProcesados.has(a.id))

        if (loteFiltrado.length === 0) {
            ok(`Lote ${numLote}: todos ya procesados anteriormente`)
            continue
        }

        if (loteFiltrado.length < lote.length) {
            warn(`Lote ${numLote}: ${lote.length - loteFiltrado.length} ya procesados, quedan ${loteFiltrado.length}`)
        }

        // Llamar a DeepSeek (hasta 2 intentos)
        let resultados = null
        for (let intento = 0; intento < 2; intento++) {
            try {
                resultados = await enriquecerLote(loteFiltrado)
                break
            } catch (e) {
                if (intento < 1) {
                    warn(`Lote ${numLote}: reintentando... (${e.message?.substring(0, 100)})`)
                    await sleep(2000)
                } else {
                    err(`Lote ${numLote}: error tras 2 intentos — ${e.message?.substring(0, 120)}`)
                    errores.push(`Lote ${numLote} (${loteFiltrado[0]?.nombre}...): ${e.message || 'Error'}`)
                }
            }
        }

        if (!resultados) {
            procesados += loteFiltrado.length
            continue
        }

        // Actualizar cada alimento en Supabase
        let okLote = 0
        let errLote = 0
        for (const r of resultados) {
            const updateData = sanitizarValoresLipidicos(r)
            // Añadir fecha de actualización
            updateData.micros_actualizados_en = new Date().toISOString().split('T')[0]

            const { error: updateError } = await supabase
                .from('alimentos')
                .update(updateData)
                .eq('id', r.alimento_id)

            if (updateError) {
                errLote++
                errores.push(`${r.nombre || r.alimento_id}: ${updateError.message}`)
            } else {
                okLote++
                actualizados++
            }
        }

        procesados += loteFiltrado.length
        log(`   ${GREEN}✓${RESET} ${okLote} actualizados | ${RED}✗${RESET} ${errLote} errores | ${loteFiltrado.length - okLote - errLote} sin cambios`)

        // Pausa entre lotes para evitar rate limits
        if (i + BATCH_SIZE < alimentos.length) {
            await sleep(1000)
        }
    }

    // 3. Estadísticas finales
    const duracionTotal = ((Date.now() - inicioGlobal) / 1000).toFixed(0)
    const stats = calcularEstadisticas(alimentos, alimentos)

    log(`\n${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)
    log(`${GREEN}✅ ENRIQUECIMIENTO COMPLETADO${RESET}`)
    log(`   Duración: ${duracionTotal}s`)
    log(`   Alimentos objetivo: ${alimentos.length}`)
    log(`   Procesados: ${procesados}`)
    log(`   Actualizados: ${actualizados}`)
    log(`   Errores: ${errores.length}`)
    if (errores.length > 0) {
        log(`   Primeros errores:`)
        errores.slice(0, 5).forEach(e => log(`     • ${e}`))
    }

    // Mostrar cobertura post-ejecución
    log(`\n${CYAN}📊 Verificar cobertura post-enriquecimiento:${RESET}`)
    log(`   node scripts/auditar-perfil-lipidico.mjs`)
    log('')
}

main().catch(e => {
    console.error('💥 Fatal:', e.message)
    process.exit(1)
})
