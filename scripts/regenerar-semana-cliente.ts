// Regenera la semana en curso de un cliente (como «Generar semana» → reemplazar) y la muestra con sus complementos.
// Antes guarda una copia de las comidas en salidas/. Uso: npx tsx scripts/regenerar-semana-cliente.ts [cliente_prefijo]
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { generarSemana } from '../lib/nutricion/planificar-semana'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const prefijo = process.argv.slice(2).find(a => !a.startsWith('--')) ?? '04cc53b3'
  const { data: cls } = await db.from('clientes').select('id')
  const clienteId = (cls ?? []).find(c => c.id.startsWith(prefijo))?.id
  if (!clienteId) throw new Error(`Cliente ${prefijo} no encontrado`)
  const { data: plan } = await db.from('planes_nutricion')
    .select('id, nombre, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo').eq('cliente_id', clienteId).eq('activo', true).maybeSingle()
  if (!plan) throw new Error('Sin plan activo')

  const { data: antes } = await db.from('comidas').select('*, comida_alimentos(*)').eq('plan_id', plan.id)
  const copia = join(__dirname, '..', 'salidas', `07-10-2026_copia-semana-${clienteId.slice(0, 8)}.json`)
  writeFileSync(copia, JSON.stringify(antes, null, 1))
  console.log(`Copia guardada: ${copia} (${antes?.length ?? 0} comidas)`)

  const r = await generarSemana(db, clienteId, plan, true, [])
  console.log('Resultado:', JSON.stringify({ asignadas: r.asignadas, complementos: r.complementos, repetidas: r.repetidas, sinCubrir: r.sinCubrir, errores: r.errores, avisos: r.avisos }, null, 1))

  const { data: filas } = await db.from('comidas')
    .select('nombre, dia_semana, orden, receta:recetas(nombre), comida_alimentos(cantidad_gramos, es_complemento, complemento_receta_id, alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas))')
    .eq('plan_id', plan.id).not('dia_semana', 'is', null)
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  type Fila = { nombre: string; dia_semana: string; orden: number; receta: { nombre: string } | null; comida_alimentos: { cantidad_gramos: number; es_complemento: boolean; complemento_receta_id: string | null; alimento: { nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number } | null }[] }
  const todas = (filas ?? []) as unknown as Fila[]
  for (const d of dias) {
    const del = todas.filter(c => c.dia_semana === d).sort((a, b) => a.orden - b.orden)
    if (!del.length) continue
    let tot = 0
    console.log(`\n== ${d} (obj ${Math.round(plan.kcal_objetivo ?? 0)} kcal)`)
    for (const c of del) {
      const k = (x: Fila['comida_alimentos'][number]) => (x.alimento ? x.alimento.calorias * x.cantidad_gramos / 100 : 0)
      const prin = c.comida_alimentos.filter(x => !x.es_complemento).reduce((t, x) => t + k(x), 0)
      const comp = c.comida_alimentos.filter(x => x.es_complemento)
      const kc = comp.reduce((t, x) => t + k(x), 0)
      tot += prin + kc
      const extras = comp.map(x => `${x.alimento?.nombre ?? '?'}${x.complemento_receta_id ? '' : ` ${Math.round(x.cantidad_gramos)}g`}`)
      console.log(`  ${c.nombre.padEnd(13)} ${(c.receta?.nombre ?? '—').slice(0, 48).padEnd(49)} ${String(Math.round(prin)).padStart(4)} kcal${comp.length ? `  + ${extras.join(' + ')} (+${Math.round(kc)})` : ''}`)
    }
    console.log(`  TOTAL ${Math.round(tot)} kcal`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
