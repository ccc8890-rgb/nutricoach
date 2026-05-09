/**
 * Script para ejecutar supabase_productos_vs_alimentos.sql en Supabase
 * 
 * USO: node scripts/ejecutar-migracion-precios.mjs
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

console.log('📌 Supabase URL:', SUPABASE_URL)
console.log('📌 Service Key (first 15):', SERVICE_KEY?.substring(0, 15) + '...')

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
})

// Leer SQL
const sqlFile = resolve(projectRoot, 'supabase_productos_vs_alimentos.sql')
const sql = readFileSync(sqlFile, 'utf-8')
console.log(`\n📄 SQL (${sql.length} caracteres)\n`)

async function main() {
    console.log('📤 Ejecutando migración...\n')

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
            console.log('✅ Migración ejecutada correctamente!')
            if (text) console.log('Respuesta:', text.substring(0, 500))
        } else {
            console.error(`❌ Error ${response.status}: ${text.substring(0, 500)}`)

            if (response.status === 404) {
                console.log('\n🔄 Intentando con endpoint alternativo /rest/v1/pg_query...')
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
                    console.log('✅ Migración ejecutada!')
                    if (text2) console.log('Respuesta:', text2.substring(0, 500))
                } else {
                    console.error(`❌ ${resp2.status}: ${text2.substring(0, 500)}`)
                    console.log('\n⚠️ Ejecuta manualmente en Supabase > SQL Editor:')
                    console.log(`   Abrir ${sqlFile}`)
                }
            }
        }
    } catch (err) {
        console.error('❌ Error:', err.message)
    }
}

main()
