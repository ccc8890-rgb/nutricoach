#!/usr/bin/env node
/**
 * Inspecciona y elimina alimentos no comestibles (mascotas, cosmética, higiene)
 * que se colaron en la tabla alimentos.
 *
 * Uso:
 *   node scripts/_limpiar-no-comestibles.mjs --dry-run   # Solo inspeccionar
 *   node scripts/_limpiar-no-comestibles.mjs              # Eliminar
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(PROJECT_ROOT, '.env.local')
    if (!existsSync(envPath)) { console.error('❌ No .env.local'); process.exit(1) }
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
        process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

async function query(categoria) {
    const all = []
    let from = 0
    const limit = 1000
    while (true) {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/alimentos?select=id,nombre,categoria,created_at&categoria=eq.${categoria}&offset=${from}`
        const res = await fetch(url, {
            headers: {
                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                'Accept': 'application/json',
            }
        })
        if (!res.ok) break
        const data = await res.json()
        if (!data || data.length === 0) break
        all.push(...data)
        from += limit
    }
    return all
}

async function main() {
    console.log(`${CYAN}═════════════════════════════════════════════${RESET}`)
    console.log(`${CYAN}  🧹 Limpieza de alimentos no comestibles${RESET}`)
    console.log(`${CYAN}═════════════════════════════════════════════${RESET}`)
    console.log(`Dry-run: ${DRY_RUN ? 'SÍ' : 'NO'}\n`)

    const mascotas = await query('Mascotas')
    const cosmetic = await query('__SKIP__')

    console.log(`${YELLOW}🐶 MASCOTAS (${mascotas.length}):${RESET}`)
    mascotas.forEach(a => console.log(`   [${a.id}] ${a.nombre}  (creado: ${a.created_at?.slice(0, 10) || '?'})`))

    console.log(`\n${YELLOW}🧴 COSMÉTICOS / HIGIENE (${cosmetic.length}):${RESET}`)
    cosmetic.forEach(a => console.log(`   [${a.id}] ${a.nombre}  (creado: ${a.created_at?.slice(0, 10) || '?'})`))

    const total = mascotas.length + cosmetic.length
    console.log(`\n${CYAN}Total a eliminar: ${total} filas${RESET}`)

    if (total === 0) {
        console.log(`\n${GREEN}✓ No hay nada que limpiar.${RESET}`)
        return
    }

    if (DRY_RUN) {
        console.log(`\n${YELLOW}🏁 Dry-run — no se modificó nada.${RESET}`)
        console.log(`Para eliminar: node scripts/_limpiar-no-comestibles.mjs`)
        return
    }

    // Eliminar
    let ok = 0, err = 0
    for (const a of [...mascotas, ...cosmetic]) {
        const { error } = await supabase.from('alimentos').delete().eq('id', a.id)
        if (error) { err++; if (err <= 3) console.error(`   ${RED}✗${RESET} ${a.nombre}: ${error.message}`) }
        else { ok++ }
        await new Promise(r => setTimeout(r, 50)) // rate limit
    }

    console.log(`\n${GREEN}✅ Limpieza completada${RESET}`)
    console.log(`   Eliminados: ${ok}`)
    console.log(`   Errores: ${err}`)
}

main().catch(e => { console.error('💥', e.message); process.exit(1) })
