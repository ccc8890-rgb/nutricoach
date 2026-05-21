/**
 * Migra el sistema de alérgenos al modelo EU (Reglamento 1169/2011):
 * declaración POSITIVA — la receta CONTIENE estos alérgenos.
 *
 * Antes: ['Sin Gluten', 'Sin Cerdo', 'Vegano']
 * Después: ['Lácteos', 'Huevos']  (solo lo que contiene, nada más)
 *
 * Vegetariano/Vegano se mantienen como clasificación dietética positiva.
 *
 * Uso:
 *   node scripts/migrar-alergenos-eu.mjs          # dry-run
 *   node scripts/migrar-alergenos-eu.mjs --aplica
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
try {
    const env = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8')
    for (const line of env.split('\n')) {
        const [k, ...v] = line.split('=')
        if (k && v.length) process.env[k.trim()] = v.join('=').trim()
    }
} catch { /* no .env.local */ }

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const APLICA = process.argv.includes('--aplica')

// ─── Keywords para detección positiva de alérgenos EU ────────────────────────
const ALERGENOS_KEYWORDS = {
    'Gluten': [
        'harina de trigo', 'harina integral', 'trigo', 'centeno', 'cebada', 'avena',
        'pan', 'pasta', 'espagueti', 'macarrones', 'fideos', 'cuscús', 'bulgur',
        'espelta', 'kamut', 'sémola', 'galleta', 'bizcocho', 'masa de pizza',
        'hojaldre', 'panko', 'tortilla de trigo', 'wrap', 'bocadillo', 'tostada',
        'pan rallado', 'tempura', 'cerveza', 'salsa de soja' // salsa soja convencional tiene trigo
    ],
    'Lácteos': [
        'leche', 'queso', 'mantequilla', 'nata', 'yogur', 'kéfir', 'requesón',
        'ricotta', 'mascarpone', 'mozzarella', 'parmesano', 'gouda', 'emmental',
        'cheddar', 'burrata', 'cottage', 'feta', 'suero de leche', 'crema de leche',
        'proteína de suero', 'whey', 'lactosa', 'caseína', 'ghee',
    ],
    'Huevos': [
        'huevo', 'clara', 'yema', 'mayonesa',
    ],
    'Soja': [
        'soja', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari',
        'leche de soja', 'bebida de soja', 'proteína de soja',
        'soja texturizada', 'texturizado de soja',
    ],
    'Cacahuetes': [
        'cacahuete', 'maní', 'mantequilla de cacahuete', 'crema de cacahuete',
    ],
    'Frutos Secos': [
        'almendra', 'avellana', 'nuez', 'anacardo', 'pistacho', 'macadamia',
        'pacana', 'piñón', 'piñones', 'nuez de brasil', 'nuez de pecan',
        'castaña', 'harina de almendra', 'leche de almendra', 'leche de avellana',
        'mantequilla de almendra', 'pasta de avellana', 'praliné',
    ],
    'Pescado': [
        'salmón', 'atún', 'merluza', 'bacalao', 'sardina', 'anchoa', 'boquerón',
        'lubina', 'dorada', 'trucha', 'rodaballo', 'rape', 'lenguado', 'panga',
        'tilapia', 'mahi', 'pescado',
        'surimi', 'txangurro', 'brandada',
    ],
    'Crustáceos': [
        'gamba', 'langostino', 'cangrejo', 'langosta', 'bogavante',
        'cigala', 'percebe', 'camarón', 'nécora', 'centolla',
    ],
    'Moluscos': [
        'mejillón', 'almeja', 'pulpo', 'calamar', 'sepia', 'ostra', 'vieira',
        'berberecho', 'navaja', 'coquina', 'ostión', 'chipirón',
    ],
    'Sésamo': [
        'sésamo', 'tahini', 'pasta de sésamo', 'aceite de sésamo', 'gomasio',
    ],
    'Mostaza': [
        'mostaza',
    ],
    'Sulfitos': [
        'vino blanco', 'vino tinto', 'vino rosado', 'cava', 'champán',
        'vinagre de vino', 'sulfito', 'dióxido de azufre',
    ],
}

// Tags dietéticos positivos que se mantienen (no son alérgenos EU pero son útiles)
const TAGS_DIETETICOS_A_CONSERVAR = ['Vegetariano', 'Vegano']

