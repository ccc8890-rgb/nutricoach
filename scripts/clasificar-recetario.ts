// Asigna tipo y familia a las fichas del recetario. Uso: npx tsx scripts/clasificar-recetario.ts [--apply]
//  1. Elaboraciones ya marcadas (salsa_base) y fichas en revisión que lo parezcan → tipo elaboración + familia + categoría «Elaboración».
//  2. Platos sin familia → familia propuesta (sin pistas se queda vacía).
//  3. Platos APROBADOS que parecen elaboraciones: solo se listan (decide Carlos).
// Simula por defecto; con --apply guarda copia en salidas/ y escribe. Idempotente.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { familiaElaboracion, familiaPlato } from '../lib/recetas/clasificacion'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const apply = process.argv.includes('--apply')

type Fila = { id: string; nombre: string; estado: string; categoria: string | null; tipo_receta: string | null; tipo_contenido: string; familia: string | null; tags: string[] | null }

async function main() {
  let filas: Fila[] = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await sb.from('recetas').select('id, nombre, estado, categoria, tipo_receta, tipo_contenido, familia, tags').neq('estado', 'descartada').range(i, i + 999)
    if (error) throw error
    filas = filas.concat(data as Fila[]); if (data.length < 1000) break
  }

  const cambios: { fila: Fila; nuevo: Record<string, string | null>; motivo: string }[] = []
  const candidatas: Fila[] = []
  for (const f of filas) {
    const elab = familiaElaboracion(f.nombre)
    const esElab = f.tipo_receta === 'salsa_base' || f.tipo_contenido === 'elaboracion'
    if (esElab || (elab && f.estado === 'en_revision')) {
      const familia = f.familia ?? elab
      const nuevo = { tipo_contenido: 'elaboracion', familia, categoria: 'Elaboración', tipo_receta: 'salsa_base' }
      if (f.tipo_contenido !== 'elaboracion' || f.familia !== familia || f.categoria !== 'Elaboración' || f.tipo_receta !== 'salsa_base') cambios.push({ fila: f, nuevo, motivo: esElab ? 'elaboración marcada' : 'en revisión: parece elaboración' })
    } else {
      if (elab && f.estado === 'aprobada') candidatas.push(f)
      if (!f.familia) {
        const fam = familiaPlato(f)
        if (fam) cambios.push({ fila: f, nuevo: { familia: fam }, motivo: 'familia de plato' })
      }
    }
  }

  const cuenta = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {})
  console.log('Fichas:', filas.length)
  console.log('Cambios por motivo:', cuenta(cambios.map(c => c.motivo)))
  console.log('Elaboraciones por familia:', cuenta(cambios.filter(c => c.nuevo.tipo_contenido === 'elaboracion').map(c => String(c.nuevo.familia))))
  console.log('Platos por familia:', cuenta(cambios.filter(c => !c.nuevo.tipo_contenido).map(c => String(c.nuevo.familia))))
  console.log('\nElaboraciones que cambian:')
  cambios.filter(c => c.nuevo.tipo_contenido).forEach(c => console.log(`  ${c.fila.nombre}  →  ${c.nuevo.familia}  [${c.fila.estado}]`))
  const eranElab = new Set(cambios.filter(c => c.nuevo.tipo_contenido).map(c => c.fila.id))
  const sinFamilia = filas.filter(f => f.tipo_contenido !== 'elaboracion' && !eranElab.has(f.id) && !f.familia && !familiaPlato(f))
  console.log(`\nPlatos sin familia tras clasificar: ${sinFamilia.length}`)
  sinFamilia.slice(0, 12).forEach(f => console.log('  · ' + f.nombre))
  if (candidatas.length) { console.log('\nAprobadas que parecen elaboraciones (NO se tocan):'); candidatas.forEach(f => console.log(`  · ${f.nombre} [${f.categoria}]`)) }

  if (!apply) { console.log('\nsimulación; usa --apply'); return }
  fs.writeFileSync('salidas/26-10-2026_BACKUP-clasificar-recetario.json', JSON.stringify(cambios.map(c => ({ id: c.fila.id, tipo_contenido: c.fila.tipo_contenido, familia: c.fila.familia, categoria: c.fila.categoria, tipo_receta: c.fila.tipo_receta }))))
  let n = 0
  for (const c of cambios) {
    const { error } = await sb.from('recetas').update(c.nuevo).eq('id', c.fila.id)
    if (error) { console.error(c.fila.id, error.message); process.exit(1) }
    n++
  }
  console.log('\nactualizadas', n)
}
main().catch(e => { console.error(e); process.exit(1) })
