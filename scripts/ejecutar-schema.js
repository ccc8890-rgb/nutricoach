/**
 * Script para ejecutar el SQL de tablas faltantes en Supabase
 * usando la Management API (requiere token de acceso).
 *
 * USO:
 *   node scripts/ejecutar-schema.js <SUPABASE_ACCESS_TOKEN>
 *
 * Obtén tu token en: https://supabase.com/dashboard/account/tokens
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const PROJECT_REF = 'hopeqzwzmlrpktoeygxz'
const SQL_FILE = path.resolve(__dirname, '..', 'supabase_fix_tablas_faltantes.sql')

async function main() {
    const token = process.argv[2]
    if (!token) {
        console.error('❌ Uso: node scripts/ejecutar-schema.js <SUPABASE_ACCESS_TOKEN>')
        console.error('')
        console.error('Paso 1: Obtén tu token en https://supabase.com/dashboard/account/tokens')
        console.error('Paso 2: Ejecuta:')
        console.error('  node scripts/ejecutar-schema.js "tu-token-aqui"')
        process.exit(1)
    }

    const sql = fs.readFileSync(SQL_FILE, 'utf-8')
    console.log(`📄 SQL file: ${SQL_FILE} (${sql.length} chars)`)

    // Usar fetch (Node 18+)
    const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

    console.log(`🔗 Conectando a Supabase Management API...`)
    console.log(`   POST ${url}`)

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
    })

    const body = await response.text()

    if (response.ok) {
        console.log(`✅ SQL ejecutado correctamente (${response.status})`)
        if (body) console.log(`Respuesta: ${body.substring(0, 500)}`)
    } else {
        console.error(`❌ Error ${response.status}:`)
        console.error(body.substring(0, 1000))
        process.exit(1)
    }
}

main()
