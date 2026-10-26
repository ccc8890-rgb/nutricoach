// Pone cada elaboración (tipo_receta='salsa_base') en su categoría: Elaboración base · Salsa · Condimento.
// Uso: npx tsx scripts/reclasificar-elaboraciones.ts [--apply]   (simula por defecto; copia en salidas/)
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { categoriaElaboracion } from '../lib/recetas/tipo-receta'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const apply = process.argv.includes('--apply')

async function todas(filtro: (q: any) => any) {
  let rs: any[] = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await filtro(sb.from('recetas').select('id,nombre,categoria,tipo_plato,tipo_receta,estado')).range(i, i + 999)
    if (error) throw error
    rs = rs.concat(data); if (data.length < 1000) break
  }
  return rs
}

async function main() {
  const elaboraciones = await todas(q => q.eq('tipo_receta', 'salsa_base').neq('estado', 'descartada'))
  const cambios: any[] = []
  for (const r of elaboraciones) {
    const cat = categoriaElaboracion(r.nombre)
    if (!cat) { console.log(`?  sin categoría clara (no se toca): ${r.nombre}`); continue }
    if (r.categoria === cat) continue
    cambios.push({ ...r, nueva: cat })
    console.log(`${r.categoria ?? '—'} → ${cat}  ·  ${r.nombre}`)
  }
  console.log(`\nelaboraciones: ${elaboraciones.length} · por cambiar: ${cambios.length}`)

  const candidatas = (await todas(q => q.neq('tipo_receta', 'salsa_base').neq('estado', 'descartada'))).filter(r => categoriaElaboracion(r.nombre))
  if (candidatas.length) { console.log('\nCandidatas que NO son salsa_base (solo aviso, no se tocan):'); candidatas.forEach(r => console.log(`  · ${r.nombre} [${r.categoria}/${r.tipo_receta}]`)) }

  if (!apply) { console.log('\nsimulación; usa --apply'); return }
  fs.writeFileSync('salidas/26-10-2026_BACKUP-reclasificar-elaboraciones.json', JSON.stringify(cambios.map(({ nueva, ...r }) => r)))
  for (const c of cambios) {
    const { error } = await sb.from('recetas').update({ categoria: c.nueva, tipo_receta: 'salsa_base' }).eq('id', c.id)
    if (error) { console.error(c.id, error.message); process.exit(1) }
  }
  console.log('actualizadas', cambios.length)
}
main().catch(e => { console.error(e); process.exit(1) })
