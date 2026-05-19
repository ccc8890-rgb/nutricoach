#!/usr/bin/env node
/**
 * Re-procesa todos los productos_supermercado existentes aplicando el
 * algoritmo de matching mejorado (matchAlimentoInMemory v2) para
 * corregir alimento_id incorrectos.
 *
 * Detecta y repara casos como "pasta huevo" → "Huevos L" (falso positivo).
 *
 * Uso:
 *   node scripts/_reparar-matching-productos.mjs --dry-run   # solo inspeccionar
 *   node scripts/_reparar-matching-productos.mjs              # reparar (con confirmación)
 *   node scripts/_reparar-matching-productos.mjs --sql        # generar SQL
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(PROJECT_ROOT, '.env.local')
    if (!existsSync(envPath)) { console.error('❌ No .env.local'); process.exit(1) }
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
        process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const GENERAR_SQL = args.includes('--sql')

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const MAGENTA = '\x1b[35m'
const RESET = '\x1b[0m'

// ─── Lógica de matching (duplicada de lib/scraping/matcher.ts) ──
// ⚠️ Mantenida inline porque este script es .mjs (Node plano) y no puede
//    importar TypeScript. Si cambias la lógica, actualiza AMBOS archivos.

function quitarAcentos(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Misma lógica que matchAlimentoInMemory() con los fixes de nivel 3 y 5 */
function matchAlimentoInMemory(nombreLimpio, alimentosMap) {
    const lower = nombreLimpio.toLowerCase()

    // 1. Coincidencia exacta
    const exacto = alimentosMap.get(lower)
    if (exacto) return exacto

    // 2. Coincidencia exacta sin acentos
    const lowerSinAcentos = quitarAcentos(lower)
    for (const a of alimentosMap.values()) {
        if (quitarAcentos(a.nombreLower) === lowerSinAcentos) {
            return a
        }
    }

    // 3. Contiene (bidireccional)
    // - Si el alimento contiene el nombre completo del producto → match muy específico
    // - Si el producto contiene el nombre del alimento como palabra completa → match válido
    //   (con word boundaries para evitar "chocolate" → "Col" por substring)
    // - Entre matches donde el producto contiene al alimento, preferir el MÁS LARGO
    //   (más específico: "Salsa tomate..." > "Tomate")
    let mejor = null
    let mejorContainsLower = null  // aLower.includes(lower) — alimento contiene producto completo
    for (const a of alimentosMap.values()) {
        const aLower = a.nombreLower
        // Caso A: el alimento contiene el nombre completo del producto
        if (aLower.includes(lower)) {
            if (!mejorContainsLower || a.nombre.length < mejorContainsLower.nombre.length) {
                mejorContainsLower = a
            }
            continue
        }
        // Caso B: el producto contiene el nombre del alimento como palabra completa
        const aLowerEscaped = aLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const wordBoundaryRegex = new RegExp(`\\b${aLowerEscaped}\\b`)
        if (wordBoundaryRegex.test(lower)) {
            // Preferir el nombre más largo (más específico)
            if (!mejor || a.nombre.length > mejor.nombre.length) {
                mejor = a
            }
        }
    }
    // Caso A tiene prioridad sobre Caso B
    if (mejorContainsLower) mejor = mejorContainsLower
    if (mejor) return mejor

    // 4. Coincidencia por palabra clave (palabra más larga)
    const palabras = lower.split(/\s+/).filter(p => p.length > 2)
    if (palabras.length > 0) {
        const palabraClave = [...palabras].sort((a, b) => b.length - a.length)[0]
        const candidatos = []
        for (const a of alimentosMap.values()) {
            if (a.nombreLower.includes(palabraClave)) {
                candidatos.push(a)
            }
        }
        if (candidatos.length > 0) {
            const conMatch = candidatos.filter(a => {
                const palabrasAlimento = a.nombreLower.split(/\s+/)
                const coincidencias = palabras.filter(p =>
                    palabrasAlimento.some(pa => pa.includes(p) || p.includes(pa))
                )
                return coincidencias.length >= 2 || coincidencias.length === palabras.length
            })
            if (conMatch.length > 0) {
                conMatch.sort((a, b) => a.nombre.length - b.nombre.length)
                return conMatch[0]
            }
        }
    }

    // 5. Último recurso: palabra individual con límite de palabra
    // Si hay 2+ palabras relevantes, no usar nivel 5 (evitar falsos positivos)
    const palabrasFiltradas = (palabras.length ? palabras : [lower])
        .filter(p => p.length >= 3)
        .sort((a, b) => b.length - a.length)

    if (palabrasFiltradas.length >= 2) return null

    for (const palabra of palabrasFiltradas) {
        const regex = new RegExp(`\\b${palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        for (const a of alimentosMap.values()) {
            if (regex.test(a.nombreLower)) {
                return a
            }
        }
    }

    return null
}

// ─── NO usamos normalizador agresivo — usamos el nombre original directamente
//      como hace matchAlimentoInMemory() en index.ts. El algoritmo de matching
//      ya maneja variaciones internamente.
function limpiarNombre(nombre) {
    // Solo limpieza mínima: lowercase, trim, espacios múltiples
    return nombre.toLowerCase().replace(/\s+/g, ' ').trim()
}

// ─── Main ──────────────────────────────────────────────────────

async function fetchAll(table, select) {
    const all = []
    let from = 0
    const limit = 1000
    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select(select)
            .range(from, from + limit - 1)
            .order('id')

        if (error) { console.error(`❌ Error fetching ${table}:`, error.message); break }
        if (!data || data.length === 0) break
        all.push(...data)
        from += limit
    }
    return all
}

async function main() {
    console.log(`${CYAN}══════════════════════════════════════════════════════════════${RESET}`)
    console.log(`${CYAN}  🔧 Re-procesar matching de productos_supermercado existentes${RESET}`)
    console.log(`${CYAN}══════════════════════════════════════════════════════════════${RESET}`)
    console.log(`Dry-run: ${DRY_RUN ? 'SÍ' : 'NO'}`)
    console.log(`SQL:     ${GENERAR_SQL ? 'SÍ' : 'NO'}\n`)

    // 1. Cargar alimentos (solo comestibles para matching)
    console.log(`${YELLOW}📦 Cargando alimentos...${RESET}`)
    const alimentos = await fetchAll('alimentos', 'id, nombre')
    console.log(`   ${alimentos.length} alimentos cargados`)

    const alimentosMap = new Map()
    for (const a of alimentos) {
        alimentosMap.set(a.nombre.toLowerCase(), { id: a.id, nombre: a.nombre, nombreLower: a.nombre.toLowerCase() })
    }

    // 2. Cargar productos_supermercado con su alimento vinculado
    console.log(`\n${YELLOW}📦 Cargando productos_supermercado...${RESET}`)
    const productos = await fetchAll('productos_supermercado', 'id, nombre_original, alimento_id')
    console.log(`   ${productos.length} productos cargados`)

    // 3. Para cada producto, re-evaluar el match
    let corregidos = []
    let yaCorrectos = 0
    let sinMatch = []
    let errores = 0

    for (const p of productos) {
        const nombreOriginal = p.nombre_original
        const nombreLimpio = limpiarNombre(nombreOriginal)

        if (!nombreLimpio) {
            // Productos sin nombre o con solo stop words — mantener match actual
            yaCorrectos++
            continue
        }

        const mejorMatch = matchAlimentoInMemory(nombreLimpio, alimentosMap)

        if (!mejorMatch) {
            // No encontramos match — el actual puede ser incorrecto pero no tenemos alternativa
            sinMatch.push({ id: p.id, nombre: nombreOriginal, alimentoActual: p.alimento_id })
            continue
        }

        if (mejorMatch.id === p.alimento_id) {
            yaCorrectos++
        } else {
            const alimentoActual = alimentos.find(a => a.id === p.alimento_id)
            corregidos.push({
                id: p.id,
                nombre: nombreOriginal,
                nombreLimpio,
                alimentoAnterior: { id: p.alimento_id, nombre: alimentoActual?.nombre || '(desconocido)' },
                alimentoNuevo: { id: mejorMatch.id, nombre: mejorMatch.nombre },
            })
        }
    }

    // 4. Reporte
    console.log(`\n${CYAN}══════════════════════════════════════════════════════════════${RESET}`)
    console.log(`${CYAN}  📊 RESULTADOS DEL ANÁLISIS${RESET}`)
    console.log(`${CYAN}══════════════════════════════════════════════════════════════${RESET}`)
    console.log(`   ✅ Ya correctos:        ${yaCorrectos}`)
    console.log(`   🔧 A corregir:          ${corregidos.length}`)
    console.log(`   ❓ Sin match alternativo: ${sinMatch.length}`)

    if (corregidos.length > 0) {
        console.log(`\n${MAGENTA}🔧 Productos a re-vincular:${RESET}\n`)
        for (const c of corregidos) {
            console.log(`   • [${c.id}] "${c.nombre}"`)
            console.log(`     Limpio: "${c.nombreLimpio}"`)
            console.log(`     ${RED}✗${RESET} Actual: "${c.alimentoAnterior.nombre}" (${c.alimentoAnterior.id.slice(0, 8)})`)
            console.log(`     ${GREEN}✓${RESET} Nuevo:  "${c.alimentoNuevo.nombre}" (${c.alimentoNuevo.id.slice(0, 8)})`)
            console.log()
        }
    }

    if (sinMatch.length > 0) {
        console.log(`\n${YELLOW}❓ Productos sin match alternativo (mantienen alimento actual):${RESET}\n`)
        for (const s of sinMatch.slice(0, 20)) {
            console.log(`   • [${s.id}] "${s.nombre}"  → alimento: ${s.alimentoActual.slice(0, 8)}`)
        }
        if (sinMatch.length > 20) {
            console.log(`   ... y ${sinMatch.length - 20} más`)
        }
    }

    // 5. Ejecutar o mostrar SQL
    if (corregidos.length === 0) {
        console.log(`\n${GREEN}✅ Todos los productos ya están correctamente vinculados.${RESET}`)
        return
    }

    if (GENERAR_SQL) {
        console.log(`\n─── SQL GENERADO ─────────────────────────────────\n`)
        // Generar UPDATEs individuales
        for (const c of corregidos) {
            console.log(`update public.productos_supermercado set alimento_id = '${c.alimentoNuevo.id}' where id = '${c.id}';`)
        }
        console.log(`\n-- Total: ${corregidos.length} productos re-vinculados`)
        return
    }

    if (DRY_RUN) {
        console.log(`\n${YELLOW}🏁 Dry-run — no se modificó nada.${RESET}`)
        console.log(`Para aplicar: node scripts/_reparar-matching-productos.mjs`)
        console.log(`Para SQL:     node scripts/_reparar-matching-productos.mjs --sql`)
        return
    }

    // Confirmación
    if (!GENERAR_SQL) {
        console.log(`\n${RED}⚠️  ATENCIÓN: Se re-vincularán ${corregidos.length} productos con nuevos alimento_id.${RESET}`)
        console.log(`Pulsa Ctrl+C para cancelar o espera 5 segundos...`)
        await new Promise(r => setTimeout(r, 5000))

        // Ejecutar UPDATEs
        let ok = 0, err = 0
        const LOTE = 100
        for (let i = 0; i < corregidos.length; i += LOTE) {
            const lote = corregidos.slice(i, i + LOTE)
            // Actualizar cada uno individualmente porque tienen distintos alimento_id
            for (const c of lote) {
                const { error } = await supabase
                    .from('productos_supermercado')
                    .update({ alimento_id: c.alimentoNuevo.id })
                    .eq('id', c.id)

                if (error) {
                    console.error(`   ${RED}✗${RESET} ${c.nombre}: ${error.message}`)
                    err++
                } else {
                    ok++
                }
            }
            console.log(`   ${GREEN}✓${RESET} Lote ${i / LOTE + 1}: ${lote.length} productos actualizados (${ok}/${corregidos.length})`)
        }

        console.log(`\n${GREEN}✅ Reparación completada${RESET}`)
        console.log(`   Actualizados: ${ok}`)
        console.log(`   Errores: ${err}`)
    }
}

main().catch(e => { console.error('💥', e.message); process.exit(1) })
