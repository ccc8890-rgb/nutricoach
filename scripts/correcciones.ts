// Pasada de IA sobre las recetas marcadas «Corregir» en la bandeja de revisión (siempre supervisada por Claude).
//   npx tsx scripts/correcciones.ts            → lista qué hay que corregir (aspectos, nota, ingredientes y pasos)
//   npx tsx scripts/correcciones.ts resolver <id|prefijo>  → quita la marca (vuelve a «Pendientes» para que la apruebes)
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
import { createClient } from '@supabase/supabase-js'

const srv = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const [cmd, arg] = process.argv.slice(2)
  const { data: recetas } = await srv.from('recetas').select('id,nombre,tags,notas_coach,porciones,kcal,descripcion,instrucciones,estado').in('estado', ['en_revision', 'borrador']).contains('tags', ['Corregir'])
  if (cmd === 'resolver') {
    const r = (recetas ?? []).find(x => x.id.startsWith(arg ?? '___'))
    if (!r) return console.log('No encuentro esa receta marcada')
    await srv.from('recetas').update({ tags: (r.tags ?? []).filter((t: string) => t !== 'Corregir') }).eq('id', r.id)
    await srv.from('recetas_auditoria').insert({ receta_id: r.id, evento: 'correccion_resuelta', issues: {}, origen: 'pasada_ia_supervisada' })
    return console.log(`Marca quitada: ${r.nombre}`)
  }
  console.log(`${recetas?.length ?? 0} receta(s) para corregir\n`)
  for (const r of recetas ?? []) {
    const { data: ing } = await srv.from('receta_ingredientes').select('nombre_libre,cantidad_gramos,alimentos!left(nombre)').eq('receta_id', r.id).order('orden')
    const nota = (r.notas_coach ?? '').split('\n').filter((l: string) => l.includes('A corregir:')).pop()
    console.log(`## ${r.nombre} (${r.id.slice(0, 8)}) · ${r.porciones} raciones · ${Math.round(r.kcal ?? 0)} kcal`)
    console.log(`   ${nota}`)
    console.log(`   Ingredientes: ${(ing ?? []).map((i: { nombre_libre: string; cantidad_gramos: number; alimentos?: { nombre?: string } | { nombre?: string }[] | null }) => `${i.nombre_libre} ${i.cantidad_gramos} g → ${(Array.isArray(i.alimentos) ? i.alimentos[0]?.nombre : i.alimentos?.nombre) ?? '—'}`).join(' | ')}`)
    console.log(`   Pasos: ${(r.instrucciones ?? '').replace(/\n/g, ' ').slice(0, 400)}\n`)
  }
}
main()
