// lib/platos/autorizar-coach.ts
// «Mis platos»: comprueba que quien llama es el coach del cliente dueño del plato. El coach nunca ve borradores:
// para él un borrador es indistinguible de un plato inexistente (404).
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import type { PlatoFila } from './guardar'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_ENCONTRADO = () => NextResponse.json({ error: 'Plato no encontrado' }, { status: 404 })

export async function autorizarCoachPlato(request: NextRequest, platoId: string): Promise<{ db: SupabaseClient; plato: PlatoFila; userId: string } | NextResponse> {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!UUID.test(platoId)) return NO_ENCONTRADO()
  const db = createServiceSupabase()
  const { data: plato } = await db.from('platos_cliente').select('*').eq('id', platoId).maybeSingle()
  // Plato ajeno, inexistente o borrador → 404 (no se confirma su existencia)
  if (!plato || plato.estado === 'borrador') return NO_ENCONTRADO()
  const auth = await autorizarCoachCliente(db, { userId: user.id, clienteId: plato.cliente_id })
  if (!auth.ok) return auth.status === 403 ? NO_ENCONTRADO() : NextResponse.json({ error: auth.mensaje }, { status: auth.status })
  return { db, plato: plato as PlatoFila, userId: user.id }
}
