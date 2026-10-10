import assert from 'node:assert/strict'
import { reemplazarPendientesAnteriores, tipoEsUnicoPendiente } from '../lib/agentes/tareas-unicas'
import { fakeSupabase } from './helpers/fake-supabase'

const t = (id: string, tipo: string, estado: string, cliente = 'c1') => ({ id, tipo, estado, cliente_id: cliente })

async function main() {
  // Qué tipos admiten una sola pendiente por cliente (y cuáles no)
  for (const tipo of ['analisis_rendimiento', 'alerta_riesgo', 'alerta_retencion', 'revision_semanal_entreno', 'mensaje_motivacion', 'plan_entreno_ia', 'ajuste_macros']) assert.equal(tipoEsUnicoPendiente(tipo), true, tipo)
  for (const tipo of ['actualizacion_plan', 'propuesta_receta', 'tipo_inventado']) assert.equal(tipoEsUnicoPendiente(tipo), false, tipo)

  // La nueva sustituye a las pendientes anteriores del MISMO cliente y tipo; no toca otros clientes, otros tipos ni lo ya decidido.
  const f = fakeSupabase({
    agente_tareas: [
      t('viejo1', 'analisis_rendimiento', 'pendiente'), t('viejo2', 'analisis_rendimiento', 'en_revision'),
      t('nuevo', 'analisis_rendimiento', 'pendiente'),
      t('otroCliente', 'analisis_rendimiento', 'pendiente', 'c2'),
      t('otroTipo', 'alerta_riesgo', 'pendiente'),
      t('decidida', 'analisis_rendimiento', 'aprobado'),
    ],
  })
  const n = await reemplazarPendientesAnteriores(f.db, { clienteId: 'c1', tipo: 'analisis_rendimiento', nuevaId: 'nuevo' })
  assert.equal(n, 2)
  const estado = (id: string) => (f.tablas.agente_tareas.find(x => x.id === id) as { estado: string }).estado
  assert.equal(estado('viejo1'), 'reemplazada')
  assert.equal(estado('viejo2'), 'reemplazada')
  assert.equal(estado('nuevo'), 'pendiente')
  assert.equal(estado('otroCliente'), 'pendiente')
  assert.equal(estado('otroTipo'), 'pendiente')
  assert.equal(estado('decidida'), 'aprobado')

  // Un tipo que admite varias pendientes no se toca; sin cliente tampoco.
  const g = fakeSupabase({ agente_tareas: [t('a', 'actualizacion_plan', 'pendiente'), t('b', 'actualizacion_plan', 'pendiente')] })
  assert.equal(await reemplazarPendientesAnteriores(g.db, { clienteId: 'c1', tipo: 'actualizacion_plan', nuevaId: 'b' }), 0)
  assert.equal(g.ops.length, 0)
  assert.equal(await reemplazarPendientesAnteriores(g.db, { clienteId: null, tipo: 'analisis_rendimiento', nuevaId: 'b' }), 0)

  // Si la escritura falla no revienta (la tarea nueva ya está guardada): devuelve 0.
  const h = fakeSupabase({ agente_tareas: [t('v', 'alerta_riesgo', 'pendiente'), t('n', 'alerta_riesgo', 'pendiente')] }, { falla: () => true })
  assert.equal(await reemplazarPendientesAnteriores(h.db, { clienteId: 'c1', tipo: 'alerta_riesgo', nuevaId: 'n' }), 0)
  console.log('tareas-unicas.test OK')
}
main()
