// Quita la marca «base» (es_base) a productos de marca o elaborados de fuente IA / Open Food Facts que se colaron por haberse usado alguna vez.
// No toca enlaces de recetas ni borra nada: solo deja de ofrecerlos primero en el buscador de alimentos (siguen en «Ver más opciones» y en precios/compra).
//   npx tsx scripts/quitar-base-productos-elaborados.ts            → lista
//   npx tsx scripts/quitar-base-productos-elaborados.ts --aplica   → copia en salidas/ y quita la marca
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APLICA = process.argv.includes('--aplica')
const ELABORADO = /\b(rellen\w*|sobres?|3 en 1|tarrit\w*|cachit\w*|gourmet|listos?|ultracongelad\w*|helad\w*|cuadradit\w*|lingote|macerad\w*|pastillas?|salteado|guisad\w*|campero|docena|hacendado|carrefour|mercadona|rodolfo|maredeus|lodosa|pack|botella|bandeja|brik|brick|pascua|chips ahoy|krispies|tamburinas|magdalenas?|barritas?|tex-mex|disquitos|con (chocolate|avellanas|mango|cebolla|soja|chips|pepitas)|tex-mex)\b/i

async function main() {
  const todos: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await db.from('alimentos').select('id, nombre, fuente, categoria').eq('es_base', true).in('fuente', ['ia', 'openfoodfacts']).range(f, f + 999)
    todos.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const quitar = todos.filter(a => ELABORADO.test(a.nombre))
  quitar.forEach(a => console.log(`${a.fuente.padEnd(13)} ${a.nombre}`))
  console.log(`${quitar.length} de ${todos.length} base de IA/OFF`)
  if (!APLICA) return
  writeFileSync(join(__dirname, '..', 'salidas', '01-11-2026_BACKUP-quitar-base-elaborados.json'), JSON.stringify(quitar.map(a => a.id)))
  for (let i = 0; i < quitar.length; i += 100) await db.from('alimentos').update({ es_base: false }).in('id', quitar.slice(i, i + 100).map(a => a.id))
  console.log('hecho')
}
main().catch(e => { console.error(e); process.exit(1) })
