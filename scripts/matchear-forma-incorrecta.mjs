/**
 * matchear-forma-incorrecta.mjs
 *
 * Segunda pasada (read-only) sobre los hallazgos tipo "forma_incorrecta" de
 * salidas/auditoria-forma-ingredientes-*.json. No confía en el texto libre de
 * la sugerencia de la IA: busca en la tabla `alimentos` real el mejor candidato
 * y solo lo marca como "alta confianza" (auto-aplicable) cuando hay un match
 * inequívoco. El resto queda en un listado de revisión manual.
 *
 * USO:
 *   node scripts/matchear-forma-incorrecta.mjs
 *
 * OUTPUT:
 *   salidas/forma-incorrecta-alta-confianza-FECHA.json   (auto-aplicables)
 *   salidas/forma-incorrecta-revision-manual-FECHA.json  (requieren ojo humano)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
    const p = resolve(ROOT, '.env.local')
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
}
loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function normalizar(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, '').trim()
}

const QUALIFICADORES = new Set(['fresco', 'fresca', 'frescos', 'frescas', 'cocido', 'cocida', 'cocidos', 'cocidas', 'crudo', 'cruda', 'crudos', 'crudas'])

function extraerKeyword(sugerencia) {
    let s = sugerencia
        .replace(/^eliminar o vincular a\s*/i, '')
        .replace(/^vincular a\s*/i, '')
        .replace(/^usar\s*/i, '')
    // cortar en el primer paréntesis, coma o punto
    const cortes = [s.indexOf('('), s.indexOf(','), s.indexOf('.')].filter(i => i > 0)
    if (cortes.length) s = s.slice(0, Math.min(...cortes))
    s = s.replace(/^(un|una|el|la|los|las)\s+/i, '').trim()
    // quitar comillas
    s = s.replace(/['"]/g, '').trim()
    return s
}

function coreWords(keyword) {
    return normalizar(keyword).split(/\s+/).filter(w => w.length > 2 && !QUALIFICADORES.has(w))
}

async function buscarCandidatos(keyword) {
    const frase = keyword.trim()
    let { data } = await sb.from('alimentos').select('id,nombre,calorias,es_comestible').ilike('nombre', `%${frase}%`).eq('es_comestible', true).limit(15)
    if (!data || data.length === 0) {
        const palabras = coreWords(keyword)
        if (palabras.length > 0) {
            const principal = palabras.sort((a, b) => b.length - a.length)[0]
            const res = await sb.from('alimentos').select('id,nombre,calorias,es_comestible').ilike('nombre', `%${principal}%`).eq('es_comestible', true).limit(20)
            data = res.data
        }
    }
    return data || []
}

function elegirMejor(keyword, candidatos) {
    const keywordNorm = normalizar(keyword)
    const palabrasClave = coreWords(keyword)

    const puntuados = candidatos
        .filter(c => c.calorias > 0 || keywordNorm.includes('agua') || keywordNorm.includes('sal'))
        .map(c => {
            const nombreNorm = normalizar(c.nombre)
            let score = 0
            if (nombreNorm === keywordNorm) score += 100
            else if (nombreNorm.startsWith(keywordNorm)) score += 50
            const palabrasNombre = nombreNorm.split(/\s+/)
            const coincideTodas = palabrasClave.every(p => nombreNorm.includes(p))
            if (coincideTodas) score += 30
            score -= palabrasNombre.length // preferir nombres cortos/genéricos
            return { ...c, score }
        })
        .sort((a, b) => b.score - a.score)

    return puntuados
}

async function main() {
    const informe = JSON.parse(readFileSync(resolve(ROOT, 'salidas/auditoria-forma-ingredientes-2026-09-26.json'), 'utf-8'))
    const hallazgos = informe.hallazgos.filter(h => h.tipo === 'forma_incorrecta')
    console.log(`🔍 ${hallazgos.length} hallazgos "forma_incorrecta" a resolver contra alimentos reales...\n`)

    const altaConfianza = []
    const revisionManual = []

    let i = 0
    for (const h of hallazgos) {
        i++
        const keyword = extraerKeyword(h.sugerencia)
        if (!keyword || keyword.length < 3) {
            revisionManual.push({ ...h, motivo_revision: 'sugerencia no parseable', keyword_extraido: keyword })
            continue
        }
        const candidatos = await buscarCandidatos(keyword)
        const puntuados = elegirMejor(keyword, candidatos)

        if (puntuados.length === 0) {
            revisionManual.push({ ...h, motivo_revision: 'sin candidatos en BD', keyword_extraido: keyword })
        } else {
            const top = puntuados[0]
            const segundo = puntuados[1]
            const inequivoco = top.score >= 30 && (!segundo || top.score - segundo.score >= 15)
            if (inequivoco) {
                altaConfianza.push({ ...h, keyword_extraido: keyword, alimento_nuevo_id: top.id, alimento_nuevo_nombre: top.nombre, alimento_nuevo_calorias: top.calorias, score: top.score })
            } else {
                revisionManual.push({ ...h, motivo_revision: 'ambiguo', keyword_extraido: keyword, candidatos: puntuados.slice(0, 5).map(c => ({ id: c.id, nombre: c.nombre, score: c.score })) })
            }
        }
        if (i % 40 === 0) process.stdout.write(`\r   ${i}/${hallazgos.length}...`)
    }
    console.log(`\r   ${hallazgos.length}/${hallazgos.length} procesados.\n`)

    const hoy = new Date().toISOString().split('T')[0]
    const outDir = resolve(ROOT, 'salidas')
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(outDir, `forma-incorrecta-alta-confianza-${hoy}.json`), JSON.stringify(altaConfianza, null, 2))
    writeFileSync(resolve(outDir, `forma-incorrecta-revision-manual-${hoy}.json`), JSON.stringify(revisionManual, null, 2))

    console.log(`📊 RESULTADOS`)
    console.log(`   Alta confianza (auto-aplicable): ${altaConfianza.length}`)
    console.log(`   Revisión manual: ${revisionManual.length}`)
}

main().catch(console.error)
