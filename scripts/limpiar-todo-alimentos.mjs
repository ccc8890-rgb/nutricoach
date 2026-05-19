#!/usr/bin/env node
/**
 * LIMPIEZA COMPLETA DE ALIMENTOS
 *
 * Fases (en orden):
 *   1. Elimina NO-ALIMENTOS (cosmética, limpieza, ferretería, ropa, droguería, chicles, etc.)
 *   2. Elimina BEBIDAS ALCOHÓLICAS (con word-boundary para evitar falsos positivos)
 *   3. RECATEGORIZA alimentos mal clasificados (mueve reales fuera de "Supermercado")
 *   4. Elimina SUPERMERCADO 0 kcal residual (lo que no se pudo recategorizar)
 *   5. DEDUPLICA alimentos con mismo nombre normalizado
 *
 * USO: node scripts/limpiar-todo-alimentos.mjs
 *      node scripts/limpiar-todo-alimentos.mjs --dry-run
 *
 * REQUIERE: SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Cargar .env.local ───────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local')
const envRaw = readFileSync(envPath, 'utf-8')
for (const line of envRaw.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const DRY_RUN = process.argv.includes('--dry-run')

// ── Helpers ──────────────────────────────────────────────────

function normalizar(n) {
    return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function nombreClave(nombre) {
    return normalizar(nombre)
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

/** Match con word-boundary para evitar falsos positivos */
function matchPalabra(texto, palabra) {
    const re = new RegExp(`(^|[^a-záéíóúàèìòùäëïöüñ0-9])${palabra}([^a-záéíóúàèìòùäëïöüñ0-9]|$)`, 'i')
    return re.test(texto)
}

function matchSubstring(texto, substr) {
    return texto.toLowerCase().includes(substr.toLowerCase())
}

// ══════════════════════════════════════════════════════════════
// SECCIÓN 1: NO-ALIMENTOS
// ══════════════════════════════════════════════════════════════
const NO_ALIMENTOS_KEYWORDS = [
    // Chicles / caramelos / golosinas no nutritivas
    'chicle', 'chicles', 'goma de mascar', 'goma mascar',
    // Higiene personal
    'champú', 'champu', 'acondicionador', 'mascarilla capilar', 'sérum capilar', 'serum capilar',
    'gel de ducha', 'gel ducha', 'desodorante', 'antitranspirante', 'colonia',
    'crema corporal', 'loción corporal', 'manteca corporal',
    'aceite corporal', 'crema reductora', 'anticelulítico',
    'crema facial', 'sérum facial', 'contorno de ojos',
    'gel de afeitar', 'espuma de afeitar', 'aftershave',
    'pasta de dientes', 'dentifrico', 'dentífrico', 'cepillo de dientes', 'enjuague bucal', 'hilo dental',
    'jabón de manos', 'champú seco', 'jabón',
    'tampón', 'tampones', 'compresas', 'salvaslip', 'copa menstrual',
    'pañal', 'pañales', 'toallitas bebé', 'biberón', 'chupete',
    // Cosmética / belleza
    'maquillaje', 'colorete', 'base de maquillaje', 'pintalabios', 'labial',
    'máscara de pestañas', 'delineador de ojos', 'sombra de ojos',
    'laca de uñas', 'quitaesmalte',
    'agua micelar',
    'exfoliante facial',
    'bálsamo labial', 'balsamo labial', 'protector labial',
    'protector solar', 'crema solar', 'spray solar', 'spf',
    'autobronceador',
    'algodón hidrófilo', 'bastoncillos',
    // Farmacia / sanidad
    'apósitos', 'apositos', 'tiritas', 'vendas', 'venda',
    'suero fisiológico',
    'laxante', 'paracetamol', 'ibuprofeno', 'aspirina',
    // Limpieza hogar
    'detergente', 'suavizante', 'lejía',
    'limpiador', 'limpiacristales', 'desengrasante', 'lavavajillas',
    'fregona', 'fregasuelos', 'bolsa basura', 'bolsas basura',
    'papel higiénico', 'papel de cocina', 'papel aluminio', 'film transparente',
    'ambientador', 'insecticida', 'antimoho',
    'estropajo', 'esponja', 'esponjas',
    'vela', 'incienso', 'cera para',
    'limpiamaquinas', 'limpiacoches',
    // Mascotas
    'arena gatos', 'pienso', 'comida para gato', 'comida para perro',
    'comida perro', 'comida gato', 'alimento perro', 'alimento gato',
    'arena gato', 'cama perro', 'arenero',
    // Ropa y textil
    'calcetines', 'calcetín', 'chaqueta', 'edredón', 'edredon',
    'almohada', 'bufanda', 'gorro', 'vestido', 'camiseta',
    'toalla', 'toallas', 'sábanas', 'sabana',
    // Ferretería / bricolaje
    'tornillo', 'tuerca', 'destornillador', 'taladro', 'broca',
    'cable eléctrico', 'enchufe', 'pilas', 'bombilla',
    'cortacallos', 'corta callos', 'lima',
    'pegamento', 'cinta adhesiva',
    // Menaje no alimenticio
    'abrelatas', 'tabla de cortar', 'cubertería', 'cuberteria',
    'cuchillo de cocina',
    // Juguetes
    'juguete', 'peluche', 'muñeco', 'muñeca',
    // Decoración / plantas
    'maceta', 'planta decorativa', 'planta artificial', 'flor artificial',
    // Electrodomésticos
    'cafetera', 'batidora', 'freidora', 'hervidor', 'licuadora',
    'robot de cocina',
    // Productos dentales / higiene bucal
    'pasta encias', 'encias delicadas', 'cepill', 'corta encias',
    'higienico humedo', 'higiénico húmedo',
    // Maquillaje/pintura/cosmética varios
    'mousse', 'espuma',
    'tinte', 'tinte pelo', 'coloracion',
    'firework', 'glitter', 'purpurina',
    'fluido diario invisible', 'protector invisible',
    'tonico facial', 'tonico hidratante',
    // Otros no-alimentos detectados en dry-run
    'body&hair', 'body mist', 'liner', 'barren', 'envase',
    'guantes', 'balsam vermell', 'tiger balm',
    'gel hidratante vaginal', 'gel fijador',
    'deo aluminio', 'desodorante',
]

