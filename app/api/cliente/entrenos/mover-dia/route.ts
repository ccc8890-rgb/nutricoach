import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { esFechaISO, lunesDe, sumarDias, type Ajuste } from '@/lib/entrenos/calendario-ajustes'
import { plantillaActivaEn } from '@/lib/entrenos/ventana-plan'
import { decidirMovimientoSesion, registrarCambioCliente, textoSesionDevuelta, textoSesionMovida } from '@/lib/entrenos/cambios-cliente'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const hoyMadrid = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })

/**
 * El atleta cambia una sesión de día SOLO en esa fecha (nunca la semana tipo del coach para todas las semanas) y se deja constancia
 * en `cambios_cliente` para que el coach lo vea. Usa la misma tabla de ajustes por fecha que el calendario del coach.
 */
export async function POST(request: NextRequest) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sesionId: string = body.sesion_id
  const nuevoDia: string = body.dia_semana
  const fechaOrigen: string = body.fecha_origen
  const indiceDestino = DIAS.indexOf(nuevoDia)
  if (!sesionId || indiceDestino < 0 || !esFechaISO(fechaOrigen)) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })

  const admin = createServiceSupabase()
  const { data: cliente } = await admin.from('clientes').select('id').eq('profile_id', user.id).single()
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: sesion } = await admin.from('sesiones_entrenamiento')
    .select('id, nombre, dia_semana, plan:planes_entrenamiento!inner(id, cliente_id, activo, created_at, duracion_semanas)').eq('id', sesionId).single()
  const plan = sesion?.plan as unknown as { id: string; cliente_id: string; activo: boolean; created_at: string; duracion_semanas: number | null } | null
  if (!sesion || !plan || plan.cliente_id !== cliente.id || !plan.activo) return NextResponse.json({ error: 'Sesión no encontrada en tu plan' }, { status: 404 })

  const destino = sumarDias(lunesDe(fechaOrigen), indiceDestino)
  if (destino === fechaOrigen) return NextResponse.json({ ok: true })
  const hoy = hoyMadrid()
  if (fechaOrigen < hoy || destino < hoy) return NextResponse.json({ error: 'Solo se pueden mover sesiones que aún no han pasado' }, { status: 400 })
  if (!plantillaActivaEn(plan.created_at, plan.duracion_semanas)(destino)) return NextResponse.json({ error: 'Solo puedes mover dentro de tu bloque actual' }, { status: 400 })

  const { data: ajustesBD } = await admin.from('calendario_entreno_ajustes').select('id, sesion_id, tipo, fecha_origen, fecha').eq('plan_id', plan.id).eq('sesion_id', sesionId)
  const ajustes = (ajustesBD ?? []) as Ajuste[]
  const existente = ajustes.find(a => a.fecha === fechaOrigen && (a.tipo === 'mover' || a.tipo === 'copiar'))

  const decision = decidirMovimientoSesion({ fechaOrigen, destino, diaPlantilla: sesion.dia_semana, existente: existente ?? null })
  if (decision.accion === 'error') return NextResponse.json({ error: decision.mensaje }, { status: 400 })
  const tabla = admin.from('calendario_entreno_ajustes')
  const { error } = decision.accion === 'borrar' ? await tabla.delete().eq('id', decision.ajusteId)
    : decision.accion === 'actualizar' ? await tabla.update({ fecha: decision.fecha }).eq('id', decision.ajusteId)
    : await tabla.insert({ plan_id: plan.id, sesion_id: sesionId, ...decision.fila })
  const devuelta = decision.accion === 'borrar'
  if (error) return NextResponse.json({ error: 'No se pudo mover la sesión' }, { status: 500 })

  await registrarCambioCliente(admin, {
    clienteId: cliente.id, planId: plan.id, tipo: devuelta ? 'sesion_devuelta' : 'sesion_movida',
    resumen: devuelta ? textoSesionDevuelta(sesion.nombre, destino) : textoSesionMovida(sesion.nombre, fechaOrigen, destino),
    detalle: { sesion_id: sesionId, desde: fechaOrigen, hasta: destino },
  })
  return NextResponse.json({ ok: true })
}
