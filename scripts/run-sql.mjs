/**
 * Script para ejecutar supabase_fix_completo.sql en Supabase
 * usando la service_role_key.
 * 
 * USO: node scripts/run-sql.mjs
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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
})

// Leer SQL
const sqlFile = resolve(projectRoot, 'supabase_fix_completo.sql')
const sql = readFileSync(sqlFile, 'utf-8')
console.log(`\n📄 Supabase SQL: ${sql.length} caracteres\n`)

// La clave: Supabase permite ejecutar SQL directamente vía REST
// POST /rest/v1/rpc/ con parámetro query NO funciona porque no existe exec_sql
// Pero podemos usar el endpoint /sql que sí está disponible con service_role_key
// Alternativa: usar pgclient endpoint

async function main() {
    // Opción 1: Intentar usando el endpoint /sql
    // POST https://<project>.supabase.co/sql 
    // con Content-Type: application/json
    // body: { "query": "..." }

    console.log('📤 Ejecutando SQL en Supabase...\n')

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
            console.log('✅ SQL ejecutado correctamente!')
            if (text) console.log('Respuesta:', text.substring(0, 500))
        } else {
            console.error(`❌ Error ${response.status}: ${text.substring(0, 500)}`)

            if (response.status === 404) {
                // Opción 2: Intentar con pg_query 
                console.log('\n🔄 Intentando con endpoint alternativo...')

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
                    console.log('✅ SQL ejecutado correctamente!')
                    if (text2) console.log('Respuesta:', text2.substring(0, 500))
                } else {
                    console.error(`❌ ${resp2.status}: ${text2.substring(0, 500)}`)

                    // Opción 3: Ejecutar el SQL mediante inserciones/consultas directas
                    console.log('\n🔄 Ejecutando bloque por bloque via REST API...')
                    await ejecutarPorBloques(sql, supabase)
                }
            }
        }
    } catch (err) {
        console.error('❌ Error:', err.message)
    }
}

async function ejecutarPorBloques(sqlCompleto, supabaseClient) {
    // Dividir SQL en statements individuales
    const blocks = sqlCompleto
        .split(';')
        .map(b => b.trim())
        .filter(b => b.length > 0 && !b.startsWith('--'))

    let ok = 0, fail = 0

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i] + ';'
        const desc = obtenerDescripcion(block, i + 1)

        process.stdout.write(`  ${desc.padEnd(35)} `)

        try {
            // Ejecutar usando raw query de Supabase
            const { error } = await supabaseClient.rpc('exec_sql', { query: block })

            if (!error) {
                console.log('✅')
                ok++
            } else {
                if (error.message?.includes('already exists') ||
                    error.message?.includes('duplicate') ||
                    error.code === '42710' || // duplicate policy
                    error.code === '42P07') { // duplicate table
                    console.log('⚠️')
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

    console.log(`\n📊 Resultado: ${ok} OK, ${fail} errores`)

    if (fail > 0) {
        console.log('\n⚠️ Algunos bloques fallaron. Puede ser necesario ejecutar manualmente.')
    }
}

function obtenerDescripcion(block, index) {
    const m = block.match(/(?:TABLE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:PUBLIC\.)?(\w+)/i)
    if (m) return `${m[1]}`
    const m2 = block.match(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)/i)
    if (m2) return `ALTER: ${m2[1]}`
    const m3 = block.match(/CREATE\s+(INDEX|POLICY|FUNCTION)/i)
    if (m3) return `${m3[1]}`
    return `#${index}`
}

// También intentar crear exec_sql primero
async function crearExecSQL(supabaseClient) {
    const createFunc = `
    create or replace function exec_sql(query text)
    returns void
    security definer
    language plpgsql
    as $$
    begin
      execute query;
    end;
    $$;`

    try {
        const { error } = await supabaseClient.rpc('exec_sql', { query: 'SELECT 1' })
        if (error && error.message?.includes('function exec_sql')) {
            console.log('  ⚠️ exec_sql no existe. No se puede crear sin ella.')
            return false
        }
        return true
    } catch {
        return false
    }
}

// Verificar si exec_sql existe
const exists = await crearExecSQL(supabase)
if (!exists) {
    console.log('La función exec_sql() no existe en Supabase.')
    console.log('Ejecutando directamente...')
}

await main()
