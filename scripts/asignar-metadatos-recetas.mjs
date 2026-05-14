#!/usr/bin/env node
/**
 * asignar-metadatos-recetas.mjs
 *
 * Asigna categoría, tipo_cocción, dificultad y tipo_plato a todas las recetas
 * basándose en nombre, ingredientes y macros.
 * También normaliza valores existentes (Dulce→Postre, fácil→Fácil, etc.)
 *
 * USO: node scripts/asignar-metadatos-recetas.mjs [--apply]
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')
const APPLY = process.argv.includes('--apply')

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

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const headers = {
    'apikey': KEY,
    'Authorization': `Bearer ${KEY}`,
    'Content-Type': 'application/json',
}

async function fetchAll(table, select, filter = '') {
    let all = [], from = 0, pageSize = 1000
    while (true) {
        const res = await fetch(`${SB}/rest/v1/${table}?select=${select}${filter}`, {
            headers: { ...headers, 'Range': `${from}-${from + pageSize - 1}` }
        })
        if (res.status === 416) break
        const data = await res.json()
        if (!data || !data.length) break
        all = all.concat(data)
        if (data.length < pageSize) break
        from += pageSize
    }
    return all
}

async function patch(table, id, body) {
    const res = await fetch(`${SB}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`PATCH error ${res.status}: ${await res.text()}`)
    return res.json()
}

// ─── REGLAS DE CLASIFICACIÓN ───

const CATEGORIAS_VALIDAS = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre']

// Normalización de categorías existentes no estándar
const NORMALIZAR_CATEGORIA = {
    'dulce': 'Postre',
    'Dulce': 'Postre',
    'salsas': 'Comida',
    'Salsas': 'Comida',
    'pescados': 'Comida',
    'Pescados': 'Comida',
    'ensaladas': 'Comida',
    'Ensaladas': 'Comida',
    'platos variados': 'Comida',
    'Platos variados': 'Comida',
    'carne': 'Comida',
    'Carnes': 'Comida',
    'entrante': 'Snack',
    'Entrante': 'Snack',
    'verduras': 'Comida',
}

// Reglas para inferir categoría por nombre de receta
function inferirCategoria(nombre, ingredientes, kcal, grasas, carbohidratos, proteina) {
    const n = nombre.toLowerCase()
    const ings = ingredientes.join(' ').toLowerCase()

    // === POSTRES ===
    const postreKeywords = [
        'tarta', 'pastel', 'cheesecake', 'mug cake', 'mousse', 'brownie',
        'helado', 'flan', 'natillas', 'tiramisú', 'tiramisu', 'donuts',
        'donut', 'dulce de leche', 'carrot cake', 'pudding', 'pudín',
        'compota', 'peras al vino', 'manzanas asadas', 'choco pudding',
        'muffin', 'cupcake', 'cookie', 'galleta', 'bizcocho', 'cake',
        'crepes', 'rollos de canela', 'fresa requesón donut',
        'chocolate fundente', 'mousse de chocolate', 'nice cream',
        'helado de plátano', 'pecan caramel', 'twix', 'ferrero',
        'crocante', 'cakepop', 'cake pop', 'barritas de galleta',
    ]
    if (postreKeywords.some(k => n.includes(k))) return 'Postre'

    // === DESAYUNOS ===
    const desayunoKeywords = [
        'desayuno', 'tostada', 'tostadas', 'bowl de yogur', 'bowl de fruta',
        'batido', 'smoothie', 'pancakes', 'tortitas', 'pan plano',
        'pan integral', 'muesli', 'granola', 'copos de avena', 'avena',
        'yogur griego', 'yogur con', 'tostada de pan', 'mini sándwich',
        'sandwich', 'sándwich', 'porridge', 'overnight oats', 'revuelto',
        'huevos poché', 'huevos revueltos', 'tortilla de claras',
        'huevos rellenos', 'huevos cocidos', 'crepes de avena',
    ]
    if (desayunoKeywords.some(k => n.includes(k))) return 'Desayuno'

    // === ENSALADAS ===
    const ensaladaKeywords = [
        'ensalada', 'salad', 'gazpacho', 'ceviche', 'poke',
    ]
    if (ensaladaKeywords.some(k => n.includes(k))) return 'Comida'

    // === SOPAS / CREMAS ===
    const sopaKeywords = [
        'sopa', 'crema de', 'caldo', 'gazpacho', 'vichyssoise',
    ]
    if (sopaKeywords.some(k => n.includes(k))) return 'Comida'

    // === SNACKS / ENTRANTES ===
    const snackKeywords = [
        'snack', 'hummus', 'wrap', 'pinchos', 'canapés', 'canape',
        'palitos de pepino', 'brócoli al vapor', 'chimichurri',
        'mix de especias', 'salsa de', 'salsa ', 'dipping',
        'tsukemono', 'encurtido', 'garbanzos especiados', 'crudités',
        'popcorn', 'nachos', 'guacamole', 'patatas fritas',
        'tortillas de maíz', 'tortilla de maíz',
    ]
    if (snackKeywords.some(k => n.includes(k))) return 'Snack'

    // Si tiene mucha grasa y carbos + azúcar → Postre
    if (grasas > 30 && carbohidratos > 40) return 'Postre'
    // Si es proteico puro y bajo en carbos → Snack o Cena
    if (proteina > 30 && carbohidratos < 20) return 'Cena'
    // Si tiene ingredientes de postre
    if (/chocolate|azúcar|mermelada|leche condensada|leche evaporada/i.test(ings)) return 'Postre'

    return null // indeterminado
}

// Reglas para inferir tipo_coccion por nombre
function inferirTipoCoccion(nombre, instrucciones) {
    const n = nombre.toLowerCase()
    const inst = (instrucciones || '').toLowerCase()
    const texto = n + ' ' + inst

    if (/no bake|no horno|sin horno|nevera|frigor[ií]fico|fr[ií]o/i.test(texto)) return 'No Bake'
    if (/microondas/i.test(texto)) return 'Microondas'
    if (/freidora de aire|airfryer/i.test(texto)) return 'Freidora de Aire'
    if (/plancha/i.test(texto)) return 'Plancha'
    if (/vapor/i.test(texto)) return 'Vapor'
    if (/parrilla|barbacoa|grill/i.test(texto)) return 'Parrilla'
    if (/hervir|hervido|hervida|cocer|poché/i.test(texto)) return 'Hervido'
    if (/sart[eé]n|salteado|wok|sofr[ií]e|rehogar/i.test(texto)) return 'Sartén/Wok'
    if (/horno|horneado|horneada|al horno|asado|asada|gratinado/i.test(texto)) {
        if (/airfryer|freidora/i.test(texto)) return 'Horno/Airfryer'
        return 'Horno'
    }
    if (/olla|cazuela|guiso|estofado|puchero|olla lenta|slow cooker|pressure cooker/i.test(texto)) return 'Olla/Cazuela'

    // Por nombre de receta
    if (/horno|asado|horneado/i.test(n)) return 'Horno'
    if (/hervido|hervida|cocido|cocida/i.test(n)) return 'Hervido'
    if (/sart[eé]n/i.test(n)) return 'Sartén'
    if (/plancha/i.test(n)) return 'Plancha'
    if (/crudo|cruda|fresco|fresca|raw/i.test(n)) return 'No Bake'

    return null
}

// Reglas para inferir dificultad
function inferirDificultad(nombre, instrucciones, tiempoTotal) {
    const texto = (nombre + ' ' + (instrucciones || '')).toLowerCase()

    // Palabras que indican complejidad
    const dificil = ['complejo', 'difícil', 'dificil', 'avanzado', 'profesional',
        'hojaldre', 'masa madre', 'fermentación', 'fermentar', 'laminado']
    const facil = ['fácil', 'facil', 'sencillo', 'r[áa]pido', 'expr[eé]s',
        'microondas', 'no bake', 'sin horno', '5 min', '10 min']

    if (dificil.some(k => texto.includes(k))) return 'Difícil'
    if (facil.some(k => texto.includes(k))) return 'Fácil'

    // Por tiempo total
    if (tiempoTotal !== null) {
        if (tiempoTotal <= 15) return 'Fácil'
        if (tiempoTotal >= 90) return 'Difícil'
    }

    return null // Medio es el default
}

function inferirTipoPlato(categoria, nombre) {
    if (categoria) {
        // Map categoría to tipo_plato
        const map = {
            'Desayuno': 'Desayuno',
            'Comida': 'Comida',
            'Cena': 'Cena',
            'Merienda': 'Merienda',
            'Snack': 'Snack',
            'Postre': 'Postre',
        }
        if (map[categoria]) return map[categoria]
    }
    return null
}

// ─── MAIN ───

async function main() {
    console.log('══════════════════════════════════════════════════')
    console.log('   ASIGNAR METADATOS A RECETAS')
    console.log('   Modo: ' + (APPLY ? '🔥 APLICANDO' : '👁️  Dry-run (usa --apply)'))
    console.log('══════════════════════════════════════════════════\n')

    // 1. Get all recetas
    const allR = await fetchAll('recetas', 'id,nombre,instrucciones,categoria,tipo_coccion,tiempo_prep_min,tiempo_coccion_min,dificultad,tipo_plato,kcal,proteinas,grasas,carbohidratos')
    console.log(`📦 Recetas totales: ${allR.length}\n`)

    // 2. Get ingredients per receta
    const ri = await fetchAll('receta_ingredientes', 'id,receta_id,nombre_libre')
    const recetaIngs = {}
    for (const r of ri) {
        if (!recetaIngs[r.receta_id]) recetaIngs[r.receta_id] = []
        recetaIngs[r.receta_id].push(r.nombre_libre || '')
    }

    // 3. Analyze each receta
    const cambios = []
    const normalizaciones = []

    for (const r of allR) {
        const ingredientes = recetaIngs[r.id] || []
        const tiempoPrep = r.tiempo_prep_min || 0
        const tiempoCook = r.tiempo_coccion_min || 0
        const tiempoTotal = (tiempoPrep + tiempoCook) || null
        const update = {}

        // --- Normalizar categoria existente ---
        if (r.categoria && !CATEGORIAS_VALIDAS.includes(r.categoria)) {
            const normalizada = NORMALIZAR_CATEGORIA[r.categoria]
            if (normalizada) {
                update.categoria = normalizada
                normalizaciones.push({ id: r.id, nombre: r.nombre, campo: 'categoria', de: r.categoria, a: normalizada })
            }
        }

        // --- Inferir categoria faltante ---
        if (!r.categoria || !CATEGORIAS_VALIDAS.includes(r.categoria)) {
            const inferida = inferirCategoria(r.nombre, ingredientes, r.kcal || 0, r.grasas || 0, r.carbohidratos || 0, r.proteinas || 0)
            if (inferida && (!update.categoria || !CATEGORIAS_VALIDAS.includes(r.categoria))) {
                if (!r.categoria) {
                    update.categoria = inferida
                    cambios.push({ id: r.id, nombre: r.nombre, campo: 'categoria', valor: inferida })
                } else if (!CATEGORIAS_VALIDAS.includes(r.categoria)) {
                    update.categoria = inferida
                }
            }
        }

        // --- Inferir tipo_coccion faltante ---
        if (!r.tipo_coccion) {
            const inferida = inferirTipoCoccion(r.nombre, r.instrucciones)
            if (inferida) {
                update.tipo_coccion = inferida
                cambios.push({ id: r.id, nombre: r.nombre, campo: 'tipo_coccion', valor: inferida })
            }
        }

        // --- Inferir dificultad faltante ---
        if (!r.dificultad) {
            const inferida = inferirDificultad(r.nombre, r.instrucciones, tiempoTotal)
            if (inferida) {
                update.dificultad = inferida
                cambios.push({ id: r.id, nombre: r.nombre, campo: 'dificultad', valor: inferida })
            }
        } else if (!['Fácil', 'Medio', 'Difícil'].includes(r.dificultad)) {
            // Normalizar
            const normalizada = r.dificultad.toLowerCase() === 'fácil' || r.dificultad.toLowerCase() === 'facil' ? 'Fácil'
                : r.dificultad.toLowerCase() === 'media' || r.dificultad.toLowerCase() === 'medio' ? 'Medio'
                    : r.dificultad.toLowerCase() === 'difícil' || r.dificultad.toLowerCase() === 'dificil' ? 'Difícil'
                        : null
            if (normalizada) {
                update.dificultad = normalizada
                normalizaciones.push({ id: r.id, nombre: r.nombre, campo: 'dificultad', de: r.dificultad, a: normalizada })
            }
        }

        // --- Inferir tipo_plato faltante ---
        if (!r.tipo_plato) {
            const catFinal = update.categoria || r.categoria
            const inferida = inferirTipoPlato(catFinal, r.nombre)
            if (inferida) {
                update.tipo_plato = inferida
                cambios.push({ id: r.id, nombre: r.nombre, campo: 'tipo_plato', valor: inferida })
            }
        }

        if (Object.keys(update).length > 0) {
            update.updated_at = new Date().toISOString()
            if (APPLY) {
                try {
                    await patch('recetas', r.id, update)
                } catch (e) {
                    console.error(`❌ Error en ${r.nombre}: ${e.message}`)
                }
            }
        }
    }

    // 4. Report
    const catChanges = cambios.filter(c => c.campo === 'categoria')
    const coccChanges = cambios.filter(c => c.campo === 'tipo_coccion')
    const diffChanges = cambios.filter(c => c.campo === 'dificultad')
    const platoChanges = cambios.filter(c => c.campo === 'tipo_plato')

    console.log('📊 CAMBIOS POR INFERENCIA:')
    console.log(`  Categorías asignadas:     ${catChanges.length}`)
    console.log(`  Tipo cocción asignados:   ${coccChanges.length}`)
    console.log(`  Dificultad asignadas:     ${diffChanges.length}`)
    console.log(`  Tipo plato asignados:     ${platoChanges.length}`)
    console.log(`  TOTAL inferencias:        ${cambios.length}`)

    console.log('\n📊 NORMALIZACIONES:')
    for (const n of normalizaciones) {
        console.log(`  ${n.nombre.slice(0, 40).padEnd(42)} ${n.campo}: "${n.de}" → "${n.a}"`)
    }
    console.log(`  TOTAL normalizaciones: ${normalizaciones.length}`)

    if (!APPLY) {
        console.log(`\n👁️  Dry-run. Usa --apply para aplicar ${cambios.length} cambios + ${normalizaciones.length} normalizaciones.`)
        return
    }

    // 5. Summary
    const finalRecetas = await fetchAll('recetas', 'id,nombre,categoria,tipo_coccion,dificultad,tipo_plato')

    const conCat = finalRecetas.filter(r => r.categoria && CATEGORIAS_VALIDAS.includes(r.categoria)).length
    const conCocc = finalRecetas.filter(r => r.tipo_coccion).length
    const conDiff = finalRecetas.filter(r => ['Fácil', 'Medio', 'Difícil'].includes(r.dificultad)).length
    const conPlato = finalRecetas.filter(r => r.tipo_plato).length
    const catsUsadas = [...new Set(finalRecetas.filter(r => r.categoria).map(r => r.categoria))]
    const cocesUsadas = [...new Set(finalRecetas.filter(r => r.tipo_coccion).map(r => r.tipo_coccion))]

    console.log('\n══════════════════════════════════════════════════')
    console.log('   RESULTADO FINAL')
    console.log('══════════════════════════════════════════════════')
    console.log(`  Categorías estándar:  ${conCat}/${finalRecetas.length}`)
    console.log(`  Tipo cocción:         ${conCocc}/${finalRecetas.length}`)
    console.log(`  Dificultad estándar:  ${conDiff}/${finalRecetas.length}`)
    console.log(`  Tipo plato:           ${conPlato}/${finalRecetas.length}`)
    console.log(`  Categorías usadas:    ${catsUsadas.join(', ')}`)
    console.log(`  Cocciones usadas:     ${cocesUsadas.join(', ')}`)
    console.log('══════════════════════════════════════════════════')
}

main().catch(err => { console.error(err); process.exit(1) })
