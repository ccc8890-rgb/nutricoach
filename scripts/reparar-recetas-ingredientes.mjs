/**
 * Script para reparar recetas: migrar ingredientes de texto a receta_ingredientes
 * y calcular macros desde alimentos vinculados.
 *
 * El problema: en la importación CSV, los ingredientes (texto) se guardaron
 * en la columna `instrucciones` en lugar de crear registros en `receta_ingredientes`.
 *
 * USO: node scripts/reparar-recetas-ingredientes.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// Leer .env.local
const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Faltan SUPABASE_URL o SERVICE_KEY en .env.local')
    process.exit(1)
}

console.log('📌 Supabase URL:', SUPABASE_URL)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
})

// Obtener todos los alimentos para hacer matching por nombre
async function obtenerAlimentos() {
    const { data } = await supabase
        .from('alimentos')
        .select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')
    return data || []
}

// Normalizar nombre para matching case-insensitive
function normNombre(n) {
    return n.toLowerCase()
        .replace(/[áäà]/g, 'a').replace(/[éëè]/g, 'e')
        .replace(/[íïì]/g, 'i').replace(/[óöò]/g, 'o')
        .replace(/[úüù]/g, 'u').replace(/[ñ]/g, 'n')
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
}

// Buscar el mejor match de un nombre_libre contra la base de alimentos
function buscarAlimento(nombre_libre, alimentos) {
    const norm = normNombre(nombre_libre)
    if (!norm) return null

    // 1. Exact match
    const exacto = alimentos.find(a => normNombre(a.nombre) === norm)
    if (exacto) return exacto

    // 2. Match parcial
    const parcial = alimentos.find(a => {
        const aNorm = normNombre(a.nombre)
        return aNorm.includes(norm) || norm.includes(aNorm)
    })
    if (parcial) return parcial

    // 3. Match de palabras clave
    const palabras = norm.split(/\s+/).filter(p => p.length > 3)
    if (palabras.length > 0) {
        const porPalabras = alimentos
            .map(a => {
                const aNorm = normNombre(a.nombre)
                const coincidencias = palabras.filter(p => aNorm.includes(p)).length
                return { alimento: a, score: coincidencias / palabras.length }
            })
            .filter(x => x.score >= 0.6)
            .sort((a, b) => b.score - a.score)
        if (porPalabras.length > 0) return porPalabras[0].alimento
    }

    return null
}

async function main() {
    console.log('🚀 REPARANDO INGREDIENTES DE RECETAS\n')

    // 1. Obtener todas las recetas
    const { data: recetas, error: recetasErr } = await supabase
        .from('recetas')
        .select('id, nombre, instrucciones, kcal, proteinas, carbohidratos, grasas, porciones')

    if (recetasErr) {
        console.error('❌ Error obteniendo recetas:', recetasErr.message)
        process.exit(1)
    }

    console.log('📋 Total recetas:', recetas.length)

    // 2. Obtener alimentos para matching
    const alimentos = await obtenerAlimentos()
    console.log('📋 Alimentos disponibles para matching:', alimentos.length)

    // 3. Procesar cada receta
    let conIngredientes = 0
    let ingredientesCreados = 0
    let vinculados = 0
    let sinVincular = 0
    let macrosCalculados = 0

    for (const receta of recetas) {
        const textoIngredientes = receta.instrucciones
        if (!textoIngredientes || textoIngredientes.trim() === '') {
            continue
        }

        // Verificar si ya tiene ingredientes en receta_ingredientes
        const { data: existentes } = await supabase
            .from('receta_ingredientes')
            .select('id')
            .eq('receta_id', receta.id)
            .limit(1)

        if (existentes && existentes.length > 0) {
            continue
        }

        // Parsear líneas de ingredientes
        const lineas = textoIngredientes
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('*'))

        if (lineas.length === 0) continue

        conIngredientes++
        const inserts = []
        let tieneVinculo = false

        for (let i = 0; i < lineas.length; i++) {
            const linea = lineas[i]
            if (linea.length < 2) continue

            // Extraer cantidad (gramos) si está al inicio
            const matchGramos = linea.match(/^([\d.,]+)\s*(?:g|gr|gramos?)?\s+(.+)$/i)
            let cantidad = 100
            let nombre = linea

            if (matchGramos) {
                cantidad = Math.max(1, Math.round(parseFloat(matchGramos[1].replace(',', '.'))))
                nombre = matchGramos[2].trim()
            } else {
                // Intentar "1 huevo" -> 60g
                const matchHuevos = linea.match(/^(\d+)\s*huevos?\b/i)
                if (matchHuevos) {
                    cantidad = parseInt(matchHuevos[1]) * 60
                    nombre = 'Huevo'
                }
            }

            // Buscar match en alimentos
            const alimento = buscarAlimento(nombre, alimentos)
            const insert = {
                receta_id: receta.id,
                nombre_libre: nombre,
                cantidad_gramos: cantidad,
                orden: i,
            }

            if (alimento) {
                insert.alimento_id = alimento.id
                vinculados++
                tieneVinculo = true
            } else {
                sinVincular++
            }

            inserts.push(insert)
        }

        if (inserts.length > 0) {
            const { error: insErr } = await supabase
                .from('receta_ingredientes')
                .insert(inserts)

            if (insErr) {
                console.error('  ❌ Error insertando ingredientes para "' + receta.nombre + '": ' + insErr.message)
            } else {
                ingredientesCreados += inserts.length
                let msg = '  ✅ "' + (receta.nombre?.substring(0, 50) || '?') + '" → ' + inserts.length + ' ingredientes'
                if (tieneVinculo) msg += ', 🔗 con vínculos'
                console.log(msg)
            }
        }

        // Si se vincularon ingredientes, calcular macros
        if (tieneVinculo) {
            await calcularMacrosReceta(receta.id, receta.porciones || 1)
            macrosCalculados++
        }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 RESUMEN')
    console.log('='.repeat(60))
    console.log('   Recetas con ingredientes texto: ' + conIngredientes)
    console.log('   Ingredientes creados: ' + ingredientesCreados)
    console.log('   Vinculados a alimentos: ' + vinculados)
    console.log('   Sin vincular (nombre_libre): ' + sinVincular)
    console.log('   Macros recalculados: ' + macrosCalculados)
    console.log('')
    console.log('📌 NOTA: Las recetas sin vínculos a alimentos usan nombre_libre.')
    console.log('   Puedes vincularlos manualmente desde /recetas/[id]/editar')
}

async function calcularMacrosReceta(recetaId, porciones) {
    const { data: ingreds } = await supabase
        .from('receta_ingredientes')
        .select('cantidad_gramos, alimento:alimentos(calorias, proteinas, carbohidratos, grasas, fibra)')
        .eq('receta_id', recetaId)
        .not('alimento_id', 'is', null)

    if (!ingreds || ingreds.length === 0) return

    const divisor = Math.max(1, porciones)
    let kcal = 0, proteinas = 0, carbohidratos = 0, grasas = 0, fibra = 0

    for (const ing of ingreds) {
        const a = ing.alimento
        if (!a) continue
        const factor = ing.cantidad_gramos / 100
        kcal += (a.calorias ?? 0) * factor
        proteinas += (a.proteinas ?? 0) * factor
        carbohidratos += (a.carbohidratos ?? 0) * factor
        grasas += (a.grasas ?? 0) * factor
        fibra += (a.fibra ?? 0) * factor
    }

    const { error } = await supabase
        .from('recetas')
        .update({
            kcal: Math.round(kcal / divisor * 100) / 100,
            proteinas: Math.round(proteinas / divisor * 100) / 100,
            carbohidratos: Math.round(carbohidratos / divisor * 100) / 100,
            grasas: Math.round(grasas / divisor * 100) / 100,
            fibra: Math.round(fibra / divisor * 100) / 100,
        })
        .eq('id', recetaId)

    if (error) {
        console.error('     ❌ Error actualizando macros: ' + error.message)
    }
}

main().catch(err => {
    console.error('Error general:', err)
    process.exit(1)
})
