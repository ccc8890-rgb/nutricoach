// Solo lectura: ingredientes que figuran en la lista de una receta aprobada pero que sus pasos nunca mencionan
// (señal de ingrediente inventado/colado). Agrupa por ingrediente para ver los patrones sistemáticos.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'en', 'al', 'y', 'o', 'para', 'natural', 'fresco', 'fresca', 'fresh', 'polvo', 'molido', 'molida', 'troceado', 'picado', 'cocido', 'cocida', 'crudo', 'entero', 'entera', 'grande', 'mediano', 'mediana', 'pequeno', 'extra', 'virgen', 'light', 'desnatado', 'desnatada', 'semidesnatado', 'integral', 'blanco', 'blanca', 'negro', 'negra', 'rojo', 'roja', 'verde', 'seco', 'seca', 'liquido', 'liquida', 'cucharada', 'cucharadita', 'unidad', 'pieza', 'diente', 'dientes', 'hoja', 'hojas', 'rama', 'ramas'])
// Ingredientes que se usan sin que los pasos los nombren: no son señal
const IGNORAR = /^(sal|pimienta|agua|hielo|aceite|aove|spray|edulcorante|stevia)\b/

function tokens(nombre: string) {
  return norm(nombre).replace(/\(.*?\)/g, ' ').split(/[^a-z0-9ñ]+/).filter(t => t.length > 3 && !VACIAS.has(t)).map(t => t.slice(0, 5))
}

async function todo<T>(tabla: string, select: string, filtro: (q: any) => any): Promise<T[]> {
  const out: T[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await filtro(db.from(tabla).select(select)).range(f, f + 999)
    if (error) throw error
    out.push(...(data as T[]))
    if ((data ?? []).length < 1000) break
  }
  return out
}

async function main() {
  const recetas = await todo<{ id: string; nombre: string; instrucciones: string | null; url_origen: string | null }>('recetas', 'id, nombre, instrucciones, url_origen', q => q.eq('estado', 'aprobada'))
  const ings = await todo<{ receta_id: string; nombre_libre: string | null; cantidad_gramos: number }>('receta_ingredientes', 'receta_id, nombre_libre, cantidad_gramos', q => q)
  const porReceta = new Map<string, typeof ings>()
  for (const i of ings) porReceta.set(i.receta_id, [...(porReceta.get(i.receta_id) ?? []), i])

  const hallazgos: { receta: string; receta_id: string; url: string | null; ingrediente: string; gramos: number }[] = []
  for (const r of recetas) {
    const texto = norm(`${r.instrucciones ?? ''}`)
    if (texto.length < 80) continue // sin pasos suficientes no se puede juzgar
    for (const i of porReceta.get(r.id) ?? []) {
      const nombre = i.nombre_libre ?? ''
      if (!nombre || IGNORAR.test(norm(nombre))) continue
      const t = tokens(nombre)
      if (t.length === 0) continue
      if (!t.some(x => texto.includes(x))) hallazgos.push({ receta: r.nombre, receta_id: r.id, url: r.url_origen, ingrediente: nombre, gramos: i.cantidad_gramos })
    }
  }
  const porIng = new Map<string, number>()
  for (const h of hallazgos) { const k = norm(h.ingrediente).replace(/\s+/g, ' ').trim(); porIng.set(k, (porIng.get(k) ?? 0) + 1) }
  console.log(`Recetas aprobadas: ${recetas.length} · ingredientes que los pasos nunca nombran: ${hallazgos.length} en ${new Set(hallazgos.map(h => h.receta_id)).size} recetas\n`)
  console.log('Ingredientes más repetidos (posibles añadidos sistemáticos):')
  for (const [k, n] of [...porIng.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${String(n).padStart(3)} × ${k}`)
  writeFileSync(join(__dirname, '..', 'salidas', 'auditoria-ingredientes-fantasma-2026-10-01.json'), JSON.stringify(hallazgos, null, 1))
}
main().catch(e => { console.error(e); process.exit(1) })