// Tags "Sin X" que eliminamos (modelo anterior incorrecto)
const TAGS_SIN_X = [
    'Sin Gluten', 'Sin Lactosa', 'Sin Huevo', 'Sin Frutos Secos',
    'Sin Mariscos', 'Sin Cerdo', 'Sin Soja', 'Apto Diabéticos',
]

function detectarAlergenos(textos) {
    const texto = textos.join(' ').toLowerCase()
    const encontrados = []
    for (const [alergeno, keywords] of Object.entries(ALERGENOS_KEYWORDS)) {
        if (keywords.some(k => texto.includes(k.toLowerCase()))) {
            encontrados.push(alergeno)
        }
    }
    return encontrados
}

async function main() {
    console.log(`Modo: ${APLICA ? '✅ APLICA cambios en BD' : '🔍 DRY-RUN (preview)'}\n`)

    let recetas = []
    let from = 0
    while (true) {
        const { data, error } = await supabase
            .from('recetas')
            .select('id, nombre, descripcion, intolerancias, receta_ingredientes(nombre_libre)')
            .eq('estado', 'aprobada')
            .range(from, from + 99)
        if (error) { console.error('Error:', error.message); process.exit(1) }
        if (!data?.length) break
        recetas.push(...data)
        if (data.length < 100) break
        from += 100
    }

    console.log(`Recetas cargadas: ${recetas.length}\n`)

    const stats = { actualizadas: 0, sinCambios: 0, errores: 0 }
    const preview = []

    for (const receta of recetas) {
        const ingredientesTexto = (receta.receta_ingredientes ?? []).map(i => i.nombre_libre ?? '')
        const textos = [...ingredientesTexto, receta.nombre, receta.descripcion ?? '']

        // Detectar alérgenos positivos
        const alergenosDetectados = detectarAlergenos(textos)

        // Conservar tags dietéticos positivos que ya tenga
        const tagsActuales = receta.intolerancias ?? []
        const tagsConservar = tagsActuales.filter(t => TAGS_DIETETICOS_A_CONSERVAR.includes(t))

        // Nuevo array: alérgenos detectados + tags dietéticos conservados (sin duplicados)
        const nuevosTags = [...new Set([...alergenosDetectados, ...tagsConservar])]

        // Ver qué cambia
        const sinXEliminados = tagsActuales.filter(t => TAGS_SIN_X.includes(t))
        const alergenosNuevos = alergenosDetectados.filter(t => !tagsActuales.includes(t))
        const hayCambio = sinXEliminados.length > 0 || alergenosNuevos.length > 0

        const tagsActualesOrdenados = [...tagsActuales].sort()
        const nuevosTagsOrdenados = [...nuevosTags].sort()
        if (!hayCambio && JSON.stringify(tagsActualesOrdenados) === JSON.stringify(nuevosTagsOrdenados)) {
            stats.sinCambios++
            continue
        }

        preview.push({
            nombre: receta.nombre,
            antes: tagsActuales.join(', ') || '(ninguno)',
            despues: nuevosTags.join(', ') || '(ninguno)',
        })

        if (APLICA) {
            const { error } = await supabase
                .from('recetas')
                .update({ intolerancias: nuevosTags.length ? nuevosTags : null })
                .eq('id', receta.id)
            if (error) { console.error(`  ❌ ${receta.nombre}: ${error.message}`); stats.errores++ }
            else stats.actualizadas++
        } else {
            stats.actualizadas++
        }
    }

    if (preview.length) {
        const mostrar = preview.slice(0, 20)
        for (const p of mostrar) {
            console.log(`  📌 ${p.nombre}`)
            console.log(`     Antes:   ${p.antes}`)
            console.log(`     Después: ${p.despues}`)
            console.log()
        }
        if (preview.length > 20) console.log(`  ... y ${preview.length - 20} más\n`)
    }

    console.log('─'.repeat(50))
    console.log(`✅ Sin cambios: ${stats.sinCambios}`)
    console.log(`${APLICA ? '✅ Actualizadas' : '🔍 A actualizar'}: ${stats.actualizadas}`)
    if (stats.errores) console.log(`❌ Errores: ${stats.errores}`)
    if (!APLICA && stats.actualizadas > 0) console.log('\n→ Ejecuta con --aplica para aplicar.')
}

main()