// ══════════════════════════════════════════════════════════════
// SECCIÓN 2: ALCOHOL
// ══════════════════════════════════════════════════════════════
// NOTA: "anís" NO está incluido porque es una especia/planta usada
// en infusiones, galletas y repostería. Solo detectamos "anisete"
// que es específicamente el licor.

const ALCOHOL_KEYWORDS = [
    // Cerveza
    'cerveza', 'cervesa', 'birra', 'pilsner', 'lager', 'ale', 'stout',
    'pack cerveza', 'lata cerveza',
    // Vino
    'vino', 'vinico', 'vinicola',
    'caja vino', 'pack vino', 'botella vino', 'bag in box vino',
    // Cava / espumosos
    'cava brut', 'cava semi', 'cava rosado',
    'champán', 'champagne', 'champaña',
    'prosecco', 'lambrusco',
    // Destilados
    'whisky', 'whiskey', 'bourbon', 'scotch',
    'vodka', 'ginebra',
    'tequila', 'mezcal',
    'ron blanco', 'ron añejo', 'ron negro', 'ron dorado',
    'brandy', 'coñac', 'cognac',
    // Licores (solo "anisete" = licor, no "anís" = especia)
    'licor de', 'licor crema',
    'anisete',
    'pacharán', 'pacharan',
    'amaretto', 'absenta', 'absinthe',
    'vermut', 'vermouth', 'martini',
    // Vinos fortificados
    'oporto', 'madeira', 'jerez', 'moscatel',
    'fino jerez', 'oloroso', 'amontillado',
    // Sidra
    'sidra natural', 'sidra brut',
    // Combinados / RTD
    'sangría', 'sangria', 'tinto de verano',
    'bebida preparada de',
    'calimocho', 'kalimotxo',
    // Aperitivos alcohólicos
    'aperitivo alcohólico', 'aperitivo alcohol',
    'palo cortado',
]

