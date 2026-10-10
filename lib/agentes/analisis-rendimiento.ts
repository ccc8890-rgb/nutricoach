// ================================================================
// AGENTE ENTRENADOR IA — RENDIMIENTO
// Lee la carga, la evolución y el estado del atleta (Garmin/Strava) como lo haría un
// entrenador de running/Hyrox, y propone decisiones para la semana siguiente.
// SIEMPRE supervisado: crea una tarea para el coach; aprobarla solo deja constancia
// y alimenta el aprendizaje, no modifica el plan ni escribe al cliente.
// ================================================================
import { llamarDeepSeek, guardarTareaAgente } from './executor'
import { createServiceSupabase } from '@/lib/supabase-server'
import { construirContextoRendimiento } from '@/lib/rendimiento/contexto'
import { validarPasos, type Paso } from '@/lib/entrenos/pasos'
import { CLAVES_METRICA, type ClaveMetrica, type Direccion } from '@/lib/rendimiento/seguimiento'

const SYSTEM = `Eres un entrenador de running y Hyrox de alto nivel que asesora a otro entrenador (el coach). Razonas con ciencia del entrenamiento, no con tópicos.

MARCO CIENTÍFICO (úsalo y cítalo por su nombre cuando lo apliques):
- Carga: modelo impulso-respuesta de Banister y Performance Management Chart de Coggan (forma CTL, fatiga ATL, frescura TSB). Frescura entre -10 y -30 = zona productiva; por debajo de -30 hay riesgo; +5 a +25 es el rango de competir. Subir la forma más de ~5-8 puntos/semana aumenta el riesgo.
- Intensidad: distribución polarizada/piramidal (Seiler; Stöggl y Sperlich): ~75-80% del tiempo fácil, el resto de calidad. Daniels: tempo ≤10% del volumen semanal, intervalos ≤8% (máx 10 km), repeticiones ≤5%.
- Ritmos de entreno desde el VDOT (Daniels); los que se te dan son los vigentes.
- Variabilidad entre días (Foster): monotonía alta + carga alta = más enfermedad/sobreentrenamiento.
- Descarga cada 3-4 semanas; reducción previa a competir (tapering) manteniendo intensidad y recortando volumen.
- Hyrox/híbrido: efecto de interferencia entre fuerza y resistencia (Hickson 1980; Wilson 2012): separar sesiones duras ≥6 h o ponerlas en días distintos; la carrera en Hyrox es la mitad del tiempo.
- La regla del "10% semanal" es una heurística débil: no la uses como razón única.

REGLAS DE TRABAJO:
1. Usa SOLO los datos del contexto. Si un dato falta o es escaso, dilo y baja la confianza; no inventes cifras.
2. Las ALERTAS AUTOMÁTICAS son hechos calculados: tenlas en cuenta y no las contradigas.
3. Propón cambios concretos y pocos (máximo 5): qué sesión, qué cambiar (ritmo, volumen, orden, descanso) y por qué. No cambies volumen e intensidad a la vez en una misma sesión.
4. Respeta las DECISIONES ANTERIORES DEL COACH: si rechazó o corrigió algo, no repitas el mismo planteamiento sin una razón nueva; adáptate a sus comentarios.
5. En la carga de fuerza/gimnasio el pulso infravalora el esfuerzo real: no concluyas que "entrena poco" solo por su TSS.
6. No des consejo médico. Ante dolor, lesión o síntomas, recomienda que lo valore un profesional y márcalo como alerta.
7. Escribe en español de España, claro y directo, sin relleno y sin reproches. Habla del atleta en tercera persona con su nombre: el lector es el coach, nunca el atleta.
8. En "evidencia" cita SOLO principios o autores del marco científico de arriba. Si ninguno encaja, escribe "criterio de entrenador (sin cita)". No inventes referencias ni atribuyas una idea a un autor que no la defiende.
9. Las zonas de pulso de Garmin son por % del pulso máximo y pueden quedar por debajo del umbral real: un rodaje suave con calor o poca base puede caer en Z4. Para el reparto de intensidad fíate de la sección REPARTO DE INTENSIDAD (calculada con el pulso de umbral del atleta) y antes de decir que algo fue intenso contrasta ritmo y pulso.
10. La sección EJECUCIÓN DE LAS SESIONES dice si lo planificado se cumplió (ritmos por repetición, caída al final, sesiones saltadas). Es lo más importante para juzgar si el plan funciona: si no se cumple, plantea si el objetivo es demasiado exigente o si faltó recuperación antes de tocar la carga.
11. Ritmos: un número MENOR de min/km es MÁS RÁPIDO (4:38 es más rápido que 4:49). Comprueba la dirección de cada comparación antes de escribirla, y no afirmes que algo es más rápido o lento que un umbral sin hacer esa comprobación. Si los ritmos por tramo empeoran hacia el final, dilo (caída).
12. PASOS NUEVOS (opcional). Solo si el cambio afecta a una sesión que tenga [sesion_id:...] en el contexto, puedes añadir "sesion_id" (copiado tal cual) y "pasos": la sesión COMPLETA ya modificada, en el mismo formato JSON que "pasos_actuales" (tipos: calentamiento, trabajo, recuperacion, enfriamiento y bloques {"tipo":"repetir","veces":N,"pasos":[...]}; duración {"unidad":"metros"|"segundos","valor":N}; objetivo {"tipo":"ritmo","min_seg_km":N,"max_seg_km":N} con un rango de 10-15 s/km). Parte siempre de pasos_actuales, conserva sus campos "nota" y cambia solo lo que justifica la decisión. Si el cambio es genérico o la sesión no tiene pasos, NO incluyas "pasos". Un coach humano revisará y aplicará el cambio.
13. Sé coherente con tus propias cifras: si dices que un límite se supera, no propongas algo que lo supera.
14. MÉTRICA OBJETIVO (opcional pero recomendable): si una decisión busca mover un indicador medible con el reloj, añade "metrica_objetivo" con UNO de: "pct_suave" (% del tiempo corriendo en suave), "deriva" (deriva cardiaca), "eficiencia" (eficiencia aeróbica), "carga_semana" (TSS semanal), "km_semana" (km de carrera por semana). Para "carga_semana" y "km_semana" añade también "direccion": "sube" o "baja". Así el coach podrá ver 4 semanas después si el cambio funcionó. No la pongas si ningún indicador la refleja.

Responde SOLO con este JSON:
{
  "resumen": "2-3 frases: cómo está el atleta ahora y qué se juega esta semana",
  "lecturas": [ { "titulo": "corto", "detalle": "qué dicen los datos y qué significa", "dato": "cifra concreta del contexto" } ],
  "decisiones": [ { "sesion": "nombre de la sesión del plan o 'general'", "cambio": "qué hacer exactamente", "razon": "por qué, ligado a los datos", "evidencia": "principio o autor", "confianza": 0.0, "metrica_objetivo": "pct_suave|deriva|eficiencia|carga_semana|km_semana (opcional)", "direccion": "sube|baja (solo con carga_semana o km_semana)", "sesion_id": "solo si propones pasos nuevos", "pasos": [ ... solo si propones pasos nuevos ... ] } ],
  "alerta_prioritaria": "texto o null",
  "preguntas_al_coach": ["dudas que solo el coach puede resolver"],
  "prioridad": 5,
  "score_confianza": 0.0
}
"prioridad": 1 (urgente) a 10 (rutinaria). "lecturas": máximo 4. "decisiones": máximo 5.`

