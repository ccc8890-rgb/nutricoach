import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.SUPABASE_LOCAL_URL
  const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY
  assert.ok(url, 'SUPABASE_LOCAL_URL requerida')
  assert.ok(serviceKey, 'SUPABASE_LOCAL_SERVICE_ROLE_KEY requerida')

  const parsed = new URL(url)
  assert.ok(
    parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost',
    `Prueba bloqueada: solo admite Supabase local, recibido ${parsed.hostname}`,
  )

  const dbA = createClient(url, serviceKey, { auth: { persistSession: false } })
  const dbB = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: cliente, error: clienteError } = await dbA
    .from('clientes')
    .select('id, coach_id')
    .not('coach_id', 'is', null)
    .order('created_at')
    .limit(1)
    .single()
  assert.ifError(clienteError)
  assert.ok(cliente?.id && cliente.coach_id, 'El seed local necesita un cliente con coach')

  const clave = `fase0:concurrencia:${crypto.randomUUID()}`
  const args = {
    p_cliente_id: cliente.id,
    p_clave: clave,
    p_actor_id: cliente.coach_id,
  }

  const [a, b] = await Promise.all([
    dbA.rpc('claim_generacion_plan_inicial', args),
    dbB.rpc('claim_generacion_plan_inicial', args),
  ])
  assert.ifError(a.error)
  assert.ifError(b.error)

  const resultados = [a.data?.[0], b.data?.[0]]
  assert.ok(resultados.every(Boolean))
  assert.equal(new Set(resultados.map(r => r?.generacion_id)).size, 1)
  assert.equal(resultados.filter(r => r?.accion === 'generar').length, 1)
  assert.equal(resultados.filter(r => r?.accion === 'esperar').length, 1)

  const generacionId = resultados[0]?.generacion_id
  assert.ok(generacionId)
  const { error: cleanupError } = await dbA
    .from('generaciones_plan_inicial')
    .delete()
    .eq('id', generacionId)
  assert.ifError(cleanupError)

  console.log('fase0 local concurrent generation test passed')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
