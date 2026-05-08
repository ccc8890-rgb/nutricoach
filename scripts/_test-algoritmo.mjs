import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const env = {}
for (const line of readFileSync(resolve(projectRoot, '.env.local'), 'utf-8').split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ──────────────────────────────────────────────
// Configuracion del algoritmo
// ──────────────────────────────────────────────

const CONNECTORS = new Set([
    'de', 'la', 'las', 'los', 'el', 'lo', 'un', 'una', 'del', 'al',
    'con', 'y', 'e', 'a', 'para', 'por', 'en'
])

const PREP_WORDS = new Set([
    'cruda', 'crudo', 'cocida', 'cocido', 'cocidas', 'cocidos',
    'congelada', 'congelado', 'congeladas', 'congelados',
    'natural', 'naturales', 'light',
    'fresco', 'fresca', 'frescos',
    'entero', 'entera', 'enteras', 'enteros',
    'desnatada', 'desnatado', 'semidesnatada',
    'molida', 'molido', 'rallada', 'rallado',
    'tostada', 'tostado', 'tostadas', 'picada', 'picado',
    'asada', 'asado', 'frita', 'frito',
    'ahumado', 'ahumada', 'seca', 'seco',
    'polvo', 'lata', 'brick',
    'sal', 'sin',
    'batido', 'batida',
])

const RESTRICTIVE_WORDS = new Set([
    'sin', 'light', 'desnatada', 'desnatado', 'semidesnatada',
    'cocida', 'cocido', 'cocidas', 'cocidos',
    'ahumado', 'ahumada', 'tostada', 'tostado', 'tostadas',
])

const DISH_WORDS = new Set([
    'bowl', 'mousse', 'tortilla', 'muffin', 'brownie', 'burger',
    'galleta', 'galletas', 'tarta', 'bizcocho', 'donut', 'gofre',
    'barrita', 'barritas', 'helado', 'sandwich', 'wrap', 'taco', 'tacos',
    'ensalada', 'sopa', 'guiso', 'salteado', 'revuelto', 'pudding',
    'skillet', 'bites', 'barras', 'tostadas', 'lazanya', 'brochetas',
    'caracolas', 'fideosudon', 'kebaprol', 'kebab', 'patatas',
    'hamburguesa', 'hamburguesas', 'smashed', 'rice', 'crispy',
    'caramelized', 'no bake', 'cookies', 'cookie', 'blondis',
    'snickers', 'snack', 'chips', 'salsa',
    'pan', 'bacon', 'manzanas',
])

const ACENTOS = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }

// ──────────────────────────────────────────────
// Funciones auxiliares
// ──────────────────────────────────────────────

function singularizar(p) {
    const p2 = p.toLowerCase().trim()
    if (p2.endsWith('ces') && p2.length > 4) return p2.slice(0, -3) + 'z'
    if (p2.endsWith('s') && p2.length > 3) return p2.slice(0, -1)
    return p2
}

function esSustantiva(palabra) {
    if (CONNECTORS.has(palabra)) return false
    if (PREP_WORDS.has(palabra)) return false
    if (DISH_WORDS.has(palabra)) return false
    if (palabra.length <= 2) return false
    return true
}

function sonVariantes(a, b) {
    if (a === b) return true
    return singularizar(a) === singularizar(b)
}

function palabraEnConsulta(palabraCandidato, palabrasConsulta) {
    for (const pc of palabrasConsulta) {
        if (sonVariantes(palabraCandidato, pc)) return true
    }
    return false
}

