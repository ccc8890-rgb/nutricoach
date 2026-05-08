/**
 * Script para migrar recetas del esquema antiguo al nuevo.
 *
 * PASO 1: Ejecuta supabase_migrar_recetas.sql en Supabase (vía /sql endpoint)
 * PASO 2: Llama a POST /api/recetas/migrar para migrar ingredientes y calcular macros
 *
 * USO: node scripts/migrar-recetas.mjs
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
const NEXT_PUBLIC_SITE_URL = env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Faltan SUPABASE_URL o SERVICE_KEY en .env.local')
    process.exit(1)
}

console.log('📌 Supabase URL:', SUPABASE_URL)
console.log('📌 Site URL:', NEXT_PUBLIC_SITE_URL)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
})

// ============================================================
// PASO 1: Ejecutar SQL
// ============================================================
async function paso1EjecutarSQL() {
    console.log('\n' + '='.repeat(60))
    console.log('📦 PASO 1: Ejecutar SQL de migración en Supabase')
    console.log('='.repeat(60))

    const sqlFile = resolve(projectRoot, 'supabase_migrar_recetas.sql')
    const sql = readFileSync(sqlFile, 'utf-8')
    console.log(`📄 SQL: ${sql.length} caracteres\n`)

    // Estrategia: enviar el SQL completo al endpoint /sql de Supabase
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
            if (text) console.log('Respuesta:', text.substring(0, 200))
            return true
        } else {
            console.error(`❌ Error ${response.status}: ${text.substring(0, 200)}`)
            // Fallback: ejecutar bloque por bloque
            return await ejecutarPorBloques(sql)
        }
    } catch (err) {
        console.error('❌ Error de conexión:', err.message)
        return await ejecutarPorBloques(sql)
    }
}

async function ejecutarPorBloques(sql) {
    console.log('\n🔄 Fallback: ejecutando bloque por bloque...')

    const blocks = sql
        .replace(/--.*$/gm, '') // eliminar comentarios de línea
        .split(';')
        .map(b => b.trim())
        .filter(b => b.length > 0 && b !== '$$' && !b.startsWith('--'))

    let ok = 0, fail = 0

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i] + ';'
        const desc = obtenerDescripcion(block, i + 1)

        process.stdout.write(`  ${desc.padEnd(40)} `)

        try {
            // Intentar con rpc('exec_sql', ...)
            const { error } = await supabase.rpc('exec_sql', { query: block })

            if (!error) {
                console.log('✅')
                ok++
            } else {
                // Errores tolerables
                const msg = error.message || ''
                if (msg.includes('already exists') ||
                    msg.includes('duplicate') ||
                    error.code === '42710' ||
                    error.code === '42P07') {
                    console.log('⚠️ (ya existe)')
                    ok++
                } else if (msg.includes('function exec_sql')) {
                    console.log('❌ exec_sql no disponible')
                    return false
                } else {
                    console.log(`❌ ${msg.substring(0, 80)}`)
                    fail++
                }
            }
        } catch (err) {
            console.log(`❌ ${err.message?.substring(0, 80)}`)
            fail++
        }
    }

    console.log(`\n📊 Resultado SQL: ${ok} OK, ${fail} errores`)
    return fail === 0
}

function obtenerDescripcion(block, index) {
    // Extraer el tipo de operación
    const m = block.match(/^\s*(CREATE|ALTER|DROP|UPDATE|INSERT|DELETE)\s+/i)
    const obj = block.match(/(?:TABLE|INDEX|POLICY|COLUMN|FUNCTION)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/i)
    if (m && obj) return `${m[1]} ${obj[1]}`
    if (m) return `${m[1]} #${index}`
    const d = block.match(/do\s+\$\$/i)
    if (d) return `DO block #${index}`
    return `#${index}`
}

// ============================================================
// PASO 2: Llamar a la API de migración
// ============================================================
async function paso2EjecutarAPI() {
    console.log('\n' + '='.repeat(60))
    console.log('📦 PASO 2: Ejecutar API de migración')
    console.log('='.repeat(60))

    // Primero intentamos localhost:3000 (dev), sino la URL configurada
    const urls = ['http://localhost:3000', NEXT_PUBLIC_SITE_URL]
    let lastError = null

    for (const baseUrl of urls) {
        const url = `${baseUrl.replace(/\/$/, '')}/api/recetas/migrar`
        process.stdout.write(`  Intentando ${url}... `)

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            const data = await response.json()

            if (response.ok) {
                console.log('✅')
                console.log(`  Mensaje: ${data.message}`)
                if (data.results?.length) {
                    console.log(`  Resultados (${data.results.length}):`)
                    data.results.slice(0, 20).forEach(r => console.log(`    - ${r}`))
                }
                if (data.errors?.length) {
                    console.log(`  ⚠️ Errores (${data.errors.length}):`)
                    data.errors.slice(0, 10).forEach(e => console.log(`    ❌ ${e}`))
                }
                if (data.needsSqlMigration) {
                    console.log(`\n⚠️ La API indica que necesita migración SQL primero.`)
                    console.log(`   ${data.message}`)
                }
                return true
            } else {
                console.log(`❌ ${response.status}: ${data.message || 'error'}`)
                lastError = data
            }
        } catch (err) {
            console.log(`❌ ${err.message}`)
            lastError = err
        }
    }

    console.log(`\n⚠️ No se pudo conectar a la API de migración.`)
    if (lastError) {
        console.log(`   Último error: ${lastError.message || JSON.stringify(lastError)}`)
    }
    console.log(`\n📋 Alternativa: ejecuta manualmente:`)
    console.log(`   curl -X POST http://localhost:3000/api/recetas/migrar`)
    return false
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('🚀 INICIANDO MIGRACIÓN DE RECETAS\n')
    console.log(`Fecha: ${new Date().toISOString()}`)
    console.log(`Directorio: ${projectRoot}`)

    const sqlOk = await paso1EjecutarSQL()

    if (sqlOk) {
        console.log('\n✅ SQL ejecutado. Pequeña pausa antes de la API...')
        // Pequeña pausa para que la base de datos procese los cambios
        await new Promise(r => setTimeout(r, 2000))
    } else {
        console.log('\n⚠️ Hubo errores en el SQL. Continuamos con la API igualmente...')
    }

    await paso2EjecutarAPI()

    console.log('\n' + '='.repeat(60))
    console.log('📋 RESUMEN')
    console.log('='.repeat(60))
    console.log('✅ SQL migration:', sqlOk ? 'Ejecutado' : 'Falló parcialmente')
    console.log('')
    console.log('📌 PRÓXIMOS PASOS:')
    console.log('  1. Abre la app y verifica las recetas: http://localhost:3000/recetas')
    console.log('  2. Comprueba que se muestran:')
    console.log('     - ✅ Ingredientes con cantidades y macros por ingrediente')
    console.log('     - ✅ Elaboración (instrucciones/pasos)')
    console.log('     - ✅ Categoría del plato')
    console.log('     - ✅ Macros totales por porción calculados correctamente')
    console.log('  3. Si ves datos del esquema antiguo, refresca la página')
    console.log('')
    console.log('❓ Si la API no pudo ejecutarse, prueba manualmente:')
    console.log('   curl -X POST http://localhost:3000/api/recetas/migrar')
}

main().catch(err => {
    console.error('Error general:', err)
    process.exit(1)
})
