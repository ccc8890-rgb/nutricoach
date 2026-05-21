import { createServiceSupabase } from '@/lib/supabase-server'

// Builds learned profile from last 100 intercambios and upserts perfil_alimentario_cliente
export async function actualizarPerfilDesdeIntercambios(clienteId: string): Promise<void> {
  const supabase = createServiceSupabase()

  // Fetch last 100 swaps with food names
  const { data: intercambios } = await supabase
    .from('intercambios_historial')
    .select(`
      alimento_original_id,
      alternativa_elegida_id,
      original:alimentos!intercambios_historial_alimento_original_id_fkey(nombre),
      alternativa:alimentos!intercambios_historial_alternativa_elegida_id_fkey(nombre)
    `)
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!intercambios || intercambios.length === 0) return

  const rechazoCount: Record<string, number> = {}
  const preferenciaCount: Record<string, number> = {}

  for (const swap of intercambios) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalNombre = (swap.original as any)?.nombre
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alternativaNombre = (swap.alternativa as any)?.nombre
    if (originalNombre) rechazoCount[originalNombre] = (rechazoCount[originalNombre] ?? 0) + 1
    if (alternativaNombre) preferenciaCount[alternativaNombre] = (preferenciaCount[alternativaNombre] ?? 0) + 1
  }

  // Only include foods swapped out at least twice (pattern, not accident)
  const rechazados = Object.entries(rechazoCount)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([nombre]) => nombre)

  const preferidos = Object.entries(preferenciaCount)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([nombre]) => nombre)

  await supabase
    .from('perfil_alimentario_cliente')
    .upsert(
      {
        cliente_id: clienteId,
        ingredientes_rechazados: rechazados,
        ingredientes_preferidos: preferidos,
        total_interacciones: intercambios.length,
        patrones_aprendidos: { rechazados, preferidos },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cliente_id' },
    )
}
