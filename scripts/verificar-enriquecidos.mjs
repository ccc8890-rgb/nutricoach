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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// 1. Últimos completados en la cola
const { data: cola, error: err1 } = await supabase
    .from('alimentos_enriquecimiento_cola')
    .select('alimento_id, nombre_original, estado, updated_at, resultado_json')
    .eq('estado', 'completado')
    .order('updated_at', { ascending: false })
    .limit(10)

if (err1) { console.error('Error cola:', err1); process.exit(1) }

console.log('\n=== ÚLTIMOS ENRIQUECIDOS (cola) ===')
for (const r of cola) {
    console.log('  ' + r.nombre_original)
    console.log('    Estado: ' + r.estado + ' | Actualizado: ' + (r.updated_at || '?'))
    if (r.resultado_json) {
        const res = typeof r.resultado_json === 'string' ? JSON.parse(r.resultado_json) : r.resultado_json
        console.log('    Calorías: ' + res.calorias + ', P: ' + res.proteinas + ', HC: ' + res.carbohidratos + ', G: ' + res.grasas)
    }
}
console.log('Total completados en cola: ' + cola.length)

// 2. Verificar alimentos específicos (aceites)
const names = [
    'Aceite de coco',
    'Aceite de girasol',
    'Aceite de oliva 0,4º',
    'Aceite de oliva virgen extra Picual Casa Juncal',
    'Almendra frita y salada Hacendado pelada',
    'Aceite de coco virgen',
    'Aceite de girasol refinado 0,2º',
]

const { data: alimentos, error: err2 } = await supabase
    .from('alimentos')
    .select('id, nombre, categoria, calorias, proteinas, carbohidratos, grasas')
    .in('nombre', names)
    .order('nombre')

if (err2) { console.error('Error alimentos:', err2) }
else {
    console.log('\n=== ALIMENTOS VERIFICADOS ===')
    for (const a of alimentos) {
        console.log('  ' + a.nombre)
        console.log('    Cat: ' + (a.categoria || 'sin cat') + ' | Cal: ' + a.calorias + ' | P: ' + a.proteinas + ' | HC: ' + a.carbohidratos + ' | G: ' + a.grasas)
    }
}

// 3. Estadísticas
const { count: pendientes } = await supabase
    .from('alimentos_pendientes_enriquecer')
    .select('*', { count: 'exact', head: true })

const { count: completados } = await supabase
    .from('alimentos_enriquecimiento_cola')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'completado')

console.log('\n=== ESTADÍSTICAS ===')
console.log('  Pendientes (view): ' + (pendientes ?? '?'))
console.log('  Completados totales: ' + (completados ?? '?'))
