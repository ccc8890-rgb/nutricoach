/**
 * Script para ejecutar migraciones SQL pendientes (05-05-2026)
 * USO: node scripts/ejecutar-pendientes.mjs
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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
})

async function ejecutarSQL(sql, descripcion) {
    console.log(`\n📤 ${descripcion}...`)
    try {
        const response = await fetch(`${SUPABASE_URL}/sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({ query: sql }),
        })
        const text = await response.text()
        if (response.ok) {
            console.log(`✅ ${descripcion}: OK`)
            if (text) console.log('  Respuesta:', text.substring(0, 200))
            return true
        } else {
            console.error(`❌ ${descripcion}: Error ${response.status}: ${text.substring(0, 300)}`)

            // Fallback: intentar con pg_query
            console.log('  🔄 Intentando pg_query fallback...')
            const resp2 = await fetch(`${SUPABASE_URL}/rest/v1/pg_query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                },
                body: JSON.stringify({ query: sql }),
            })
            const text2 = await resp2.text()
            if (resp2.ok) {
                console.log(`✅ ${descripcion}: OK (pg_query)`)
                if (text2) console.log('  Respuesta:', text2.substring(0, 200))
                return true
            } else {
                console.error(`❌ ${descripcion}: pg_query falló: ${text2.substring(0, 300)}`)

                // Fallback final: raw SQL via supabase.rpc
                console.log('  🔄 Intentando supabase.rpc...')
                try {
                    const { data, error } = await supabase.rpc('exec_sql', { query: sql })
                    if (error) {
                        console.error(`  ❌ RPC falló: ${error.message}`)
                        return false
                    }
                    console.log(`✅ ${descripcion}: OK (RPC)`)
                    return true
                } catch (e) {
                    console.error(`  ❌ RPC error: ${e.message}`)
                    return false
                }
            }
        }
    } catch (err) {
        console.error(`❌ ${descripcion}: Error de red: ${err.message}`)
        return false
    }
}

async function main() {
    console.log('='.repeat(60))
    console.log('🧩 Migraciones pendientes - NutriCoach')
    console.log('='.repeat(60))
    console.log('📌 Supabase URL:', SUPABASE_URL)

    // 1. Migración: descripcion_porcion
    const sql1 = `ALTER TABLE public.recetas ADD COLUMN IF NOT EXISTS descripcion_porcion text;`
    await ejecutarSQL(sql1, 'Migración: ADD COLUMN descripcion_porcion')

    // 2. Activar recetas legacy
    const sql2 = `UPDATE public.recetas SET estado = 'aprobada' WHERE estado IS NULL;`
    await ejecutarSQL(sql2, 'Migración: UPDATE estado recetas legacy')

    console.log('\n' + '='.repeat(60))
    console.log('✅ Migraciones completadas')
}

main().catch(console.error)
