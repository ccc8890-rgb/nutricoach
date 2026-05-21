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
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

// ── Flags ──
const args = process.argv.slice(2)
const flagLimite = args.find(a => a.startsWith('--limite='))
const LIMITE = flagLimite ? parseInt(flagLimite.split('=')[1], 10) : 90
const SOLO_SALADAS = args.includes('--secos')
const SOLO_DULCES = args.includes('--dulces')

// COACH_ID fijo (Carlos Casanova)
const COACH_ID = 'f62aea4e-69a2-4062-b517-bb6a639ee1b5'

// ── 90 recetas nuevas — enfocadas en los GAPS detectados ──────────────
// Prioridad: CENAS (27→60), DESAYUNOS SALADOS (0→15), COMIDAS diversas (arroces, pasta, legumbres)
// Estas recetas se insertan con fuente_tipo='ia_generada' y estado='en_revision'
// para que Carlos pueda revisarlas y sustituirlas por recetas reales en el futuro.
const RECETAS_A_GENERAR = [

    // ══════════════════════════════════════════════════════════
    // CENAS — PESCADO Y MARISCO (objetivo: +20 cenas de pescado)
    // ══════════════════════════════════════════════════════════
    { nombre: 'Salmón al horno con espárragos y limón', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 20 },
    { nombre: 'Dorada a la sal con patatas al vapor', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 35 },
    { nombre: 'Merluza al horno con pisto de verduras', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 25 },
    { nombre: 'Gambas al ajillo con pan integral tostado', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Sepia a la plancha con alioli de ajo negro', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 10 },
    { nombre: 'Mejillones al vapor con salsa de tomate casera', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 12 },
    { nombre: 'Bacalao al pil pil ligero con pimientos', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 2, tiempo_prep: 15, tiempo_coccion: 20 },
    { nombre: 'Lubina a la plancha con salsa verde de perejil', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 12 },
    { nombre: 'Boquerones al horno con ajo y limón', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Caballa al horno con tomate y orégano', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 20 },
    { nombre: 'Pulpo a la gallega con pimentón ahumado', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 2, tiempo_prep: 5, tiempo_coccion: 45 },
    { nombre: 'Chipirones en su tinta con arroz blanco', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 2, tiempo_prep: 15, tiempo_coccion: 25 },
    { nombre: 'Atún a la plancha con ensalada de tomate y cebolla', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 6 },
    { nombre: 'Gamba roja a la plancha con sal en escamas', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 4 },

    // ══════════════════════════════════════════════════════════
    // CENAS — CARNE LIGERA Y AVES
    // ══════════════════════════════════════════════════════════
    { nombre: 'Pechuga de pavo al horno con limón y hierbas', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 25 },
    { nombre: 'Pollo a la plancha con ensalada de rúcula y parmesano', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 12 },
    { nombre: 'Lomo de cerdo a la plancha con manzana y mostaza', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 10 },
    { nombre: 'Filete de ternera a la plancha con espinacas salteadas', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Albóndigas de pavo en salsa de champiñones', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 3, tiempo_prep: 20, tiempo_coccion: 25 },

    // ══════════════════════════════════════════════════════════
    // CENAS — VERDURA + PROTEÍNA Y SOPAS
    // ══════════════════════════════════════════════════════════
    { nombre: 'Frittata de verduras al horno con queso feta', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 20 },
    { nombre: 'Coliflor asada con salsa de yogur y especias', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 30 },
    { nombre: 'Sopa de tomate asado con albahaca y huevo pochado', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 25 },
    { nombre: 'Caldo de pollo casero con verduras y fideos', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 40 },
    { nombre: 'Crema de brócoli con queso fresco y almendras', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 3, tiempo_prep: 10, tiempo_coccion: 20 },
    { nombre: 'Espinacas salteadas con huevo y jamón ibérico', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Champiñones rellenos de atún y queso gratinados', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 15 },
    { nombre: 'Tortilla española de patata con cebolla', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'media', porciones: 4, tiempo_prep: 20, tiempo_coccion: 15 },
    { nombre: 'Pisto manchego con huevos al plato', categoria: 'Cena', tipo_plato: 'Cena', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 25 },

    // ══════════════════════════════════════════════════════════
    // DESAYUNOS SALADOS (GAP CRÍTICO — actualmente 0)
    // ══════════════════════════════════════════════════════════
    { nombre: 'Huevos revueltos con espinacas y jamón serrano', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Tortilla francesa proteica con queso y champiñones', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 6 },
    { nombre: 'Tostadas con salmón ahumado, queso fresco y alcaparras', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Tostadas de sardinas con tomate triturado y orégano', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Huevos a la mexicana con tomate pimiento y jalapeño', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 10 },
    { nombre: 'Bowl salado de quínoa con huevo y aguacate', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Scrambled eggs con chorizo ibérico y pimiento verde', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Tosta de pan de centeno con atún y tomate', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Shakshuka ligera con pollo y especias marroquíes', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'media', porciones: 2, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Tortilla de claras con pimientos y cebolla caramelizada', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 10, tiempo_coccion: 10 },
    { nombre: 'Porridge de avena salado con huevo poché y aguacate', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'media', porciones: 1, tiempo_prep: 5, tiempo_coccion: 10 },
    { nombre: 'Tostada de pan integral con jamón de pavo y tomate', categoria: 'Desayuno', tipo_plato: 'Desayuno', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },

    // ══════════════════════════════════════════════════════════
    // COMIDAS — ARROCES (actualmente solo 3)
    // ══════════════════════════════════════════════════════════
    { nombre: 'Arroz caldoso con rape y gambas', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 15, tiempo_coccion: 30 },
    { nombre: 'Arroz a banda con alioli casero', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 15, tiempo_coccion: 35 },
    { nombre: 'Risotto de espárragos trigueros y parmesano', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 2, tiempo_prep: 10, tiempo_coccion: 25 },
    { nombre: 'Arroz con costillas y judías verdes al estilo valenciano', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 4, tiempo_prep: 20, tiempo_coccion: 40 },
    { nombre: 'Arroz negro con sepia y alioli', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 15, tiempo_coccion: 30 },
    { nombre: 'Arroz al horno con embutido y patata', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 35 },

    // ══════════════════════════════════════════════════════════
    // COMIDAS — PASTA (actualmente 0 recetas de pasta española)
    // ══════════════════════════════════════════════════════════
    { nombre: 'Pasta integral con atún y tomate casero', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Espaguetis con gambas y salsa de ajo y perejil', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 15 },
    { nombre: 'Pasta integral con pollo y pesto de espinacas', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 15 },
    { nombre: 'Macarrones con carne picada y tomate casero', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 3, tiempo_prep: 10, tiempo_coccion: 20 },
    { nombre: 'Pasta al pesto de albahaca con tomates cherry', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 10, tiempo_coccion: 12 },
    { nombre: 'Fideuà de pescado y marisco al estilo valenciano', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 15, tiempo_coccion: 25 },

    // ══════════════════════════════════════════════════════════
    // COMIDAS — LEGUMBRES (actualmente solo 3-4)
    // ══════════════════════════════════════════════════════════
    { nombre: 'Lentejas con chorizo y verduras al estilo tradicional', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 40 },
    { nombre: 'Judías blancas con almejas y salsa verde', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 15, tiempo_coccion: 25 },
    { nombre: 'Potaje de garbanzos con espinacas y bacalao', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 4, tiempo_prep: 15, tiempo_coccion: 35 },
    { nombre: 'Alubias rojas con morcilla y pimiento choricero', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 4, tiempo_prep: 20, tiempo_coccion: 50 },
    { nombre: 'Hummus casero con crudités y pan de pita', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 4, tiempo_prep: 10, tiempo_coccion: 0 },
    { nombre: 'Guiso de lentejas rojas con cúrcuma y coco', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 3, tiempo_prep: 10, tiempo_coccion: 25 },

    // ══════════════════════════════════════════════════════════
    // COMIDAS — GUISOS Y CARNES TRADICIONALES ESPAÑOLAS
    // ══════════════════════════════════════════════════════════
    { nombre: 'Muslos de pollo al horno con patatas panaderas', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 3, tiempo_prep: 15, tiempo_coccion: 45 },
    { nombre: 'Dorada al horno con patatas y verduras mediterráneas', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'fácil', porciones: 2, tiempo_prep: 15, tiempo_coccion: 30 },
    { nombre: 'Caldereta de cordero con patatas y pimientos', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 4, tiempo_prep: 20, tiempo_coccion: 60 },
    { nombre: 'Estofado de ternera con patatas y zanahorias', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 4, tiempo_prep: 20, tiempo_coccion: 70 },
    { nombre: 'Pollo en pepitoria con almendras y azafrán', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 20, tiempo_coccion: 40 },
    { nombre: 'Conejo al ajillo con aceite de oliva y vino blanco', categoria: 'Comida', tipo_plato: 'Comida', dificultad: 'media', porciones: 3, tiempo_prep: 15, tiempo_coccion: 35 },

    // ══════════════════════════════════════════════════════════
    // MERIENDAS — AMPLIAR BASE (actualmente solo 11)
    // ══════════════════════════════════════════════════════════
    { nombre: 'Tostada de pan de centeno con mantequilla de almendra y plátano', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 3, tiempo_coccion: 0 },
    { nombre: 'Queso fresco con higos frescos y nueces', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Mini tortilla de claras con espinacas', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 8 },
    { nombre: 'Dátiles rellenos de almendra y chocolate negro', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 1, tiempo_prep: 5, tiempo_coccion: 0 },
    { nombre: 'Arroz con leche de avena y canela sin azúcar', categoria: 'Merienda', tipo_plato: 'Merienda', dificultad: 'fácil', porciones: 2, tiempo_prep: 5, tiempo_coccion: 25 },
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
        // en_revision para que Carlos las revise antes de activarlas
        estado: 'en_revision',
        // Trazabilidad: identifica estas recetas como generadas por IA
        // → permite filtrarlas en el futuro para sustituirlas por recetas reales
        fuente: 'ia-generada',
        fuente_tipo: 'ia_generada',
        coach_id: COACH_ID,
        notas_coach: 'Generada automáticamente por DeepSeek. Revisar macros, ingredientes e imagen antes de aprobar.',
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