function norm(p) {
    return p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function generarVariantesAcento(token) {
    const opciones = [token]
    for (let i = 0; i < token.length; i++) {
        if (ACENTOS[token[i]]) {
            const acc = ACENTOS[token[i]]
            opciones.push(token.slice(0, i) + acc + token.slice(i + 1))
        }
    }
    return [...new Set(opciones)]
}

async function buscarAlimento(token) {
    const { data: direct } = await supabase
        .from('alimentos')
        .select('id, nombre')
        .ilike('nombre', '%' + token + '%')
    if (direct && direct.length > 0) return direct

    const variantes = generarVariantesAcento(token).filter(v => v !== token)
    if (variantes.length === 0) return []

    const conditions = variantes.map(v => `nombre.ilike.%${v}%`)
    const { data: conAcentos } = await supabase
        .from('alimentos')
        .select('id, nombre')
        .or(conditions.join(','))

    return conAcentos || []
}

// ──────────────────────────────────────────────
// Sistema de puntuacion (TODO normalizado por acentos)
// ──────────────────────────────────────────────

function puntuarCandidato(candidato, tokensBuscar, consultaOriginal) {
    const aNorm = norm(candidato)
    const queryNorm = norm(consultaOriginal)
    const queryLower = consultaOriginal.toLowerCase().trim()
    const palabrasConsulta = queryLower.split(/\s+/).filter(p => p.length > 0 && !CONNECTORS.has(p))

    const tokensNorm = tokensBuscar.map(t => norm(t))

    // Contar match/miss con penalizacion diferenciada para prep words
    let baseScore = 0
    let penalizacionFaltantes = 0
    let tokensMatchCount = 0

    for (let i = 0; i < tokensBuscar.length; i++) {
        const tNorm = tokensNorm[i]
        const tOrig = tokensBuscar[i]
        if (aNorm.includes(tNorm)) {
            baseScore += 10
            tokensMatchCount++
        } else {
            // Token no encontrado en candidato
            if (PREP_WORDS.has(tOrig)) {
                penalizacionFaltantes += 2  // Prep word ausente = penalizacion leve
            } else {
                penalizacionFaltantes += 8  // Token sustantivo ausente = penalizacion fuerte
            }
        }
    }

    const palabrasCandidato = aNorm.split(/[\s()]+/).filter(p => p.length > 0 && !CONNECTORS.has(p))
    let penalizacionExtra = 0
    let sustantivasExtra = 0
    let palabrasRestrictivas = 0

    for (const pc of palabrasCandidato) {
        if (pc.length <= 2) continue
        if (palabraEnConsulta(pc, palabrasConsulta.map(norm))) continue

        if (DISH_WORDS.has(pc)) {
            penalizacionExtra += 12
            sustantivasExtra++
        } else if (PREP_WORDS.has(pc)) {
            penalizacionExtra += 2
            if (RESTRICTIVE_WORDS.has(pc)) {
                penalizacionExtra += 5
                palabrasRestrictivas++
            }
        } else if (esSustantiva(pc)) {
            penalizacionExtra += 10
            sustantivasExtra++
        } else {
            penalizacionExtra += 3
        }
    }

    if (aNorm.includes('(') && !queryNorm.includes('(')) {
        penalizacionExtra += 2
    }

    // Bonus por raiz normalizada
    const queryRoot = singularizar(queryNorm)
    if (queryRoot.length > 3 && aNorm.includes(queryRoot)) {
        baseScore += 3
        if (palabrasCandidato.length > 0) {
            const mainWord = palabrasCandidato[0]
            if (mainWord === queryRoot || queryRoot.includes(mainWord) || mainWord.includes(queryRoot)) {
                baseScore += 5
            }
        }
    }

    if (sustantivasExtra > 1) {
        penalizacionExtra += sustantivasExtra * 5
    }

    return {
        total: baseScore - penalizacionFaltantes - penalizacionExtra,
        palabrasRestrictivas,
        tokensMatchCount
    }
}

// ──────────────────────────────────────────────
// matchIngredient() — version definitiva
// ──────────────────────────────────────────────
async function matchIngredient(nombre) {
    const q = nombre.toLowerCase().trim()

    // ── 1. MATCH EXACTO ──
    const { data: exact } = await supabase.from('alimentos').select('id, nombre').ilike('nombre', q)
    if (exact?.length) return exact[0]

    // ── 1b. MATCH EXACTO CON SINGULAR ──
    const singular = singularizar(q)
    if (singular !== q) {
        const { data: exSing } = await supabase.from('alimentos').select('id, nombre').ilike('nombre', singular)
        if (exSing?.length) return exSing[0]
    }

    // ── 2. MULTI-TOKEN SCORING ──
    const tokens = q.split(/\s+/).filter(w => w.length > 2)
    const tokensExtra = new Set(tokens)
    if (singular !== q) tokensExtra.add(singular)
    for (const t of tokens) {
        const s = singularizar(t)
        if (s !== t) tokensExtra.add(s)
    }
    const tokensBuscar = Array.from(tokensExtra)

    const candidatosMap = new Map()
    for (const token of tokensBuscar) {
        const results = await buscarAlimento(token)
        if (results) {
            for (const item of results) {
                if (!candidatosMap.has(item.id)) candidatosMap.set(item.id, item)
            }
        }
    }

    if (candidatosMap.size > 0) {
        const scored = Array.from(candidatosMap.values())
            .map(a => {
                const { total, palabrasRestrictivas, tokensMatchCount } = puntuarCandidato(a.nombre, tokensBuscar, q)
                return { ...a, total, palabrasRestrictivas, tokensMatchCount }
            })
            .sort((a, b) => {
                if (b.total !== a.total) return b.total - a.total
                if (a.palabrasRestrictivas !== b.palabrasRestrictivas) {
                    return a.palabrasRestrictivas - b.palabrasRestrictivas
                }
                return a.nombre.length - b.nombre.length
            })

        const mejor = scored[0]

        function contarExtraSustantivas(nombreCandidato) {
            const aNorm2 = norm(nombreCandidato)
            const palabrasConsulta = q.split(/\s+/).filter(p => p.length > 0 && !CONNECTORS.has(p))
            const palabrasCandidato = aNorm2.split(/[\s()]+/).filter(p => p.length > 0 && !CONNECTORS.has(p))
            let extras = 0
            for (const pc of palabrasCandidato) {
                if (pc.length <= 2) continue
                if (palabraEnConsulta(pc, palabrasConsulta)) continue
                if (DISH_WORDS.has(pc) || esSustantiva(pc)) extras++
            }
            return extras
        }

        const aMejorNorm = norm(mejor.nombre)
        const tokensNorm = tokensBuscar.map(t => norm(t))
        const tokensMatchCount = tokensNorm.filter(t => aMejorNorm.includes(t)).length
        const extra = contarExtraSustantivas(mejor.nombre)

        // Calcular cuantas palabras SUSTANTIVAS tiene la consulta original
        // (excluyendo CONNECTORS y PREP_WORDS como "picado", "cruda", etc.)
        const palabrasSustantivasConsulta = q.split(/\s+/)
            .filter(p => p.length > 0 && !CONNECTORS.has(p) && !PREP_WORDS.has(p))

        // Si la consulta tiene 0-1 palabras sustantivas, NO tolerar extras
        // Si tiene 2+, tolerar 1 extra (ej: "Pechuga de pollo" → "Pechuga de pollo (cruda)")
        const toleranciaExtra = palabrasSustantivasConsulta.length <= 1 ? 0 : 1

        // Aceptar si puntuacion > 0 y dentro de tolerancia de palabras extra
        if (mejor.total > 0 && extra <= toleranciaExtra) {
            return mejor
        }

        // Fallback: si 0 palabras extra sustantivas y al menos 1 token match → aceptar
        // Esto captura "Cacahuete picado" → "Cacahuetes (naturales)"
        // porque "picado" es PREP (miss penalizado leve) y 0 extra words
        if (extra === 0 && tokensMatchCount >= 1) {
            return mejor
        }
    }

    return null
}

// ──────────────────────────────────────────────
// TEST CASES
// ──────────────────────────────────────────────
const tests = [
    // === BASICOS ===
    ['almendras', 'Almendra cruda'],
    ['pasta de almendras', 'Pasta de almendras (sin azúcar)'],
    ['crema de cacahuete', 'Crema de cacahuete (natural)'],
    ['Cacahuete picado', 'Cacahuetes (naturales)'],
    ['cacahuete', 'Cacahuetes (naturales)'],
    ['nueces', 'Nueces'],
    ['Fresas', 'Fresa'],
    ['Arandanos', null],
    ['Harina de avena', null],
    ['Yogur griego natural (0%)', 'Yogur griego natural'],
    ['Mantequilla de cacahuete', 'Mantequilla de cacahuete'],
    ['Queso crema light', 'Queso crema light'],
    ['Aceite de oliva virgen extra', 'Aceite de oliva virgen extra'],
    ['Pechuga de pollo', 'Pechuga de pollo (cruda)'],
    ['Clara de huevo', 'Clara de huevo'],
    ['Huevos', 'Huevo M'],
    ['Pan integral', 'Pan integral'],
    ['Leche de avena', 'Leche de avena'],
    ['Avena en copos', 'Avena (copos)'],
    ['Garbanzos cocidos', 'Garbanzos cocidos'],
    ['Lentejas cocidas', 'Lentejas cocidas'],
    ['Cebolla', 'Cebolla cruda'],
    ['Ajo', 'Ajo crudo'],
    ['Espinacas', 'Espinacas congeladas'],
    ['Miel', null],
    ['Sal', 'Sal'],
    ['Pimienta negra', 'Pimienta negra'],

    // === ACENTOS ===
    ['Pimenton dulce', 'Pimenton dulce'],
    ['Pimentón dulce', 'Pimentón dulce'],
    ['pimenton dulce', 'Pimentón dulce'],
    ['pimentón dulce', 'Pimentón dulce'],

    // === CASOS LIMITE ===
    ['Pollo', null],
    ['Queso cottage', 'Queso cottage'],
    ['Queso fresco', 'Queso fresco'],
    ['Yogur natural', 'Yogur natural'],
]

console.log('Resultados:')
console.log('='.repeat(100))
let ok = 0, fail = 0
for (const [input, expected] of tests) {
    const result = await matchIngredient(input)
    const rName = result?.nombre ?? 'SIN MATCH'

    const rNorm = norm(rName)

    let status, match
    if (expected === null) {
        match = rName === 'SIN MATCH'
        status = match ? '✓' : '✗ (esperaba SIN MATCH, obtuvo: ' + rName + ')'
    } else {
        match = rNorm.includes(norm(expected))
        status = match ? '✓' : '✗ (esperaba: ' + expected + ', obtuvo: ' + rName + ')'
    }
    if (match) ok++; else fail++
    console.log(status, '\t' + input.padEnd(38) + '\t→ ' + rName.padEnd(45) + (result?.id?.substring(0, 8) ?? ''))
}
console.log('='.repeat(100))
console.log('Aciertos:', ok, '/', tests.length, 'Fallos:', fail)

if (fail > 0) process.exit(1)
