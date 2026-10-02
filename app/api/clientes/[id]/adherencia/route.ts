import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { calcularAdherencia } from '@/lib/adherencia/score'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { comidasDelDia, diaActualIndex } from '@/lib/nutricion/comidas-dia'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params

  const authClient = createApiSupabase(request)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = createServiceSupabase()

  // Solo el coach dueño del cliente (antes cualquier usuario logueado podía leer la adherencia de otro).
  const autorizacion = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!autorizacion.ok) return NextResponse.json({ error: autorizacion.mensaje }, { status: autorizacion.status })

  // Check-ins semanales (auto-reportados)
  const { data: checkins } = await db
    .from('checkins')
    .select('fecha, adherencia, energia, sueno')
    .eq('cliente_id', clienteId)
    .order('fecha', { ascending: false })
    .limit(20)

  // Registros de comidas diarios (últimos 14 días)
  const hace14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: registros } = await db
    .from('registro_comidas_dia')
    .select('fecha, comida_id, estado')
    .eq('cliente_id', clienteId)
    .gte('fecha', hace14d)
    .order('fecha', { ascending: false })

  // Adherencia diaria = comidas hechas/cambiadas ÷ comidas PLANIFICADAS ese día (no solo las registradas:
  // antes, registrar 1 comida y saltarse el resto daba 100 %). Solo cuentan los días con algún registro;
  // un día sin registro puede ser "no abrió la app", no "no cumplió", y se informa aparte.
  const { data: plan } = await db
    .from('planes_nutricion')
    .select('comidas(id, orden, dia_semana)')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const comidasPlan = (plan?.comidas ?? []) as { id: string; orden: number; dia_semana: string | null }[]

  const porDia: Record<string, { hechas: number; registradas: number }> = {}
  for (const r of (registros ?? [])) {
    if (!porDia[r.fecha]) porDia[r.fecha] = { hechas: 0, registradas: 0 }
    porDia[r.fecha].registradas++
    if (r.estado === 'hecha' || r.estado === 'cambiada') porDia[r.fecha].hechas++
  }

  const diasConRegistro = Object.entries(porDia)
    .map(([fecha, { hechas, registradas }]) => {
      const planificadas = comidasDelDia(comidasPlan, diaActualIndex(new Date(`${fecha}T12:00:00`))).length
      const total = Math.max(planificadas, registradas) // plan cambiado o sin plan activo: nunca por debajo de lo registrado
      return { fecha, pct: total > 0 ? Math.min(100, Math.round((hechas / total) * 100)) : 0, hechas, total }
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  const score = calcularAdherencia(checkins ?? [])

  // Enriquecer con datos de registro diario
  const mediaRegistroDiario = diasConRegistro.length > 0
    ? Math.round(diasConRegistro.reduce((s, d) => s + d.pct, 0) / diasConRegistro.length)
    : null

  return NextResponse.json({
    ...score,
    registro_diario: diasConRegistro,
    media_registro_diario: mediaRegistroDiario,
    dias_con_registro: diasConRegistro.length,
    dias_sin_registro: Math.max(0, 14 - diasConRegistro.length),
  })
}
