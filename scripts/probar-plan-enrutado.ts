// scripts/probar-plan-enrutado.ts — genera (sin guardar) el plan de un cliente con el enrutador real y muestra qué modelo respondió.
// Uso: npx tsx scripts/probar-plan-enrutado.ts [prefijoClienteId]   (por defecto Carlos, 04cc53b3)
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { generarPlanEntrenoIA } from '../lib/entrenos/generar-plan-ia'
import { evaluarPlanIA } from '../lib/entrenos/evaluar-plan-ia'

for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] = process.env[l.slice(0, i)] ?? l.slice(i + 1).replace(/^"|"$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
;(async () => {
  const pre = process.argv[2] ?? '04cc53b3'
  const { data } = await db.from('clientes').select('id')
  const id = data!.find(c => c.id.startsWith(pre))!.id as string
  const t0 = Date.now()
  const r = await generarPlanEntrenoIA(db, { clienteId: id })
  const ev = evaluarPlanIA(r, r.esHibrido ? 6 : null)
  const plan = r.planIA as Record<string, unknown>
  console.log(JSON.stringify({
    segundos: Math.round((Date.now() - t0) / 1000), modelo: r.metadata.generado_con, uso: r.metadata.uso,
    puntuacion: ev.puntuacion, metricas: ev.metricas, correccion: plan._correccion ?? null,
    hallazgos: r.validacion?.hallazgos.map(h => h.codigo) ?? [],
  }, null, 2))
})().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
