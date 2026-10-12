import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'

/** Lo que el atleta ha dicho de sí mismo: sus marcas y cómo fueron las cargas de cada bloque. Solo el coach propietario. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const db = createServiceSupabase()
  const acceso = await autorizarCoachCliente(db, { userId: user.id, clienteId: id })
  if (!acceso.ok) return NextResponse.json({ error: acceso.mensaje }, { status: acceso.status })

  const [{ data: perfil }, { data: fb }] = await Promise.all([
    db.from('perfil_entreno_cliente').select('marcas, updated_at').eq('cliente_id', id).maybeSingle(),
    db.from('feedback_bloque').select('plan_id, clave, valoracion, created_at, plan:planes_entrenamiento(nombre, created_at)').eq('cliente_id', id).order('created_at', { ascending: false }).limit(40),
  ])
  type Fila = { plan_id: string; clave: string; valoracion: string; created_at: string; plan: { nombre: string; created_at: string } | { nombre: string; created_at: string }[] | null }
  const bloques = new Map<string, { plan_id: string; plan: string; fecha: string; respuestas: { clave: string; valoracion: string }[] }>()
  for (const f of (fb ?? []) as unknown as Fila[]) {
    const plan = Array.isArray(f.plan) ? f.plan[0] : f.plan
    const b = bloques.get(f.plan_id) ?? { plan_id: f.plan_id, plan: plan?.nombre ?? 'Plan', fecha: f.created_at, respuestas: [] }
    b.respuestas.push({ clave: f.clave, valoracion: f.valoracion })
    bloques.set(f.plan_id, b)
  }
  return NextResponse.json({ marcas: (perfil?.marcas as Record<string, number> | null) ?? {}, bloques: [...bloques.values()].slice(0, 4) })
}
