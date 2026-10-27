// El agente revisor del recetario por línea de comandos.
//   npx tsx scripts/revisar-cola.ts                     → qué revisaría (no llama a la IA, no gasta)
//   npx tsx scripts/revisar-cola.ts --aplica            → revisa las fichas «Con el agente» (máx. 10, tope diario de tokens)
//   npx tsx scripts/revisar-cola.ts --aplica --limite=5 --tokens-dia=300000
//   npx tsx scripts/revisar-cola.ts --aplica --id=<uuid> [--forzar]   → una ficha concreta (--forzar si no está «Con el agente»)
// Lo usa la pasada local de 6 h; la nube lo hace una vez al día (/api/cron/revisor-recetas). NUNCA aprueba ni toca ingredientes, pasos ni macros.
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Claves de IA y Supabase desde .env.local (el enrutador lee process.env)
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3)
const aplica = process.argv.includes('--aplica')

async function main() {
  const { revisarFicha, revisarPendientes, tokensGastadosHoy, acuerdoConCarlos, TOKENS_POR_DIA, LIMITE_POR_EJECUCION } = await import('../lib/recetas/revisor/revisar')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const id = arg('id')
  const limite = Number(arg('limite')) || LIMITE_POR_EJECUCION
  const tokensDia = Number(arg('tokens-dia')) || TOKENS_POR_DIA

  const gastados = await tokensGastadosHoy(db)
  const { data: cola } = await db.from('recetas').select('id, nombre').eq('estado', 'en_revision').eq('fase_revision', 'en_agente').order('updated_at', { ascending: true })
  console.log(`Con el agente: ${cola?.length ?? 0} fichas · tokens hoy: ${gastados.toLocaleString('es-ES')} de ${tokensDia.toLocaleString('es-ES')}`)
  if (!aplica) { (cola ?? []).slice(0, limite).forEach(f => console.log('  ·', f.nombre)); console.log('\nsimulación; usa --aplica'); return }

  if (id) {
    const r = await revisarFicha(db, id, { forzar: process.argv.includes('--forzar') })
    console.log(`${id.slice(0, 8)} → ${r.estado}${r.veredicto ? ` (${r.veredicto})` : ''}${r.tokens ? ` · ${r.tokens} tokens` : ''}`, r.aplicadas && Object.keys(r.aplicadas).length ? `· aplicó ${JSON.stringify(r.aplicadas)}` : '')
    return
  }
  const r = await revisarPendientes(db, { limite, tokensDia })
  console.log(`Revisadas ${r.revisadas} · sin cambios ${r.omitidas} · inválidas ${r.invalidas} · ${r.tokens.toLocaleString('es-ES')} tokens${r.paradoPorPresupuesto ? ' · TOPE DIARIO' : ''}`)
  const a = await acuerdoConCarlos(db)
  if (a.total) console.log(`Acuerdo con Carlos: ${a.acuerdo}/${a.total} (${Math.round(100 * a.acuerdo / a.total)} %)`)
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
