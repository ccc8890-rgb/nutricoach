/**
 * Etiqueta recetas existentes con nuevos tags de alérgenos:
 * Sin Mariscos | Sin Cerdo | Sin Soja
 *
 * Lógica: si la receta NO contiene ningún ingrediente de la lista de keywords
 * del alérgeno → se le añade el tag correspondiente (si no lo tiene ya).
 *
 * Uso:
 *   node scripts/etiquetar-alergenos.mjs          # dry-run (preview)
 *   node scripts/etiquetar-alergenos.mjs --aplica  # aplica cambios en BD
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Cargar .env.local
try {
    const env = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8')
    for (const line of env.split('\n')) {
        const [k, ...v] = line.split('=')
        if (k && v.length) process.env[k.trim()] = v.join('=').trim()
    }
} catch { /* no .env.local */ }

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const APLICA = process.argv.includes('--aplica')

// ─── Keywords por alérgeno ───────────────────────────────────────────────────
// Si el nombre_libre de CUALQUIER ingrediente contiene una de estas palabras
// → la receta NO es apta para ese alérgeno → NO se añade el tag.

const ALERGENOS = {
    'Sin Mariscos': [
        'gamba', 'gambas', 'langostino', 'langostinos', 'mejillón', 'mejillones',
        'almeja', 'almejas', 'berberecho', 'berberechos', 'pulpo', 'calamar', 'calamares',
        'sepia', 'cangrejo', 'centolla', 'nécora', 'bogavante', 'langosta',
        'camarón', 'camarones', 'surimi', 'marisco', 'mariscos', 'crustáceo',
        'cigala', 'cigalas', 'percebe', 'percebes', 'vieira', 'vieiras',
        'navaja', 'berberecho', 'coquina', 'ostión', 'ostra', 'ostras',
    ],
    'Sin Cerdo': [
        'cerdo', 'cochinillo', 'panceta', 'bacon', 'beicon', 'chorizo',
        'salchichón', 'morcilla', 'fuet', 'longaniza', 'sobrasada',
        'jamón serrano', 'jamón ibérico', 'jamón york', 'jamón cocido',
        'jamón', 'lomo embuchado', 'lomo de cerdo', 'costilla de cerdo',
        'costillas de cerdo', 'chicharrón', 'tocino', 'papada', 'papada de cerdo',
        'solomillo de cerdo', 'secreto ibérico', 'presa ibérica', 'pluma ibérica',
        'carrillera de cerdo', 'manitas de cerdo', 'butifarra',
    ],
    'Sin Soja': [
        'soja', 'tofu', 'tempeh', 'edamame', 'miso', 'tamari',
        'salsa de soja', 'salsa soja', 'leche de soja', 'bebida de soja',
        'proteína de soja', 'soja texturizada', 'texturizado de soja',
        'lecitina de soja', 'aceite de soja', 'harina de soja',
    ],
}

function contieneAlergeno(ingredientesNombres, nombreReceta, descripcion, keywords) {
    // Buscar en ingredientes + nombre + descripción para cubrir ingredientes sin vincular
    const partes = [...ingredientesNombres, nombreReceta, descripcion ?? '']
    const texto = partes.join(' ').toLowerCase()
    return keywords.some(k => texto.includes(k.toLowerCase()))
}

async function main() {
    console.log(`Modo: ${APLICA ? '✅ APLICA cambios en BD' : '🔍 DRY-RUN (preview)'}\n`)

    // Cargar todas las recetas con sus ingredientes + nombre + descripción
    let recetas = []
    let from = 0
    const PAGE = 100
    while (true) {
        const { data, error } = await supabase
            .from('recetas')
            .select('id, nombre, descripcion, intolerancias, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre)')
            .eq('estado', 'aprobada')
            .range(from, from + PAGE - 1)
        if (error) { console.error('Error:', error.message); process.exit(1) }
        if (!data?.length) break
        recetas.push(...data)
        if (data.length < PAGE) break
        from += PAGE
    }

    console.log(`Recetas cargadas: ${recetas.length}\n`)

    const stats = { sinCambios: 0, actualizadas: 0, errores: 0 }
    const preview = []

    for (const receta of recetas) {
        const ingredientesNombres = (receta.receta_ingredientes ?? [])
            .map(i => i.nombre_libre ?? '')
            .filter(Boolean)

        const tagsActuales = receta.intolerancias ?? []
        const tagsNuevos = [...tagsActuales]

        for (const [tag, keywords] of Object.entries(ALERGENOS)) {
            if (tagsActuales.includes(tag)) continue // ya tiene el tag
            const tieneAlergeno = contieneAlergeno(ingredientesNombres, receta.nombre, receta.descripcion, keywords)
            if (!tieneAlergeno) {
                tagsNuevos.push(tag)
            }
        }

        const tagsSumados = tagsNuevos.filter(t => !tagsActuales.includes(t))
        if (!tagsSumados.length) { stats.sinCambios++; continue }

        preview.push({
            nombre: receta.nombre,
            antes: tagsActuales.join(', ') || '(ninguno)',
            añadidos: tagsSumados.join(', '),
        })

        if (APLICA) {
            const { error } = await supabase
                .from('recetas')
                .update({ intolerancias: tagsNuevos })
                .eq('id', receta.id)
            if (error) {
                console.error(`  ❌ ${receta.nombre}: ${error.message}`)
                stats.errores++
            } else {
                stats.actualizadas++
            }
        } else {
            stats.actualizadas++
        }
    }

    // Mostrar preview
    if (preview.length) {
        console.log(`Recetas a actualizar (${preview.length}):`)
        for (const p of preview) {
            console.log(`  📌 ${p.nombre}`)
            console.log(`     Antes: ${p.antes}`)
            console.log(`     + ${p.añadidos}`)
        }
        console.log()
    }

    console.log('─'.repeat(50))
    console.log(`✅ Sin cambios: ${stats.sinCambios}`)
    console.log(`${APLICA ? '✅ Actualizadas' : '🔍 A actualizar'}: ${stats.actualizadas}`)
    if (stats.errores) console.log(`❌ Errores: ${stats.errores}`)

    if (!APLICA && stats.actualizadas > 0) {
        console.log('\n→ Ejecuta con --aplica para guardar los cambios en BD.')
    }
}

main()
