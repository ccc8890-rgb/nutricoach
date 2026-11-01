// lib/platos/enlazar.ts
// «Mis platos»: enlaza un ingrediente a un alimento YA existente. Nunca crea alimentos ni usa productos de supermercado:
// lo que no encaja queda sin enlazar y lo resuelve el coach antes de aprobar.
import type { SupabaseClient } from '@supabase/supabase-js'
import { fase1_matchAlimentos } from '@/lib/recetas/auto-match-ingrediente'
import { calidadVinculo } from '@/lib/recetas/reconstruccion-segura'

export type AlimentoCache = Parameters<typeof fase1_matchAlimentos>[2][number]

export async function enlazarSoloExistente(
  supabase: SupabaseClient,
  nombre: string,
  cache: AlimentoCache[],
): Promise<{ alimento_id: string; alimento_nombre: string } | null> {
  // Si el cliente escribe en plural («huevos»), se prueba también el singular
  const singular = nombre.split(' ').map(w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)).join(' ')
  const r = (await fase1_matchAlimentos(supabase, nombre, cache)) ?? (singular !== nombre ? await fase1_matchAlimentos(supabase, singular, cache) : null)
  if (!r?.alimento_id || !r.alimento_nombre) return null
  const calidad = calidadVinculo(nombre, r.alimento_nombre)
  if (calidad !== 'exacta' && calidad !== 'buena') return null
  return { alimento_id: r.alimento_id, alimento_nombre: r.alimento_nombre }
}
