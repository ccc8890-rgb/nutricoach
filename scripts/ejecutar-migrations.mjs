/**
 * Script para ejecutar migraciones SQL directamente en PostgreSQL de Supabase.
 * 
 * USO: node scripts/ejecutar-migrations.mjs
 *
 * Requiere: npm install pg
 * La contraseña se obtiene de .env.local como DB_PASSWORD o se pasa como variable de entorno
 */
import pg from 'pg'
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

// Priorizar process.env (CLI) sobre .env.local
// Usar pooler de Supabase (puerto 6543 con SSL)
const DB_HOST = process.env.DB_HOST || env.DB_HOST || 'aws-0-eu-west-1.pooler.supabase.com'
const DB_PORT = parseInt(process.env.DB_PORT || env.DB_PORT || '6543', 10)
const DB_NAME = process.env.DB_NAME || env.DB_NAME || 'postgres'
// user format: postgres.<project_ref> (ver Connection String en Supabase Dashboard > Settings > Database)
const DB_USER = process.env.DB_USER || env.DB_USER || 'postgres.hopeqzwzmlrpktoeygxz'
const DB_PASSWORD = process.env.DB_PASSWORD || env.DB_PASSWORD || ''

if (!DB_PASSWORD) {
    console.error('❌ No se encontró DB_PASSWORD. Pásala como: DB_PASSWORD=... node scripts/ejecutar-migrations.mjs')
    process.exit(1)
}

const pool = new pg.Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
})

async function ejecutarSQL(sql, descripcion) {
    const client = await pool.connect()
    try {
        console.log(`📤 ${descripcion}...`)
        const result = await client.query(sql)
        console.log(`✅ ${descripcion}: ${result.rowCount ?? 0} filas afectadas`)
        return true
    } catch (err) {
        console.error(`❌ ${descripcion}: ${err.message}`)
        return false
    } finally {
        client.release()
    }
}

async function main() {
    console.log('='.repeat(60))
    console.log('🧩 Migraciones SQL - NutriCoach')
    console.log('='.repeat(60))
    console.log(`📌 Conectando a ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`)

    try {
        // Test connection
        const client = await pool.connect()
        const { rows } = await client.query('SELECT version()')
        console.log(`📌 PostgreSQL: ${rows[0].version.split(',')[0]}`)
        client.release()
    } catch (err) {
        console.error(`❌ Error de conexión: ${err.message}`)
        console.log('\n💡 Sugerencia: Revisa las credenciales en Supabase Dashboard →')
        console.log('   Project Settings → Database → Connection string')
        await pool.end()
        process.exit(1)
    }

    console.log('')

    // 1. Migración: descripcion_porcion
    const sql1 = `ALTER TABLE public.recetas ADD COLUMN IF NOT EXISTS descripcion_porcion text;`
    await ejecutarSQL(sql1, 'Migración 1: ADD COLUMN descripcion_porcion')

    // 2. Activar recetas legacy
    const sql2 = `UPDATE public.recetas SET estado = 'aprobada' WHERE estado IS NULL;`
    await ejecutarSQL(sql2, 'Migración 2: UPDATE estado recetas legacy')

    console.log('\n' + '='.repeat(60))
    console.log('✅ Migraciones completadas')

    await pool.end()
}

main().catch(err => {
    console.error('Error fatal:', err)
    pool.end()
    process.exit(1)
})