export interface ResultadoAnalisis {
  ok: boolean
  tareaId?: string
  motivo?: string
}

interface Decision { sesion?: string; cambio?: string; razon?: string; evidencia?: string; confianza?: number; metrica_objetivo?: string; direccion?: string; sesion_id?: string; pasos?: unknown }
interface Salida {
  resumen?: string
  lecturas?: { titulo?: string; detalle?: string; dato?: string }[]
  decisiones?: Decision[]
  alerta_prioritaria?: string | null
  preguntas_al_coach?: string[]
  prioridad?: number
  score_confianza?: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const texto = (v: unknown, max = 600): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const acotar = (n: unknown, min: number, max: number, def: number): number => {
  const x = Number(n)
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def
}

/** Limpia lo que devuelve el modelo: solo campos esperados, con longitud acotada. */
export function sanearSalida(raw: unknown): { resumen: string; lecturas: { titulo: string; detalle: string; dato: string }[]; decisiones: { sesion: string; cambio: string; razon: string; evidencia: string; confianza: number; metrica_objetivo?: ClaveMetrica; direccion?: Direccion; sesion_id?: string; pasos?: Paso[] }[]; alerta: string | null; preguntas: string[]; prioridad: number; confianza: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Salida
  const resumen = texto(s.resumen, 700)
  if (!resumen) return null
  const decisiones = (Array.isArray(s.decisiones) ? s.decisiones : [])
    .map(d => {
      const metrica = CLAVES_METRICA.find(c => c === d.metrica_objetivo)
      const direccion: Direccion | undefined = d.direccion === 'sube' || d.direccion === 'baja' ? d.direccion : undefined
      const base = {
        sesion: texto(d.sesion, 120) || 'general', cambio: texto(d.cambio, 500), razon: texto(d.razon, 500), evidencia: texto(d.evidencia, 200), confianza: acotar(d.confianza, 0, 1, 0.5),
        ...(metrica ? { metrica_objetivo: metrica, ...(direccion && (metrica === 'carga_semana' || metrica === 'km_semana') ? { direccion } : {}) } : {}),
      }
      // Los pasos solo se conservan si traen un id de sesión con forma de UUID y el formato es válido.
      const id = texto(d.sesion_id, 60)
      const v = d.pasos !== undefined ? validarPasos(d.pasos) : null
      return UUID_RE.test(id) && v?.ok ? { ...base, sesion_id: id, pasos: v.pasos } : base
    })
    .filter(d => d.cambio)
    .slice(0, 5)
  return {
    resumen,
    lecturas: (Array.isArray(s.lecturas) ? s.lecturas : []).map(l => ({ titulo: texto(l.titulo, 100), detalle: texto(l.detalle, 500), dato: texto(l.dato, 120) })).filter(l => l.titulo || l.detalle).slice(0, 4),
    decisiones,
    alerta: texto(s.alerta_prioritaria, 400) || null,
    preguntas: (Array.isArray(s.preguntas_al_coach) ? s.preguntas_al_coach : []).map(p => texto(p, 300)).filter(Boolean).slice(0, 4),
    prioridad: Math.round(acotar(s.prioridad, 1, 10, 6)),
    confianza: acotar(s.score_confianza, 0, 1, 0.6),
  }
}

export async function ejecutarAnalisisRendimiento(clienteId: string, opciones: { forzar?: boolean } = {}): Promise<ResultadoAnalisis> {
  const db = createServiceSupabase()
  const hoy = new Date().toISOString().slice(0, 10)

  if (!opciones.forzar) {
    const hace6 = new Date(Date.now() - 6 * 86_400_000).toISOString()
    const { count } = await db.from('agente_tareas').select('id', { count: 'exact', head: true })
      .eq('cliente_id', clienteId).eq('tipo', 'analisis_rendimiento').gte('created_at', hace6)
    if (count && count > 0) return { ok: false, motivo: 'Ya hay un análisis de los últimos 6 días' }
  }

  const ctx = await construirContextoRendimiento(db, clienteId, hoy)
  if (!ctx.hayDatos) return { ok: false, motivo: 'Sin entrenos en las últimas 4 semanas: no hay base para analizar' }

  let crudo: string
  try {
    crudo = await llamarDeepSeek(SYSTEM, `DATOS DEL ATLETA\n\n${ctx.texto}`, 0.25)
  } catch (e) {
    console.error('[analisis-rendimiento] IA:', e instanceof Error ? e.message : e) // el detalle del proveedor no sale al navegador
    return { ok: false, motivo: 'La IA no ha respondido ahora; inténtalo de nuevo en unos minutos' }
  }

  let json: unknown
  try { json = JSON.parse(crudo) } catch {
    const m = crudo.match(/\{[\s\S]*\}/)
    try { json = m ? JSON.parse(m[0]) : null } catch { json = null }
  }
  const s = sanearSalida(json)
  if (!s) return { ok: false, motivo: 'La IA devolvió una respuesta que no se puede usar' }

  const tarea = await guardarTareaAgente('director', {
    tipo: 'analisis_rendimiento',
    propuesta: s.resumen,
    razonamiento: s.lecturas.map(l => `${l.titulo}: ${l.detalle}`).join('\n'),
    payload: {
      resumen: s.resumen,
      lecturas: s.lecturas,
      decisiones: s.decisiones,
      alerta_prioritaria: s.alerta,
      preguntas_al_coach: s.preguntas,
      alertas_automaticas: ctx.alertas,
      metricas: ctx.metricas,
    },
    fuentes: [],
    prioridad: s.prioridad,
    score_confianza: s.confianza,
    requiere_aprobacion: true,
  }, clienteId)

  return tarea ? { ok: true, tareaId: tarea.id } : { ok: false, motivo: 'No se pudo guardar el análisis' }
}
