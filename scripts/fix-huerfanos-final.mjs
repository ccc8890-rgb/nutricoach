#!/usr/bin/env node
/**
 * fix-huerfanos-final.mjs
 *
 * Corrige los 22 ingredientes huérfanos:
 *   - Vincula directamente los que ya existen en BD
 *   - Crea los que no existen
 *   - Elimina items de basura
 *
 * USO:
 *   node scripts/fix-huerfanos-final.mjs          → dry-run
 *   node scripts/fix-huerfanos-final.mjs --apply  → ejecuta
 */

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

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const isApply = process.argv.includes('--apply')

async function api(method, path, body) {
    const opts = {
        method,
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
    }
    if (body) {
        opts.body = JSON.stringify(body)
        if (method === 'PATCH' || method === 'POST') {
            opts.headers['Prefer'] = 'return=representation'
        }
    }
    const res = await fetch(`${URL}/rest/v1/${path}`, opts)
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`${method} ${path} → ${res.status}: ${text.substring(0, 200)}`)
    }
    const length = res.headers.get('content-length')
    if (length === '0') return null
    return res.json().catch(() => null)
}

// Encontrar ID de alimento por nombre (búsqueda exacta o like)
async function findAlimentoId(nombre) {
    // Primero try exact
    let data = await api('GET', `alimentos?id=not.is.null&nombre=eq.${encodeURIComponent(nombre)}&select=id,nombre,calorias&limit=5`)

    if (!data || data.length === 0) {
        // Try ilike
        const enc = encodeURIComponent(nombre)
        data = await api('GET', `alimentos?select=id,nombre,calorias&nombre=ilike.*${enc}*&limit=10`)
    }

    if (!data || data.length === 0) {
        // Buscar con primeras palabras
        const tokens = nombre.toLowerCase().split(/[\s,()\/\-]+/).filter(t => t.length >= 3)
        for (const t of tokens.slice(0, 2)) {
            data = await api('GET', `alimentos?select=id,nombre,calorias&nombre=ilike.*${encodeURIComponent(t)}*&limit=5`)
            if (data && data.length > 0) break
        }
    }

    return data || []
}

async function getIngredientesHuerfanos() {
    return api('GET', 'receta_ingredientes?select=id,nombre_libre,receta_id&alimento_id=is.null&limit=50')
}

// Definición manual de vinculaciones basada en investigación previa
const VINCULOS = [
    // [patrón en nombre_libre, nombre del alimento en BD]
    ['almendra tostada hacendado 0%', 'Almendra tostada Hacendado 0% sal añadida con piel'],
    ['cebolla morada', 'Cebolla morada'],
    ['guindilla o cayena', 'Cayena molida'],
    ['zucchini', 'Calabacín'],
    ['papa', 'Patata cocida'],
    ['tomates secos', 'Tomate seco Hacendado en aceite de oliva'],
    ['salsa inglesa', 'Salsa Worcestershire Botella'],
    ['pickles dulces', 'Pickles dulces'],
    ['levadura química', 'levadura química'],
    ['ghee', 'Ghee (mantequilla clarificada)'],
    ['ajetes', 'Ajo tierno'],
    ['ajete', 'Ajo tierno'],
    ['chile', 'Cayena molida'],
    ['ají molido', 'Cayena molida'],
    ['ajo cebollino', 'Cebollino'],
    ['carne de ternera molida', 'Ternera picada'],
]

// Alimentos a crear (no existen en BD)
const A_CREAR = [
    { nombre: 'Piel de yuzu deshidratada', kcal: 1, proteinas: 0, carbohidratos: 0, grasas: 0, categoria: 'Especias' },
    { nombre: 'Pastillas de caldo de ave trituradas', kcal: 2, proteinas: 0.1, carbohidratos: 0.3, grasas: 0, categoria: 'Condimentos' },
    { nombre: 'Pepinillos holandeses', kcal: 11, proteinas: 0.4, carbohidratos: 2, grasas: 0.1, categoria: 'Encurtidos' },
    { nombre: 'Galletas (genérico)', kcal: 430, proteinas: 7, carbohidratos: 76, grasas: 11, categoria: 'Galletas' },
]

