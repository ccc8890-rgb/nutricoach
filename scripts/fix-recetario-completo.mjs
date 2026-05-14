/**
 * fix-recetario-completo.mjs
 *
 * Corrección integral del recetario NutriCoach.
 *
 * FASES (ejecución ordenada):
 *   1. Identificar alimentos usados en recetas con macros a cero y asignar valores BEDCA
 *   2. Re-matchear ingredientes con alimento_id huérfano a alimentos existentes
 *   3. Estandarizar intolerancias (valores no estándar → null o estándar)
 *   4. Generar tags automáticos para recetas sin tags
 *   5. Recalcular macros por porción y por 100g para TODAS las recetas
 *   6. Verificación final
 *
 * USO:
 *   node scripts/fix-recetario-completo.mjs           # dry-run
 *   node scripts/fix-recetario-completo.mjs --yes     # ejecutar
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
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

const ES_DRY_RUN = !process.argv.includes('--yes') && !process.argv.includes('-y')

// ── Helpers ──────────────────────────────────────────────────────

const LOG = []
function log(msg) { LOG.push(msg); console.log(msg) }

function normalizar(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// ================================================================
// FASE 0: CARGAR DATOS
// ================================================================

async function fase0Cargar() {
    log('\n═══ FASE 0: CARGA DE DATOS ═══\n')

    const { data: recetas } = await supabase.from('recetas').select('*').order('nombre')
    const { data: ings } = await supabase.from('receta_ingredientes').select('*')
    const { data: alims } = await supabase.from('alimentos').select('*').order('nombre')

    log(`Recetas: ${recetas?.length || 0}`)
    log(`Ingredientes: ${ings?.length || 0}`)
    log(`Alimentos: ${alims?.length || 0}`)

    // Índices
    const alimMap = {}; for (const a of (alims || [])) alimMap[a.id] = a
    const ingPorReceta = {}; for (const i of (ings || [])) { if (!ingPorReceta[i.receta_id]) ingPorReceta[i.receta_id] = []; ingPorReceta[i.receta_id].push(i) }

    // Alimentos USADOS en recetas con macros a cero
    const alimIdsUsados = new Set((ings || []).filter(i => i.alimento_id).map(i => i.alimento_id))
    const alimsUsadosSinMacros = (alims || []).filter(a => alimIdsUsados.has(a.id) && (!a.calorias || a.calorias === 0))
    log(`\nAlimentos usados en recetas con macros=0: ${alimsUsadosSinMacros.length}`)
    for (const a of alimsUsadosSinMacros) {
        const count = (ings || []).filter(i => i.alimento_id === a.id).length
        log(`  🥗 "${a.nombre}" (${a.id}) × ${count} usos`)
    }

    // Ingredientes con alimento_id huérfano
    const huerfanos = (ings || []).filter(i => i.alimento_id && !alimMap[i.alimento_id])
    log(`\nIngredientes con alimento_id huérfano: ${huerfanos.length}`)

    // Intolerancias no estándar
    const VALIDAS = ['Sin Gluten', 'Sin Lactosa', 'Vegano', 'Vegetariano', 'Sin Huevo', 'Sin Frutos Secos']
    const noEstandar = new Set()
    let sinIntol = 0
    for (const r of (recetas || [])) {
        if (!r.intolerancias || r.intolerancias.length === 0) { sinIntol++; continue }
        for (const i of r.intolerancias) { if (!VALIDAS.includes(i)) noEstandar.add(i) }
    }
    log(`\nRecetas sin intolerancias: ${sinIntol}`)
    log(`Intolerancias no estándar (${noEstandar.size}): ${[...noEstandar].join(', ')}`)

    const sinTags = (recetas || []).filter(r => !r.tags || r.tags.length === 0).length
    log(`Recetas sin tags: ${sinTags}/${recetas?.length || 0}`)

    return { recetas, ings, alims, alimMap, ingPorReceta, alimsUsadosSinMacros, huerfanos, alimIdsUsados }
}

// ================================================================
// FASE 1: ASIGNAR MACROS A ALIMENTOS USADOS EN RECETAS CON MACROS=0
// ================================================================

// Valores BEDCA/USDA para alimentos que aparecen en recetas y tienen macros=0
const MACROS_POR_NOMBRE = {
    // Carnes y aves
    'pechuga de pollo': { calorias: 108, proteinas: 24, carbohidratos: 0, grasas: 1.2, fibra: 0 },
    'contramuslos de pollo deshuesados y sin piel': { calorias: 119, proteinas: 20, carbohidratos: 0, grasas: 4, fibra: 0 },
    'brochetas de pollo, pimiento verde y tocino de cerdo con varilla': { calorias: 150, proteinas: 18, carbohidratos: 2, grasas: 8, fibra: 1 },
    'pato (pechuga sin piel)': { calorias: 134, proteinas: 22, carbohidratos: 0, grasas: 5, fibra: 0 },

    // Pescados y mariscos
    'gambas': { calorias: 84, proteinas: 18, carbohidratos: 0, grasas: 0.6, fibra: 0 },
    'atún claro en escabeche pack de 3': { calorias: 200, proteinas: 25, carbohidratos: 0, grasas: 10, fibra: 0 },

    // Huevos
    'huevo': { calorias: 143, proteinas: 12.6, carbohidratos: 0.7, grasas: 9.5, fibra: 0 },
    'huevo entero': { calorias: 143, proteinas: 12.6, carbohidratos: 0.7, grasas: 9.5, fibra: 0 },

    // Aceites y grasas
    'aceite de oliva': { calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0 },
    'aceite de oliva virgen extra': { calorias: 884, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0 },
    'aceite de coco': { calorias: 862, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0 },
    'ghee (mantequilla clarificada)': { calorias: 900, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0 },
    'ghee': { calorias: 900, proteinas: 0, carbohidratos: 0, grasas: 100, fibra: 0 },
    'mantequilla ligera': { calorias: 360, proteinas: 1, carbohidratos: 0.5, grasas: 40, fibra: 0 },

    // Frutos secos y semillas
    'cacahuetes sin sal': { calorias: 567, proteinas: 26, carbohidratos: 16, grasas: 49, fibra: 9 },
    'harina de almendra': { calorias: 583, proteinas: 21, carbohidratos: 22, grasas: 50, fibra: 11 },
    'mantequilla de cacahuete': { calorias: 588, proteinas: 25, carbohidratos: 20, grasas: 50, fibra: 6 },
    'semillas de chía': { calorias: 486, proteinas: 17, carbohidratos: 42, grasas: 31, fibra: 34 },

    // Chocolates y cacao
    'chocolate negro 85% cacao': { calorias: 598, proteinas: 11, carbohidratos: 19, grasas: 52, fibra: 11 },
    'chocolate fondant': { calorias: 500, proteinas: 7, carbohidratos: 40, grasas: 33, fibra: 5 },
    'cacao puro en polvo': { calorias: 228, proteinas: 20, carbohidratos: 12, grasas: 13, fibra: 8 },
    'cacao en polvo a la taza valor': { calorias: 360, proteinas: 5, carbohidratos: 70, grasas: 3, fibra: 4 },

    // Cereales y harinas
    'arroz': { calorias: 345, proteinas: 7, carbohidratos: 77, grasas: 0.7, fibra: 1.4 },
    'arroz para sushi': { calorias: 345, proteinas: 7, carbohidratos: 77, grasas: 0.7, fibra: 1.4 },
    'tortilla trigo': { calorias: 300, proteinas: 8, carbohidratos: 52, grasas: 7, fibra: 3 },
    'spaghetti al huevo': { calorias: 370, proteinas: 13, carbohidratos: 70, grasas: 3, fibra: 2 },

    // Salsas y condimentos
    'salsa de soja': { calorias: 53, proteinas: 5, carbohidratos: 5, grasas: 0.1, fibra: 0.5 },
    'mayonesa light': { calorias: 292, proteinas: 0.5, carbohidratos: 5, grasas: 30, fibra: 0 },
    'mayonesa hellmann\'s': { calorias: 700, proteinas: 1, carbohidratos: 0.5, grasas: 75, fibra: 0 },
    'vinagre balsámico': { calorias: 88, proteinas: 0.5, carbohidratos: 17, grasas: 0, fibra: 0 },
    'vinagre de jerez reserva': { calorias: 30, proteinas: 0.1, carbohidratos: 2, grasas: 0, fibra: 0 },
    'vinagre de manzana hacendado sin filtrar': { calorias: 22, proteinas: 0, carbohidratos: 1, grasas: 0, fibra: 0 },
    'tomate frito receta artesana': { calorias: 60, proteinas: 1.5, carbohidratos: 8, grasas: 2.5, fibra: 1.5 },
    'tomate frito hida': { calorias: 55, proteinas: 1, carbohidratos: 8, grasas: 2, fibra: 1.5 },
    'tomate frito estilo casero': { calorias: 55, proteinas: 1, carbohidratos: 8, grasas: 2, fibra: 1.5 },
    'tomate frito sin azúcares añadidos': { calorias: 40, proteinas: 1.5, carbohidratos: 5, grasas: 1.5, fibra: 2 },
    'ketchup en sobres individuales': { calorias: 100, proteinas: 1, carbohidratos: 23, grasas: 0.1, fibra: 0.5 },
    'mostaza clásica': { calorias: 66, proteinas: 4, carbohidratos: 5, grasas: 3, fibra: 1 },
    'cebolla frita crujiente': { calorias: 400, proteinas: 4, carbohidratos: 40, grasas: 25, fibra: 3 },
    'sazonador barbacoa hacendado para pollo y costillas': { calorias: 50, proteinas: 2, carbohidratos: 8, grasas: 1, fibra: 3 },
    'sazonador para burritos': { calorias: 50, proteinas: 2, carbohidratos: 9, grasas: 1, fibra: 2 },
    'sazonador pollo y carne': { calorias: 50, proteinas: 2, carbohidratos: 8, grasas: 1, fibra: 2 },
    'sazonador pasta': { calorias: 50, proteinas: 2, carbohidratos: 8, grasas: 1, fibra: 2 },
    'sazonador hierbas provenzales hacendado para pollo y costillas': { calorias: 50, proteinas: 2, carbohidratos: 8, grasas: 1, fibra: 3 },
    'alioli con perejil': { calorias: 600, proteinas: 1, carbohidratos: 2, grasas: 65, fibra: 0 },
    'allioli en sobres individuales': { calorias: 600, proteinas: 1, carbohidratos: 2, grasas: 65, fibra: 0 },
    'panela azúcar moreno de caña integral': { calorias: 375, proteinas: 0, carbohidratos: 93, grasas: 0, fibra: 0 },

    // Especias
    'sal': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'sal fina': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'sal marina gruesa': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'sal de ajo': { calorias: 5, proteinas: 0, carbohidratos: 1, grasas: 0, fibra: 0 },
    'canela en rama': { calorias: 247, proteinas: 4, carbohidratos: 80, grasas: 1.2, fibra: 53 },
    'canela molida': { calorias: 247, proteinas: 4, carbohidratos: 80, grasas: 1.2, fibra: 53 },
    'jengibre molido': { calorias: 335, proteinas: 9, carbohidratos: 71, grasas: 4, fibra: 14 },
    'pimentón dulce de la vera': { calorias: 280, proteinas: 15, carbohidratos: 50, grasas: 13, fibra: 30 },
    'pimentón picante': { calorias: 280, proteinas: 15, carbohidratos: 50, grasas: 13, fibra: 30 },
    'pimienta blanca molida': { calorias: 255, proteinas: 10, carbohidratos: 60, grasas: 3, fibra: 25 },
    'pimienta negra en grano': { calorias: 255, proteinas: 10, carbohidratos: 60, grasas: 3, fibra: 25 },
    'molinillo mix pimientas': { calorias: 255, proteinas: 10, carbohidratos: 60, grasas: 3, fibra: 25 },
    'molinillo pimienta negra': { calorias: 255, proteinas: 10, carbohidratos: 60, grasas: 3, fibra: 25 },
    'hoja de laurel': { calorias: 313, proteinas: 8, carbohidratos: 75, grasas: 8, fibra: 25 },
    'comino en grano': { calorias: 375, proteinas: 18, carbohidratos: 44, grasas: 22, fibra: 11 },
    'ajo y perejil': { calorias: 100, proteinas: 4, carbohidratos: 18, grasas: 1, fibra: 2 },
    'cebolla en polvo': { calorias: 341, proteinas: 10, carbohidratos: 79, grasas: 1, fibra: 7 },

    // Lácteos y quesos
    'queso feta': { calorias: 264, proteinas: 14, carbohidratos: 4, grasas: 21, fibra: 0 },
    'queso lonchas de cabra': { calorias: 250, proteinas: 18, carbohidratos: 1, grasas: 20, fibra: 0 },

    // Bebidas
    'limón exprimido': { calorias: 22, proteinas: 0.4, carbohidratos: 7, grasas: 0, fibra: 0.3 },
    'refresco cola': { calorias: 42, proteinas: 0, carbohidratos: 10.6, grasas: 0, fibra: 0 },
    'refresco coca-cola zero azúcar': { calorias: 0.5, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'refresco coca-cola light': { calorias: 1, proteinas: 0, carbohidratos: 0.1, grasas: 0, fibra: 0 },
    'refresco coca-cola zero zero': { calorias: 0.5, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'refresco cola hacendado zero azúcar': { calorias: 0.5, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'refresco cola hacendado zero azúcar zero cafeína': { calorias: 0.5, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'refresco fanta limón': { calorias: 27, proteinas: 0, carbohidratos: 6.5, grasas: 0, fibra: 0 },
    'refresco fanta limón zero azúcares añadidos': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'refresco de limón hacendado fresh gas': { calorias: 27, proteinas: 0, carbohidratos: 6.5, grasas: 0, fibra: 0 },
    'refresco de limón hacendado zero azúcar fresh gas': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral con gas grande fonter': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral con gas grande san pellegrino': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral con gas grande vichy catalan': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral con gas pequeña cortes': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral con gas pequeña vichy catalan': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'gaseosa grande la casera': { calorias: 30, proteinas: 0, carbohidratos: 7, grasas: 0, fibra: 0 },
    'agua mineral grande bezoya': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral grande cortes': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral grande font vella': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral grande lanjarón': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral grande nestlé aquarel': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral grande solán de cabras': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral mediana bronchales': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral mediana cortes': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua mineral pequeña bronchale': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'bebida energética furious energy drink': { calorias: 45, proteinas: 0, carbohidratos: 11, grasas: 0, fibra: 0 },
    'bebida energética mango loco monster': { calorias: 48, proteinas: 0, carbohidratos: 12, grasas: 0, fibra: 0 },
    'bebida energética red bull': { calorias: 45, proteinas: 0, carbohidratos: 11, grasas: 0, fibra: 0 },

    // Dulces y snacks
    'miel': { calorias: 304, proteinas: 0.3, carbohidratos: 82, grasas: 0, fibra: 0.2 },
    'malvaviscos mini': { calorias: 318, proteinas: 2, carbohidratos: 78, grasas: 0.2, fibra: 0 },
    'cereal de arroz con chocolate (cocoa krispies)': { calorias: 383, proteinas: 4, carbohidratos: 88, grasas: 1.5, fibra: 1 },
    'proteína en polvo (vainilla o chocolate)': { calorias: 373, proteinas: 80, carbohidratos: 10, grasas: 3, fibra: 1 },

    // Otros
    'combinado frutos secos, frutas desecadas y semillas de calabaza': { calorias: 500, proteinas: 15, carbohidratos: 35, grasas: 35, fibra: 8 },
    'hielo cocktail': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'barritas con proteínas enervit sport sabor coco y chocolate': { calorias: 380, proteinas: 30, carbohidratos: 35, grasas: 12, fibra: 3 },
    'verduras para cocido bolsa': { calorias: 35, proteinas: 2, carbohidratos: 6, grasas: 0.5, fibra: 3 },
    'bicarbonato de sódio': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'bicarbonato sódico': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'edulcorante': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'edulcorante líquido': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'agua': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },

    // Café e infusiones
    'café molido mezcla': { calorias: 2, proteinas: 0.1, carbohidratos: 0, grasas: 0, fibra: 0 },
    'café molido fuerte': { calorias: 2, proteinas: 0.1, carbohidratos: 0, grasas: 0, fibra: 0 },
    'café molido bonka': { calorias: 2, proteinas: 0.1, carbohidratos: 0, grasas: 0, fibra: 0 },
    'infusión menta poleo': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'infusión tila': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'infusión manzanilla con anís': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'infusión relax': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'infusión respir': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'infusión jengibre': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'infusión tomillo': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'infusión dormir': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'infusión digest': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'té negro con canela': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },
    'té matcha en polvo': { calorias: 2, proteinas: 0.3, carbohidratos: 0, grasas: 0, fibra: 0.1 },
    'té verde con hierbabuena': { calorias: 1, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 },

    // Helados
    'helado blanco': { calorias: 200, proteinas: 3, carbohidratos: 22, grasas: 11, fibra: 0 },
    'helado mini sándwich choco cream': { calorias: 250, proteinas: 3, carbohidratos: 30, grasas: 13, fibra: 1 },
    'helado de fresa': { calorias: 120, proteinas: 2, carbohidratos: 18, grasas: 4, fibra: 0.5 },
    'helado de chocolate': { calorias: 200, proteinas: 4, carbohidratos: 24, grasas: 10, fibra: 1 },
}

async function fase1CorregirMacrosAlimentos(alims, alimIdsUsados) {
    log('\n═══ FASE 1: CORREGIR MACROS DE ALIMENTOS USADOS EN RECETAS ═══\n')

    // Solo alimentos que están SIENDO USADOS en recetas Y tienen macros a cero
    const aCorregir = (alims || []).filter(a =>
        alimIdsUsados.has(a.id) && (!a.calorias || a.calorias === 0)
    )

    log(`Alimentos a corregir (usados en recetas y con macros=0): ${aCorregir.length}`)
    let ok = 0

    for (const alim of aCorregir) {
        const nombreNorm = normalizar(alim.nombre)

        // Buscar match en nuestro diccionario
        let match = null
        for (const [key, macros] of Object.entries(MACROS_POR_NOMBRE)) {
            const keyNorm = normalizar(key)
            if (nombreNorm === keyNorm || nombreNorm.includes(keyNorm) || keyNorm.includes(nombreNorm)) {
                match = macros
                break
            }
        }

        if (!match) {
            log(`  ⏭️  "${alim.nombre}" — sin datos de macros disponibles`)
            continue
        }

        if (ES_DRY_RUN) {
            log(`  📝 "${alim.nombre}" → ${match.calorias} kcal (dry-run)`)
            ok++
            continue
        }

        const { error } = await supabase.from('alimentos').update(match).eq('id', alim.id)
        if (error) {
            log(`  ❌ "${alim.nombre}": ${error.message}`)
        } else {
            log(`  ✅ "${alim.nombre}" → ${match.calorias} kcal, P:${match.proteinas}, C:${match.carbohidratos}, G:${match.grasas}`)
            ok++
        }
    }

    log(`\n  Alimentos actualizados: ${ok}/${aCorregir.length}`)
    return ok
}

// ================================================================
// FASE 1b: RE-MATCHEAR INGREDIENTES HUÉRFANOS
// ================================================================

async function fase1bRematchear(ings, alims, alimMap) {
    log('\n═══ FASE 1b: RE-MATCHEAR INGREDIENTES HUÉRFANOS ═══\n')

    const huerfanos = (ings || []).filter(i => i.alimento_id && !alimMap[i.alimento_id])
    log(`Ingredientes huérfanos a procesar: ${huerfanos.length}`)

    let ok = 0, noMatch = 0

    for (const ing of huerfanos) {
        const nombre = normalizar(ing.nombre_libre || '')
        if (!nombre || nombre.length < 2) continue

        // Buscar mejor match
        let match = null

        // 1. Match exacto
        match = (alims || []).find(a => normalizar(a.nombre) === nombre)

        // 2. Match por inclusión (nombre_libre está dentro de nombre de alimento)
        if (!match) {
            match = (alims || []).find(a => {
                const aName = normalizar(a.nombre)
                return aName.includes(nombre) && nombre.length >= 3
            })
        }

        // 3. Match por palabras clave (al menos 2 palabras coinciden)
        if (!match) {
            const palabras = nombre.split(/[\s,]+/).filter(p => p.length >= 3)
            if (palabras.length >= 2) {
                for (const a of (alims || [])) {
                    const aName = normalizar(a.nombre)
                    const coinciden = palabras.filter(p => aName.includes(p)).length
                    if (coinciden >= 2) { match = a; break }
                }
            }
        }

        // 4. Match por una sola palabra clave (si es larga y específica)
        if (!match) {
            const palabras = nombre.split(/[\s,]+/).filter(p => p.length >= 4)
            for (const p of palabras) {
                match = (alims || []).find(a => {
                    const aName = normalizar(a.nombre)
                    return aName.includes(p) && !aName.includes('agua') // evitar falsos con agua
                })
                if (match) break
            }
        }

        if (match) {
            if (ES_DRY_RUN) {
                log(`  📝 "${ing.nombre_libre}" → "${match.nombre}" (dry-run)`)
            } else {
                const { error } = await supabase.from('receta_ingredientes').update({ alimento_id: match.id }).eq('id', ing.id)
                if (error) {
                    log(`  ❌ "${ing.nombre_libre}": ${error.message}`)
                    continue
                }
                log(`  ✅ "${ing.nombre_libre}" → "${match.nombre}"`)
            }
            ok++
        } else {
            if (noMatch < 10) log(`  ⏭️  "${ing.nombre_libre}" — sin match (primeros 10)`)
            noMatch++
        }
    }

    log(`\n  Re-matcheados: ${ok} | Sin match: ${noMatch}`)
    return { ok, noMatch }
}

// ================================================================
// FASE 2: ESTANDARIZAR INTOLERANCIAS
// ================================================================

const MAPA_INTOLERANCIAS = {
    'Crema Cacahuete': null,          // No es intolerancia, eliminar
    'Chocolate': null,                // No es intolerancia
    'Harina Avena': null,             // No es intolerancia
    'Harina Almendra': 'Sin Frutos Secos',
    'Huevo': 'Sin Huevo',
    'Yogur': 'Sin Lactosa',
    'Sin Mariscos': null,             // No estándar
    'Cacao en Polvo': null,           // No es intolerancia
    'Leche Almendra': 'Sin Lactosa',
    'Tortita Trigo': 'Sin Gluten',
    'Coco Rallado': null,             // No es intolerancia
    'Apto Diabéticos': null,          // No es intolerancia
    'Miel': null,                     // No es intolerancia
    'Fresas': null,                   // No es intolerancia
    'Salmon': null,                   // No es intolerancia
    'Crema Avellana': null,           // No es intolerancia
    'Zanahoria': null,                // No es intolerancia
    'Cafe': null,                     // No es intolerancia
    'Platano': null,                  // No es intolerancia
    'Chia': null,                     // No es intolerancia
    'Granola': null,                  // No es intolerancia
    'Proteina Polvo': null,           // No es intolerancia
    'Carne picada': null,             // No es intolerancia
    'Mango': null,                    // No es intolerancia
    'Crema Arroz': null,              // No es intolerancia
    'Arandanos': null,                // No es intolerancia
    'Manzana': null,                  // No es intolerancia
    'Datiles': null,                  // No es intolerancia
    'Queso Cotagge': null,            // No es intolerancia
    'Pepino': null,                   // No es intolerancia
}

async function fase2EstandarizarIntolerancias(recetas) {
    log('\n═══ FASE 2: ESTANDARIZAR INTOLERANCIAS ═══\n')

    const VALIDAS = ['Sin Gluten', 'Sin Lactosa', 'Vegano', 'Vegetariano', 'Sin Huevo', 'Sin Frutos Secos']
    let corregidas = 0

    for (const r of (recetas || [])) {
        if (!r.intolerancias || r.intolerancias.length === 0) continue

        const nuevas = []
        let cambiada = false

        for (const i of r.intolerancias) {
            if (MAPA_INTOLERANCIAS[i] !== undefined) {
                if (MAPA_INTOLERANCIAS[i] !== null && !nuevas.includes(MAPA_INTOLERANCIAS[i])) {
                    nuevas.push(MAPA_INTOLERANCIAS[i])
                }
                cambiada = true
            } else if (VALIDAS.includes(i)) {
                if (!nuevas.includes(i)) nuevas.push(i)
            } else {
                // No está en mapa ni es válida → eliminar
                cambiada = true
            }
        }

        if (cambiada || nuevas.length !== r.intolerancias.length) {
            if (ES_DRY_RUN) {
                log(`  📝 "${r.nombre}": [${r.intolerancias.join(', ')}] → [${nuevas.join(', ')}] (dry-run)`)
            } else {
                const { error } = await supabase.from('recetas').update({ intolerancias: nuevas.length > 0 ? nuevas : null }).eq('id', r.id)
                if (error) {
                    log(`  ❌ "${r.nombre}": ${error.message}`)
                    continue
                }
                log(`  ✅ "${r.nombre}": [${r.intolerancias.join(', ')}] → [${nuevas.join(', ')}]`)
            }
            corregidas++
        }
    }

    log(`\n  Recetas con intolerancias corregidas: ${corregidas}`)
    return corregidas
}

// ================================================================
// FASE 3: GENERAR TAGS
// ================================================================

function generarTags(r) {
    const tags = []

    // Por categoría/tipo_plato
    const catMap = { 'Desayuno': 'desayuno', 'Comida': 'plato-principal', 'Cena': 'cena', 'Merienda': 'merienda', 'Snack': 'snack', 'Postre': 'postre', 'Almuerzo': 'almuerzo' }
    const cat = r.tipo_plato || r.categoria
    if (cat && catMap[cat]) tags.push(catMap[cat])

    // Por cocción
    const cocMap = { 'Horno/Airfryer': 'horno', 'Horno': 'horno', 'Freidora de Aire': 'airfryer', 'Sartén': 'sarten', 'Sartén/Wok': 'sarten', 'Plancha': 'plancha', 'Microondas': 'microondas', 'No Bake': 'sin-coccion', 'Parrilla': 'parrilla', 'Olla/Cazuela': 'olla', 'Olla': 'olla', 'Vapor': 'vapor', 'Hervido': 'hervido' }
    if (r.tipo_coccion && cocMap[r.tipo_coccion]) tags.push(cocMap[r.tipo_coccion])

    // Por dificultad
    if (r.dificultad === 'Fácil') tags.push('facil')
    else if (r.dificultad === 'Medio') tags.push('medio')
    else if (r.dificultad === 'Difícil') tags.push('dificil')

    // Por intolerancias válidas
    const intolMap = { 'Sin Gluten': 'sin-gluten', 'Sin Lactosa': 'sin-lactosa', 'Vegano': 'vegano', 'Vegetariano': 'vegetariano', 'Sin Huevo': 'sin-huevo', 'Sin Frutos Secos': 'sin-frutos-secos' }
    if (r.intolerancias && Array.isArray(r.intolerancias)) {
        for (const i of r.intolerancias) { if (intolMap[i]) tags.push(intolMap[i]) }
    }

    // Por nombre
    const n = (r.nombre || '').toLowerCase()
    if (n.includes('proteico') || n.includes('proteína') || n.includes('proteina')) tags.push('proteico')
    if (n.includes('fit') || n.includes('light') || n.includes('ligero') || n.includes('saludable')) tags.push('fit')
    if (n.includes('pollo')) tags.push('pollo')
    if (n.includes('salmón') || n.includes('rape') || n.includes('bacalao') || n.includes('pescado')) tags.push('pescado')
    if (n.includes('chocolate') || n.includes('choco')) tags.push('chocolate')
    if (n.includes('horno')) tags.push('horno')
    if (n.includes('arroz')) tags.push('arroz')
    if (n.includes('ensalada')) tags.push('ensalada')
    if (n.includes('crema') || n.includes('sopa')) tags.push('crema')
    if (n.includes('pizza')) tags.push('pizza')
    if (n.includes('wrap') || n.includes('burrito')) tags.push('wrap')
    if (n.includes('batido') || n.includes('smoothie')) tags.push('batido')
    if (n.includes('bizcocho') || n.includes('blondi')) tags.push('bizcocho')
    if (n.includes('galleta') || n.includes('cookie')) tags.push('galleta')
    if (n.includes('barrita') || n.includes('barritas') || n.includes('bolas')) tags.push('snack-saludable')
    if (n.includes('helado') || n.includes('nice cream')) tags.push('helado')
    if (n.includes('flan') || n.includes('natillas') || n.includes('mousse')) tags.push('postre-cremoso')

    return [...new Set(tags)]
}

async function fase3Tags(recetas) {
    log('\n═══ FASE 3: GENERAR TAGS ═══\n')

    let añadidos = 0
    let yaTienen = 0

    for (const r of (recetas || [])) {
        if (r.tags && r.tags.length > 0) { yaTienen++; continue }

        const tags = generarTags(r)
        if (tags.length === 0) continue

        if (ES_DRY_RUN) {
            log(`  📝 "${r.nombre}" → [${tags.join(', ')}] (dry-run)`)
        } else {
            const { error } = await supabase.from('recetas').update({ tags }).eq('id', r.id)
            if (error) { log(`  ❌ "${r.nombre}": ${error.message}`); continue }
            log(`  ✅ "${r.nombre}" → [${tags.join(', ')}]`)
        }
        añadidos++
    }

    log(`\n  Tags añadidos: ${añadidos} | Ya tenían: ${yaTienen}`)
    return añadidos
}

// ================================================================
// FASE 4: RECALCULAR MACROS
// ================================================================

async function fase4RecalcularMacros(recetas) {
    log('\n═══ FASE 4: RECALCULAR MACROS (TODAS LAS RECETAS) ═══\n')

    // Cargar datos frescos
    const { data: alims } = await supabase.from('alimentos').select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')
    const alimMap = {}; for (const a of (alims || [])) alimMap[a.id] = a

    const { data: ings } = await supabase.from('receta_ingredientes').select('*')
    const ingPorR = {}; for (const i of (ings || [])) { if (!ingPorR[i.receta_id]) ingPorR[i.receta_id] = []; ingPorR[i.receta_id].push(i) }

    let ok = 0, sinIngs = 0, errores = 0

    for (const r of (recetas || [])) {
        const ingList = ingPorR[r.id] || []
        if (ingList.length === 0) { sinIngs++; continue }

        let kcalT = 0, protT = 0, carbsT = 0, grasT = 0, fibT = 0, pesoT = 0
        for (const ing of ingList) {
            if (!ing.alimento_id || !ing.cantidad_gramos) continue
            const a = alimMap[ing.alimento_id]
            if (!a) continue
            const f = ing.cantidad_gramos / 100
            kcalT += (a.calorias || 0) * f
            protT += (a.proteinas || 0) * f
            carbsT += (a.carbohidratos || 0) * f
            grasT += (a.grasas || 0) * f
            fibT += (a.fibra || 0) * f
            pesoT += ing.cantidad_gramos
        }

        const porc = r.porciones || 1
        const updateData = {
            kcal: porc > 0 ? Math.round(kcalT / porc) : 0,
            proteinas: porc > 0 ? Math.round((protT / porc) * 10) / 10 : 0,
            carbohidratos: porc > 0 ? Math.round((carbsT / porc) * 10) / 10 : 0,
            grasas: porc > 0 ? Math.round((grasT / porc) * 10) / 10 : 0,
            fibra: porc > 0 ? Math.round((fibT / porc) * 10) / 10 : 0,
            kcal_100g: pesoT > 0 ? Math.round(kcalT / pesoT * 100) : 0,
            proteinas_100g: pesoT > 0 ? Math.round((protT / pesoT * 100) * 10) / 10 : 0,
            carbohidratos_100g: pesoT > 0 ? Math.round((carbsT / pesoT * 100) * 10) / 10 : 0,
            grasas_100g: pesoT > 0 ? Math.round((grasT / pesoT * 100) * 10) / 10 : 0,
            fibra_100g: pesoT > 0 ? Math.round((fibT / pesoT * 100) * 10) / 10 : 0,
            peso_total_g: pesoT,
            updated_at: new Date().toISOString(),
        }

        const oldKcal = r.kcal ? Math.round(r.kcal) : 0
        const diff = oldKcal > 0 ? Math.abs(1 - updateData.kcal / oldKcal) * 100 : 100

        if (ES_DRY_RUN) {
            const cambio = diff > 5 ? `(${oldKcal}→${updateData.kcal} kcal)` : '(sin cambios)'
            log(`  📝 "${r.nombre}": ${updateData.kcal} kcal/porc | ${updateData.peso_total_g}g total | ${cambio} (dry-run)`)
        } else {
            const { error } = await supabase.from('recetas').update(updateData).eq('id', r.id)
            if (error) { log(`  ❌ "${r.nombre}": ${error.message}`); errores++; continue }
            const cambio = diff > 5 ? `${oldKcal}→${updateData.kcal} kcal` : 'sin cambios'
            log(`  ✅ "${r.nombre}": ${updateData.kcal} kcal/porc | ${cambio}`)
        }
        ok++
    }

    log(`\n  Procesadas: ${ok} | Sin ingredientes: ${sinIngs} | Errores: ${errores}`)
    return { ok, sinIngs, errores }
}

// ================================================================
// FASE 5: VERIFICACIÓN FINAL
// ================================================================

async function fase5Verificar() {
    log('\n═══ FASE 5: VERIFICACIÓN FINAL ═══\n')

    const { data: recetas } = await supabase.from('recetas').select('*')
    if (!recetas) return

    const { data: ings } = await supabase.from('receta_ingredientes').select('*')
    const { data: alims } = await supabase.from('alimentos').select('*')
    const alimMap = {}; for (const a of (alims || [])) alimMap[a.id] = a

    const VALIDAS = ['Sin Gluten', 'Sin Lactosa', 'Vegano', 'Vegetariano', 'Sin Huevo', 'Sin Frutos Secos']
    let problemas = 0

    for (const r of recetas) {
        const issues = []
        const ingList = (ings || []).filter(i => i.receta_id === r.id)

        // kcal debe ser > 0 si tiene ingredientes
        if ((!r.kcal || r.kcal === 0) && ingList.length > 0) issues.push('kcal=0 teniendo ingredientes')

        // Verificar intolerancias
        if (r.intolerancias && Array.isArray(r.intolerancias)) {
            for (const i of r.intolerancias) { if (!VALIDAS.includes(i)) issues.push(`intolerancia inválida: "${i}"`) }
        }

        // Sin tags
        if (!r.tags || r.tags.length === 0) issues.push('sin tags')

        // Verificar kcal_100g aproximado
        if (r.kcal && r.peso_total_g && r.kcal_100g) {
            const calc100g = Math.round((r.kcal * (r.porciones || 1)) / r.peso_total_g * 100)
            if (Math.abs(calc100g - Math.round(r.kcal_100g)) > 10) {
                issues.push(`kcal_100g inconsistente: BD=${Math.round(r.kcal_100g)} vs calculado=${calc100g}`)
            }
        }

        if (issues.length > 0) {
            problemas++
            log(`  ⚠️ "${r.nombre}": ${issues.join(', ')}`)
        }
    }

    const conTags = recetas.filter(r => r.tags && r.tags.length > 0).length
    const conIntol = recetas.filter(r => r.intolerancias && r.intolerancias.length > 0).length
    const conKcal = recetas.filter(r => r.kcal && r.kcal > 0).length
    const kcalMedia = recetas.filter(r => r.kcal).reduce((s, r) => s + (r.kcal || 0), 0) / (recetas.filter(r => r.kcal).length || 1)

    log(`\n  📊 ESTADÍSTICAS FINALES:`)
    log(`  Total recetas: ${recetas.length}`)
    log(`  Con kcal > 0: ${conKcal}/${recetas.length}`)
    log(`  Con tags: ${conTags}/${recetas.length}`)
    log(`  Con intolerancias estándar: ${conIntol}/${recetas.length}`)
    log(`  Kcal media/porción: ${Math.round(kcalMedia)}`)
    log(`  Recetas con problemas: ${problemas}`)
}

// ================================================================
// MAIN
// ================================================================

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log(ES_DRY_RUN ? '║   CORRECCIÓN INTEGRAL — DRY RUN                     ║' : '║   CORRECCIÓN INTEGRAL DEL RECETARIO                ║')
    console.log('╚══════════════════════════════════════════════════════════╝')

    if (ES_DRY_RUN) console.log('\n⚠️  MODO DRY-RUN: No se guardarán cambios. Usa --yes para ejecutar.\n')

    const data = await fase0Cargar()

    // FASE 1
    await fase1CorregirMacrosAlimentos(data.alims, data.alimIdsUsados)

    // FASE 1b — solo si no es dry-run (y recargamos data)
    if (!ES_DRY_RUN) {
        const { data: alimsV2 } = await supabase.from('alimentos').select('*')
        const alimMapV2 = {}; for (const a of (alimsV2 || [])) alimMapV2[a.id] = a
        const { data: ingsV2 } = await supabase.from('receta_ingredientes').select('*')
        await fase1bRematchear(ingsV2, alimsV2, alimMapV2)
    } else {
        await fase1bRematchear(data.ings, data.alims, data.alimMap)
    }

    // FASE 2
    await fase2EstandarizarIntolerancias(data.recetas)

    // FASE 3
    await fase3Tags(data.recetas)

    // FASE 4
    if (!ES_DRY_RUN) {
        const { data: recetasV2 } = await supabase.from('recetas').select('*')
        await fase4RecalcularMacros(recetasV2)
    } else {
        await fase4RecalcularMacros(data.recetas)
    }

    // FASE 5 — verify only if not dry-run
    if (!ES_DRY_RUN) {
        await fase5Verificar()
    } else {
        log('\n  (verificación omitida en dry-run)')
    }

    const totalOps = LOG.filter(l => l.startsWith('  ✅') || l.startsWith('  📝')).length
    log(`\n══════════════════════════════════════════════════════════`)
    log(ES_DRY_RUN ? `  📋 DRY-RUN COMPLETADO — ${totalOps} operaciones simuladas` : `  ✅ CORRECCIÓN COMPLETADA — ${totalOps} operaciones ejecutadas`)
    log('══════════════════════════════════════════════════════════\n')
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})