const ALCOHOL_FOOD_EXCEPTIONS = [
    'al vino', 'en vino', 'con vino', 'estofado', 'guiso',
    'al licor', 'bombones', 'trufas', 'pralinés',
    'al ron', 'flambead',
    'vinagre', 'vinagreta',
    'pasas', 'uva moscatel', 'uvas moscatel',
    'cerveza 0,0', 'cerveza sin alcohol',
    // "manzanilla con anís" es infusión, no alcohol
    'manzanilla con anís', 'manzanilla con anis',
]

// ══════════════════════════════════════════════════════════════
// SECCIÓN 3: RECATEGORIZACIÓN (con palabras para alimentos reales)
// ══════════════════════════════════════════════════════════════

const RECATEGORIZAR = [
    { keywords: ['pollo', 'pechuga', 'muslo', 'ala de pollo', 'contramuslo', 'pavo', 'ternera', 'cerdo', 'cordero', 'conejo', 'solomillo', 'lomo ', 'entrecot', 'chuleta', 'filete', 'carne picada', 'hamburguesa', 'bistec', 'jamón', 'lacón', 'chorizo', 'salchichón', 'salchicha fresca', 'butifarra', 'bacón', 'beicon', 'tocino', 'secreto ibérico', 'presa ibérica', 'pluma ibérica', 'butifarra', 'salchicha'], target: 'Carnes' },
    { keywords: ['salmón', 'merluza', 'bacalao', 'dorada', 'lubina', 'rape', 'atún', 'bonito', 'caballa', 'sardina', 'boquerón', 'anchoa', 'sepia', 'calamar', 'pulpo', 'gamba', 'langostino', 'mejillón', 'almeja', 'berberecho', 'vieira', 'navaja', 'besugo', 'rodaballo', 'trucha', 'corvina', 'salmonete', 'gallineta', 'cazón', 'emperador', 'pez espada', 'anguila', 'surimi', 'cigala', 'carabinero', 'escopinyes', 'pescado'], target: 'Pescados' },
    { keywords: ['huevo', 'huevos', 'clara de huevo', 'yema de huevo', 'huevas'], target: 'Huevos' },
    { keywords: ['leche', 'yogur', 'yogurt', 'queso', 'cuajada', 'requesón', 'requeson', 'nata', 'mantequilla', 'crema de leche', 'kéfir', 'kefir', 'lácteo', 'lacteo', 'batido lácteo', 'lacteo', 'bifidus'], target: 'Lácteos' },
    { keywords: ['aceite de oliva', 'aceite de girasol', 'aceite de coco', 'aceite de aguacate', 'aceite vegetal', 'ghee', 'manteca de cerdo', 'sebo', 'plantequilla'], target: 'Grasas' },
    { keywords: ['almendra', 'nuez', 'anacardo', 'avellana', 'pipas', 'pistacho', 'cacahuete', 'piñón', 'pinon', 'nueces', 'almendras', 'anacardos', 'avellanas', 'pistachos', 'cacahuetes', 'pipas de girasol', 'pipas de calabaza', 'altramuces'], target: 'Frutos secos' },
    { keywords: ['arroz', 'pasta', 'espagueti', 'macarrón', 'macarron', 'fideos', 'fideuá', 'fideua', 'lenteja', 'garbanzo', 'alubia', 'judía blanca', 'judia blanca', 'quinoa', 'cuscús', 'couscous', 'bulgur', 'avena', 'cereal', 'pan ', 'pan de', 'pan integral', 'pan molde', 'pan rallado', 'harina', 'galleta', 'cereales desayuno', 'muesli', 'copos de avena', 'trigo', 'centeno', 'espelta', 'pappardelle', 'pizza'], target: 'Cereales' },
    { keywords: ['patata', 'boniato', 'batata', 'yuca', 'mandioca', 'tapioca'], target: 'Tubérculos' },
    { keywords: ['sal', 'pimienta', 'orégano', 'perejil', 'canela', 'comino', 'curry', 'pimentón', 'azafrán', 'cúrcuma', 'turmeric', 'nuez moscada', 'clavo', 'jengibre', 'laurel', 'romero', 'tomillo', 'albahaca', 'cilantro', 'hierbabuena', 'menta', 'eneldo', 'estragón', 'especia', 'condimento', 'salsa de soja', 'vinagreta', 'mostaza', 'ketchup', 'mayonesa', 'mahonesa', 'vinagre', 'anís verde', 'anis verde', 'matalauva'], target: 'Condimentos' },
    { keywords: ['agua mineral', 'agua con gas', 'agua destilada', 'agua de soda', 'zumo', 'refresco', 'bebida isotónica', 'bebida energética', 'bebida vegetal', 'leche de almendra', 'leche de soja', 'leche de avena', 'leche de coco', 'té', 'café', 'infusión', 'manzanilla', 'cola', 'horchata', 'orxata', 'bebida'], target: 'Bebidas' },
    { keywords: ['proteína', 'whey', 'suero de leche', 'creatina', 'bcaa', 'pre-entreno', 'preentreno', 'barrita proteica', 'protein bar', 'aminoácido', 'aminoacido', 'multivitamínico', 'multivitaminico', 'vitamina', 'magnesio', 'omega 3', 'colágeno', 'colageno', 'l-carnitina', 'spirulina', 'levadura nutricional'], target: 'Suplementos' },
]

