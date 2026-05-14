/**
 * Debug: prueba el algoritmo de matching para ingredientes concretos
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) return
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

function normalizar(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function palabrasCompletas(str) {
    return normalizar(str.toLowerCase())
        .split(/[\s,()\/\-]+/)
        .filter(p => p.length >= 2)
}

const MARCAS = new Set([
    'hacendado', 'nestle', 'nestlé', 'valor', 'mercadona', 'dia', 'carrefour',
    'coca', 'cola', 'monster', 'patatas', 'galletas', 'chocolate', 'bebida',
    'refresco', 'cerveza', 'vino', 'spaghetti', 'pasta', 'papilla',
    'rosquillas', 'molinillo', 'salsa', 'crema', 'sirope', 'cereal',
    'cereales', 'barrita', 'barritas', 'snack', 'snacks',
])

const DESCRIPTORES = new Set([
    'integral', 'crudo', 'cruda', 'crudos', 'crudas',
    'fresco', 'fresca', 'frescos', 'frescas',
    'seco', 'seca', 'secos', 'secas',
    'molido', 'molidos', 'molidas', 'molienda',
    'natural', 'normal',
    'blanco', 'blanca', 'blancos', 'blancas',
    'negro', 'negra', 'negros', 'negras',
    'rojo', 'roja', 'rojos', 'rojas',
    'verde', 'dulce', 'salado', 'salada',
    'ahumado', 'ahumada', 'ahumados', 'ahumadas',
    'desnatado', 'desnatada',
    'entero', 'entera', 'enteros', 'enteras',
    'rallado', 'rallada',
    'líquido', 'liquido', 'líquida', 'liquida',
    'congelado', 'congelada',
    'frito', 'frita', 'fritos', 'fritas',
    'hervido', 'hervida',
    'asado', 'asada',
    'plancha', 'horno', 'vapor',
    'largo', 'larga', 'corto', 'corta',
    'fino', 'fina', 'grueso', 'gruesa',
    'tierno', 'tierna', 'maduro', 'madura',
    'ecológico', 'ecologica', 'eco',
    'casero', 'casera', 'tradicional',
    'suave', 'fuerte',
    'clásico', 'clasico', 'clásica', 'clasica',
    'light', 'bajo', 'baja', 'bajos', 'bajas', '0%',
    'extra', 'virgen', 'refinado',
])

function puntuarFood(ingPalabras, foodPalabras) {
    const ingSet = new Set(ingPalabras)
    const foodSet = new Set(foodPalabras)
    const soloIng = ingPalabras.filter(p => !foodSet.has(p))
    const soloFood = foodPalabras.filter(p => !ingSet.has(p))
    const forwardOk = soloIng.length === 0
    const reverseOk = soloFood.length === 0
    if (!forwardOk && !reverseOk) return -1
    const esBidireccional = forwardOk && reverseOk
    const esReverseOnly = reverseOk && !forwardOk
    const esForwardOnly = forwardOk && !reverseOk
    let score = 0
    if (esBidireccional) {
        if (soloIng.length === 0 && soloFood.length === 0) score = 100
        else score = 95
    } else if (esReverseOnly) {
        score = 85
    } else if (esForwardOnly) {
        if (soloFood.length === 0) score = 100
        else if (ingPalabras.length === 1 && soloFood.length >= 2) {
            const numMarca = soloFood.filter(p => MARCAS.has(p)).length
            const numDesc = soloFood.filter(p => DESCRIPTORES.has(p)).length
            if (numMarca > 0) score = 40
            else if (numDesc >= soloFood.length) score = 80
            else score = 60
        } else {
            const numMarca = soloFood.filter(p => MARCAS.has(p)).length
            if (numMarca > 0) score = Math.max(50, 80 - numMarca * 15)
            else score = Math.max(60, 85 - soloFood.length * 5)
        }
    }
    const marcaEnFood = foodPalabras.filter(p => MARCAS.has(p)).length
    score -= marcaEnFood * 20
    if (foodPalabras.length <= 2) score += 5
    if (foodPalabras.length === 1) score += 5
    return Math.max(0, Math.min(100, score))
}

function negadosEnIngrediente(nombre) {
    const tokens = normalizar(nombre.toLowerCase()).split(/[\s,()\/\-]+/)
    const negados = new Set()
    for (let i = 0; i < tokens.length - 1; i++) {
        if (tokens[i] === 'sin' && tokens[i + 1].length >= 2) negados.add(tokens[i + 1])
    }
    return negados
}

async function debugIngrediente(nombreIngrediente, alimentos) {
    const norm = normalizar(nombreIngrediente.toLowerCase().trim())
    const palabrasIng = palabrasCompletas(nombreIngrediente)

    console.log(`\n══════════════════════════════════════`)
    console.log(`🔍 Ingrediente: "${nombreIngrediente}"`)
    console.log(`   Palabras: [${palabrasIng.join(', ')}]`)

    if (palabrasIng.length === 0) { console.log('   → SKIP: sin palabras'); return }

    const negados = negadosEnIngrediente(nombreIngrediente)
    if (negados.size > 0) console.log(`   ⛔ Negados: [${[...negados].join(', ')}]`)

    const scores = []
    for (const a of alimentos) {
        const palabrasA = palabrasCompletas(a.nombre)
        if (palabrasA.length === 0) continue

        if (negados.size > 0) {
            const tieneSin = palabrasA.some(p => p === 'sin')
            const tieneNegada = palabrasA.some(p => negados.has(p))
            if (tieneNegada && !tieneSin) continue
        }

        const punt = puntuarFood(palabrasIng, palabrasA)
        if (punt > 0) {
            const marcaEnA = palabrasA.filter(p => MARCAS.has(p)).length
            scores.push({ nombre: a.nombre, punt, marca: marcaEnA, cat: a.categoria })
        }
    }

    scores.sort((a, b) => b.punt - a.punt)

    console.log(`   📊 TOP 10 candidatos (de ${scores.length} con score > 0):`)
    for (const s of scores.slice(0, 10)) {
        const marcaTag = s.marca > 0 ? ` 🏷️${s.marca}` : ''
        const umbralTag = s.punt >= 75 ? ' ✅' : ' ❌'
        console.log(`   ${s.punt.toString().padStart(3)} pts → "${s.nombre}" (${s.cat || '?'})${marcaTag}${umbralTag}`)
    }
}

async function main() {
    // Cargar todos los alimentos
    const todos = []
    let page = 0
    const PAGE_SIZE = 2000
    while (true) {
        const { data, error } = await supabase
            .from('alimentos')
            .select('id, nombre, categoria, calorias, proteinas, carbohidratos, grasas, fibra')
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        if (error) throw new Error(error.message)
        if (!data?.length) break
        todos.push(...data)
        page++
        if (data.length < PAGE_SIZE) break
    }
    console.log(`📦 ${todos.length} alimentos cargados`)

    // Casos problemáticos
    const casos = [
        'aceite de oliva virgen extra',
        'aceite de coco',
        'harina de avena',
        'miel',
        'leche entera',
        'queso feta',
        'cebolla roja',
        'ajo en polvo',
        'avena en copos',
        'crema agria o yogur griego',
        'salsa de soja',
        'proteína en polvo sabor vainilla',
        'harina de almendra',
        'harina de trigo',
        'agua',
        'vinagre',
    ]

    for (const caso of casos) {
        await debugIngrediente(caso, todos)
    }
}

main().catch(console.error)
