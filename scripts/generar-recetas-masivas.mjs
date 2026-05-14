/**
 * generar-recetas-masivas.mjs
 *
 * Genera recetas nuevas desde cero usando DeepSeek.
 * Pipeline para cada receta: LLAMADA IA → PARSE → AUTO-MATCH → DB INSERT
 *
 * USO:
 *   node scripts/generar-recetas-masivas.mjs             → genera hasta 70 recetas
 *   node scripts/generar-recetas-masivas.mjs --limite=10  → solo 10
 *   node scripts/generar-recetas-masivas.mjs --secos      → solo categorías saladas
 *   node scripts/generar-recetas-masivas.mjs --dulces     → solo categorías dulces
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local ─────────────────────────────────
function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
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
        let value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'

// ── Flags ──
const args = process.argv.slice(2)
const flagLimite = args.find(a => a.startsWith('--limite='))
const LIMITE = flagLimite ? parseInt(flagLimite.split('=')[1], 10) : 70
const SOLO_SALADAS = args.includes('--secos')
const SOLO_DULCES = args.includes('--dulces')

// ── 70 recetas nuevas para llegar a 200+ ──────────────
// Prioriza categorías infrarrepresentadas: Comida, Cena, Merienda, Snack salado
const RECETAS_A_GENERAR = [
    // === COMIDAS (platos principales) 25 ===
    { nombre: 'Pollo al horno con patatas y romero', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 40 },
    { nombre: 'Lubina al horno con verduras asadas', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 2, tiempo_prep: 15, tiempo_coccion: 30 },
    { nombre: 'Pechuga de pollo rellena de espinacas y queso', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 2, tiempo_prep: 20, tiempo_coccion: 25 },
    { nombre: 'Salteado de ternera con brócoli y jengibre', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 15 },
    { nombre: 'Curry de garbanzos con leche de coco', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 3, tiempo_prep: 10, tiempo_coccion: 25 },
    { nombre: 'Wok de pollo con verduras y salsa de soja', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 12 },
    { nombre: 'Merluza a la plancha con pisto', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 20 },
    { nombre: 'Albóndigas de pollo en salsa ligera de tomate', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 20, tiempo_coccion: 30 },
    { nombre: 'Pavo salteado con calabacín y pimientos', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Ensalada de quinoa con aguacate y granada', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 20, tiempo_coccion: 0 },
    { nombre: 'Lentejas estofadas con verduras', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 40 },
    { nombre: 'Pollo teriyaki con arroz integral', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 2, tiempo_prep: 15, tiempo_coccion: 25 },
    { nombre: 'Bowl de salmón con aguacate y edamame', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 1, tiempo_prep: 15, tiempo_coccion: 10 },
    { nombre: 'Pimientos rellenos de pollo y arroz', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 2, tiempo_prep: 20, tiempo_coccion: 35 },
    { nombre: 'Revuelto de claras con espinacas y champiñones', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 10 },
    { nombre: 'Tortilla de claras con verduras al horno', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 20 },

    // === CENAS (ligeras) 15 ===
    { nombre: 'Crema de calabaza con jengibre', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 3, tiempo_prep: 10, tiempo_coccion: 25 },
    { nombre: 'Tartar de salmón con aguacate', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 2, tiempo_prep: 20, tiempo_coccion: 0 },
    { nombre: 'Ensalada de espinacas con pollo y vinagreta balsámica', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 10 },
    { nombre: 'Sopa de verduras con fideos de arroz', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 3, tiempo_prep: 10, tiempo_coccion: 20 },
    { nombre: 'Berenjenas a la parmesana ligeras', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 2, tiempo_prep: 15, tiempo_coccion: 30 },
    { nombre: 'Ceviche de corvina con mango', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 2, tiempo_prep: 25, tiempo_coccion: 0 },
    { nombre: 'Wrap de lechuga con pollo y verduras crujientes', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 8 },
    { nombre: 'Ensalada templada de garbanzos con bacalao', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Calabacín relleno de pavo y queso light', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 25 },
    { nombre: 'Gazpacho de sandía y tomate', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 3, tiempo_prep: 15, tiempo_coccion: 0 },

    // === SNACKS SALUDABLES 10 ===
    { nombre: 'Rollitos de jamón serrano con queso fresco', categoria: 'Snack', tipo_plato: 'Snack', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 0 },
    { nombre: 'Chips de kale al horno', categoria: 'Snack', tipo_plato: 'Snack', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 12 },
    { nombre: 'Huevos rellenos de atún y yogur', categoria: 'Snack', tipo_plato: 'Snack', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 10 },
    { nombre: 'Pinchos de mozzarella con tomate cherry y albahaca', categoria: 'Snack', tipo_plato: 'Snack', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 0 },
    { nombre: 'Hummus de remolacha con crudités', categoria: 'Snack', tipo_plato: 'Snack', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 0 },
    { nombre: 'Tostas de pan de centeno con sardinas y tomate', categoria: 'Snack', tipo_plato: 'Snack', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 3 },
    { nombre: 'Palitos de pepino con tzatziki', categoria: 'Snack', tipo_plato: 'Snack', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 0 },

    // === DESAYUNOS (más variedad) 10 ===
    { nombre: 'Tostada de pan integral con aguacate y huevo revuelto', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 5 },
    { nombre: 'Bowl de yogur con granola casera y fruta de temporada', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 0 },
    { nombre: 'Tortitas de avena y calabaza', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 12 },
    { nombre: 'Muesli casero con frutos secos y semillas', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 6, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Smoothie verde de espinacas y plátano', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Huevos poché sobre aguacate y pan integral', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'media', porciones: 1, tiempo_prep: 10, tiempo_coccion: 5 },
    { nombre: 'Parfait de yogur griego con frutos rojos y semillas de chía', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 0 },

    // === POSTRES (variedad más ligera) 5 ===
    { nombre: 'Manzanas asadas con canela y nueces', categoria: 'Postre', tipo_plato: 'Postre', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 25 },
    { nombre: 'Peras al vino tinto sin azúcar', categoria: 'Postre', tipo_plato: 'Postre', dificultad: 'media', porciones: 4, tiempo_prep: 10, tiempo_coccion: 30 },

    // === MERIENDAS 5 ===
    { nombre: 'Batido de proteínas con plátano y mantequilla de cacahuete', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Yogur griego con compota de manzana sin azúcar', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Mini sándwich de pavo y queso fresco en pan integral', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Bowl de fruta fresca con requesón y semillas', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 0 },

    // === MÁS RECETAS (para llegar a 200+) ===
    // COMIDAS
    { nombre: 'Fajitas de pollo con pimientos y cebolla', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 15 },
    { nombre: 'Bacalao al horno con patatas panadera', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 2, tiempo_prep: 15, tiempo_coccion: 35 },
    { nombre: 'Arroz integral con pollo y verduras', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 3, tiempo_prep: 15, tiempo_coccion: 30 },
    { nombre: 'Pizza casera de base de coliflor', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 2, tiempo_prep: 20, tiempo_coccion: 25 },
    { nombre: 'Solomillo de cerdo al horno con manzana', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 2, tiempo_prep: 15, tiempo_coccion: 30 },
    { nombre: 'Rape a la marinera ligero', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 2, tiempo_prep: 15, tiempo_coccion: 25 },
    { nombre: 'Tallarines de calabacín con pesto de albahaca', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 10 },
    { nombre: 'Estofado de garbanzos con calabaza y espinacas', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 35 },
    // CENAS
    { nombre: 'Sopa de pescado y marisco ligera', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 3, tiempo_prep: 15, tiempo_coccion: 25 },
    { nombre: 'Ensalada de lentejas con verduras asadas', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 0 },
    { nombre: 'Revuelto de setas con ajetes y gambas', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 10 },
    { nombre: 'Crema de puerro y patata light', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 3, tiempo_prep: 10, tiempo_coccion: 25 },
    { nombre: 'Ensalada de rúcula con queso de cabra y nueces', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 0 },
    { nombre: 'Brócoli al vapor con jamón serrano y huevo poché', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 12 },
    // SNACKS
    { nombre: 'Canapés de pepino con salmón ahumado y eneldo', categoria: 'Snack', tipo_plato: 'Snack', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 0 },
    { nombre: 'Palitos de apio con crema de cacahuete', categoria: 'Snack', tipo_plato: 'Snack', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Garbanzos especiados al horno crujientes', categoria: 'Snack', tipo_plato: 'Snack', dificultad: 'fácil', porciones: 4, tiempo_prep: 5, tiempo_coccion: 25 },
    { nombre: 'Wrap de lechuga con atún y verduras', categoria: 'Snack', tipo_plato: 'Snack', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 0 },
    // DESAYUNOS
    { nombre: 'Porridge de avena con manzana y canela', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 10 },
    { nombre: 'Tostada de pan integral con requesón y mermelada sin azúcar', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Crepes de avena y plátano', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 10 },
    { nombre: 'Batido de frutos rojos con kéfir', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    // POSTRES
    { nombre: 'Mousse de chocolate negro y aguacate', categoria: 'Postre', tipo_plato: 'Postre', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 0 },
    { nombre: 'Helado de plátano y cacao (nice cream)', categoria: 'Postre', tipo_plato: 'Postre', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 0 },
    { nombre: 'Flan de huevo casero sin azúcar', categoria: 'Postre', tipo_plato: 'Postre', dificultad: 'media', porciones: 4, tiempo_prep: 15, tiempo_coccion: 45 },
    { nombre: 'Natillas de coco y vainilla', categoria: 'Postre', tipo_plato: 'Postre', dificultad: 'fácil', porciones: 3, tiempo_prep: 10, tiempo_coccion: 15 },
    // MERIENDAS
    { nombre: 'Tostada de pan de centeno con aguacate y tomate', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Puñado de frutos secos con yogur natural', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 2, tiempo_coccion: 0 },
    { nombre: 'Rollitos de pavo con queso fresco y espinacas', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 0 },
    { nombre: 'Batido verde de manzana y espinacas', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
]

// ── Normalizar nombre ─────────────────────────────────
function normalizarNombre(nombre) {
    const map = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n' }
    let n = nombre.toLowerCase().trim()
    for (const [k, v] of Object.entries(map)) n = n.replaceAll(k, v)
    if (n.endsWith('es') && n.length > 4) n = n.slice(0, -2)
    else if (n.endsWith('s') && n.length > 3) n = n.slice(0, -1)
    return n
}

// ── Auto-match ingredientes contra DB ──────────────────
async function autoMatchIngredientes(ingredientesRefinados) {
    let matched = 0, unmatched = 0, autoCreados = 0
    const ingredientesDB = []

    for (let idx = 0; idx < ingredientesRefinados.length; idx++) {
        const p = ingredientesRefinados[idx]
        const busqueda = p.nombre_limpio.split(/\s+/).slice(0, 3).join(' ')
        let encontrado = null

        if (p.cantidad_gramos > 0 && busqueda.length >= 2) {
            // Nivel 1: ilike exacto
            const { data: exacto } = await supabase.from('alimentos').select('*').ilike('nombre', busqueda).limit(1).maybeSingle()
            if (exacto) encontrado = exacto

            // Nivel 2: palabra clave
            if (!encontrado) {
                for (const word of busqueda.split(/\s+/).filter(w => w.length > 2)) {
                    const { data: fb } = await supabase.from('alimentos').select('*').ilike('nombre', `%${word}%`).limit(1).maybeSingle()
                    if (fb) { encontrado = fb; break }
                }
            }

            // Nivel 3: singular
            if (!encontrado) {
                const normalizado = normalizarNombre(busqueda)
                if (normalizado !== busqueda) {
                    const { data: stem } = await supabase.from('alimentos').select('*').ilike('nombre', normalizado).limit(1).maybeSingle()
                    if (stem) encontrado = stem
                    if (!encontrado) {
                        for (const word of normalizado.split(/\s+/).filter(w => w.length > 2)) {
                            const { data: fb } = await supabase.from('alimentos').select('*').ilike('nombre', `%${word}%`).limit(1).maybeSingle()
                            if (fb) { encontrado = fb; break }
                        }
                    }
                }
            }
        }

        if (encontrado) {
            ingredientesDB.push({
                alimento_id: encontrado.id,
                nombre_libre: encontrado.nombre,
                cantidad_gramos: Math.max(p.cantidad_gramos, 0),
                orden: idx
            })
            matched++
        } else if (p.macros_100g && p.cantidad_gramos > 0) {
            // Auto-crear
            const { data: nuevoAlimento } = await supabase.from('alimentos').insert({
                nombre: p.nombre_limpio,
                calorias: Math.round(p.macros_100g.kcal || 0),
                proteinas: Math.round((p.macros_100g.proteinas || 0) * 10) / 10,
                carbohidratos: Math.round((p.macros_100g.carbohidratos || 0) * 10) / 10,
                grasas: Math.round((p.macros_100g.grasas || 0) * 10) / 10,
                fibra: Math.round((p.macros_100g.fibra || 0) * 10) / 10,
                categoria: 'scrapeado',
                fuente: 'deepseek-ia',
            }).select().single()

            if (nuevoAlimento) {
                ingredientesDB.push({
                    alimento_id: nuevoAlimento.id,
                    nombre_libre: nuevoAlimento.nombre,
                    cantidad_gramos: Math.max(p.cantidad_gramos, 0),
                    orden: idx
                })
                matched++
                autoCreados++
                continue
            }
            ingredientesDB.push({ alimento_id: null, nombre_libre: p.nombre_limpio, cantidad_gramos: Math.max(p.cantidad_gramos, 0), orden: idx })
            unmatched++
        } else {
            ingredientesDB.push({ alimento_id: null, nombre_libre: p.nombre_limpio, cantidad_gramos: Math.max(p.cantidad_gramos, 0), orden: idx })
            unmatched++
        }
    }
    return { ingredientesDB, matched, unmatched, autoCreados }
}

// ── Calcular macros desde ingredientes ─────────────────
async function calcularMacros(ingredientes, porciones) {
    const ids = ingredientes.filter(i => i.alimento_id).map(i => i.alimento_id)
    if (ids.length === 0) return { kcal: null, proteinas: null, carbohidratos: null, grasas: null, fibra: null }

    const { data: alimentos } = await supabase.from('alimentos').select('id, calorias, proteinas, carbohidratos, grasas, fibra').in('id', ids)
    const map = new Map(alimentos?.map(a => [a.id, a]) || [])

    let kcal = 0, proteinas = 0, carbohidratos = 0, grasas = 0, fibra = 0
    for (const ing of ingredientes) {
        if (!ing.alimento_id || !ing.cantidad_gramos) continue
        const al = map.get(ing.alimento_id)
        if (!al) continue
        const factor = ing.cantidad_gramos / 100
        kcal += (al.calorias || 0) * factor
        proteinas += (al.proteinas || 0) * factor
        carbohidratos += (al.carbohidratos || 0) * factor
        grasas += (al.grasas || 0) * factor
        fibra += (al.fibra || 0) * factor
    }
    if (porciones > 0) {
        return {
            kcal: Math.round(kcal / porciones),
            proteinas: Math.round(proteinas / porciones * 10) / 10,
            carbohidratos: Math.round(carbohidratos / porciones * 10) / 10,
            grasas: Math.round(grasas / porciones * 10) / 10,
            fibra: Math.round(fibra / porciones * 10) / 10,
        }
    }
    return {
        kcal: Math.round(kcal),
        proteinas: Math.round(proteinas * 10) / 10,
        carbohidratos: Math.round(carbohidratos * 10) / 10,
        grasas: Math.round(grasas * 10) / 10,
        fibra: Math.round(fibra * 10) / 10,
    }
}

// ── Safe JSON parse (repara errores comunes de DeepSeek) ─
function safeParseJSON(raw) {
    let str = raw.trim()

    // Stripear bloques markdown ```json ... ``` o ``` ... ```
    const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) str = codeBlockMatch[1].trim()

    // Buscar primer { y último }
    const firstBrace = str.indexOf('{')
    const lastBrace = str.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        return { error: 'No se encontraron {} válidos' }
    }
    str = str.slice(firstBrace, lastBrace + 1)

    // 1. Quitar trailing commas (antes de ] o })
    str = str.replace(/,(\s*[\]}])/g, '$1')

    // 2. Quitar comentarios // y /* */
    str = str.replace(/\/\/.*?(\n|$)/g, '\n')
    str = str.replace(/\/\*[\s\S]*?\*\//g, '')

    // 3. Reemplazar comillas simples por dobles (solo donde sean válidas)
    //    pero OJO: no si ya están dentro de un string con dobles
    str = str.replace(/'/g, '"')

    // 4. Quitar caracteres de control (0x00-0x1F excepto tab/newline)
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')

    // Intentar parseo normal
    try {
        return { data: JSON.parse(str) }
    } catch (_) { }

    // 5. Si sigue fallando, intentar con Function (más permisivo)
    try {
        const result = new Function('return (' + str + ')')()
        if (result && typeof result === 'object') return { data: result }
    } catch (_) { }

    return { error: `JSON inválido tras reparación: ${raw.slice(0, 200)}` }
}

// ── Llamar a DeepSeek para generar receta ──────────────
async function generarRecetaConIA(receta, intento = 1) {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY no configurada')

    const systemPrompt = `Eres un nutricionista y chef experto. Creas recetas saludables completas y deliciosas.

NORMAS:
1. IDIOMA: Todo en español.
2. MEDIDAS: Sistema métrico (gramos/ml).
3. INSTRUCCIONES: Pasos numerados detallados (4-8 pasos).
4. MACROS/100g: Para cada ingrediente, estima valores basados en BEDCA/USDA.
5. MACROS TOTALES: Calcula por porción.
6. Sé realista con cantidades.
7. INGREDIENTES: Nombres en español, en singular y forma más común.
8. Cada ingrediente DEBE tener cantidad_gramos > 0.
9. No incluyas ingredientes opcionales de decoración.
10. Ajusta las cantidades para el número exacto de porciones indicado.

Debes responder ÚNICAMENTE con JSON válido, sin markdown, sin texto adicional, sin comas finales en arrays u objetos.`

    const userPrompt = `Genera la siguiente receta saludable:

NOMBRE: "${receta.nombre}"
CATEGORÍA: ${receta.categoria}
TIPO DE PLATO: ${receta.tipo_plato}
DIFICULTAD: ${receta.dificultad}
PORCIONES: ${receta.porciones}
TIEMPO PREPARACIÓN: ${receta.tiempo_prep} min
TIEMPO COCCIÓN: ${receta.tiempo_coccion} min

Devuelve JSON con: nombre, descripcion, instrucciones, porciones, tiempo_prep_min, tiempo_coccion_min, ingredientes (array con nombre_limpio, cantidad_gramos, macros_100g), y macros_por_porcion.`

    const body = {
        model: DEEPSEEK_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: intento === 1 ? 0.2 : 0.5,
        max_tokens: 8192,
    }

    // DeepSeek soporta response_format para forzar JSON válido
    // Solo lo usamos si no es reintento (el reintento con temp diferente a veces funciona mejor sin él)
    if (intento === 1) {
        body.response_format = { type: 'json_object' }
    }

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const errorText = await response.text()
        // Si response_format no es soportado, reintentar sin él
        if (intento === 1 && (response.status === 400 || response.status === 422)) {
            console.log(`  ⚠️  response_format no soportado, reintentando sin él...`)
            delete body.response_format
            const retryResp = await fetch(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify(body),
            })
            if (!retryResp.ok) {
                throw new Error(`DeepSeek API error ${retryResp.status}: ${await retryResp.text()}`)
            }
            const data = await retryResp.json()
            return procesarRespuestaDeepSeek(data, receta, intento)
        }
        throw new Error(`DeepSeek API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return procesarRespuestaDeepSeek(data, receta, intento)
}

async function procesarRespuestaDeepSeek(data, receta, intento) {
    const content = data.choices?.[0]?.message?.content
    if (!content || content.trim().length === 0) {
        if (intento < 2) {
            console.log(`  ⚠️  Respuesta vacía en intento ${intento}, reintentando con temp=${intento === 1 ? 0.2 : 0.5}...`)
            await new Promise(r => setTimeout(r, 2000))
            return generarRecetaConIA(receta, intento + 1)
        }
        throw new Error('DeepSeek: respuesta vacía tras 2 intentos')
    }

    // Safe parse con reparación
    const result = safeParseJSON(content)
    if (result.error) {
        if (intento < 2) {
            console.log(`  ⚠️  Error parseo en intento ${intento}: ${result.error.substring(0, 80)}, reintentando...`)
            await new Promise(r => setTimeout(r, 2000))
            return generarRecetaConIA(receta, intento + 1)
        }
        throw new Error(`DeepSeek: ${result.error}`)
    }

    const parsed = result.data

    if (!parsed.nombre || !parsed.ingredientes || !parsed.macros_por_porcion) {
        if (intento < 2) {
            console.log(`  ⚠️  JSON incompleto en intento ${intento}, reintentando...`)
            await new Promise(r => setTimeout(r, 2000))
            return generarRecetaConIA(receta, intento + 1)
        }
        throw new Error('DeepSeek: JSON incompleto (faltan nombre, ingredientes o macros_por_porcion)')
    }

    // Filtrar ingredientes sin cantidad
    parsed.ingredientes = parsed.ingredientes.filter(i => i.cantidad_gramos > 0 && i.nombre_limpio?.length > 1)

    if (parsed.ingredientes.length < 2) {
        if (intento < 2) {
            console.log(`  ⚠️  <2 ingredientes válidos en intento ${intento}, reintentando...`)
            await new Promise(r => setTimeout(r, 2000))
            return generarRecetaConIA(receta, intento + 1)
        }
        throw new Error('DeepSeek: devolvió <2 ingredientes válidos')
    }

    return { data: parsed, total_tokens: data.usage?.total_tokens || 0 }
}

// ── Insertar receta en BD ──────────────────────────────
async function insertarRecetaEnBD(recetaPlan, dataIA, ingredientesDB) {
    // Calcular macros reales
    const macros = await calcularMacros(ingredientesDB, dataIA.porciones || 1)

    // Insertar receta
    const { data: nuevaReceta, error: insertError } = await supabase.from('recetas').insert({
        nombre: dataIA.nombre,
        descripcion: dataIA.descripcion || null,
        instrucciones: dataIA.instrucciones,
        porciones: dataIA.porciones || recetaPlan.porciones,
        tiempo_prep_min: dataIA.tiempo_prep_min || recetaPlan.tiempo_prep,
        tiempo_coccion_min: dataIA.tiempo_coccion_min || recetaPlan.tiempo_coccion,
        categoria: recetaPlan.categoria,
        tipo_plato: recetaPlan.tipo_plato,
        dificultad: recetaPlan.dificultad,
        estado: 'aprobada',
        kcal: macros.kcal,
        proteinas: macros.proteinas,
        carbohidratos: macros.carbohidratos,
        grasas: macros.grasas,
        fibra: macros.fibra,
    }).select('id').single()

    if (insertError) {
        throw new Error(`Error insertando receta: ${insertError.message}`)
    }

    // Insertar ingredientes
    if (ingredientesDB.length > 0 && nuevaReceta) {
        const inserts = ingredientesDB.map(ing => ({
            receta_id: nuevaReceta.id,
            alimento_id: ing.alimento_id,
            nombre_libre: ing.nombre_libre,
            cantidad_gramos: ing.cantidad_gramos,
            orden: ing.orden,
        }))
        const { error: ingError } = await supabase.from('receta_ingredientes').insert(inserts)
        if (ingError) {
            // Si fallan los ingredientes, borrar la receta huérfana
            await supabase.from('recetas').delete().eq('id', nuevaReceta.id)
            throw new Error(`Error insertando ingredientes: ${ingError.message}`)
        }
    }

    return nuevaReceta.id
}

// ── Procesar una receta ────────────────────────────────
async function procesarReceta(receta, index, total) {
    const startTime = Date.now()
    try {
        // 1. Generar con IA
        const { data, total_tokens } = await generarRecetaConIA(receta)

        // 2. Auto-match ingredientes
        const matchResult = await autoMatchIngredientes(data.ingredientes)

        // 3. Insertar en BD
        const recetaId = await insertarRecetaEnBD(receta, data, matchResult.ingredientesDB)

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`✅ [${index}/${total}] ${data.nombre.substring(0, 50).padEnd(52)} ${matchResult.matched}matched ${matchResult.autoCreados}creados ${total_tokens}tok ${elapsed}s`)
        return { ok: true, nombre: data.nombre, id: recetaId, tokens: total_tokens, autoCreados: matchResult.autoCreados }

    } catch (err) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        console.log(`❌ [${index}/${total}] ${receta.nombre.substring(0, 50).padEnd(52)} ${msg.substring(0, 60)} ${elapsed}s`)
        return { ok: false, nombre: receta.nombre, error: msg, tokens: 0, autoCreados: 0 }
    }
}

// ── Main ────────────────────────────────────────────────
async function main() {
    console.log('')
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log('║   🍳 GENERACIÓN MASIVA DE RECETAS CON DEEPSEEK         ║')
    console.log('╚══════════════════════════════════════════════════════════╝')
    console.log('')

    // Verificar API key
    if (!process.env.DEEPSEEK_API_KEY) {
        console.error('❌ DEEPSEEK_API_KEY no configurada en .env.local')
        process.exit(1)
    }

    // Verificar cuántas recetas hay ahora
    const { count: recetasActuales, error: countError } = await supabase
        .from('recetas')
        .select('*', { count: 'exact', head: true })

    if (countError) {
        console.error('❌ Error consultando recetas:', countError.message)
        process.exit(1)
    }

    console.log(`📊 Recetas actuales en BD: ${recetasActuales}`)

    // Obtener recetas existentes para evitar duplicados
    const { data: existentes } = await supabase.from('recetas').select('nombre')
    const nombresExistentes = new Set(existentes?.map(r => r.nombre.toLowerCase().trim()) || [])

    // Filtrar recetas a generar
    let listaRecetas = RECETAS_A_GENERAR
    if (SOLO_SALADAS) {
        listaRecetas = listaRecetas.filter(r => ['Comida', 'Cena', 'Snack', 'Merienda'].includes(r.categoria))
    } else if (SOLO_DULCES) {
        listaRecetas = listaRecetas.filter(r => ['Postre', 'Dulce', 'Desayuno'].includes(r.categoria))
    }

    // Filtrar duplicados
    const nuevas = listaRecetas.filter(r => !nombresExistentes.has(r.nombre.toLowerCase().trim()))
    const duplicados = listaRecetas.length - nuevas.length

    if (duplicados > 0) {
        console.log(`⚠️  ${duplicados} recetas ya existen en BD (omitidas)`)
    }

    // Aplicar límite
    const aProcesar = nuevas.slice(0, LIMITE)

    console.log(`🚀 Generando ${aProcesar.length} recetas nuevas...`)
    console.log('')

    // ── Procesar con pool de concurrencia ──
    const MAX_CONCURRENT = 3
    let ok = 0, failed = 0, totalTokens = 0, totalAutoCreados = 0
    const startGlobal = Date.now()

    for (let i = 0; i < aProcesar.length; i += MAX_CONCURRENT) {
        const batch = aProcesar.slice(i, i + MAX_CONCURRENT)
        const results = await Promise.all(
            batch.map((r, idx) => procesarReceta(r, i + idx + 1, aProcesar.length))
        )

        for (const result of results) {
            if (result.ok) {
                ok++
                totalTokens += result.tokens
                totalAutoCreados += result.autoCreados
            } else {
                failed++
            }
        }

        // Pausa entre lotes
        if (i + MAX_CONCURRENT < aProcesar.length) {
            await new Promise(r => setTimeout(r, 500))
        }
    }

    // ── Resumen final ──
    const elapsed = ((Date.now() - startGlobal) / 1000 / 60).toFixed(1)
    const { count: recetasFinales } = await supabase
        .from('recetas')
        .select('*', { count: 'exact', head: true })

    console.log('')
    console.log('╔══════════════════════════════════════════════╗')
    console.log('║   📊 RESUMEN FINAL                          ║')
    console.log('╚══════════════════════════════════════════════╝')
    console.log(`  🍳 Recetas antes:      ${recetasActuales}`)
    console.log(`  🍳 Recetas después:    ${recetasFinales}`)
    console.log(`  ✅ Creadas:            ${ok}`)
    console.log(`  ❌ Fallos:             ${failed}`)
    console.log(`  🆕 Alimentos creados:  ${totalAutoCreados}`)
    console.log(`  📊 Tokens totales:     ${totalTokens}`)
    console.log(`  ⏱️  Tiempo:            ${elapsed} min`)
    console.log(`  💰 Coste aprox:        ~$${(totalTokens * 0.00000015 + totalTokens * 0.0000006 * 0.3).toFixed(4)}`)
    console.log('')
}

main().catch(err => {
    console.error('Error general:', err)
    process.exit(1)
})
