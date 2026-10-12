import type { SupabaseClient } from '@supabase/supabase-js'
import { MARCAS, rmDesdeCincoReps } from '@/lib/entrenos/marcas'

/** Fusiona marcas ya validadas en el perfil del atleta y rellena las RM que lee el motor (Epley desde el 5RM; las dominadas tal cual). */
export async function guardarMarcasPerfil(admin: SupabaseClient, clienteId: string, nuevas: Record<string, number | null>): Promise<{ ok: true; marcas: Record<string, number> } | { ok: false; status: number; error: string }> {
  const { data: perfil } = await admin.from('perfil_entreno_cliente').select('marcas').eq('cliente_id', clienteId).maybeSingle()
  if (!perfil) return { ok: false, status: 404, error: 'Aún no hay perfil de atleta' }

  const marcas: Record<string, number> = { ...((perfil.marcas as Record<string, number> | null) ?? {}) }
  const cambios: Record<string, unknown> = {}
  for (const m of MARCAS) {
    if (!(m.clave in nuevas)) continue
    const valor = nuevas[m.clave]
    if (valor === null) delete marcas[m.clave]; else marcas[m.clave] = valor
    if (m.rm) cambios[m.rm] = valor === null ? null : m.clave === 'dominadas_max' ? valor : rmDesdeCincoReps(valor)
  }
  const { error } = await admin.from('perfil_entreno_cliente').update({ marcas, ...cambios }).eq('cliente_id', clienteId)
  if (error) return { ok: false, status: 500, error: 'No se pudieron guardar las marcas' }
  return { ok: true, marcas }
}
