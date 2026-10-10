// Audita (solo lectura) el plan de entrenamiento activo de un cliente: qué generó la IA frente al esqueleto del motor, con los datos reales del cliente.
// Uso: npx tsx scripts/auditar-plan-activo-cliente.ts <prefijo-id-cliente>
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const prefijo = process.argv[2] ?? '04cc53b3'
  const { data: cli } = await db.from('clientes').select('id')
  const id = (cli ?? []).find(c => String(c.id).startsWith(prefijo))?.id
  if (!id) return console.log('cliente no encontrado')
  const { data: planes } = await db.from('planes_entrenamiento').select('id,nombre,activo,created_at,duracion_semanas').eq('cliente_id', id).order('created_at', { ascending: false }).limit(4)
  console.log('PLANES (más reciente primero):'); for (const p of planes ?? []) console.log(' ', p.activo ? 'ACTIVO' : 'inactivo', p.created_at?.slice(0, 16), p.nombre, `(${p.duracion_semanas ?? '?'} sem)`)
  const activo = (planes ?? []).find(p => p.activo)
  if (!activo) return console.log('sin plan activo')
  const { data: ses } = await db.from('sesiones_entrenamiento').select('*').eq('plan_id', activo.id).order('dia_semana')
  console.log('\nSESIONES DEL PLAN ACTIVO:')
  for (const s of ses ?? []) console.log(` - ${s.dia_semana ?? '?'} · ${s.nombre} [${s.tipo ?? s.tipo_sesion ?? '-'}] ${s.duracion_estimada_min ?? '?'} min`)
  const { data: reg } = await db.from('registros_ia').select('created_at,tipo,respuesta_json').eq('cliente_id', id).order('created_at', { ascending: false }).limit(6)
  const ultimo = (reg ?? []).find(r => (r.respuesta_json as Record<string, unknown> | null)?._macrociclo)
  if (!ultimo) return console.log('\n(el último registro de IA no trae _macrociclo: el despliegue con los cambios no se usó)')
  const rj = ultimo.respuesta_json as { _macrociclo: { semanas: { n: number; fase: string; minutos: number; salidas: number; tiradaMin: number; sesiones: { tipo: string; minutos: number; dia: number }[] }[]; avisos: string[]; supuestos: string[]; datosFaltantes: string[] }; _validacion?: { hallazgos: { nivel: string; codigo: string; texto: string }[]; resumen: Record<string, unknown> } }
  console.log(`\nREGISTRO IA ${ultimo.created_at?.slice(0, 16)} · esqueleto semana 1:`, JSON.stringify(rj._macrociclo.semanas[0]))
  console.log('avisos del motor:', rj._macrociclo.avisos.length ? rj._macrociclo.avisos : 'ninguno')
  console.log('supuestos:', rj._macrociclo.supuestos)
  console.log('faltan:', rj._macrociclo.datosFaltantes)
  console.log('\nVALIDADOR sobre lo que generó la IA:'); console.log(JSON.stringify(rj._validacion?.resumen)); for (const h of rj._validacion?.hallazgos ?? []) console.log(`  [${h.nivel}] ${h.codigo}: ${h.texto}`)
}
main()
