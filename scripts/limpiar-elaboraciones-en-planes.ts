// Quita de los planes las elaboraciones ofrecidas como «alternativa de receta» y lista las comidas cuya receta ES una elaboración.
// Uso: npx tsx scripts/limpiar-elaboraciones-en-planes.ts [--apply]   (simula por defecto; copia con hora en salidas/)
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const apply = process.argv.includes('--apply')

async function main() {
  const { data: elabs } = await sb.from('recetas').select('id, nombre').eq('tipo_contenido', 'elaboracion')
  const ids = new Set((elabs ?? []).map(e => e.id))
  const nombre = new Map((elabs ?? []).map(e => [e.id, e.nombre]))

  let comidas: { id: string; nombre: string; dia_semana: string | null; receta_id: string | null; alternativas_receta_ids: string[] | null; plan_id: string | null }[] = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await sb.from('comidas').select('id, nombre, dia_semana, receta_id, alternativas_receta_ids, plan_id').range(i, i + 999)
    if (error) throw error
    comidas = comidas.concat(data as typeof comidas); if (data.length < 1000) break
  }
  const planes = new Map<string, { activo: boolean | null; cliente: string }>()
  const infoPlan = async (id: string | null) => {
    if (!id) return { activo: null, cliente: 'sin plan' }
    if (!planes.has(id)) {
      const { data } = await sb.from('planes_nutricion').select('activo, nombre, cliente_id').eq('id', id).maybeSingle()
      planes.set(id, { activo: data?.activo ?? null, cliente: data ? `${data.nombre ?? 'plan'} · cliente ${String(data.cliente_id).slice(0, 8)}` : 'plan no encontrado' })
    }
    return planes.get(id)!
  }

  const conAlternativa = comidas.filter(c => (c.alternativas_receta_ids ?? []).some(x => ids.has(x)))
  const conRecetaElab = comidas.filter(c => c.receta_id && ids.has(c.receta_id))
  console.log(`Comidas con elaboraciones como ALTERNATIVA: ${conAlternativa.length}`)
  for (const c of conAlternativa) { const p = await infoPlan(c.plan_id); console.log(`  · ${p.cliente} (${p.activo ? 'plan activo' : 'plan inactivo/sin plan'}) ${c.dia_semana ?? ''} ${c.nombre}: ${(c.alternativas_receta_ids ?? []).filter(x => ids.has(x)).map(x => nombre.get(x)).join(', ')}`) }
  console.log(`\nComidas cuya RECETA es una elaboración (no se tocan; decide Carlos): ${conRecetaElab.length}`)
  for (const c of conRecetaElab) { const p = await infoPlan(c.plan_id); console.log(`  · ${p.cliente} (${p.activo ? 'plan activo' : 'plan inactivo/sin plan'}) ${c.dia_semana ?? ''} ${c.nombre}: ${nombre.get(c.receta_id!)}`) }

  if (!apply) { console.log('\nsimulación; usa --apply'); return }
  const copia = `salidas/${new Date().toISOString().replace(/[:.]/g, '-')}_BACKUP-alternativas-con-elaboraciones.json`
  fs.writeFileSync(copia, JSON.stringify(conAlternativa.map(c => ({ id: c.id, alternativas_receta_ids: c.alternativas_receta_ids }))))
  for (const c of conAlternativa) {
    const { error } = await sb.from('comidas').update({ alternativas_receta_ids: (c.alternativas_receta_ids ?? []).filter(x => !ids.has(x)) }).eq('id', c.id)
    if (error) { console.error(c.id, error.message); process.exit(1) }
  }
  console.log('\nlimpiadas', conAlternativa.length, '· copia', copia)
}
main().catch(e => { console.error(e); process.exit(1) })
