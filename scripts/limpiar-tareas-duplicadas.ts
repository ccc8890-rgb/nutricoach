// Deja UNA tarea pendiente por cliente y tipo (la más reciente) en los tipos donde eso tiene sentido; las anteriores pasan a «reemplazada».
// No es una decisión del coach y es reversible (basta volver a poner el estado en «pendiente»).
// Uso: npx tsx scripts/limpiar-tareas-duplicadas.ts          # simula y lista
//      npx tsx scripts/limpiar-tareas-duplicadas.ts --apply  # aplica
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { tipoEsUnicoPendiente } from '../lib/agentes/tareas-unicas'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }

async function main() {
  const aplicar = process.argv.includes('--apply')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data } = await db.from('agente_tareas').select('id,cliente_id,tipo,created_at,propuesta').in('estado', ['pendiente', 'en_revision']).order('created_at', { ascending: false })
  const vistos = new Set<string>()
  const sobrantes: { id: string; tipo: string; cliente: string; fecha: string; texto: string }[] = []
  for (const t of data ?? []) {
    if (!t.cliente_id || !tipoEsUnicoPendiente(t.tipo)) continue
    const clave = `${t.cliente_id}|${t.tipo}`
    if (vistos.has(clave)) sobrantes.push({ id: t.id, tipo: t.tipo, cliente: String(t.cliente_id).slice(0, 8), fecha: String(t.created_at).slice(0, 16), texto: String(t.propuesta ?? '').slice(0, 80) })
    else vistos.add(clave)
  }
  console.log(`Pendientes: ${data?.length ?? 0} · repetidas a reemplazar: ${sobrantes.length}`)
  for (const s of sobrantes) console.log(`  ${s.tipo} · cliente ${s.cliente} · ${s.fecha} · ${s.texto}`)
  if (!aplicar) return console.log('\n(simulación; usa --apply para aplicar)')
  if (!sobrantes.length) return
  const { error } = await db.from('agente_tareas').update({ estado: 'reemplazada' }).in('id', sobrantes.map(s => s.id))
  console.log(error ? 'ERROR: ' + error.message : `✓ ${sobrantes.length} tareas marcadas como reemplazadas`)
}
main()
