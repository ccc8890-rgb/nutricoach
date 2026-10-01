// Solo lectura: muestra qué asignaría "Generar semana" a un cliente, sin escribir nada.
// Uso: npx tsx scripts/simular-generar-semana.ts [cliente_id_prefijo] [--reemplazar]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { planificarSemana } from '../lib/nutricion/planificar-semana'
import { claveProteina } from '../lib/nutricion/generar-semana'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const prefijo = process.argv.slice(2).find(a => !a.startsWith('--')) ?? '04cc53b3'
  const reemplazar = process.argv.includes('--reemplazar')
  const { data: cls } = await db.from('clientes').select('id')
  const clienteId = (cls ?? []).find(c => c.id.startsWith(prefijo))?.id
  if (!clienteId) throw new Error(`Cliente ${prefijo} no encontrado`)
  const { data: plan } = await db.from('planes_nutricion')
    .select('id, nombre, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo')
    .eq('cliente_id', clienteId).eq('activo', true).maybeSingle()
  if (!plan) throw new Error('Sin plan activo')

  const t0 = Date.now()
  const r = await planificarSemana(db, clienteId, plan, reemplazar)
  console.log(`Plan "${plan.nombre}" · reemplazar=${reemplazar} · huecos ${r.huecos.length} · calculado en ${((Date.now() - t0) / 1000).toFixed(1)} s\n`)
  console.log('Candidatas por franja:', Object.entries(r.candidatas).map(([f, l]) => `${f} ${l.length}`).join(' · '))

  const ids = [...new Set(r.asignaciones.map(a => a.receta_id))]
  const { data: recs } = await db.from('recetas').select('id, nombre, kcal, proteinas, carbohidratos, grasas, verificacion').in('id', ids)
  const porId = new Map((recs ?? []).map(x => [x.id, x]))
  for (const franja of Object.keys(r.candidatas)) {
    console.log(`\n${franja}`)
    for (const a of r.asignaciones.filter(x => x.franja === franja)) {
      const x = porId.get(a.receta_id)!
      console.log(`  ${a.dia.padEnd(10)} ${x.nombre.slice(0, 62).padEnd(63)} ${String(Math.round(x.kcal)).padStart(4)} kcal · P${Math.round(x.proteinas)} C${Math.round(x.carbohidratos)} G${Math.round(x.grasas)} ${x.verificacion ? '✓' : '·sin verificar'}${a.repetida ? ' (REPETIDA)' : ''}`)
    }
  }
  if (r.sinCubrir.length) console.log('\nSin cubrir:', r.sinCubrir.map(h => `${h.dia}/${h.franja}`).join(', '))
  const prot = r.asignaciones.map(a => claveProteina(porId.get(a.receta_id)!.nombre) ?? 'otra')
  const cuenta: Record<string, number> = {}
  for (const p of prot) cuenta[p] = (cuenta[p] ?? 0) + 1
  const dias = [...new Set(r.asignaciones.map(a => a.dia))]
  let repetidosDia = 0
  for (const dia of dias) {
    const claves = r.asignaciones.filter(a => a.dia === dia).map(a => claveProteina(porId.get(a.receta_id)!.nombre)).filter(Boolean)
    const dup = claves.length - new Set(claves).size
    repetidosDia += dup
    console.log(`  ${dia.padEnd(10)} ${claves.join(' · ')}${dup ? '   ← repite' : ''}`)
  }
  console.log('Días con proteína repetida entre franjas:', repetidosDia)
  console.log('\nProteína en el nombre:', Object.entries(cuenta).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '))
  console.log(`Recetas distintas: ${ids.length} de ${r.asignaciones.length} · repetidas: ${r.asignaciones.filter(a => a.repetida).length}`)
}
main().catch(e => { console.error(e); process.exit(1) })
