// Prueba de humo de «Mis platos» contra la BD real con datos temporales (PRUEBA-platos-*). IA y Cloudinary simulados: no gasta ni sube nada.
// Requiere la migración 20261101120000 aplicada. Uso: npx tsx scripts/probar-platos.ts
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import assert from 'node:assert/strict'
import { crearPlatoDesdeFoto, type DepsCrear } from '../lib/platos/crear'
import { cargarPlatoDeCliente, cargarLineas, listarPlatosDeCliente } from '../lib/platos/guardar'
import { MAX_ANALISIS_POR_DIA } from '../lib/platos/estado'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const { error: sinTabla } = await db.from('platos_cliente').select('id').limit(1)
  if (sinTabla) { console.error('La tabla «platos_cliente» no existe todavía: falta aplicar 20261101120000_platos_cliente.sql'); process.exit(2) }

  const { data: clientes } = await db.from('clientes').select('id').limit(2)
  assert.ok(clientes && clientes.length === 2, 'hacen falta 2 clientes de prueba')
  const [A, B] = clientes.map(c => c.id as string)
  const creados: string[] = []
  let analisisLlamadas = 0

  const deps = (analizar: DepsCrear['analizar']): DepsCrear => ({
    db,
    subirFoto: async () => 'https://res.cloudinary.com/prueba/image/upload/v1/nutricoach/platos/prueba.webp',
    miniaturaParaIA: async () => ({ base64: 'AAAA', mediaType: 'image/jpeg' }),
    analizar: async (p) => { analisisLlamadas++; return analizar!(p) },
  })
  const buena: DepsCrear['analizar'] = async () => ({ ok: true, modelo: 'prueba:sim', valor: { nombre: `PRUEBA-platos-${Date.now()}`, porciones: 1, ingredientes: [{ nombre: 'Huevo', gramos: 150 }, { nombre: 'ingrediente-imposible-xyz', gramos: 20 }], pasos: ['Cuaja.'] } })
  const mala: DepsCrear['analizar'] = async () => ({ ok: false, motivo: 'basura' })
  const foto = { clienteId: A, buffer: Buffer.alloc(2000, 1), tipoMime: 'image/jpeg', nota: null, tipoComida: 'Comida' as const }

  try {
    await db.from('platos_analisis_log').delete().in('cliente_id', [A, B])

    // Crear: las líneas se enlazan solo a alimentos existentes y lo desconocido queda sin enlazar → incompleto
    const r = await crearPlatoDesdeFoto(deps(buena), foto)
    assert.equal(r.estado, 'ok'); if (r.estado !== 'ok') return
    creados.push(r.plato.id)
    assert.equal(r.plato.estado, 'borrador'); assert.equal(r.plato.estimado, true)
    const lineas = await cargarLineas(db, r.plato.id)
    assert.equal(lineas.length, 2)
    assert.ok(lineas.find(l => l.nombre_libre.toLowerCase() === 'huevo')?.alimento_id, 'Huevo debe enlazar')
    assert.equal(lineas.find(l => l.nombre_libre.includes('xyz'))?.alimento_id, null, 'lo desconocido no se crea ni se enlaza')
    assert.equal(r.plato.incompleto, true)

    // Aislamiento (Review Focus 1): el cliente B no ve el plato de A
    assert.equal(await cargarPlatoDeCliente(db, B, r.plato.id), null, 'otro cliente no debe cargarlo')
    assert.ok((await listarPlatosDeCliente(db, B)).every(p => p.id !== r.plato.id))
    assert.ok(await cargarPlatoDeCliente(db, A, r.plato.id))

    // IA que falla: plato en borrador vacío con aviso, sin excepción (Review Focus 3)
    const f = await crearPlatoDesdeFoto(deps(mala), foto)
    assert.equal(f.estado, 'ok'); if (f.estado === 'ok') { creados.push(f.plato.id); assert.ok(f.aviso); assert.equal((await cargarLineas(db, f.plato.id)).length, 0) }

    // Foto inválida (Review Focus 4): no llega a la IA
    const antes = analisisLlamadas
    const t = await crearPlatoDesdeFoto(deps(buena), { ...foto, tipoMime: 'text/plain' })
    assert.equal(t.estado, 'foto_invalida'); assert.equal(analisisLlamadas, antes)

    // Límite diario: tras MAX análisis, el siguiente es 'limite' y no llama a la IA
    const ya = await db.from('platos_analisis_log').select('id', { count: 'exact', head: true }).eq('cliente_id', A)
    const faltan = MAX_ANALISIS_POR_DIA - (ya.count ?? 0)
    await db.from('platos_analisis_log').insert(Array.from({ length: faltan }, () => ({ cliente_id: A })))
    const llamadasAntes = analisisLlamadas
    const l = await crearPlatoDesdeFoto(deps(buena), foto)
    assert.equal(l.estado, 'limite'); assert.equal(analisisLlamadas, llamadasAntes, 'el límite corta antes de la IA')

    console.log('OK: comprobaciones de «Mis platos» (cliente)')
  } finally {
    if (creados.length) await db.from('platos_cliente').delete().in('id', creados)
    await db.from('platos_analisis_log').delete().in('cliente_id', [A, B])
  }
}
main().catch(e => { console.error(e); process.exit(1) })
