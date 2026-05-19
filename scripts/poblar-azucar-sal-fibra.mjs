#!/usr/bin/env node
/**
 * Script de enriquecimiento MASIVO de azúcares + sodio + fibra vía DeepSeek
 *
 * Procesa alimentos donde azucares=0, sodio_mg=0 o fibra=0
 * Envía LOTES de 30 alimentos por llamada DeepSeek (solo 3 campos → más eficiente).
 *
 * Uso:
 *   node scripts/poblar-azucar-sal-fibra.mjs                        # Producción real
 *   node scripts/poblar-azucar-sal-fibra.mjs --dry-run              # Solo diagnóstico
 *   node scripts/poblar-azucar-sal-fibra.mjs --max=500              # Procesar solo 500
 *   node scripts/poblar-azucar-sal-fibra.mjs --batch=40             # 40 alimentos por llamada
 *   node scripts/poblar-azucar-sal-fibra.mjs --fast                 # deepseek-chat (rápido)
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
const BATCH_SIZE = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '30', 10)
const MAX_ALIMENTOS = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '0', 10)
const DESDE_OFFSET = parseInt(args.find(a => a.startsWith('--desde-offset='))?.split('=')[1] || '0', 10)
const FETCH_TIMEOUT = parseInt(args.find(a => a.startsWith('--timeout='))?.split('=')[1] || '90', 10)
const MODELO_EFECTIVO = args.includes('--fast') ? 'deepseek-chat' : (DEEPSEEK_MODEL === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : DEEPSEEK_MODEL)

// ── Solo azúcar (procesado aparte por ser más específico) ───
const SOLO_AZUCAR = args.includes('--solo-azucar')
const SOLO_SODIO = args.includes('--solo-sodio')
const SOLO_FIBRA = args.includes('--solo-fibra')

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

// ── Fetch all with pagination ───────────────────────────────
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

// ── Obtener alimentos pendientes ────────────────────────────
async function getAlimentosPendientes() {
    log(`${CYAN}📊 Consultando alimentos con datos pendientes de azúcares/sodio/fibra...${RESET}`)

    // Construir filtro según flags
    let filtro
    if (SOLO_AZUCAR) {
        filtro = '&or=(azucares.is.null,azucares.eq.0)'
        log(`   Modo: solo azúcares`)
    } else if (SOLO_SODIO) {
        filtro = '&or=(sodio_mg.is.null,sodio_mg.eq.0)'
        log(`   Modo: solo sodio`)
    } else if (SOLO_FIBRA) {
        filtro = '&or=(fibra.is.null,fibra.eq.0)'
        log(`   Modo: solo fibra`)
    } else {
        // Por defecto: alimentos donde falte ALGUNO de los 3
        // Usamos múltiples condiciones OR
        filtro = '&or=(azucares.is.null,azucares.eq.0,sodio_mg.is.null,sodio_mg.eq.0,fibra.is.null,fibra.eq.0)'
    }

    const todos = await fetchAllAlimentos(
        'alimentos?select=id,nombre,categoria,calorias,proteinas,carbohidratos,grasas,azucares,sodio_mg,fibra,fuente' +
        '&calorias=gt.0' + filtro +
        '&fuente=neq.bedca&order=calorias.desc.nullslast'
    )

    if (!todos || todos.length === 0) {
        log('✅ Todos los alimentos ya tienen datos de azúcares, sodio y fibra.')
        return []
    }

    // Estadísticas de carencias
    const sinAzucar = todos.filter(a => !a.azucares || a.azucares === 0).length
    const sinSodio = todos.filter(a => !a.sodio_mg || a.sodio_mg === 0).length
    const sinFibra = todos.filter(a => !a.fibra || a.fibra === 0).length

    log(`📦 Encontrados ${todos.length} alimentos con datos pendientes:`)
    log(`   🍬 Sin azúcares: ${sinAzucar}`)
    log(`   🧂 Sin sodio: ${sinSodio}`)
    log(`   🌾 Sin fibra: ${sinFibra}`)
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

// ── DeepSeek — Enriquecer lote ──────────────────────────────
async function enriquecerLote(alimentos) {
    const alimentosParaPrompt = alimentos.map(a => ({
        id: a.id,
        nombre: a.nombre,
        categoria: a.categoria || 'desconocida',
        calorias: a.calorias || 0,
        proteinas: a.proteinas || 0,
        carbohidratos: a.carbohidratos || 0,
        grasas: a.grasas || 0,
        // Indicar qué datos YA tenemos para no pedirlos de nuevo
        tiene_azucar: (a.azucares || 0) > 0,
        tiene_sodio: (a.sodio_mg || 0) > 0,
        tiene_fibra: (a.fibra || 0) > 0,
    }))

    const prompt = `Eres un nutricionista experto en composición de alimentos basado en tablas oficiales BEDCA (Base de Datos Española de Composición de Alimentos) y USDA FoodData Central.

Para CADA alimento, proporciona estos 3 valores por 100g basándote ESTRICTAMENTE en tablas oficiales. No inventes valores.

CAMPOS SOLICITADOS (por alimento):
1. azucares (g) — azúcares simples/azúcares totales por 100g
   - Fruta fresca: 5-15g (manzana ~10g, plátano ~12g, fresas ~5g)
   - Fruta deshidratada: 50-70g
   - Lácteos: leche ~5g, yogur natural ~4g, yogur griego ~3g
   - Bebidas azucaradas: 8-12g por 100ml
   - Verduras: 1-5g
   - Carnes/pescados/huevos: 0-1g
   - Legumbres/cereales: 0-3g
   - Frutos secos: 3-7g
   - Miel/sirope: 70-85g

2. sodio_mg (mg) — sodio por 100g
   - Alimentos naturales (fruta, verdura, carne fresca, pescado fresco): 1-100mg
   - Lácteos: 40-200mg
   - Pan: 400-600mg
   - Embutidos/jamón: 800-2000mg
   - Quesos curados: 600-1500mg
   - Conservas: 300-800mg
   - Salsas: 500-2000mg
   - Snacks procesados: 400-1500mg
   - Frutos secos (naturales): 1-10mg
   - Frutos secos (fritos/salados): 200-600mg

3. fibra (g) — fibra dietética total por 100g
   - Fruta fresca: 1-5g
   - Verduras: 1-6g
   - Legumbres cocidas: 6-10g
   - Cereales integrales: 6-15g
   - Cereales refinados: 1-4g
   - Frutos secos: 6-12g
   - Carnes/pescados/huevos/lácteos: 0g
   - Aceites: 0g

NOTA IMPORTANTE: Si el alimento YA tiene un campo marcado como true (tiene_azucar/tiene_sodio/tiene_fibra), NO necesitas re-estimarlo, devuelve 0 o null para ese campo y no se sobrescribirá.

Responde SOLO JSON array, SIN markdown, SIN explicaciones:
[{"alimento_id":"uuid","nombre":"...","azucares":N,"sodio_mg":N,"fibra":N}]

Alimentos: ${JSON.stringify(alimentosParaPrompt)}`

    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        // @ts-ignore
        signal: AbortSignal.timeout(FETCH_TIMEOUT * 1000),
        body: JSON.stringify({
            model: MODELO_EFECTIVO,
            messages: [
                {
                    role: 'system',
                    content: 'Eres un nutricionista experto en tablas de composición de alimentos (BEDCA, USDA). Respondes SOLO con JSON válido, sin markdown, sin razonamiento, sin explicaciones. Tus valores son precisos y basados en datos oficiales.'
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

// ── Sanitizar valores ───────────────────────────────────────
function sanitizarValores(data, alimentosOriginales) {
    const updateData = {}
    const original = alimentosOriginales.find(a => a.id === data.alimento_id)

    // azucares (g) — solo sobrescribe si el original es 0 o null
    if (!original?.azucares || original.azucares === 0) {
        const val = data.azucares
        if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
            updateData.azucares = Math.max(0, Math.round(val * 100) / 100)
        } else if (typeof val === 'string') {
            const parsed = parseFloat(val)
            if (!isNaN(parsed) && isFinite(parsed)) {
                updateData.azucares = Math.max(0, Math.round(parsed * 100) / 100)
            }
        }
    }

    // sodio_mg (mg) — solo sobrescribe si el original es 0 o null
    if (!original?.sodio_mg || original.sodio_mg === 0) {
        const val = data.sodio_mg
        if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
            updateData.sodio_mg = Math.max(0, Math.round(val * 100) / 100)
        } else if (typeof val === 'string') {
            const parsed = parseFloat(val)
            if (!isNaN(parsed) && isFinite(parsed)) {
                updateData.sodio_mg = Math.max(0, Math.round(parsed * 100) / 100)
            }
        }
    }

    // fibra (g) — solo sobrescribe si el original es 0 o null
    if (!original?.fibra || original.fibra === 0) {
        const val = data.fibra
        if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
            updateData.fibra = Math.max(0, Math.round(val * 100) / 100)
        } else if (typeof val === 'string') {
            const parsed = parseFloat(val)
            if (!isNaN(parsed) && isFinite(parsed)) {
                updateData.fibra = Math.max(0, Math.round(parsed * 100) / 100)
            }
        }
    }

    return updateData
}

// ── Estadísticas ────────────────────────────────────────────
function calcularEstadisticas(alimentos) {
    const stats = {
        total: alimentos.length,
        conAzucar: alimentos.filter(a => (a.azucares || 0) > 0).length,
        conSodio: alimentos.filter(a => (a.sodio_mg || 0) > 0).length,
        conFibra: alimentos.filter(a => (a.fibra || 0) > 0).length,
    }
    return stats
}

// ── Mostrar resumen por categorías ──────────────────────────
function mostrarResumenCategorias(alimentos) {
    const cats = {}
    for (const a of alimentos) {
        const cat = a.categoria || 'sin categoría'
        if (!cats[cat]) cats[cat] = { count: 0 }
        cats[cat].count++
    }

    const sorted = Object.entries(cats).sort((a, b) => b[1].count - a[1].count)
    console.log(`\n${CYAN}📊 Distribución por categorías:${RESET}`)
    for (const [cat, datos] of sorted) {
        const pct = ((datos.count / alimentos.length) * 100).toFixed(1)
        console.log(`   ${cat.padEnd(25)} ${String(datos.count).padStart(5)} (${pct}%)`)
    }
}

// ── Verificar si un lote ya fue procesado ───────────────────
async function verificarYaProcesados(ids) {
    // Verificamos campo por campo según el modo activo
    // Esto evita re-enviar a DeepSeek alimentos que ya tienen datos completos
    const { data, error } = await supabase
        .from('alimentos')
        .select('id, azucares, sodio_mg, fibra')
        .in('id', ids)

    if (error) return new Set()

    // Determinar qué campos comprobar según flags
    const checkAzucar = !SOLO_SODIO && !SOLO_FIBRA
    const checkSodio = !SOLO_AZUCAR && !SOLO_FIBRA
    const checkFibra = !SOLO_AZUCAR && !SOLO_SODIO

    return new Set(
        (data || [])
            .filter(a => {
                const tieneAzucar = !checkAzucar || (a.azucares || 0) > 0
                const tieneSodio = !checkSodio || (a.sodio_mg || 0) > 0
                const tieneFibra = !checkFibra || (a.fibra || 0) > 0
                return tieneAzucar && tieneSodio && tieneFibra
            })
            .map(a => a.id)
    )
}

// ── Main ────────────────────────────────────────────────────
async function main() {
    log(`${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)
    log(`${MAGENTA}  🍬 ENRIQUECIMIENTO MASIVO — AZÚCAR + SODIO + FIBRA${RESET}`)
    log(`${MAGENTA}═══════════════════════════════════════════════════════════════${RESET}`)
    log(`Modelo: ${MODELO_EFECTIVO}`)
    log(`Batch: ${BATCH_SIZE} alimentos por llamada`)
    log(`Dry-run: ${DRY_RUN ? 'SÍ' : 'NO'}`)
    log(`Offset: ${DESDE_OFFSET}`)
    log(`Max: ${MAX_ALIMENTOS > 0 ? MAX_ALIMENTOS : 'sin límite'}`)
    log('')

    // 1. Obtener alimentos
    const alimentos = await getAlimentosPendientes()
    if (alimentos.length === 0) {
        log(`${GREEN}✅ No hay alimentos pendientes de enriquecer.${RESET}`)
        return
    }

    // Estadísticas iniciales
    const statsInicial = calcularEstadisticas(alimentos)
    log(`${CYAN}📊 Estado inicial de los ${alimentos.length} alimentos pendientes:${RESET}`)
    log(`   🍬 Con azúcares: ${statsInicial.conAzucar} (${((statsInicial.conAzucar / alimentos.length) * 100).toFixed(1)}%)`)
    log(`   🧂 Con sodio: ${statsInicial.conSodio} (${((statsInicial.conSodio / alimentos.length) * 100).toFixed(1)}%)`)
    log(`   🌾 Con fibra: ${statsInicial.conFibra} (${((statsInicial.conFibra / alimentos.length) * 100).toFixed(1)}%)`)
    log('')

    // Mostrar resumen por categorías
    mostrarResumenCategorias(alimentos)

    const totalLotes = Math.ceil(alimentos.length / BATCH_SIZE)
    log(`\n${CYAN}📦 Total: ${alimentos.length} alimentos en ${totalLotes} lotes de ${BATCH_SIZE}${RESET}`)

    if (DRY_RUN) {
        log(`\n${YELLOW}🏁 MODO DRY-RUN — No se modificará la base de datos.${RESET}`)
        log(`Para ejecutar en producción: node scripts/poblar-azucar-sal-fibra.mjs --fast`)
        log(`Para limitar: node scripts/poblar-azucar-sal-fibra.mjs --fast --max=500`)
        log(`Para reanudar: node scripts/poblar-azucar-sal-fibra.mjs --fast --desde-offset=500`)
        return
    }

    // 2. Procesar por lotes
    log(`\n${CYAN}🚀 Iniciando procesamiento...${RESET}\n`)
    let procesados = 0
    let actualizados = 0
    let errores = []
    const inicioGlobal = Date.now()

    for (let i = 0; i < alimentos.length; i += BATCH_SIZE) {
        const lote = alimentos.slice(i, i + BATCH_SIZE)
        const numLote = Math.floor(i / BATCH_SIZE) + 1
        const pctTotal = Math.round((i / alimentos.length) * 100)

        log(`${CYAN}[${numLote}/${totalLotes} - ${pctTotal}%]${RESET} Procesando lote de ${lote.length} alimentos...`)

        // Verificar si alguno ya fue procesado completamente
        const yaProcesados = await verificarYaProcesados(lote.map(a => a.id))
        const loteFiltrado = lote.filter(a => !yaProcesados.has(a.id))

        if (loteFiltrado.length === 0) {
            ok(`Lote ${numLote}: todos ya procesados anteriormente`)
            continue
        }

        if (loteFiltrado.length < lote.length) {
            warn(`Lote ${numLote}: ${lote.length - loteFiltrado.length} ya completados, quedan ${loteFiltrado.length}`)
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
            const updateData = sanitizarValores(r, loteFiltrado)

            // Solo actualizar si hay algo que cambiar
            if (Object.keys(updateData).length === 0) {
                continue
            }

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

        // Pausa entre lotes
        if (i + BATCH_SIZE < alimentos.length) {
            await sleep(1000)
        }
    }

    // 3. Estadísticas finales
    const duracionTotal = ((Date.now() - inicioGlobal) / 1000).toFixed(0)

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
    log('')
}

main().catch(e => {
    console.error('💥 Fatal:', e.message)
    process.exit(1)
})
