import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const { data } = await db.from('recetas').select('id, nombre, created_at').eq('estado', 'en_revision').order('nombre')
  console.log('Total en_revision:', data?.length)

  const grupos = new Map<string, Array<{id: string, created_at: string}>>()
  for (const r of data ?? []) {
    const arr = grupos.get(r.nombre) ?? []
    arr.push({ id: r.id, created_at: r.created_at })
    grupos.set(r.nombre, arr)
  }

  const conDupes = [...grupos.entries()].filter(([, items]) => items.length > 1)
  console.log('Grupos con duplicados:', conDupes.length)

  let borrados = 0
  for (const [nombre, items] of conDupes) {
    // Ordenar por created_at desc — mantener el más reciente
    items.sort((a, b) => b.created_at.localeCompare(a.created_at))
    const aBorrar = items.slice(1).map(i => i.id)
    const { error } = await db.from('recetas').delete().in('id', aBorrar)
    if (error) { console.error('Error borrando', nombre, error); continue }
    borrados += aBorrar.length
    console.log(' ✅ Limpiado:', nombre, '— borrados:', aBorrar.length)
  }

  const { data: final } = await db.from('recetas').select('id').eq('estado', 'en_revision')
  console.log('\nTotal final en_revision:', final?.length)
  console.log('Borrados totales:', borrados)
}
main().catch(console.error)
