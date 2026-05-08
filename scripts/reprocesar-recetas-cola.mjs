/**
 * Script para reprocesar recetas existentes en la cola de revisión
 * con las últimas correcciones del scraper:
 * 
 * 1. Capitalizar nombre de receta
 * 2. Capitalizar nombre_libre de cada ingrediente
 * 3. Auto-numerar instrucciones si no lo están
 * 4. Re-ejecutar matchIngredient() contra alimentos (algoritmo mejorado)
 * 5. Recalcular macros (kcal, proteinas, carbohidratos, grasas, fibra)
 * 
 * USO: node scripts/reprocesar-recetas-cola.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// ── Cargar .env.local ──
const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

console.log('Supabase URL:', SUPABASE_URL)
console.log('Service Key (first 15):', SERVICE_KEY?.substring(0, 15) + '...')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
})

// ── DeepSeek API helper (inline, sin depender de TS) ──
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = env.DEEPSEEK_MODEL || 'deepseek-v4-flash'

async function completarAlimentoConIA(nombreAlimento) {
    const apiKey = env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

    const messages = [
        {
            role: 'system',
            content: `Eres un nutricionista experto en composición de alimentos.
Dados nombres de alimentos, devuelves sus valores nutricionales por 100g basados en BEDCA (Base de Datos Española) y USDA.
Debes ser preciso. Si no conoces el valor exacto, da la estimación más cercana.

RESPONDE SOLO CON JSON (sin markdown, sin explicaciones):
{
  "kcal": number,
  "proteinas": number,
  "carbohidratos": number,
  "grasas": number,
  "fibra": number,
  "calcio_mg": number,
  "hierro_mg": number,
  "magnesio_mg": number,
  "potasio_mg": number,
  "sodio_mg": number,
  "zinc_mg": number,
  "vitamina_c_mg": number,
  "vitamina_a_ug": number,
  "vitamina_d_ug": number,
  "vitamina_b12_ug": number
}`
        },
        { role: 'user', content: `Valores nutricionales por 100g para: "${nombreAlimento}"` }
    ]

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: DEEPSEEK_MODEL, messages, temperature: 0.1, max_tokens: 800 }),
    })

    if (!response.ok) throw new Error(`DeepSeek API error ${response.status} al consultar alimento`)
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('DeepSeek: respuesta vacía')

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('DeepSeek: respuesta no contiene JSON')

    return JSON.parse(jsonMatch[0])
}

// ══════════════════════════════════════════════════
// Configuración del algoritmo de matching
// ══════════════════════════════════════════════════

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
// Sistema de puntuación (todo normalizado por acentos)
// ──────────────────────────────────────────────

function puntuarCandidato(candidato, tokensBuscar, consultaOriginal) {
    const aNorm = norm(candidato)
    const queryNorm = norm(consultaOriginal)
    const queryLower = consultaOriginal.toLowerCase().trim()
    const palabrasConsulta = queryLower.split(/\s+/).filter(p => p.length > 0 && !CONNECTORS.has(p))

    const tokensNorm = tokensBuscar.map(t => norm(t))

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
            if (PREP_WORDS.has(tOrig)) {
                penalizacionFaltantes += 2
            } else {
                penalizacionFaltantes += 8
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

// ══════════════════════════════════════════════════
// matchIngredient() — algoritmo definitivo con scoring inteligente
// ══════════════════════════════════════════════════
async function matchIngredient(nombre) {
    const q = nombre.toLowerCase().trim()

    // ── 1. MATCH EXACTO ──
    const { data: exact } = await supabase
        .from('alimentos')
        .select('id, nombre')
        .ilike('nombre', q)
    if (exact?.length) return exact[0]

    // ── 1b. MATCH EXACTO CON SINGULAR ──
    const singular = singularizar(q)
    if (singular !== q) {
        const { data: exSing } = await supabase
            .from('alimentos')
            .select('id, nombre')
            .ilike('nombre', singular)
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

        const palabrasSustantivasConsulta = q.split(/\s+/)
            .filter(p => p.length > 0 && !CONNECTORS.has(p) && !PREP_WORDS.has(p))
        const toleranciaExtra = palabrasSustantivasConsulta.length <= 1 ? 0 : 1

        if (mejor.total > 0 && extra <= toleranciaExtra) {
            return mejor
        }

        if (extra === 0 && tokensMatchCount >= 1) {
            return mejor
        }
    }

    return null
}

// ══════════════════════════════════════════════════
// Auto-crear alimento base si no existe en BD
// ══════════════════════════════════════════════════
async function autoCrearAlimento(nombre) {
    const q = nombre.toLowerCase().trim()
    if (q.length < 3) return null

    const tokens = q.split(/\s+/).filter(t => t.length > 0)
    const sustantivos = tokens.filter(t => esSustantiva(t))

    // No auto-crear si no hay palabras sustantivas
    if (sustantivos.length === 0) return null

    // No auto-crear si parece un nombre de plato (contiene dish words)
    const tieneDishWord = tokens.some(t => DISH_WORDS.has(t))
    if (tieneDishWord && !['pasta', 'crema', 'mantequilla', 'salsa'].includes(tokens[0])) return null

    // Capitalizar correctamente
    const nombreFormateado = tokens
        .map(t => t.charAt(0).toUpperCase() + t.slice(1))
        .join(' ')

    // Insertar con macros a 0 provisionalmente + flag fuente='ia' para revisión
    const { data: nuevo, error } = await supabase
        .from('alimentos')
        .insert({
            nombre: nombreFormateado,
            calorias: 0,
            proteinas: 0,
            carbohidratos: 0,
            grasas: 0,
            fibra: 0,
            fuente: 'ia',
        })
        .select('id, nombre')
        .single()

    if (error || !nuevo) {
        console.error('Error auto-creando alimento:', error?.message)
        return null
    }

    console.log(`   🆕 Alimento auto-creado: "${nombreFormateado}" (${nuevo.id})`)

    // ── Completar macros y micros con IA (DeepSeek) ──
    try {
        const macros = await completarAlimentoConIA(nombreFormateado)
        await supabase
            .from('alimentos')
            .update({
                calorias: macros.kcal,
                proteinas: macros.proteinas,
                carbohidratos: macros.carbohidratos,
                grasas: macros.grasas,
                fibra: macros.fibra,
                // Micronutrientes (si DeepSeek los devuelve)
                ...(macros.calcio_mg !== undefined && { calcio_mg: macros.calcio_mg }),
                ...(macros.hierro_mg !== undefined && { hierro_mg: macros.hierro_mg }),
                ...(macros.magnesio_mg !== undefined && { magnesio_mg: macros.magnesio_mg }),
                ...(macros.potasio_mg !== undefined && { potasio_mg: macros.potasio_mg }),
                ...(macros.sodio_mg !== undefined && { sodio_mg: macros.sodio_mg }),
                ...(macros.zinc_mg !== undefined && { zinc_mg: macros.zinc_mg }),
                ...(macros.vitamina_c_mg !== undefined && { vitamina_c_mg: macros.vitamina_c_mg }),
                ...(macros.vitamina_a_ug !== undefined && { vitamina_a_ug: macros.vitamina_a_ug }),
                ...(macros.vitamina_d_ug !== undefined && { vitamina_d_ug: macros.vitamina_d_ug }),
                ...(macros.vitamina_b12_ug !== undefined && { vitamina_b12_ug: macros.vitamina_b12_ug }),
                micros_actualizados_en: new Date().toISOString(),
            })
            .eq('id', nuevo.id)
        console.log(`   🤖 IA completada: ${macros.kcal} kcal | P:${macros.proteinas} | C:${macros.carbohidratos} | G:${macros.grasas} | F:${macros.fibra}`)
    } catch (e) {
        console.error(`   ⚠️ No se pudieron completar macros con IA:`, e.message)
    }

    return nuevo
}

// ══════════════════════════════════════════════════
// calcularMacros() — réplica del cálculo del scraper
// ══════════════════════════════════════════════════
async function calcularMacros(ingredientes, porciones) {
    const ids = ingredientes.filter(i => i.alimento_id).map(i => i.alimento_id)
    if (ids.length === 0) {
        return { kcal: null, proteinas: null, carbohidratos: null, grasas: null, fibra: null }
    }

    const { data } = await supabase.from('alimentos').select('*').in('id', ids)
    const alimentos = data ?? []
    const lookup = new Map(alimentos.map(a => [a.id, a]))

    let totalKcal = 0, totalProt = 0, totalCarb = 0, totalGras = 0, totalFibra = 0
    for (const ing of ingredientes) {
        if (!ing.alimento_id) continue
        const a = lookup.get(ing.alimento_id)
        if (!a) continue
        const f = ing.cantidad_gramos / 100
        totalKcal += (a.calorias ?? 0) * f
        totalProt += (a.proteinas ?? 0) * f
        totalCarb += (a.carbohidratos ?? 0) * f
        totalGras += (a.grasas ?? 0) * f
        totalFibra += (a.fibra ?? 0) * f
    }

    const d = Math.max(1, porciones)
    return {
        kcal: Math.round(totalKcal / d * 100) / 100,
        proteinas: Math.round(totalProt / d * 100) / 100,
        carbohidratos: Math.round(totalCarb / d * 100) / 100,
        grasas: Math.round(totalGras / d * 100) / 100,
        fibra: Math.round(totalFibra / d * 100) / 100,
    }
}

// ══════════════════════════════════════════════════
// Formatear instrucciones
// ══════════════════════════════════════════════════
function formatearInstrucciones(instrucciones) {
    if (!instrucciones) return instrucciones
    // Si ya empieza con "1. " está formateado
    if (instrucciones.match(/^\d+\.\s/)) return instrucciones
    // Dividir por saltos de línea y numerar
    const saltos = instrucciones.split(/\n+/).filter(Boolean)
    if (saltos.length === 0) return instrucciones
    return saltos.map((s, i) => `${i + 1}. ${s.trim()}`).join('\n')
}

// ══════════════════════════════════════════════════
// Capitalizar primera letra (respetando palabras ya en mayúscula)
// ══════════════════════════════════════════════════
function capitalizar(texto) {
    if (!texto) return texto
    return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// ══════════════════════════════════════════════════
// Detectar si un nombre parece estar en inglés
// ══════════════════════════════════════════════════
// Lista de palabras típicamente inglesas en contexto culinario
const ENGLISH_WORDS = new Set([
    'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp', 'egg', 'eggs',
    'bread', 'butter', 'milk', 'cheese', 'cream', 'yogurt', 'rice', 'pasta',
    'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'sauce', 'garlic', 'onion',
    'tomato', 'potato', 'carrot', 'apple', 'banana', 'orange', 'lemon', 'lime',
    'flour', 'butter', 'baking', 'powder', 'soda', 'vanilla', 'chocolate',
    'cocoa', 'honey', 'syrup', 'maple', 'corn', 'bean', 'beans', 'pea', 'peas',
    'broccoli', 'spinach', 'lettuce', 'cucumber', 'pepper', 'mushroom',
    'avocado', 'olive', 'olives', 'almond', 'almonds', 'walnut', 'walnuts',
    'peanut', 'peanuts', 'cashew', 'cashews', 'pecan', 'pecans', 'coconut',
    'strawberry', 'blueberry', 'raspberry', 'banana', 'pineapple', 'mango',
    'peach', 'pear', 'grape', 'grapes', 'watermelon', 'melon', 'kiwi',
    'cheese', 'mozzarella', 'cheddar', 'parmesan', 'ricotta', 'cottage',
    'ham', 'bacon', 'sausage', 'turkey', 'salami', 'pepperoni',
    'mustard', 'mayonnaise', 'ketchup', 'bbq', 'barbecue', 'hot', 'sweet',
    'sour', 'bitter', 'spicy', 'raw', 'cooked', 'roasted', 'baked', 'fried',
    'grilled', 'steamed', 'boiled', 'fresh', 'dried', 'frozen', 'canned',
    'whole', 'skim', 'low', 'fat', 'free', 'organic', 'natural',
    'cup', 'cups', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons',
    'ounce', 'ounces', 'pound', 'pounds', 'piece', 'pieces', 'slice', 'slices',
    'medium', 'large', 'small', 'diced', 'chopped', 'minced', 'grated',
    'sliced', 'mashed', 'ground', 'whole', 'half', 'optional',
    'for', 'the', 'and', 'with', 'without', 'from', 'into',
])

function pareceIngles(texto) {
    if (!texto) return false
    const lower = texto.toLowerCase().trim()
    const palabras = lower.split(/\s+/)
    // Si la primera palabra está en la lista de inglés, probablemente es inglés
    if (palabras.length > 0 && ENGLISH_WORDS.has(palabras[0])) return true
    // Contar cuántas palabras parecen inglesas
    const soloCaracteres = palabras.filter(p => /^[a-z]+$/.test(p))
    if (soloCaracteres.length === 0) return false
    const inglesas = soloCaracteres.filter(p => ENGLISH_WORDS.has(p))
    return (inglesas.length / soloCaracteres.length) > 0.3
}

// ══════════════════════════════════════════════════
// Traducción básica de ingredientes comunes de inglés a español
// ══════════════════════════════════════════════════
const EN2ES = {
    'chicken': 'Pollo', 'beef': 'Carne de ternera', 'pork': 'Cerdo',
    'salmon': 'Salmón', 'tuna': 'Atún', 'shrimp': 'Gambas',
    'egg': 'Huevo', 'eggs': 'Huevos',
    'bread': 'Pan', 'butter': 'Mantequilla', 'milk': 'Leche',
    'cheese': 'Queso', 'cream': 'Nata', 'yogurt': 'Yogur',
    'rice': 'Arroz', 'pasta': 'Pasta',
    'sugar': 'Azúcar', 'salt': 'Sal', 'pepper': 'Pimienta',
    'oil': 'Aceite', 'olive oil': 'Aceite de oliva',
    'vinegar': 'Vinagre', 'sauce': 'Salsa',
    'garlic': 'Ajo', 'onion': 'Cebolla',
    'tomato': 'Tomate', 'potato': 'Patata', 'carrot': 'Zanahoria',
    'apple': 'Manzana', 'banana': 'Plátano', 'orange': 'Naranja',
    'lemon': 'Limón', 'flour': 'Harina',
    'baking powder': 'Levadura química', 'baking soda': 'Bicarbonato',
    'vanilla': 'Vainilla', 'chocolate': 'Chocolate', 'cocoa': 'Cacao',
    'honey': 'Miel', 'syrup': 'Sirope',
    'corn': 'Maíz', 'bean': 'Judía', 'beans': 'Judías',
    'broccoli': 'Brócoli', 'spinach': 'Espinacas',
    'cucumber': 'Pepino', 'mushroom': 'Champiñón',
    'avocado': 'Aguacate', 'olive': 'Aceituna', 'olives': 'Aceitunas',
    'almond': 'Almendra', 'almonds': 'Almendras',
    'walnut': 'Nuez', 'walnuts': 'Nueces',
    'peanut': 'Cacahuete', 'peanuts': 'Cacahuetes',
    'cashew': 'Anacardo', 'cashews': 'Anacardos',
    'coconut': 'Coco',
    'strawberry': 'Fresa', 'blueberry': 'Arándano',
    'raspberry': 'Frambuesa', 'pineapple': 'Piña',
    'mango': 'Mango', 'peach': 'Melocotón', 'pear': 'Pera',
    'grape': 'Uva', 'grapes': 'Uvas', 'kiwi': 'Kiwi',
    'mozzarella': 'Mozzarella', 'cheddar': 'Cheddar',
    'parmesan': 'Parmesano', 'ham': 'Jamón',
    'bacon': 'Bacon', 'turkey': 'Pavo',
    'mustard': 'Mostaza', 'mayonnaise': 'Mayonesa', 'ketchup': 'Kétchup',
    'sweet': 'Dulce', 'sour': 'Ácido', 'spicy': 'Picante',
    'raw': 'Crudo', 'cooked': 'Cocinado', 'roasted': 'Asado',
    'baked': 'Al horno', 'fried': 'Frito', 'grilled': 'A la parrilla',
    'steamed': 'Al vapor', 'boiled': 'Hervido',
    'fresh': 'Fresco', 'dried': 'Seco', 'frozen': 'Congelado',
    'canned': 'En lata',
    'whole': 'Entero', 'skim': 'Desnatado',
    'low fat': 'Bajo en grasa', 'fat free': 'Sin grasa',
    'organic': 'Ecológico', 'natural': 'Natural',
    'cup': 'Taza', 'tablespoon': 'Cucharada', 'teaspoon': 'Cucharadita',
    'ounce': 'Onza', 'pound': 'Libra',
    'piece': 'Pieza', 'pieces': 'Piezas', 'slice': 'Loncha', 'slices': 'Lonchas',
    'medium': 'Mediano', 'large': 'Grande', 'small': 'Pequeño',
    'diced': 'En dados', 'chopped': 'Picado', 'minced': 'Picado fino',
    'grated': 'Rallado', 'sliced': 'En rodajas', 'mashed': 'Triturado',
    'ground': 'Molido', 'half': 'Mitad', 'optional': 'Opcional',
    'skinless': 'Sin piel', 'boneless': 'Sin hueso', 'lean': 'Magro',
    'extra virgin': 'Virgen extra', 'virgin': 'Virgen',
    'dark': 'Negro', 'white': 'Blanco', 'brown': 'Moreno',
    'black': 'Negro', 'red': 'Rojo', 'green': 'Verde',
    'seed': 'Semilla', 'seeds': 'Semillas', 'nut': 'Fruto seco',
    'nuts': 'Frutos secos', 'mixed': 'Variado',
    'plain': 'Natural', 'flavored': 'Saborizado',
    'minced beef': 'Carne picada de ternera',
    'minced pork': 'Carne picada de cerdo',
    'minced chicken': 'Carne picada de pollo',
    'chicken breast': 'Pechuga de pollo',
    'chicken thigh': 'Muslo de pollo',
    'chicken wings': 'Alas de pollo',
    'pork loin': 'Lomo de cerdo',
    'beef steak': 'Filete de ternera',
    'ground beef': 'Carne picada de ternera',
    'egg white': 'Clara de huevo',
    'egg whites': 'Claras de huevo',
    'whole egg': 'Huevo entero',
    'rolled oats': 'Copos de avena',
    'oatmeal': 'Copos de avena',
    'greek yogurt': 'Yogur griego',
    'cottage cheese': 'Requesón',
    'heavy cream': 'Nata para montar',
    'whipping cream': 'Nata para montar',
    'sour cream': 'Crema agria',
    'cream cheese': 'Queso crema',
    'spaghetti': 'Espaguetis',
    'breadcrumbs': 'Pan rallado',
    'baking': 'Repostería',
    'all-purpose flour': 'Harina de trigo',
    'whole wheat flour': 'Harina integral',
    'almond flour': 'Harina de almendra',
    'coconut flour': 'Harina de coco',
    'coconut oil': 'Aceite de coco',
    'olive oil': 'Aceite de oliva',
    'sunflower oil': 'Aceite de girasol',
    'sesame oil': 'Aceite de sésamo',
    'soy sauce': 'Salsa de soja',
    'worcestershire sauce': 'Salsa Worcestershire',
    'hot sauce': 'Salsa picante',
    'bbq sauce': 'Salsa barbacoa',
    'maple syrup': 'Sirope de arce',
    'chocolate chips': 'Gotas de chocolate',
    'cocoa powder': 'Cacao en polvo',
    'protein powder': 'Proteína en polvo',
    'whey protein': 'Proteína de suero',
    'vanilla extract': 'Extracto de vainilla',
    'vanilla essence': 'Esencia de vainilla',
    'baking powder': 'Levadura en polvo',
    'baking soda': 'Bicarbonato sódico',
    'powdered sugar': 'Azúcar glas',
    'brown sugar': 'Azúcar moreno',
    'sea salt': 'Sal marina',
    'black pepper': 'Pimienta negra',
    'red pepper flakes': 'Copos de pimiento rojo',
    'bay leaf': 'Hoja de laurel',
    'bay leaves': 'Hojas de laurel',
    'fresh herbs': 'Hierbas frescas',
    'dried herbs': 'Hierbas secas',
    'mixed herbs': 'Hierbas variadas',
    'italian seasoning': 'Hierbas italianas',
    'cumin': 'Comino',
    'paprika': 'Pimentón',
    'turmeric': 'Cúrcuma',
    'cinnamon': 'Canela',
    'ginger': 'Jengibre',
    'nutmeg': 'Nuez moscada',
    'oregano': 'Orégano',
    'thyme': 'Tomillo',
    'rosemary': 'Romero',
    'basil': 'Albahaca',
    'parsley': 'Perejil',
    'cilantro': 'Cilantro',
    'dill': 'Eneldo',
    'mint': 'Menta',
    'curry': 'Curry',
    'chili': 'Chile',
    'chilli': 'Chile',
    'garlic powder': 'Ajo en polvo',
    'onion powder': 'Cebolla en polvo',
    'chicken broth': 'Caldo de pollo',
    'vegetable broth': 'Caldo de verduras',
    'beef broth': 'Caldo de carne',
    'water': 'Agua',
}

function traducirIngrediente(texto) {
    if (!texto) return texto
    if (!pareceIngles(texto)) return texto

    const lower = texto.toLowerCase().trim()

    // Probar coincidencias multi-palabra primero
    const entradas = Object.entries(EN2ES).sort((a, b) => b[0].length - a[0].length)
    let resultado = lower

    for (const [en, es] of entradas) {
        const regex = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
        if (regex.test(resultado)) {
            resultado = resultado.replace(regex, es.toLowerCase())
        }
    }

    // Capitalizar primera letra
    return resultado.charAt(0).toUpperCase() + resultado.slice(1)
}

// ══════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════
async function main() {
    console.log('')
    console.log('╔══════════════════════════════════════════════╗')
    console.log('║   Reprocesar Recetas en Cola de Revisión    ║')
    console.log('╚══════════════════════════════════════════════╝')
    console.log('')

    // ── 1. Fetch recetas en cola ──
    console.log('📡 Buscando recetas en estado en_revision o borrador...')
    const { data: recetas, error } = await supabase
        .from('recetas')
        .select('*')
        .in('estado', ['en_revision', 'borrador'])
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Error al obtener recetas:', error)
        process.exit(1)
    }

    console.log(`✅ Encontradas ${recetas.length} recetas para reprocesar`)
    console.log('')

    let totalActualizadas = 0
    let totalErrores = 0
    let totalIngredientesMatch = 0
    let totalIngredientesSinMatch = 0
    let totalTraducidas = 0
    let totalInstruccionesFormateadas = 0
    const resultados = []

    for (let i = 0; i < recetas.length; i++) {
        const receta = recetas[i]
        console.log(`\n[${i + 1}/${recetas.length}] Procesando: "${receta.nombre}" (${receta.id})`)

        const cambios = {}

        // ── 2. Capitalizar nombre ──
        const nombreCapitalizado = capitalizar(receta.nombre)
        if (nombreCapitalizado !== receta.nombre) {
            cambios.nombre = nombreCapitalizado
            console.log(`   📝 Nombre capitalizado: "${receta.nombre}" → "${nombreCapitalizado}"`)
        }

        // ── 3. Traducir si está en inglés ──
        if (pareceIngles(receta.nombre)) {
            const nombreTraducido = traducirIngrediente(receta.nombre)
            if (nombreTraducido !== receta.nombre) {
                cambios.nombre = capitalizar(nombreTraducido)
                console.log(`   🌐 Nombre traducido: "${receta.nombre}" → "${cambios.nombre}"`)
                totalTraducidas++
            }
        }

        // ── 4. Formatear instrucciones ──
        const instruccionesFormateadas = formatearInstrucciones(receta.instrucciones)
        if (instruccionesFormateadas !== receta.instrucciones) {
            cambios.instrucciones = instruccionesFormateadas
            console.log(`   📋 Instrucciones auto-numeradas`)
            totalInstruccionesFormateadas++
        }

        // ── 5. Obtener ingredientes actuales ──
        const { data: ingredientes, error: ingError } = await supabase
            .from('receta_ingredientes')
            .select('*')
            .eq('receta_id', receta.id)
            .order('orden', { ascending: true })

        if (ingError) {
            console.error(`   ❌ Error al obtener ingredientes:`, ingError)
            totalErrores++
            continue
        }

        if (!ingredientes || ingredientes.length === 0) {
            console.log(`   ⏭️  Sin ingredientes que procesar`)
            resultados.push({ id: receta.id, nombre: receta.nombre, estado: 'sin_ingredientes' })
            continue
        }

        // ── 6. Reprocesar cada ingrediente ──
        const ingredientesActualizados = []
        let tieneCambiosIngredientes = false

        for (const ing of ingredientes) {
            const actualizacion = { id: ing.id }

            // Capitalizar nombre_libre
            if (ing.nombre_libre) {
                const nombreCap = capitalizar(ing.nombre_libre)
                if (nombreCap !== ing.nombre_libre) {
                    actualizacion.nombre_libre = nombreCap
                    tieneCambiosIngredientes = true
                }

                // Traducir si parece inglés
                if (pareceIngles(ing.nombre_libre)) {
                    const nombreTrad = traducirIngrediente(ing.nombre_libre)
                    if (nombreTrad !== ing.nombre_libre && nombreTrad !== actualizacion.nombre_libre) {
                        actualizacion.nombre_libre = capitalizar(nombreTrad)
                        tieneCambiosIngredientes = true
                        totalTraducidas++
                        console.log(`   🌐 Ingrediente traducido: "${ing.nombre_libre}" → "${actualizacion.nombre_libre}"`)
                    }
                }
            }

            // Re-ejecutar matchIngredient
            const nombreBuscar = actualizacion.nombre_libre || ing.nombre_libre || ''
            let match = await matchIngredient(nombreBuscar)

            // Si no hay match, auto-crear alimento base en BD
            if (!match) {
                match = await autoCrearAlimento(nombreBuscar)
            }

            const oldAlimentoId = ing.alimento_id
            const newAlimentoId = match?.id ?? null

            if (newAlimentoId !== oldAlimentoId) {
                actualizacion.alimento_id = newAlimentoId
                tieneCambiosIngredientes = true
                if (newAlimentoId) {
                    console.log(`   🔗 Ingrediente "${nombreBuscar}": ${oldAlimentoId ? 'reasignado' : 'asignado'} → "${match.nombre}" (${newAlimentoId})`)
                    totalIngredientesMatch++
                } else {
                    console.log(`   ⚠️  Ingrediente "${nombreBuscar}": sin match en BD`)
                    totalIngredientesSinMatch++
                }
            } else if (newAlimentoId) {
                totalIngredientesMatch++
            } else {
                totalIngredientesSinMatch++
            }

            ingredientesActualizados.push(actualizacion)
        }

        // ── 7. Aplicar cambios en ingredientes ──
        if (tieneCambiosIngredientes) {
            for (const act of ingredientesActualizados) {
                if (Object.keys(act).length > 1) { // tiene más que solo id
                    const { error: updErr } = await supabase
                        .from('receta_ingredientes')
                        .update(act)
                        .eq('id', act.id)
                    if (updErr) {
                        console.error(`   ❌ Error al actualizar ingrediente ${act.id}:`, updErr)
                    }
                }
            }
        }

        // ── 8. Recalcular macros ──
        const ingredientesConMatch = ingredientesActualizados.map(act => {
            const ingOriginal = ingredientes.find(i => i.id === act.id)
            return {
                alimento_id: act.alimento_id ?? ingOriginal?.alimento_id ?? null,
                cantidad_gramos: ingOriginal?.cantidad_gramos ?? 0,
            }
        })

        const porciones = receta.porciones ?? 1
        const macros = await calcularMacros(ingredientesConMatch, porciones)

        // Solo actualizar si hay cambios o si algún macro es null y ahora tiene valor
        const necesitaMacros = (
            receta.kcal !== macros.kcal ||
            receta.proteinas !== macros.proteinas ||
            receta.carbohidratos !== macros.carbohidratos ||
            receta.grasas !== macros.grasas ||
            receta.fibra !== macros.fibra
        )

        if (necesitaMacros) {
            cambios.kcal = macros.kcal
            cambios.proteinas = macros.proteinas
            cambios.carbohidratos = macros.carbohidratos
            cambios.grasas = macros.grasas
            cambios.fibra = macros.fibra
            console.log(`   📊 Macros recalculados: ${macros.kcal} kcal | P:${macros.proteinas} C:${macros.carbohidratos} G:${macros.grasas} F:${macros.fibra}`)
        }

        // ── 9. Guardar cambios en la receta ──
        if (Object.keys(cambios).length > 0) {
            const cambiosConTimestamp = {
                ...cambios,
                updated_at: new Date().toISOString(),
            }

            const { error: updateError } = await supabase
                .from('recetas')
                .update(cambiosConTimestamp)
                .eq('id', receta.id)

            if (updateError) {
                console.error(`   ❌ Error al actualizar receta:`, updateError)
                totalErrores++
                resultados.push({ id: receta.id, nombre: receta.nombre, estado: 'error', error: updateError.message })
            } else {
                console.log(`   ✅ Receta actualizada correctamente`)
                totalActualizadas++
                resultados.push({
                    id: receta.id,
                    nombre: receta.nombre,
                    estado: 'actualizada',
                    cambios: Object.keys(cambios),
                    ingredientes: ingredientes.length,
                    conMatch: ingredientesActualizados.filter(a => a.alimento_id).length,
                })
            }
        } else {
            console.log(`   ⏭️  Sin cambios necesarios`)
            resultados.push({ id: receta.id, nombre: receta.nombre, estado: 'sin_cambios' })
        }
    }

    // ── Resumen final ──
    console.log('')
    console.log('╔══════════════════════════════════════════════╗')
    console.log('║               RESUMEN FINAL                 ║')
    console.log('╚══════════════════════════════════════════════╝')
    console.log('')
    console.log(`📊 Total recetas procesadas: ${recetas.length}`)
    console.log(`✅ Recetas actualizadas:     ${totalActualizadas}`)
    console.log(`❌ Errores:                  ${totalErrores}`)
    console.log(`🔗 Ingredientes con match:   ${totalIngredientesMatch}`)
    console.log(`⚠️  Ingredientes sin match:   ${totalIngredientesSinMatch}`)
    console.log(`🌐 Ingredientes traducidos:  ${totalTraducidas}`)
    console.log(`📋 Instrucciones formateadas: ${totalInstruccionesFormateadas}`)
    console.log('')

    // Mostrar detalle por receta
    console.log('📋 Detalle por receta:')
    console.log('─────────────────────')
    for (const r of resultados) {
        const icono = r.estado === 'actualizada' ? '✅' : r.estado === 'sin_cambios' ? '⏭️' : r.estado === 'sin_ingredientes' ? '⚠️' : '❌'
        let detalle = `  ${icono} "${r.nombre}" → ${r.estado}`
        if (r.cambios) detalle += ` (cambios: ${r.cambios.join(', ')})`
        if (r.ingredientes !== undefined) detalle += ` | ${r.conMatch}/${r.ingredientes} ingredientes con match`
        if (r.error) detalle += ` | error: ${r.error}`
        console.log(detalle)
    }

    console.log('')
    console.log('✨ Proceso completado')
}

main().catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
})
