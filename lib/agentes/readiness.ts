import { createServiceSupabase } from '@/lib/supabase-server'
import { cargarActividadCoach } from '@/lib/actividad/coach-insights'
import { guardarTareaAgente } from './executor'

export async function ejecutarAgenteReadiness(clienteId: string): Promise<void> {
  const db = createServiceSupabase()

  const { count: duplicada } = await db
    .from('agente_tareas')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .in('tipo', ['alerta_readiness', 'ajuste_nutricion_carga'])
    .eq('estado', 'pendiente')

  if (duplicada && duplicada > 0) return

  const actividad = await cargarActividadCoach(db, clienteId, 14).catch(() => null)
  if (!actividad || !actividad.resumen.tiene_datos || actividad.flags.length === 0) return

  const flagsAltas = actividad.flags.filter(f => f.severidad === 'alta')
  const flagsNutricion = actividad.flags.filter(f => f.tipo === 'tdee_alto' || f.tipo === 'carga_alta')
  const principales = flagsAltas.length ? flagsAltas : actividad.flags.slice(0, 2)
  const prioridad = flagsAltas.length ? 2 : 5
  const tipo = flagsNutricion.length ? 'ajuste_nutricion_carga' : 'alerta_readiness'

  const propuesta = flagsNutricion.length
    ? 'Revisar nutrición alrededor de la carga real: ajustar carbohidratos en sesiones clave y comprobar que el déficit no esté comprometiendo recuperación.'
    : 'Revisar recuperación antes de progresar carga: valorar descarga, intensidad de la semana y mensaje preventivo al cliente.'

  const razonamiento = principales
    .map(f => `${f.titulo}: ${f.descripcion}`)
    .join(' ')
    .slice(0, 450)

  await guardarTareaAgente('readiness', {
    tipo,
    propuesta,
    razonamiento,
    payload: {
      resumen: actividad.resumen,
      flags: actividad.flags,
      acciones: principales.map(f => f.accion),
    },
    fuentes: [],
    prioridad,
    score_confianza: flagsAltas.length ? 0.82 : 0.68,
    requiere_aprobacion: true,
    senales_proxima_semana: [
      'HRV/readiness respecto a baseline',
      'TDEE real frente a calorías del plan',
      'Carga alta y respuesta de sueño/energía',
    ],
  }, clienteId)
}
