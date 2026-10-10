import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { MAX_HITOS, validarHito, type Hito } from '@/lib/rendimiento/intervenciones'

async function autorizar(request: NextRequest, clienteId: string) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const db = createServiceSupabase()
  const a = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!a.ok) return { error: NextResponse.json({ error: a.mensaje }, { status: a.status }) }
  return { db }
}

/** Lee los hitos guardados. `faltaColumna` si la migración de hitos_entreno aún no está aplicada. */
async function leerHitos(db: ReturnType<typeof createServiceSupabase>, clienteId: string) {
  const { data, error } = await db.from('perfil_entreno_cliente').select('hitos_entreno').eq('cliente_id', clienteId).maybeSingle()
  if (error) return { hitos: [] as Hito[], existe: false, faltaColumna: error.code === '42703' || /hitos_entreno/.test(error.message) }
  return { hitos: (Array.isArray(data?.hitos_entreno) ? data!.hitos_entreno : []) as Hito[], existe: !!data, faltaColumna: false }
}

const MENSAJES = {
  faltaColumna: 'Falta aplicar la migración de hitos (20261010130000_hitos_entreno.sql) en la base de datos.',
  sinPerfil: 'Este atleta aún no tiene perfil de atleta: créalo primero en la pestaña Perfil atleta.',
}

/** Anota un cambio de entrenamiento para medir después qué pasó con el atleta. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const a = await autorizar(request, clienteId)
  if (a.error) return a.error

  const hoy = new Date().toISOString().slice(0, 10)
  const v = validarHito(await request.json().catch(() => null), hoy)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 422 })

  const { hitos, existe, faltaColumna } = await leerHitos(a.db, clienteId)
  if (faltaColumna) return NextResponse.json({ error: MENSAJES.faltaColumna }, { status: 409 })
  if (!existe) return NextResponse.json({ error: MENSAJES.sinPerfil }, { status: 409 })
  if (hitos.length >= MAX_HITOS) return NextResponse.json({ error: `Máximo ${MAX_HITOS} cambios anotados: quita alguno antiguo.` }, { status: 422 })

  const nuevo: Hito = { id: randomUUID(), ...v.hito }
  const { error } = await a.db.from('perfil_entreno_cliente').update({ hitos_entreno: [...hitos, nuevo] }).eq('cliente_id', clienteId)
  if (error) return NextResponse.json({ error: 'No se pudo guardar el cambio.' }, { status: 500 })
  return NextResponse.json({ ok: true, hito: nuevo })
}

/** Quita un hito anotado (`?id=`). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const a = await autorizar(request, clienteId)
  if (a.error) return a.error

  const id = request.nextUrl.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 })
  const { hitos, faltaColumna } = await leerHitos(a.db, clienteId)
  if (faltaColumna) return NextResponse.json({ error: MENSAJES.faltaColumna }, { status: 409 })
  if (!hitos.some(h => h.id === id)) return NextResponse.json({ error: 'No existe ese cambio.' }, { status: 404 })

  const { error } = await a.db.from('perfil_entreno_cliente').update({ hitos_entreno: hitos.filter(h => h.id !== id) }).eq('cliente_id', clienteId)
  if (error) return NextResponse.json({ error: 'No se pudo quitar el cambio.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
