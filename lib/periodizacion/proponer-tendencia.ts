import { calcularAjusteCaloricoSemanal } from './motor-macros'
import { evaluarTendenciaPeso, metaDesdeObjetivo, UMBRALES_TENDENCIA } from './tendencia-peso'

/**
 * Tras un check-in, mira la tendencia de peso de las últimas 5 semanas frente a la meta del onboarding y, si hay que corregir,
 * deja una propuesta `revision_tendencia_peso` (±5 % de kcal) pendiente de aprobación del coach. Nunca cambia el plan sola.
 * No propone otra hasta pasados 14 días (hay que ver el efecto del cambio). Devuelve true si creó una propuesta.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function proponerAjustePorTendencia(db: any, clienteId: string, checkinId: string): Promise<boolean> {
  const { data: onb } = await db.from('onboarding_responses').select('objetivo').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const meta = metaDesdeObjetivo(onb?.objetivo)
  if (!meta) return false

  const desde = new Date(Date.now() - 35 * 86_400_000).toISOString().slice(0, 10)
  const { data: cks } = await db.from('checkins').select('fecha, peso, adherencia').eq('cliente_id', clienteId).not('peso', 'is', null).gte('fecha', desde).order('fecha')
  const adh = (cks ?? []).map((c: { adherencia: number | null }) => c.adherencia).filter((a: number | null): a is number => a != null).slice(-4)
  const adherenciaMedia = adh.length ? adh.reduce((a: number, b: number) => a + b, 0) / adh.length : null
  const tendencia = evaluarTendenciaPeso((cks ?? []).map((c: { fecha: string; peso: number }) => ({ fecha: c.fecha, peso: Number(c.peso) })), meta, adherenciaMedia)
  if (tendencia.kcal_pct === 0) return false

  const limite = new Date(Date.now() - UMBRALES_TENDENCIA.enfriamiento_dias * 86_400_000).toISOString()
  const { data: reciente } = await db.from('periodizacion_acciones').select('id').eq('cliente_id', clienteId).eq('accion', 'revision_tendencia_peso').gte('created_at', limite).limit(1)
  if (reciente?.length) return false

  const { data: plan } = await db.from('planes_nutricion').select('kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo').eq('cliente_id', clienteId).eq('activo', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!plan?.kcal_objetivo) return false
  const aj = calcularAjusteCaloricoSemanal({ kcal: plan.kcal_objetivo, proteinas: plan.proteinas_objetivo ?? 150, carbohidratos: plan.carbohidratos_objetivo ?? 200, grasas: plan.grasas_objetivo ?? 70 }, tendencia.kcal_pct)
  const { error } = await db.from('periodizacion_acciones').insert({
    cliente_id: clienteId, checkin_id: checkinId, accion: 'revision_tendencia_peso',
    input_snapshot: { meta, estado: tendencia.estado, ritmo_pct_semana: tendencia.ritmo_pct_semana, dias: tendencia.dias },
    ajuste_macros: { ...aj, descripcion: `${tendencia.descripcion} → ${aj.kcal_ajustado} kcal (${aj.kcal_ajustado >= aj.kcal ? '+' : ''}${aj.kcal_ajustado - aj.kcal} kcal). Proteína sin cambios.` },
    requiere_aprobacion: true, aprobado_por_coach: null, aplicado: false,
  })
  return !error
}
