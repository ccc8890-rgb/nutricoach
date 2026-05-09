/**
 * Script para ejecutar supabase_enriquecimiento_nutricional.sql en Supabase
 * usando la service_role_key.
 * 
 * USO: node scripts/ejecutar-enriquecimiento.mjs
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

console.log('📌 Supabase URL:', SUPABASE_URL)

// Leer SQL
const sqlFile = resolve(projectRoot, 'supabase_enriquecimiento_nutricional.sql')
const sql = readFileSync(sqlFile, 'utf-8')
console.log(`\n📄 SQL: ${sql.length} caracteres\n`)

async function main() {
    console.log('📤 Ejecutando SQL de enriquecimiento nutricional...\n')

    // Dividir SQL en statements individuales (por ;)
    // Pero respetar bloques $$ (funciones) que contienen ;
    const blocks = dividirSQL(sql)

    let ok = 0, fail = 0

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i].trim()
        if (!block || block.startsWith('--')) continue

        const desc = obtenerDescripcion(block, i + 1)
        process.stdout.write(`  ${String(i + 1).padStart(2, ' ')}. ${desc.padEnd(45)} `)

        try {
            // Usar endpoint /sql de Supabase (disponible con service_role)
            const response = await fetch(`${SUPABASE_URL}/sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ query: block }),
            })

            if (response.ok || response.status === 204) {
                console.log('✅')
                ok++
            } else {
                const text = await response.text()
                // Ignorar "already exists" como warning
                if (text.includes('already exists') || text.includes('duplicate') ||
                    text.includes('42710') || text.includes('42P07') ||
                    text.includes('28P01')) {
                    console.log('⚠️  (ya existe)')
                    ok++
                } else {
                    console.log(`❌ ${text.substring(0, 80)}`)
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
        console.log('\n⚠️  Algunos bloques fallaron. Revisa los errores arriba.')
        console.log('   Puedes ejecutar el SQL manualmente en el SQL Editor de Supabase:')
        console.log('   https://supabase.com/dashboard/project/hopeqzwzmlrpktoeygxz/sql/new')
    } else {
        console.log('\n✅ Migración de enriquecimiento nutricional completada.')
    }
}

function dividirSQL(sql) {
    const blocks = []
    let current = ''
    let inDollar = false
    let dollarTag = ''

    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i]
        const next2 = sql.substring(i, i + 2)

        if (!inDollar && next2 === '$$') {
            inDollar = true
            dollarTag = '$$'
            current += '$$'
            i++
            continue
        }

        if (inDollar && dollarTag === '$$' && next2 === '$$') {
            // Check if it's the closing $$
            inDollar = false
            dollarTag = ''
            current += '$$'
            i++
            continue
        }

        // Handle $tag$ style dollar quoting
        if (!inDollar && ch === '$') {
            let j = i + 1
            let tag = '$'
            while (j < sql.length && sql[j] !== '$') {
                tag += sql[j]
                j++
            }
            if (j < sql.length && sql[j] === '$') {
                tag += '$'
                if (tag.length > 2) {
                    inDollar = true
                    dollarTag = tag
                    current += tag
                    i = j
                    continue
                }
            }
        }

        if (inDollar && dollarTag.startsWith('$') && dollarTag.endsWith('$') && dollarTag.length > 2) {
            const closing = dollarTag
            if (sql.substring(i, i + closing.length) === closing) {
                inDollar = false
                current += closing
                i += closing.length - 1
                continue
            }
        }

        if (!inDollar && ch === ';') {
            blocks.push(current)
            current = ''
            continue
        }

        current += ch
    }

    if (current.trim()) blocks.push(current)

    return blocks
}

function obtenerDescripcion(block, index) {
    const withoutNewlines = block.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

    const m = block.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:PUBLIC\.)?(\w+)/i)
    if (m) return `TABLE: ${m[1]}`

    const m2 = block.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:PUBLIC\.)?(\w+)/i)
    if (m2) return `FUNCTION: ${m2[1]}`

    const m3 = block.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:PUBLIC\.)?(\w+)/i)
    if (m3) return `INDEX: ${m3[2]}`

    const m4 = block.match(/INSERT\s+INTO\s+(?:PUBLIC\.)?(\w+)/i)
    if (m4) return `INSERT: ${m4[1]}`

    const m5 = block.match(/ALTER\s+TABLE\s+(?:PUBLIC\.)?(\w+)/i)
    if (m5) return `ALTER: ${m5[1]}`

    const m6 = block.match(/CREATE\s+(MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:PUBLIC\.)?(\w+)/i)
    if (m6) return `VIEW: ${m6[2]}`

    return `#${index}: ${withoutNewlines.substring(0, 50)}...`
}

main().catch(err => {
    console.error('❌ Error fatal:', err)
    process.exit(1)
})
