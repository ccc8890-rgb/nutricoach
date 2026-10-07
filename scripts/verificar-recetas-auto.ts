/**
 * Verificación automática del recetario de confianza: marca verificacion='auto' en
 * recetas aprobadas completas (salvo foto) que pasan el quality gate sin bloqueantes.
 * Nunca toca las verificadas por el coach. Simula por defecto; --apply para escribir.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { auditarRecetaProfesional } from '../lib/recetas/auditoria'
import { motivosIncompleta } from '../lib/recetas/verificacion-auto'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

type Receta = {
  id: string; nombre: string; tipo_plato: string | null; instrucciones: string | null; intolerancias: string[] | null
  tiempo_prep_min: number | null; verificacion: string | null
  receta_ingredientes: { alimento_id: string | null; rol_ingrediente: string | null }[]
}

async function main() {
  const { data, error } = await db.from('recetas')
    .select('id, nombre, tipo_plato, instrucciones, intolerancias, tiempo_prep_min, verificacion, receta_ingredientes!receta_ingredientes_receta_id_fkey(alimento_id, rol_ingrediente)')
    .eq('estado', 'aprobada')
  if (error) throw error

  const motivos: Record<string, number> = {}
  const verificar: string[] = []
  const retirar: string[] = []
  for (const r of (data ?? []) as Receta[]) {
    if (r.verificacion === 'coach') continue
    const faltan = motivosIncompleta(r)
    if (!faltan.length) {
      const audit = await auditarRecetaProfesional(db as never, r.id, 'verificacion_auto', 'script_verificar_recetas_auto')
      faltan.push(...audit.score.bloqueantes.map(b => `gate:${b}`))
    }
    faltan.forEach(m => (motivos[m] = (motivos[m] ?? 0) + 1))
    if (!faltan.length && r.verificacion !== 'auto') verificar.push(r.id)
    if (faltan.length && r.verificacion === 'auto') retirar.push(r.id)
  }

  console.log(`Aprobadas: ${data?.length} · a verificar: ${verificar.length} · a retirar verificación: ${retirar.length}`)
  console.log('Motivos de no verificación:', motivos)
  if (!APPLY) { console.log('\nSimulación: nada escrito. Usa --apply.'); return }

  const ahora = new Date().toISOString()
  for (const ids of [verificar]) {
    for (let i = 0; i < ids.length; i += 100) {
      const { error: e } = await db.from('recetas').update({ verificacion: 'auto', verificada_at: ahora }).in('id', ids.slice(i, i + 100))
      if (e) throw e
    }
  }
  for (let i = 0; i < retirar.length; i += 100) {
    const { error: e } = await db.from('recetas').update({ verificacion: null, verificada_at: null }).in('id', retirar.slice(i, i + 100))
    if (e) throw e
  }
  console.log(`✅ ${verificar.length} verificadas · ${retirar.length} retiradas`)
}

main().catch(e => { console.error('❌', e.message ?? e); process.exit(1) })
