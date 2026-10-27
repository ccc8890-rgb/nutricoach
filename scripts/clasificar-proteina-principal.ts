// Calcula recetas.proteinas_principales desde los ingredientes de cada receta. Uso: npx tsx scripts/clasificar-proteina-principal.ts [--apply]
// Simula por defecto; con --apply escribe solo las que cambian. Idempotente (va en la pasada de 6 h).
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { proteinasPrincipales } from '../lib/recetas/proteina-principal'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const apply = process.argv.includes('--apply')

async function paginar<T>(consulta: (desde: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  let todo: T[] = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await consulta(i)
    if (error) throw error
    todo = todo.concat(data ?? []); if (!data || data.length < 1000) break
  }
  return todo
}

async function main() {
  const recetas = await paginar<{ id: string; nombre: string; proteinas_principales: string[] | null }>(i => sb.from('recetas').select('id, nombre, proteinas_principales').neq('estado', 'descartada').range(i, i + 999))
  const ings = await paginar<{ receta_id: string; cantidad_gramos: number | null; nombre_libre: string | null; alimento: { nombre: string } | { nombre: string }[] | null }>(i =>
    sb.from('receta_ingredientes').select('receta_id, cantidad_gramos, nombre_libre, alimento:alimentos(nombre)').range(i, i + 999))
  const porReceta = new Map<string, { nombre: string; gramos: number }[]>()
  for (const x of ings) {
    const al = Array.isArray(x.alimento) ? x.alimento[0] : x.alimento
    const lista = porReceta.get(x.receta_id) ?? []
    lista.push({ nombre: al?.nombre ?? x.nombre_libre ?? '', gramos: x.cantidad_gramos ?? 0 })
    porReceta.set(x.receta_id, lista)
  }
  const cambios = recetas.map(r => ({ r, nuevo: proteinasPrincipales(porReceta.get(r.id) ?? [], r.nombre) }))
    .filter(({ r, nuevo }) => [...(r.proteinas_principales ?? [])].sort().join() !== [...nuevo].sort().join())
  const cuenta: Record<string, number> = {}
  for (const { nuevo } of cambios) for (const k of nuevo) cuenta[k] = (cuenta[k] ?? 0) + 1
  console.log(`Recetas: ${recetas.length} · cambian: ${cambios.length}`, cuenta)
  if (!apply) { console.log('Simulación: usa --apply para escribir'); return }
  let hechas = 0
  for (const { r, nuevo } of cambios) {
    const { error } = await sb.from('recetas').update({ proteinas_principales: nuevo }).eq('id', r.id)
    if (error) console.error('Error en', r.nombre, error.message); else hechas++
  }
  console.log(`Aplicado: ${hechas}`)
}
main().catch(e => { console.error(e); process.exit(1) })
