import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { construirContexto } from '@/lib/nutricion/contexto-suplementos'
import { getFichaSuplemento, recomendarSuplementos, type Recomendacion } from '@/lib/nutricion/suplementos'

type Ambito = 'sesion' | 'diaria' | 'carrera'
type Estado = 'propuesta' | 'aprobada' | 'descartada'
type Decision = { suplemento_id: string; ambito: Ambito; estado: Estado; dosis?: string; timing?: string; notas?: string }
type DecisionGuardada = { suplemento_id: string; ambito: Ambito; estado: Estado; dosis: string | null; timing: string | null; notas: string | null }

function esDecision(body: unknown): body is Decision {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  const datos = body as Record<string, unknown>
  return typeof datos.suplemento_id === 'string' && datos.suplemento_id.trim().length > 0 && datos.suplemento_id.length <= 300
    && ['sesion', 'diaria', 'carrera'].includes(datos.ambito as string)
    && ['propuesta', 'aprobada', 'descartada'].includes(datos.estado as string)
    && ['dosis', 'timing', 'notas'].every(campo => datos[campo] === undefined || (typeof datos[campo] === 'string' && datos[campo].length <= 300))
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { data: { user }, error: authError } = await createApiSupabase(request).auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const db = createServiceSupabase()
    const acceso = await autorizarCoachCliente(db, { userId: user.id, clienteId: id })
    if (!acceso.ok) return NextResponse.json({ error: acceso.mensaje }, { status: acceso.status })

    const ctx = await construirContexto(db, id)
    if (!ctx) return NextResponse.json({ error: 'Falta un peso valido para calcular las dosis' }, { status: 422 })
    const guardadasRes = await db.from('suplementacion_cliente')
      .select('suplemento_id,ambito,estado,dosis,timing,notas').eq('cliente_id', id)
    if (guardadasRes.error) throw new Error('Error al consultar decisiones de suplementacion')
    const guardadas = new Map((guardadasRes.data as DecisionGuardada[]).map(fila => [`${fila.ambito}:${fila.suplemento_id}`, fila]))
    const propuestas = recomendarSuplementos(ctx)
    const fusionar = (ambito: Ambito, recomendaciones: Recomendacion[]) => recomendaciones.map(recomendacion => {
      const guardada = guardadas.get(`${ambito}:${recomendacion.id}`)
      return {
        ...recomendacion,
        estado: guardada?.estado ?? 'propuesta',
        notas: guardada?.notas ?? null,
        dosis: guardada?.dosis ?? recomendacion.dosis,
        timing: guardada?.timing ?? recomendacion.timing,
      }
    })
    return NextResponse.json({
      sesion: fusionar('sesion', propuestas.sesion),
      diaria: fusionar('diaria', propuestas.diaria),
      carrera: fusionar('carrera', propuestas.carrera),
      avisos: propuestas.avisos,
      ctx,
    })
  } catch (error) {
    console.error('Error GET /api/clientes/[id]/suplementacion:', error)
    return NextResponse.json({ error: 'Error al obtener suplementacion' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { data: { user }, error: authError } = await createApiSupabase(request).auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const db = createServiceSupabase()
    const acceso = await autorizarCoachCliente(db, { userId: user.id, clienteId: id })
    if (!acceso.ok) return NextResponse.json({ error: acceso.mensaje }, { status: acceso.status })

    const body: unknown = await request.json().catch(() => null)
    if (!esDecision(body)) return NextResponse.json({ error: 'Datos de suplementacion invalidos' }, { status: 400 })
    if (!getFichaSuplemento(body.suplemento_id)) return NextResponse.json({ error: 'Suplemento desconocido' }, { status: 400 })
    const { suplemento_id, ambito, estado, notas } = body
    let { dosis, timing } = body
    // Aprobar sin dosis/momento (p. ej. por API) dejaría al cliente sin pauta: se completa con la propuesta actual
    if (estado === 'aprobada' && (dosis === undefined || timing === undefined)) {
      const ctx = await construirContexto(db, id)
      const propuesta = ctx ? recomendarSuplementos(ctx)[ambito].find(r => r.id === suplemento_id) : undefined
      if (propuesta) { dosis ??= propuesta.dosis; timing ??= propuesta.timing }
    }
    const { data, error } = await db.from('suplementacion_cliente').upsert({
      cliente_id: id,
      suplemento_id,
      ambito,
      estado,
      ...(dosis !== undefined ? { dosis } : {}),
      ...(timing !== undefined ? { timing } : {}),
      ...(notas !== undefined ? { notas } : {}),
      decidido_por: estado === 'propuesta' ? null : user.id,
      decidido_at: estado === 'propuesta' ? null : new Date().toISOString(),
    }, { onConflict: 'cliente_id,suplemento_id,ambito' }).select('suplemento_id,ambito,estado,dosis,timing,notas').single()
    if (error) throw new Error('Error al guardar decision de suplementacion')
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error PATCH /api/clientes/[id]/suplementacion:', error)
    return NextResponse.json({ error: 'Error al guardar suplementacion' }, { status: 500 })
  }
}
