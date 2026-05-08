/**
 * Limpiar duplicados creados por el restore.
 * 
 * El primer seed (seed_alimentos.sql) ya tenía algunos alimentos que
 * también estaban en seed_alimentos_extra.sql (el restore).
 * Ahora tenemos duplicados: mismo nombre, diferente created_at.
 * 
 * Estrategia: mantener el que tenga el created_at más reciente (el restore
 * con categorías correctas), eliminar el anterior.
 * 
 * USO: node scripts/limpiar-duplicados-restore.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
})

console.log('=== LIMPIAR DUPLICADOS POST-RESTORE ===\n')

// Obtener todos los alimentos
const { data: todos } = await supabase
    .from('alimentos')
    .select('id, nombre, categoria, created_at')
    .order('nombre')

if (!todos) {
    console.error('No se pudieron obtener alimentos')
    process.exit(1)
}

console.log(`Total en BD: ${todos.length}\n`)

// Agrupar por nombre (normalizado)
const grupos = {}
for (const a of todos) {
    const key = a.nombre.toLowerCase().trim()
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(a)
}

// Identificar duplicados
let totalEliminados = 0
for (const [key, items] of Object.entries(grupos)) {
    if (items.length <= 1) continue

    // Ordenar por created_at descendente (más reciente primero)
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Mantener el más reciente, eliminar los demás
    const mantener = items[0]
    const eliminar = items.slice(1)

    console.log(`"${mantener.nombre}" (${mantener.categoria}, ${mantener.created_at?.substring(0, 10)}) → mantener`)
    for (const e of eliminar) {
        console.log(`  └─ 🗑️ Eliminar: id=${e.id} "${e.nombre}" (${e.categoria}, ${e.created_at?.substring(0, 10)})`)
        const { error } = await supabase
            .from('alimentos')
            .delete()
            .eq('id', e.id)
        if (error) {
            console.log(`     ❌ Error: ${error.message.substring(0, 60)}`)
        } else {
            totalEliminados++
        }
    }
}

console.log(`\nTotal duplicados eliminados: ${totalEliminados}`)

// Verificar el nuevo total
const { count } = await supabase
    .from('alimentos')
    .select('*', { count: 'exact', head: true })
console.log(`Total final en BD: ${count}`)
