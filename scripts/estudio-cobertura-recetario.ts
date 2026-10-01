// Solo lectura: mapa de cobertura del recetario aprobado por franja, dieta y perfil nutricional.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

type Receta = {
  nombre: string; tipo_plato: string | null; kcal: number; proteinas: number; carbohidratos: number; grasas: number
  intolerancias: string[] | null; imagen_url: string | null; apto_rendimiento: boolean | null; es_post_entreno: boolean | null
}

const pctP = (r: Receta) => (r.kcal > 0 ? (r.proteinas * 4) / r.kcal : 0)
const pctC = (r: Receta) => (r.kcal > 0 ? (r.carbohidratos * 4) / r.kcal : 0)
const pctG = (r: Receta) => (r.kcal > 0 ? (r.grasas * 9) / r.kcal : 0)
const tiene = (r: Receta, tag: string) => (r.intolerancias ?? []).some(t => t.toLowerCase() === tag.toLowerCase())

const filtros: Record<string, (r: Receta) => boolean> = {
  'Total': () => true,
  'Vegano': r => tiene(r, 'Vegano'),
  'Vegetariano': r => tiene(r, 'Vegetariano') || tiene(r, 'Vegano'),
  'Sin gluten': r => tiene(r, 'Sin Gluten'),
  'Sin lactosa': r => tiene(r, 'Sin Lactosa'),
  'Alta prot (≥30% kcal)': r => pctP(r) >= 0.30,
  'Baja grasa (≤25%)': r => pctG(r) <= 0.25,
  'Alto HC (≥50%)': r => pctC(r) >= 0.50,
  'Pérdida grasa*': r => pctP(r) >= 0.30 && pctG(r) <= 0.35,
  'Rendimiento*': r => pctC(r) >= 0.45 && r.proteinas >= 20,
  'Vegano + alta prot': r => tiene(r, 'Vegano') && pctP(r) >= 0.25,
  'Sin foto': r => !r.imagen_url,
}

async function main() {
  const recetas: Receta[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('recetas')
      .select('nombre, tipo_plato, kcal, proteinas, carbohidratos, grasas, intolerancias, imagen_url, apto_rendimiento, es_post_entreno')
      .eq('estado', 'aprobada').range(from, from + 999)
    if (error) throw error
    recetas.push(...(data as Receta[]))
    if (data.length < 1000) break
  }

  const franjas = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre']
  const grupo = (r: Receta) => (franjas.includes(r.tipo_plato ?? '') ? r.tipo_plato! : 'Otros')
  const columnas = [...franjas, 'Otros']

  console.log(`Recetas aprobadas: ${recetas.length}\n`)
  console.log(['Filtro'.padEnd(24), ...columnas.map(c => c.slice(0, 8).padStart(9))].join(''))
  for (const [nombre, f] of Object.entries(filtros)) {
    const fila = columnas.map(c => String(recetas.filter(r => grupo(r) === c && f(r)).length).padStart(9))
    console.log([nombre.padEnd(24), ...fila].join(''))
  }

  console.log('\nRango kcal por ración (Comida + Cena):')
  const principales = recetas.filter(r => r.tipo_plato === 'Comida' || r.tipo_plato === 'Cena')
  for (const [a, b] of [[0, 300], [300, 450], [450, 600], [600, 800], [800, 9999]]) {
    console.log(`  ${a}-${b === 9999 ? '+' : b} kcal: ${principales.filter(r => r.kcal >= a && r.kcal < b).length}`)
  }

  console.log('\nFlags de la BD: apto_rendimiento', recetas.filter(r => r.apto_rendimiento).length,
    '· es_post_entreno', recetas.filter(r => r.es_post_entreno).length)
}

main().catch(e => { console.error(e); process.exit(1) })