function detectarCategoriaCorrecta(nombre) {
    const n = normalizar(nombre)
    for (const rule of RECATEGORIZAR) {
        if (rule.keywords.some(kw => n.includes(kw))) {
            return rule.target
        }
    }
    return null
}

// ══════════════════════════════════════════════════════════════
// HELPERS BD
// ══════════════════════════════════════════════════════════════

async function fetchAll(table, select = '*') {
    const todos = []
    let from = 0
    const pageSize = 1000
    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select(select)
            .range(from, from + pageSize - 1)
            .order('id')
        if (error) throw error
        if (!data || data.length === 0) break
        todos.push(...data)
        if (data.length < pageSize) break
        from += pageSize
    }
    return todos
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
async function main() {
    console.log('══════════════════════════════════════════')
    console.log('  LIMPIEZA COMPLETA — ALIMENTOS')
    console.log(`  Modo: ${DRY_RUN ? '🔍 DRY-RUN (solo diagnóstico)' : '⚡ EJECUCIÓN REAL'}`)
    console.log('══════════════════════════════════════════\n')

    const alimentos = await fetchAll('alimentos', 'id, nombre, categoria, calorias, custom')

    console.log(`📊 Total en BD: ${alimentos.length}`)
    console.log('')

    // ─── FASE 1: NO-ALIMENTOS ───────────────────────────
    console.log('── FASE 1: NO-ALIMENTOS ──')
    const noAlimentos = alimentos.filter(a => {
        const n = (a.nombre ?? '').toLowerCase()
        return NO_ALIMENTOS_KEYWORDS.some(kw => matchSubstring(n, kw))
    })
    console.log(`   🔴 ${noAlimentos.length} detectados`)
    if (noAlimentos.length > 0) {
        console.log('   Primeros 20:')
        noAlimentos.slice(0, 20).forEach(a => console.log(`     [${a.categoria}] ${a.nombre}`))
        if (noAlimentos.length > 20) console.log(`   ... y ${noAlimentos.length - 20} más`)
    }

    // ─── FASE 2: ALCOHOL ────────────────────────────────
    console.log('\n── FASE 2: ALCOHOL ──')
    const alcohol = alimentos.filter(a => {
        const n = (a.nombre ?? '').toLowerCase()
        // Excepciones primero
        if (ALCOHOL_FOOD_EXCEPTIONS.some(ex => n.includes(ex))) return false
        // Match con word-boundary para keywords cortos
        for (const kw of ALCOHOL_KEYWORDS) {
            if (kw.length <= 5) {
                if (matchPalabra(a.nombre, kw)) return true
            } else if (n.includes(kw.toLowerCase())) {
                return true
            }
        }
        return false
    })
    console.log(`   🍺 ${alcohol.length} detectados`)
    if (alcohol.length > 0) {
        console.log('   Primeros 30:')
        alcohol.slice(0, 30).forEach(a => console.log(`     [${a.categoria}] ${a.nombre} (${a.calorias} kcal)`))
        if (alcohol.length > 30) console.log(`   ... y ${alcohol.length - 30} más`)
    }

    const idsBasuraFija = new Set([...noAlimentos, ...alcohol].map(a => a.id))

    // ─── FASE 3: RECATEGORIZAR ──────────────────────────
    console.log('\n── FASE 3: RECATEGORIZACIÓN (antes de eliminar Supermercado) ──')
    const malCategorizados = alimentos.filter(a => {
        if (idsBasuraFija.has(a.id)) return false
        const correcta = detectarCategoriaCorrecta(a.nombre)
        return correcta && correcta !== a.categoria
    })
    console.log(`   🔄 ${malCategorizados.length} para recategorizar`)
    if (malCategorizados.length > 0) {
        console.log('   Primeros 20:')
        malCategorizados.slice(0, 20).forEach(a => {
            const correcta = detectarCategoriaCorrecta(a.nombre)
            console.log(`     "${a.nombre}" : ${a.categoria} → ${correcta}`)
        })
        if (malCategorizados.length > 20) console.log(`   ... y ${malCategorizados.length - 20} más`)
    }

    // ─── FASE 4: SUPERMERCADO 0 kcal RESIDUAL ──────────
    console.log('\n── FASE 4: SUPERMERCADO 0 kcal (lo que no se pudo recategorizar) ──')
    const supermercadoBasura = alimentos.filter(a => {
        if (idsBasuraFija.has(a.id)) return false
        if (malCategorizados.some(m => m.id === a.id)) return false // ya se va a recategorizar
        if (a.categoria !== 'Supermercado' && a.categoria !== 'Supermercado - Sin clasificar') return false
        if (a.calorias && a.calorias > 0) return false
        return true
    })
    console.log(`   🗑️ ${supermercadoBasura.length} en Supermercado con 0 kcal (residual)`)

    // Check for false positives: real foods in supermercado 0 kcal that didn't match categorizer
    const sospechososComida = supermercadoBasura.filter(a => {
        const n = (a.nombre ?? '').toLowerCase()
        // Palabras que sugieren que es comida real
        return /verduras?|hortalizas?|fruta|carne|pescado|leche|huevo|pan|arroz|pasta/.test(n) ||
            /cerdo|ternera|pollo|cordero|conejo|merluza|bacalao/.test(n)
    })
    if (sospechososComida.length > 0) {
        console.log(`   ⚠️ Posibles alimentos reales (falsos positivos): ${sospechososComida.length}`)
        sospechososComida.slice(0, 10).forEach(a =>
            console.log(`     "${a.nombre}" (${a.categoria})`)
        )
        if (sospechososComida.length > 10) console.log(`   ... y ${sospechososComida.length - 10} más`)
    }

    if (supermercadoBasura.length > 0) {
        console.log('   Primeros 30:')
        supermercadoBasura.slice(0, 30).forEach(a => console.log(`     [${a.categoria}] ${a.nombre} (${a.calorias ?? 0} kcal)`))
        if (supermercadoBasura.length > 30) console.log(`   ... y ${supermercadoBasura.length - 30} más`)
    }

    const idsEliminar = new Set([...idsBasuraFija, ...supermercadoBasura].map(a => a.id))

    // ─── FASE 5: DEDUPLICAR ────────────────────────────
    console.log('\n── FASE 5: DUPLICADOS ──')
    const grupos = new Map()
    const quedar = new Set()
    const eliminar = new Set()

    for (const a of alimentos) {
        if (idsEliminar.has(a.id)) continue
        const key = nombreClave(a.nombre)
        if (!grupos.has(key)) grupos.set(key, [])
        grupos.get(key).push(a)
    }

    const duplicados = [...grupos.entries()].filter(([, items]) => items.length > 1)
    console.log(`   📋 ${duplicados.length} grupos con duplicados`)
    if (duplicados.length > 0) {
        console.log('   Primeros 15 grupos:')
        duplicados.slice(0, 15).forEach(([key, items]) => {
            console.log(`     "${key}" (${items.length}x):`)
            items.forEach(a => console.log(`       - [${a.categoria}] id:${a.id} "${a.nombre}" custom:${a.custom}`))
        })
        if (duplicados.length > 15) console.log(`   ... y ${duplicados.length - 15} grupos más`)

        for (const [, items] of duplicados) {
            items.sort((a, b) => {
                const scoreA = (a.custom ? 10 : 0) + ((a.calorias ?? 0) > 0 ? 5 : 0)
                const scoreB = (b.custom ? 10 : 0) + ((b.calorias ?? 0) > 0 ? 5 : 0)
                return scoreB - scoreA
            })
            quedar.add(items[0].id)
            items.slice(1).forEach(a => eliminar.add(a.id))
        }
        console.log(`   🗑️ ${eliminar.size} duplicados a eliminar`)
    }

    // ─── RESUMEN ───────────────────────────────────────
    const totalEliminar = idsEliminar.size + eliminar.size
    console.log(`\n══ RESUMEN ══`)
    console.log(`   No-alimentos:          ${noAlimentos.length}`)
    console.log(`   Alcohol:                ${alcohol.length}`)
    console.log(`   Recategorizar:          ${malCategorizados.length}`)
    console.log(`   Superm. 0 kcal (resid): ${supermercadoBasura.length}`)
    console.log(`   Duplicados:             ${eliminar.size}`)
    console.log(`   TOTAL eliminar:         ${totalEliminar}`)
    console.log(`   TOTAL update categoria: ${malCategorizados.length}`)
    console.log(`   Quedarán aprox:         ${alimentos.length - totalEliminar}`)

    if (DRY_RUN) {
        console.log('\n🔍 DRY-RUN — no se ejecutaron cambios')
        console.log('   Para ejecutar: node scripts/limpiar-todo-alimentos.mjs')
        return
    }

    // ─── EJECUTAR ──────────────────────────────────────
    console.log('\n⚡ EJECUTANDO...')

    async function eliminarConReferencias(idsArr, label) {
        if (idsArr.length === 0) return
        console.log(`⏳ ${label}: ${idsArr.length}...`)
        const { data: enRecetas } = await supabase
            .from('receta_ingredientes')
            .select('alimento_id')
            .in('alimento_id', idsArr)
        const idsEnRecetas = new Set(enRecetas?.map(r => r.alimento_id) ?? [])
        if (idsEnRecetas.size > 0) {
            console.log(`   ⚠️ ${idsEnRecetas.size} referenciados en recetas — se conservan`)
            const conservados = alimentos.filter(a => idsEnRecetas.has(a.id))
            conservados.forEach(a => console.log(`     "${a.nombre}"`))
        }
        const idsSeguros = idsArr.filter(id => !idsEnRecetas.has(id))
        for (let i = 0; i < idsSeguros.length; i += 200) {
            const chunk = idsSeguros.slice(i, i + 200)
            await supabase.from('productos_supermercado').delete().in('alimento_id', chunk)
            const { error } = await supabase.from('alimentos').delete().in('id', chunk)
            if (error) console.error(`   Error batch ${i}: ${error.message}`)
        }
        console.log(`   ✅ ${idsSeguros.length} eliminados`)
    }

    // FASE 3: Recategorizar PRIMERO (antes de eliminar)
    if (malCategorizados.length > 0) {
        console.log(`⏳ Recategorizando ${malCategorizados.length} alimentos...`)
        let count = 0
        for (const a of malCategorizados) {
            const correcta = detectarCategoriaCorrecta(a.nombre)
            if (correcta) {
                const { error } = await supabase.from('alimentos').update({ categoria: correcta }).eq('id', a.id)
                if (!error) count++
                if (count % 200 === 0) process.stdout.write('.')
            }
        }
        console.log(`\n   ✅ ${count} recategorizados`)
    }

    // FASE 4: Eliminar Supermercado basura
    if (supermercadoBasura.length > 0) {
        await eliminarConReferencias([...supermercadoBasura.map(a => a.id)], 'Supermercado 0 kcal')
    }

    // FASE 1+2: Eliminar no-alimentos + alcohol
    if (idsBasuraFija.size > 0) {
        await eliminarConReferencias([...idsBasuraFija], 'No-alimentos + alcohol')
    }

    // FASE 5: Eliminar duplicados
    if (eliminar.size > 0) {
        await eliminarConReferencias([...eliminar], 'Duplicados')
    }

    console.log('\n✅ LIMPIEZA COMPLETADA')
}

main().catch(err => {
    console.error('❌ Error:', err.message)
    process.exit(1)
})
