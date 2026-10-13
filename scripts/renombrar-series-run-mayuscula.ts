// «Series run Xm» → «Series Run Xm» en el catálogo (y en sesiones si el nombre se copió). Simula por defecto; --apply escribe.
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] = process.env[l.slice(0, i)] ?? l.slice(i + 1).replace(/^"|"$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const APLICAR = process.argv.includes('--apply')
;(async () => {
  for (const tabla of ['ejercicios', 'sesiones_entrenamiento', 'plantilla_sesiones']) {
    const { data, error } = await db.from(tabla).select('id,nombre').ilike('nombre', '%series run%')
    if (error) { console.log(tabla, 'omitida:', error.message); continue }
    for (const r of data ?? []) {
      const nuevo = (r.nombre as string).replace(/series run/gi, 'Series Run')
      if (nuevo === r.nombre) continue
      console.log(`${tabla}: «${r.nombre}» → «${nuevo}»`)
      if (APLICAR) await db.from(tabla).update({ nombre: nuevo }).eq('id', r.id)
    }
  }
  console.log(APLICAR ? 'APLICADO' : 'Simulación (usa --apply)')
})()
