// lib/entrenos/autorizar-sesion-coach.ts
// Comprueba que quien llama es el coach propietario del plan al que pertenece una sesión.
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export interface ContextoSesionCoach {
  admin: SupabaseClient
  userId: string
  sesionId: string
  planId: string
}

export async function autorizarSesionCoach(request: NextRequest, sesionId: string): Promise<{ ctx: ContextoSesionCoach } | { error: NextResponse }> {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }

  const admin = createServiceSupabase()
  const { data: sesion } = await admin.from('sesiones_entrenamiento').select('id, plan_id').eq('id', sesionId).maybeSingle()
  if (!sesion) return { error: NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 }) }
  const { data: plan } = await admin.from('planes_entrenamiento').select('coach_id').eq('id', sesion.plan_id).maybeSingle()
  if (!plan || plan.coach_id !== user.id) return { error: NextResponse.json({ error: 'Sin acceso' }, { status: 403 }) }
  return { ctx: { admin, userId: user.id, sesionId, planId: sesion.plan_id as string } }
}
