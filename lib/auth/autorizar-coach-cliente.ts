import type { SupabaseClient } from '@supabase/supabase-js'

export type CoachClienteAuthorization =
  | {
      ok: true
      cliente: { id: string; coach_id: string; profile_id: string | null }
    }
  | {
      ok: false
      status: 403 | 404 | 500
      codigo: 'CLIENT_NOT_OWNED' | 'CLIENT_NOT_FOUND' | 'AUTH_LOOKUP_FAILED'
      mensaje: string
    }

export async function autorizarCoachCliente(
  db: SupabaseClient,
  input: { userId: string; clienteId: string },
): Promise<CoachClienteAuthorization> {
  try {
    const { data: cliente, error } = await db
      .from('clientes')
      .select('id,coach_id,profile_id')
      .eq('id', input.clienteId)
      .single()

    if (error?.code === 'PGRST116' || (!error && !cliente)) {
      return {
        ok: false,
        status: 404,
        codigo: 'CLIENT_NOT_FOUND',
        mensaje: 'Cliente no encontrado.',
      }
    }

    if (error || !cliente) {
      return {
        ok: false,
        status: 500,
        codigo: 'AUTH_LOOKUP_FAILED',
        mensaje: 'No se pudo verificar el acceso al cliente.',
      }
    }

    if (cliente.coach_id !== input.userId) {
      return {
        ok: false,
        status: 403,
        codigo: 'CLIENT_NOT_OWNED',
        mensaje: 'No tienes permiso para gestionar este cliente.',
      }
    }

    return { ok: true, cliente }
  } catch {
    return {
      ok: false,
      status: 500,
      codigo: 'AUTH_LOOKUP_FAILED',
      mensaje: 'No se pudo verificar el acceso al cliente.',
    }
  }
}
