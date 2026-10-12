// Renombra en el catálogo y en las sesiones: «Remo ergómetro» → «Remo (Row)», «Series a ritmo de intervalos» → «Series run»,
// «pliometría» con mayúscula en los nombres de sesión. Simula por defecto; con --apply escribe. Deshacer: volver a poner el nombre anterior (aparece en la salida).
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i)] = process.env[l.slice(0, i)] ?? l.slice(i + 1).replace(/^"|"$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const APLICAR = process.argv.includes('--apply')
const EJERCICIOS: Record<string, string> = { 'Remo ergómetro': 'Remo (Row)', 'Remo ergómetro sprint': 'Remo (Row) sprint', 'Remo ergómetro endurance': 'Remo (Row) endurance', 'Series a ritmo de intervalos': 'Series run' }
const nuevoNombreSesion = (n: string) => n.replace(/\s+a ritmo de intervalos/gi, '').replace(/\+\s*([a-záéíóúñ])/g, (_, c: string) => `+ ${c.toUpperCase()}`)
;(async () => {
  for (const [antes, despues] of Object.entries(EJERCICIOS)) {
    const { data } = await db.from('ejercicios').select('id').eq('nombre', antes)
    console.log(`ejercicio «${antes}» → «${despues}» (${data?.length ?? 0})`)
    if (APLICAR && data?.length) await db.from('ejercicios').update({ nombre: despues }).eq('nombre', antes)
  }
  const { data: ses } = await db.from('sesiones_entrenamiento').select('id,nombre').or('nombre.ilike.%pliometr%,nombre.ilike.%ritmo de intervalos%')
  for (const s of ses ?? []) {
    const nuevo = nuevoNombreSesion(s.nombre as string)
    if (nuevo === s.nombre) continue
    console.log(`sesión «${s.nombre}» → «${nuevo}»`)
    if (APLICAR) await db.from('sesiones_entrenamiento').update({ nombre: nuevo }).eq('id', s.id)
  }
  console.log(APLICAR ? 'APLICADO' : 'Simulación (usa --apply)')
})()
