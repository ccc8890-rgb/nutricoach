/**
 * Verificar conteo total de alimentos en BD y test de matching
 * 
 * USO: node scripts/verificar-alimentos.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
})

console.log('=== VERIFICACIÓN DE ALIMENTOS ===\n')

// 1. Conteo total
const { count, error: countError } = await supabase
    .from('alimentos')
    .select('*', { count: 'exact', head: true })

console.log(`Total alimentos en BD: ${count ?? 'ERROR'}`)
if (countError) console.error('Error conteo:', countError.message)

// 2. Verificar alimentos clave que faltaban
const clave = [
    'Aceite de oliva virgen extra',
    'Vinagre de manzana',
    'Ajo crudo',
    'Sal',
    'Pimienta negra',
    'Perejil',
    'Romero',
    'Orégano',
    'Canela',
    'Pimentón',
]

console.log('\n--- Alimentos clave ---')
for (const nombre of clave) {
    const { data } = await supabase
        .from('alimentos')
        .select('id, nombre, categoria')
        .ilike('nombre', nombre)
        .limit(1)

    if (data && data.length > 0) {
        console.log(`  ✅ ${data[0].nombre} (${data[0].categoria})`)
    } else {
        console.log(`  ❌ ${nombre} — NO ENCONTRADO`)
    }
}

// 3. Verificar que no hay duplicados
const { data: todos } = await supabase
    .from('alimentos')
    .select('nombre')

if (todos) {
    const nombres = todos.map(a => a.nombre.toLowerCase().trim())
    const duplicados = nombres.filter((n, i) => nombres.indexOf(n) !== i)
    const unicos = [...new Set(nombres)]

    console.log(`\n--- Duplicados ---`)
    console.log(`  Nombres únicos: ${unicos.length}`)
    console.log(`  Duplicados detectados: ${duplicados.length > 0 ? duplicados.join(', ') : 'NINGUNO ✅'}`)
}

// 4. Test de matching (simula matchIngredient)
const testCases = [
    'aceite de oliva virgen extra',
    'vinagre de manzana',
    'sal',
    'pimienta negra',
    'ajo crudo',
    'pimentón dulce',
    'comino molido',
    'canela molida',
    'perejil fresco',
    'aceite de coco',
]

console.log(`\n--- Test de matching (simulado) ---`)
for (const test of testCases) {
    const q = test.toLowerCase().trim()

    // 1. Exact match
    const { data: exact } = await supabase
        .from('alimentos')
        .select('id, nombre')
        .ilike('nombre', q)
    if (exact && exact.length > 0) {
        console.log(`  [EXACTO] "${test}" → ${exact[0].nombre}`)
        continue
    }

    // 2. Multi-token match (como la nueva lógica)
    const tokens = q.split(/\s+/).filter((w) => w.length > 2)
    if (tokens.length >= 2) {
        const { data: all } = await supabase
            .from('alimentos')
            .select('id, nombre')
            .ilike('nombre', `%${tokens[0]}%`)
        if (all && all.length > 0) {
            const scored = all
                .map(a => {
                    const aLower = a.nombre.toLowerCase()
                    const score = tokens.filter(t => aLower.includes(t)).length
                    return { ...a, score }
                })
                .sort((a, b) => b.score - a.score)
            if (scored[0].score >= Math.ceil(tokens.length / 2)) {
                console.log(`  [TOKENS] "${test}" → ${scored[0].nombre} (score: ${scored[0].score}/${tokens.length})`)
                continue
            }
        }
    }

    // 3. Palabra más larga
    const longWords = q.split(/\s+/).filter(w => w.length > 4)
    longWords.sort((a, b) => b.length - a.length)
    let matched = false
    for (const word of longWords) {
        const { data: byWord } = await supabase
            .from('alimentos')
            .select('id, nombre')
            .ilike('nombre', `%${word}%`)
            .limit(1)
        if (byWord && byWord.length > 0) {
            console.log(`  [PALABRA] "${test}" → ${byWord[0].nombre} (palabra: "${word}")`)
            matched = true
            break
        }
    }
    if (matched) continue

    console.log(`  ❌ "${test}" → SIN MATCH`)
}
