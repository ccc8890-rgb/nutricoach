#!/usr/bin/env node
/**
 * investigar-huerfanos.mjs
 *
 * Para cada ingrediente huérfano, busca en Supabase si existe un alimento
 * similar. Usa REST API directa para evitar problemas de schema cache.
 *
 * USO:
 *   node scripts/investigar-huerfanos.mjs
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

async function restGet(table, params = {}) {
    const query = new URLSearchParams(params).toString()
    const res = await fetch(`${URL}/rest/v1/${table}?${query}`, {
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
            'Accept': 'application/json'
        }
    })
    if (!res.ok) {
        const text = await res.text()
        console.error(`  ❌ REST error ${res.status}: ${text.substring(0, 200)}`)
        return []
    }
    return res.json()
}

function normalizar(str) {
    return str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ').trim()
}

async function buscarAlimentos(palabras) {
    // Buscar OR por cada palabra clave
    const conds = palabras.map(p => `nombre.ilike.*${encodeURIComponent(p)}*`).join(',')
    return restGet('alimentos', {
        select: 'id,nombre,kcal,proteinas,carbohidratos,grasas,categoria',
        or: `(${conds})`,
        limit: 10
    })
}

const HUERFANOS = [
    { ing: 'pepinillos holandeses', desc: 'Encurtido' },
    { ing: 'levadura química (polvo para hornear)', desc: 'Leudante' },
    { ing: 'ghee', desc: 'Mantequilla clarificada' },
    { ing: 'ajetes', desc: 'Ajo tierno' },
    { ing: 'papa', desc: 'Patata/papa latino' },
    { ing: 'galletas', desc: 'Galletas genérico' },
    { ing: 'guindilla o cayena (opcional)', desc: 'Especia picante' },
    { ing: 'tomates secos', desc: 'Tomate deshidratado' },
    { ing: 'ajete', desc: 'Ajo tierno (singular)' },
    { ing: 'zucchini', desc: 'Calabacín' },
    { ing: 'gel de baño granada y frutos silvestres deliplus piel normal', desc: 'BASURA - gel/baño' },
    { ing: 'carne de ternera molida (5% grasa)', desc: 'Carne picada magra' },
    { ing: 'pickles dulces (para salsa de hamburguesa)', desc: 'Encurtido' },
    { ing: 'almendra tostada hacendado 0% sal añadida con piel', desc: 'Fruto seco' },
    { ing: 'cebolla morada (para salsa de hamburguesa)', desc: 'Verdura' },
    { ing: 'ajo cebollino (para salsa de hamburguesa)', desc: 'Especia' },
    { ing: 'salsa inglesa (para salsa de hamburguesa)', desc: 'Condimento' },
    { ing: 'ajo cebollino (para salsa de trufa)', desc: 'Especia' },
    { ing: 'chile', desc: 'Especia picante' },
    { ing: 'piel de yuzu deshidratada', desc: 'Especia/exótico' },
    { ing: 'pastillas de caldo de ave trituradas', desc: 'Condimento' },
    { ing: 'ají molido', desc: 'Especia picante' },
]

async function main() {
    console.log('🔍 INVESTIGACIÓN DE INGREDIENTES HUÉRFANOS\n')

    for (const { ing, desc } of HUERFANOS) {
        const palabrasClave = normalizar(ing)
            .split(/\s+/)
            .filter(p => p.length >= 3 && !['de', 'la', 'el', 'los', 'las', 'del', 'en', 'por', 'con', 'sin', 'para', 'y', 'e', 'o', 'a', 'su', 'que', 'es', 'se', 'no', 'lo', 'como', 'mas', 'pero', 'todo', 'entre', 'una', 'un', 'unos', 'unas', 'le', 'da', 'do', 'tu', 'al', '0%', '5%', 'sal', 'piel'].includes(p))

        console.log(`\n── ${ing} ──`)

        const candidatos = await buscarAlimentos(palabrasClave)

        if (candidatos.length === 0) {
            console.log(`  ❌ NO EXISTE en BD (${desc}) → CREAR`)
            continue
        }

        const mostrar = candidatos.slice(0, 3)
        for (const c of mostrar) {
            const cat = c.categoria || 'sin cat'
            console.log(`  🟢 "${c.nombre}" (${c.kcal} kcal, ${cat})`)
        }
        if (candidatos.length > 3) {
            console.log(`  ... +${candidatos.length - 3} más`)
        }

        // Detectar match exacto
        const ingNorm = normalizar(ing)
        const exacto = candidatos.find(c => normalizar(c.nombre) === ingNorm)
        if (exacto) {
            console.log(`  ✅ MATCH EXACTO EXISTE: "${exacto.nombre}" (ID: ${exacto.id?.substring(0, 8)})`)
        }
    }

    console.log('\n══════════════════════════════════════════')
    console.log('PLAN DE ACCIÓN:\n')

    // Clasificar
    for (const { ing, desc } of HUERFANOS) {
        if (ing.includes('gel de baño')) {
            console.log(`  🗑️  BASURA: "${ing}" → eliminar de receta_ingredientes`)
            continue
        }

        // Ver si son variantes de alimentos existentes
        const palabrasClave = normalizar(ing)
            .split(/\s+/)
            .filter(p => p.length >= 3 && !['de', 'la', 'el', 'los', 'las', 'del', 'en', 'por', 'con', 'sin', 'para', 'y', 'e', 'o', 'a', 'su', 'que', 'es', 'se', 'no', 'lo', 'como', 'mas', 'pero', 'todo', 'entre', 'una', 'un', 'unos', 'unas', 'le', 'da', 'do', 'tu', 'al', '0%', '5%', 'sal', 'piel'].includes(p))

        const candidatos = await buscarAlimentos(palabrasClave)
        const exacto = candidatos.find(c => normalizar(c.nombre) === normalizar(ing))

        if (exacto) {
            console.log(`  🔗 RE-VINCULAR: "${ing}" → "${exacto.nombre}" (ya existe, no matcheó por algoritmo)`)
        } else if (candidatos.length > 0) {
            const mejor = candidatos[0]
            const ingSinParentesis = normalizar(ing.replace(/\(.*?\)/g, '').trim())
            const mejorNorm = normalizar(mejor.nombre)
            // Si el mejor candidato es el mismo quitando paréntesis
            if (mejorNorm === ingSinParentesis) {
                console.log(`  🔗 RE-VINCULAR: "${ing}" → "${mejor.nombre}" (mismo nombre sin paréntesis)`)
            } else {
                console.log(`  📝 CREAR: "${ing}" → mejor candidato "${mejor.nombre}" pero no es exacto`)
            }
        } else {
            console.log(`  📝 CREAR: "${ing}" (${desc})`)
        }
    }
}

main().catch(console.error)