async function main() {
    console.log('🔧 FIX HUÉRFANOS FINAL\n')

    const ingredientes = await getIngredientesHuerfanos()
    if (!ingredientes || ingredientes.length === 0) {
        console.log('✅ No hay ingredientes huérfanos.')
        return
    }

    console.log(`📋 ${ingredientes.length} ingredientes huérfanos encontrados:\n`)

    let nVincular = 0, nCrear = 0, nEliminar = 0, nSinAccion = 0

    for (const ing of ingredientes) {
        const nombre = ing.nombre_libre?.toLowerCase().trim() || ''
        console.log(`  ${ing.nombre_libre}`)

        // Es basura?
        if (nombre.includes('gel de baño')) {
            nEliminar++
            console.log(`    🗑️  BASURA → eliminar`)
            if (isApply) {
                await api('DELETE', `receta_ingredientes?id=eq.${ing.id}`)
                console.log(`    ✅ Eliminado`)
            }
            continue
        }

        // Buscar vinculación
        let encontrado = false
        for (const [patron, nombreAlimento] of VINCULOS) {
            if (nombre.includes(patron)) {
                const alimentos = await findAlimentoId(nombreAlimento)
                if (alimentos && alimentos.length > 0) {
                    const mejor = alimentos[0]
                    nVincular++
                    console.log(`    🔗 → "${mejor.nombre}" (${mejor.calorias || '?'} kcal)`)
                    if (isApply) {
                        await api('PATCH', `receta_ingredientes?id=eq.${ing.id}`, {
                            alimento_id: mejor.id
                        })
                        console.log(`    ✅ Vinculado`)
                    }
                    encontrado = true
                } else {
                    console.log(`    ⚠️  No se encontró "${nombreAlimento}" en BD`)
                }
                break
            }
        }

        if (encontrado) continue

        // Buscar quitando paréntesis
        const sinParen = nombre.replace(/\(.*?\)/g, '').trim()
        if (sinParen !== nombre && sinParen.length > 0) {
            const alimentos = await findAlimentoId(sinParen)
            if (alimentos && alimentos.length > 0) {
                const mejor = alimentos[0]
                nVincular++
                console.log(`    🔗 → "${mejor.nombre}" (${mejor.calorias || '?'} kcal) [sin paréntesis]`)
                if (isApply) {
                    await api('PATCH', `receta_ingredientes?id=eq.${ing.id}`, {
                        alimento_id: mejor.id
                    })
                    console.log(`    ✅ Vinculado`)
                }
                encontrado = true
                continue
            }
        }

        if (!encontrado) {
            // Ver si está en A_CREAR
            const aCrear = A_CREAR.find(c => nombre.includes(c.nombre.toLowerCase().substring(0, 10)))
            if (aCrear) {
                nCrear++
                console.log(`    📝 CREAR: "${aCrear.nombre}" (${aCrear.kcal} kcal)`)
                if (isApply) {
                    const created = await api('POST', 'alimentos', {
                        nombre: aCrear.nombre,
                        calorias: aCrear.kcal,
                        proteinas: aCrear.proteinas,
                        carbohidratos: aCrear.carbohidratos,
                        grasas: aCrear.grasas,
                        categoria: aCrear.categoria,
                    })
                    if (created && created.length > 0) {
                        await api('PATCH', `receta_ingredientes?id=eq.${ing.id}`, {
                            alimento_id: created[0].id
                        })
                        console.log(`    ✅ Creado y vinculado (ID: ${created[0].id?.substring(0, 8)})`)
                    }
                }
            } else {
                nSinAccion++
                console.log(`    ❓ Sin acción disponible`)
            }
        }
    }

    console.log('\n══════════════════════════════════════════')
    console.log(`RESUMEN: ${nVincular} vinculados | ${nCrear} creados | ${nEliminar} eliminados | ${nSinAccion} pendientes`)

    if (!isApply) {
        console.log('\n🔸 Modo dry-run. Usa --apply para ejecutar.')
    }
}

main().catch(console.error)
