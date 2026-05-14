#!/usr/bin/env node
/**
 * fix-huerfanos-sql.mjs
 *
 * Vincula manualmente ingredientes huérfanos con alimentos existentes.
 * También crea los que faltan y elimina basura.
 *
 * USO: node scripts/fix-huerfanos-sql.mjs
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

async function runSQL(sql) {
    const res = await fetch(`${URL}/sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
        },
        body: JSON.stringify({ query: sql })
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`SQL Error ${res.status}: ${text.substring(0, 300)}`)
    }
    return res.json()
}

async function getJSON(path) {
    const res = await fetch(`${URL}/rest/v1/${path}`, {
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
            'Accept': 'application/json'
        }
    })
    return res.json()
}

async function main() {
    // 1. Encontrar IDs de alimentos
    const sql = `
-- Buscar IDs de alimentos target
SELECT id, nombre FROM alimentos WHERE nombre ILIKE ANY(ARRAY[
    'levadura química%',
    'Ghee (mantequilla clarificada)',
    'Ajo tierno',
    'Patata cocida',
    'Cayena molida',
    'Tomate seco%',
    'Calabacín',
    'Pickles dulces',
    'Almendra tostada Hacendado 0% sal añadida con piel',
    'Cebolla morada',
    'Salsa Worcestershire Botella',
    'Cebollino',
    'Galletas (genérico)',
    'Ternera picada%'
]);
`
    console.log('🔍 Buscando alimentos target...\n')

    try {
        const result = await runSQL(sql)
        console.log('Alimentos encontrados:')
        for (const r of result) {
            console.log(`  ${r.id?.substring(0, 8)}... → ${r.nombre}`)
        }
    } catch (err) {
        console.error(`Error SQL: ${err.message}`)
        // Fallback: buscar uno por uno via REST
        console.log('\nUsando REST API como fallback...')
    }

    // Fallback: buscar cada alimento individualmente
    const busquedas = [
        ['levadura química%', 'levadura química'],
        ['Ghee (mantequilla clarificada)', 'Ghee (mantequilla clarificada)'],
        ['Ajo tierno', 'Ajo tierno'],
        ['Patata cocida', 'Patata cocida'],
        ['Cayena molida', 'Cayena molida'],
        ['Tomate seco Hacendado%', 'Tomate seco Hacendado en aceite de oliva'],
        ['Calabacín', 'Calabacín'],
        ['Pickles dulces', 'Pickles dulces'],
        ['Almendra tostada Hacendado 0% sal añadida con piel', 'Almendra tostada Hacendado 0% sal añadida con piel'],
        ['Cebolla morada', 'Cebolla morada'],
        ['Salsa Worcestershire%', 'Salsa Worcestershire Botella'],
        ['Cebollino', 'Cebollino'],
        ['Galletas (genérico)', 'Galletas (genérico)'],
        ['Ternera picada%', 'Ternera picada'],
    ]

    const alimentos = {}
    for (const [patron, nombre] of busquedas) {
        const data = await getJSON(`alimentos?select=id,nombre,calorias&nombre=ilike.*${encodeURIComponent(patron.replace(/%/g, ''))}*&limit=3`)
        if (data && data.length > 0) {
            alimentos[nombre] = data[0]
            console.log(`  ✅ ${nombre} → ${data[0].id?.substring(0, 8)}... (${data[0].calorias || '?'} kcal)`)
        } else {
            console.log(`  ❌ NO ENCONTRADO: ${nombre}`)
        }
    }

    // 2. Vincular ingredientes huérfanos
    const vinculaciones = [
        { nombre_libre: 'levadura química (polvo para hornear)', target: 'levadura química' },
        { nombre_libre: 'ghee', target: 'Ghee (mantequilla clarificada)' },
        { nombre_libre: 'ajetes', target: 'Ajo tierno' },
        { nombre_libre: 'ajete', target: 'Ajo tierno' },
        { nombre_libre: 'papa', target: 'Patata cocida' },
        { nombre_libre: 'guindilla o cayena (opcional)', target: 'Cayena molida' },
        { nombre_libre: 'Tomates secos', target: 'Tomate seco Hacendado en aceite de oliva' },
        { nombre_libre: 'zucchini', target: 'Calabacín' },
        { nombre_libre: 'Pickles dulces (para salsa de hamburguesa)', target: 'Pickles dulces' },
        { nombre_libre: 'Almendra tostada Hacendado 0% sal añadida con piel', target: 'Almendra tostada Hacendado 0% sal añadida con piel' },
        { nombre_libre: 'Cebolla morada (para salsa de hamburguesa)', target: 'Cebolla morada' },
        { nombre_libre: 'Salsa inglesa (para salsa de hamburguesa)', target: 'Salsa Worcestershire Botella' },
        { nombre_libre: 'Ajo cebollino (para salsa de hamburguesa)', target: 'Cebollino' },
        { nombre_libre: 'Ajo cebollino (para salsa de trufa)', target: 'Cebollino' },
        { nombre_libre: 'Chile', target: 'Cayena molida' },
        { nombre_libre: 'Ají molido', target: 'Cayena molida' },
        { nombre_libre: 'Galletas', target: 'Galletas (genérico)' },
        { nombre_libre: 'Carne de ternera molida (5% grasa)', target: 'Ternera picada' },
    ]

    console.log('\n🔗 Vinculando ingredientes...\n')

    for (const v of vinculaciones) {
        const target = alimentos[v.target]
        if (!target) {
            console.log(`  ❌ No target para "${v.nombre_libre}" → "${v.target}"`)
            continue
        }

        // Get the ingredient ID
        const enc = encodeURIComponent(v.nombre_libre)
        const ings = await getJSON(`receta_ingredientes?select=id,nombre_libre,receta_id&alimento_id=is.null&nombre_libre=ilike.${enc}&limit=5`)

        if (!ings || ings.length === 0) {
            console.log(`  ⚠️  No se encontró ingrediente: "${v.nombre_libre}"`)
            continue
        }

        for (const ing of ings) {
            // PATCH to link
            const res = await fetch(`${URL}/rest/v1/receta_ingredientes?id=eq.${ing.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': KEY,
                    'Authorization': `Bearer ${KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ alimento_id: target.id })
            })
            if (res.ok) {
                console.log(`  ✅ "${ing.nombre_libre}" → "${target.nombre}" (${target.calorias} kcal)`)
            } else {
                const txt = await res.text()
                console.log(`  ❌ Error vinculando "${ing.nombre_libre}": ${txt.substring(0, 100)}`)
            }
        }
    }

    // 3. Eliminar basura
    console.log('\n🗑️  Eliminando basura...')
    const basura = await getJSON(`receta_ingredientes?select=id,nombre_libre&alimento_id=is.null&nombre_libre=ilike.*${encodeURIComponent('gel de baño')}*&limit=5`)
    for (const b of basura || []) {
        await fetch(`${URL}/rest/v1/receta_ingredientes?id=eq.${b.id}`, {
            method: 'DELETE',
            headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
        })
        console.log(`  🗑️  Eliminado: "${b.nombre_libre}"`)
    }

    // 4. Alimento nuevo que falta
    console.log('\n📝 Creando alimentos faltantes...')

    // Ajo cebollino no existe como alimento separado - crear
    const existsAjoCebollino = await getJSON(`alimentos?select=id&nombre=ilike.*ajo*cebollino*&limit=1`)
    if (!existsAjoCebollino || existsAjoCebollino.length === 0) {
        const res = await fetch(`${URL}/rest/v1/alimentos`, {
            method: 'POST',
            headers: {
                'apikey': KEY,
                'Authorization': `Bearer ${KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                nombre: 'Ajo cebollino',
                calorias: 30,
                proteinas: 3,
                carbohidratos: 4,
                grasas: 0.5,
                categoria: 'Especias'
            })
        })
        if (res.ok) {
            const created = await res.json()
            console.log(`  ✅ Creado: "Ajo cebollino" (${created[0]?.id?.substring(0, 8)}...)`)

            // Vinculamos los ingredientes de ajo cebollino a este nuevo alimento
            for (const patron of ['Ajo cebollino (para salsa de hamburguesa)', 'Ajo cebollino (para salsa de trufa)']) {
                const ings = await getJSON(`receta_ingredientes?select=id&alimento_id=is.null&nombre_libre=ilike.${encodeURIComponent(patron)}&limit=5`)
                for (const ing of ings || []) {
                    await fetch(`${URL}/rest/v1/receta_ingredientes?id=eq.${ing.id}`, {
                        method: 'PATCH',
                        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ alimento_id: created[0].id })
                    })
                    console.log(`    ✅ Vinculado: "${patron}" → Ajo cebollino`)
                }
            }
        }
    }

    console.log('\n✅ Fix completado.')
}

main().catch(console.error)
