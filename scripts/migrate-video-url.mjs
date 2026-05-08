/**
 * migrate-video-url.mjs
 * Ejecuta la migración para añadir columna video_url a recetas
 * 
 * USO: node scripts/migrate-video-url.mjs
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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
})

const sqlFile = resolve(projectRoot, 'supabase_video_url_migration.sql')
const sql = readFileSync(sqlFile, 'utf-8')
console.log(`📄 SQL a ejecutar (${sql.length} caracteres):\n${sql}\n`)

async function main() {
    // Estrategia: intentar con endpoint /sql primero
    const endpoints = [
        { url: `${SUPABASE_URL}/sql`, label: '/sql' },
        { url: `${SUPABASE_URL}/rest/v1/pg_query`, label: '/pg_query' },
    ]

    for (const ep of endpoints) {
        process.stdout.write(`📤 Intentando ${ep.label}... `)
        try {
            const res = await fetch(ep.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                },
                body: JSON.stringify({ query: sql }),
            })
            const text = await res.text()
            if (res.ok) {
                console.log('✅ OK')
                if (text.trim()) console.log('   Respuesta:', text.substring(0, 200))
                // Verificar columna
                await verificarColumna()
                return
            }
            console.log(`❌ ${res.status}: ${text.substring(0, 100)}`)
        } catch (err) {
            console.log(`❌ ${err.message}`)
        }
    }

    // Fallback: ejecutar bloque por bloque via REST API
    console.log('\n🔄 Ejecutando bloque por bloque...')
    const blocks = sql
        .split(';')
        .map(b => b.trim())
        .filter(b => b.length > 0 && !b.startsWith('--'))

    let ok = 0, fail = 0
    for (const block of blocks) {
        const blockSql = block + ';'
        const desc = blockSql.replace(/\s+/g, ' ').substring(0, 50)
        process.stdout.write(`  ${desc.padEnd(55)} `)

        try {
            const { error } = await supabase.rpc('exec_sql', { query: blockSql })
            if (!error) {
                console.log('✅')
                ok++
            } else {
                if (error.message?.includes('already exists') ||
                    error.code === '42710' || error.code === '42P07') {
                    console.log('⚠️ (ya existe)')
                    ok++
                } else {
                    console.log(`❌ ${error.message.substring(0, 60)}`)
                    fail++
                }
            }
        } catch (err) {
            console.log(`❌ ${err.message?.substring(0, 60) || 'error'}`)
            fail++
        }
    }

    console.log(`\n📊 ${ok} OK, ${fail} errores`)

    if (fail > 0) {
        console.log('\n⚠️ La migración necesita ejecutarse manualmente.')
        console.log('   Abre: https://supabase.com/dashboard/project/hopeqzwzmlrpktoeygxz/sql/new')
        console.log('   Pega el contenido de supabase_video_url_migration.sql y ejecútalo.\n')
    }

    await verificarColumna()
}

async function verificarColumna() {
    const { data, error } = await supabase.from('recetas').select('video_url').limit(1)
    if (error) {
        console.log(`\n❌ Columna video_url NO disponible: ${error.message}`)
        process.exit(1)
    }
    console.log(`\n✅ Columna video_url disponible correctamente`)
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err)
    process.exit(1)
})
