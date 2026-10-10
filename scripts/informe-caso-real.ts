// Construye el informe de un cliente real con la lógica de la ruta (solo lectura) y lo imprime. Uso: npx tsx scripts/informe-caso-real.ts <prefijo-id>
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
async function main() {
  const { reunirDatosInforme } = await import('../lib/informe-caso/datos')
  const { construirInformeCaso } = await import('../lib/informe-caso/construir')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data } = await db.from('clientes').select('id')
  const id = (data ?? []).find(c => String(c.id).startsWith(process.argv[2] ?? '04cc53b3'))?.id
  const datos = await reunirDatosInforme(db, id as string)
  console.log(JSON.stringify(construirInformeCaso(datos!), null, 2))
}
main()
