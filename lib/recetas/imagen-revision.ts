import type { createServiceSupabase } from '@/lib/supabase-server'

type Srv = ReturnType<typeof createServiceSupabase>

/**
 * Aprobar una receta da por revisada su foto: sale de la pantalla de Imágenes.
 * Las que el coach marcó expresamente como «revisar» o «rechazada» se respetan, y las que no tienen foto siguen pendientes.
 */
export async function marcarFotoRevisada(srv: Srv, ids: string[]) {
  if (ids.length === 0) return
  await srv
    .from('recetas')
    .update({ imagen_estado: 'aprobada', imagen_needs_review: false, imagen_reviewed_at: new Date().toISOString() })
    .in('id', ids)
    .not('imagen_url', 'is', null)
    .neq('imagen_url', '')
    .or('imagen_estado.is.null,imagen_estado.not.in.(revisar,rechazada)')
}
