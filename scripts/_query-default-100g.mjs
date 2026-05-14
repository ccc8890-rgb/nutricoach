import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const sup = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 1. Recetas con TODOS los ingredientes a 100g
const { data: recetas } = await sup.from('recetas').select('id,nombre,porciones,peso_total_g').not('nombre', 'is', null)
console.log('=== RECETAS DONDE TODOS LOS INGREDIENTES TIENEN cantidad_gramos = 100 ===')
for (const receta of recetas) {
    const { data: ings } = await sup.from('receta_ingredientes').select('id,cantidad_gramos').eq('receta_id', receta.id)
    if (ings && ings.length > 0 && ings.every(i => i.cantidad_gramos === 100)) {
        console.log(`  ${receta.nombre} | ${ings.length} ingredientes | porciones: ${receta.porciones} | peso: ${receta.peso_total_g}`)
    }
}
