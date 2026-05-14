/**
 * Ejecuta supabase_fix_trigger_recetas.sql en Supabase
 * usando la service_role_key via endpoint /sql
 *
 * USO: node scripts/exec-sql-fix.mjs
 */
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

console.log('🔧 Fix Trigger + Delete Duplicado')
console.log('='.repeat(50))
console.log('📌 Supabase URL:', SUPABASE_URL)

// Leer SQL
const sqlFile = resolve(projectRoot, 'supabase_fix_trigger_recetas.sql')
const sql = readFileSync(sqlFile, 'utf-8')
console.log(`📄 SQL: ${sql.length} caracteres`)
console.log('')

// Dividir en bloques para mejor feedback
const blocks = sql
    .split(';')
    .map(b => b.trim())
    .filter(b => b.length > 0 && !b.startsWith('--'))

async function ejecutarBloque(sqlBlock, descripcion) {
    try {
        const response = await fetch(`${SUPABASE_URL}/sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({ query: sqlBlock + ';' }),
        })

        const text = await response.text()

        if (response.ok) {
            console.log(`  ✅ ${descripcion}`)
            return true
        } else {
            // Si es "already exists", lo damos por bueno
            if (text.includes('already exists') || text.includes('duplicate')) {
                console.log(`  ⚠️ ${descripcion} (ya existe)`)
                return true
            }
            console.log(`  ❌ ${descripcion}: ${text.substring(0, 200)}`)
            return false
        }
    } catch (err) {
        console.log(`  ❌ ${descripcion}: ${err.message}`)
        return false
    }
}

async function main() {
    let ok = 0
    let fail = 0

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]
        // Extraer descripción del bloque
        let desc = `#${i + 1}`
        const m = block.match(/(?:CREATE OR REPLACE FUNCTION|DELETE FROM|DROP FUNCTION)\s+(?:IF\s+EXISTS\s+)?(?:PUBLIC\.)?(\w+)/i)
        if (m) desc = `${m[1]}`
        else if (block.includes('CREATE OR REPLACE FUNCTION')) desc = 'FUNCTION'
        else if (block.includes('DELETE FROM')) desc = 'DELETE'

        const result = await ejecutarBloque(block, desc)
        if (result) ok++
        else fail++
    }

    console.log('')
    console.log('='.repeat(50))
    console.log(`📊 Resultado: ${ok} OK, ${fail} errores`)

    if (fail > 0) {
        console.log('⚠️  Algunos bloques fallaron. Revisa manualmente.')
        process.exit(1)
    } else {
        console.log('✅ Fix completado correctamente')
    }
}

main().catch(err => {
    console.error('Error fatal:', err)
    process.exit(1)
})
