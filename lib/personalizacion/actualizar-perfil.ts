import { createServiceSupabase } from '@/lib/supabase-server'
import { perfilVacio, type PerfilAlimentario } from './generador-comidas'

export async function obtenerOCrearPerfil(clienteId: string): Promise<PerfilAlimentario> {
  const supabase = createServiceSupabase()

  const { data } = await supabase
    .from('perfil_alimentario_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .single()

  if (data) return data as PerfilAlimentario

  // Crear perfil vacío desde los datos del onboarding
  const { data: onboarding } = await supabase
    .from('onboarding_responses')
    .select('nivel_cocina, tiempo_cocina_min, restricciones, tipo_entreno')
    .eq('cliente_id', clienteId)
    .single()

  const { data: perfil } = await supabase
    .from('onboarding_perfil_profundo')
    .select('comidas_favoritas, alimentos_evitar_extra, suplementos')
    .eq('cliente_id', clienteId)
    .single()

  const niveles: Record<string, string> = {
    sin_cocina: 'no_cocina',
    basico: 'basico',
    intermedio: 'intermedio',
    avanzado: 'avanzado',
  }

  const nuevo: Omit<PerfilAlimentario, never> & { cliente_id: string } = {
    cliente_id: clienteId,
    comidas_habituales: perfil?.comidas_favoritas
      ? perfil.comidas_favoritas.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [],
    cocinas_preferidas: ['mediterránea'],
    nivel_cocina: niveles[onboarding?.nivel_cocina ?? ''] ?? 'basico',
    tiempo_disponible_min: onboarding?.tiempo_cocina_min ?? 30,
    electrodomesticos: [],
    ingredientes_preferidos: [],
    ingredientes_rechazados: perfil?.alimentos_evitar_extra
      ? perfil.alimentos_evitar_extra.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [],
    patrones_aprendidos: {},
  }

  await supabase.from('perfil_alimentario_cliente').insert(nuevo)
  return nuevo as PerfilAlimentario
}

export async function procesarFeedback(
  clienteId: string,
  feedback: {
    accion: 'aceptada' | 'rechazada' | 'sustituida' | 'guardada'
    razon: string | null
    ingredientes: string[]
    tipoComida: string
    comidaNombre: string
    comidaIngredientes: { nombre: string; gramos: number }[]
    macrosObjetivo: { kcal: number; proteinas: number; carbohidratos: number; grasas: number }
  }
) {
  const supabase = createServiceSupabase()

  // Guardar feedback en historial
  await supabase.from('feedback_comidas_generadas').insert({
    cliente_id: clienteId,
    comida_nombre: feedback.comidaNombre,
    comida_ingredientes: feedback.comidaIngredientes,
    macros_objetivo: feedback.macrosObjetivo,
    tipo_comida: feedback.tipoComida,
    accion: feedback.accion,
    razon: feedback.razon,
  })

  // Actualizar perfil alimentario
  const { data: perfil } = await supabase
    .from('perfil_alimentario_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .single()

  if (!perfil) return

  const updates: Record<string, unknown> = {
    total_interacciones: (perfil.total_interacciones ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }

  if (feedback.accion === 'aceptada' || feedback.accion === 'guardada') {
    updates.ingredientes_preferidos = [
      ...new Set([
        ...((perfil.ingredientes_preferidos as string[]) ?? []),
        ...feedback.ingredientes.slice(0, 3),
      ]),
    ].slice(0, 20)

    const patrones = { ...((perfil.patrones_aprendidos as Record<string, string[]>) ?? {}) }
    patrones[feedback.tipoComida] = [
      ...new Set([
        ...((patrones[feedback.tipoComida] as string[]) ?? []),
        ...feedback.ingredientes.slice(0, 2),
      ]),
    ].slice(0, 10)
    updates.patrones_aprendidos = patrones
  }

  if (feedback.accion === 'rechazada' && feedback.razon) {
    // Extraer ingrediente de la razón (heurística simple: buscar palabras clave)
    const palabrasClave = feedback.razon.toLowerCase().split(/[\s,]+/).filter(p => p.length > 3)
    const ingredientesActuales = (perfil.ingredientes_rechazados as string[]) ?? []
    updates.ingredientes_rechazados = [
      ...new Set([...ingredientesActuales, ...palabrasClave.slice(0, 2)]),
    ].slice(0, 30)
  }

  await supabase
    .from('perfil_alimentario_cliente')
    .update(updates)
    .eq('cliente_id', clienteId)
}
