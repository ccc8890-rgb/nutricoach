import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const sup = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: r } = await sup.from('recetas').select('id,nombre,kcal,proteinas,carbohidratos,grasas,porciones,peso_total_g').ilike('nombre', '%pan plano%').single()
console.log('RECETA:', r.nombre)
console.log('  kcal:', r.kcal, '| P:', r.proteinas, '| C:', r.carbohidratos, '| G:', r.grasas, '| porciones:', r.porciones, '| peso:', r.peso_total_g)

const { data: ings } = await sup.from('receta_ingredientes').select('id,nombre_libre,cantidad_gramos,alimento_id,orden').eq('receta_id', r.id).order('orden')

for (const ing of ings) {
    let a = null
    if (ing.alimento_id) {
        const { data: aa } = await sup.from('alimentos').select('id,nombre,calorias,proteinas,carbohidratos,grasas').eq('id', ing.alimento_id).single()
        a = aa
    }
    const alimInfo = a ? `=> ${a.nombre} (kcal:${a.calorias} P:${a.proteinas} C:${a.carbohidratos} G:${a.grasas})` : '=> SIN ALIMENTO VINCULADO'
    console.log(`  ${ing.orden}. ${ing.nombre_libre} | ${ing.cantidad_gramos}g | ${alimInfo}`)
}
