import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const sup = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 1. Cuántos alimentos tienen calorias=0
const { count: zeroCount } = await sup.from('alimentos').select('*', { count: 'exact', head: true }).eq('calorias', 0)
console.log(`Alimentos con calorias=0: ${zeroCount}`)

// 2. Total alimentos
const { count: totalCount } = await sup.from('alimentos').select('*', { count: 'exact', head: true })
console.log(`Total alimentos: ${totalCount}`)
console.log(`Porcentaje: ${Math.round(zeroCount / totalCount * 100)}%`)

// 3. Top 50 alimentos con calorias=0 QUE se usan en recetas
const { data: usados } = await sup.from('receta_ingredientes').select('alimento_id')
console.log(`\nIngredientes en recetas: ${usados.length}`)

const usadoIds = [...new Set(usados.filter(i => i.alimento_id).map(i => i.alimento_id))]
console.log(`Alimentos distintos vinculados: ${usadoIds.length}`)

// 4. De esos, cuantos tienen calorias=0
let zeroUsados = 0
for (const id of usadoIds) {
    const { data: a } = await sup.from('alimentos').select('id,nombre,calorias').eq('id', id).single()
    if (a && a.calorias === 0) {
        zeroUsados++
        console.log(`  calorias=0 → ${a.nombre} (id: ${a.id})`)
    }
}
console.log(`\nDe los vinculados a recetas, ${zeroUsados} tienen calorias=0`)
