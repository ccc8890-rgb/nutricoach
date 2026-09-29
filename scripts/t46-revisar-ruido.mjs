/**
 * t46-revisar-ruido.mjs
 * Lee salidas/auditoria-matches-2026-09-28.json (98 hallazgos de T45),
 * consulta el estado ACTUAL en Supabase de cada receta_ingredientes,
 * y marca cuáles ya fueron corregidos (por T45) vs cuáles siguen igual
 * (pendientes de revisión uno a uno para T46).
 *
 * Solo lectura. No escribe nada.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
if (!existsSync(envPath)) { console.error('No .env.local'); process.exit(1) }
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const data = JSON.parse(readFileSync(resolve(process.cwd(), 'salidas/auditoria-matches-2026-09-28.json'), 'utf-8'))

async function main() {
  const out = []
  for (const s of data.sospechosos) {
    const { data: row, error } = await sb
      .from('receta_ingredientes')
      .select('id, nombre_libre, cantidad_gramos, alimento_id, alimentos(id, nombre, calorias, proteinas, carbohidratos, grasas)')
      .eq('id', s.ingrediente_id)
      .maybeSingle()
    if (error || !row) {
      out.push({ ...s, estado: 'BORRADO_O_ERROR', error: error?.message })
      continue
    }
    const cambiado = row.alimentos?.nombre !== s.alimento_nombre
    out.push({
      receta_id: s.receta_id,
      receta_nombre: s.receta_nombre,
      ingrediente_id: s.ingrediente_id,
      nombre_libre: row.nombre_libre,
      cantidad_gramos: row.cantidad_gramos,
      alimento_actual: row.alimentos?.nombre,
      alimento_actual_id: row.alimento_id,
      alimento_original_auditoria: s.alimento_nombre,
      estado: cambiado ? 'YA_CORREGIDO' : 'PENDIENTE',
    })
  }
  const pendientes = out.filter(o => o.estado === 'PENDIENTE')
  const corregidos = out.filter(o => o.estado === 'YA_CORREGIDO')
  console.log(`Total: ${out.length} | Ya corregidos: ${corregidos.length} | Pendientes: ${pendientes.length}`)
  writeFileSync(resolve(process.cwd(), 'salidas/t46-estado-98-hallazgos.json'), JSON.stringify(out, null, 2))
  console.log('Guardado en salidas/t46-estado-98-hallazgos.json')
}
main()
