import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { registrarCron } from '@/lib/sistema/registrar-cron'
import { MAX_ENVIOS, sincronizarGarminCliente } from '@/lib/entrenos/garmin-sync-cliente'

export const maxDuration = 300

function autorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7) === secreto
  return req.headers.get('x-cron-secret') === secreto
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // `cliente` + `forzar`: el coach reenvía todo lo programado de un cliente (se ignora lo ya enviado; se recrea sin duplicar).
  const soloCliente = req.nextUrl.searchParams.get('cliente')
  const forzar = !!soloCliente && req.nextUrl.searchParams.get('forzar') === '1'
  const db = createServiceSupabase()
  const resumen = { clientes: 0, enviados: 0, al_dia: 0, limpiados: 0, errores: [] as string[] }

  let consulta = db
    .from('integraciones_cliente')
    .select('cliente_id')
    .eq('proveedor', 'garmin_connect')
    .eq('activa', true)
  if (soloCliente) consulta = consulta.eq('cliente_id', soloCliente)
  const { data: conexiones } = await consulta

  for (const { cliente_id: clienteId } of conexiones ?? []) {
    if (resumen.enviados >= MAX_ENVIOS) break
    resumen.clientes++
    await sincronizarGarminCliente(db, clienteId, forzar, resumen)
  }

  if (!soloCliente) await registrarCron(db, 'enviar-garmin', resumen.errores.length, `${resumen.enviados} enviadas${resumen.limpiados ? `, ${resumen.limpiados} antiguas quitadas` : ''}${resumen.errores.length ? `; ${resumen.errores[0]}` : ''}`)
  return NextResponse.json(resumen)
}
