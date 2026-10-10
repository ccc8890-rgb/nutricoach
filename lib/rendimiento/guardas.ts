// lib/rendimiento/guardas.ts
// Vallas que se aplican a lo que propone la IA antes de que llegue al coach. Las reglas del motor mandan:
// la IA puede añadir matices, pero no contradecir una alerta de seguridad, duplicar una regla ni atar una métrica que no encaja.
import type { ClaveMetrica, Direccion } from './seguimiento'
import type { EstadoAtleta } from './estado'
import type { PropuestaRegla, Riesgo } from './reglas'

export interface DecisionIA {
  sesion: string
  cambio: string
  razon: string
  evidencia: string
  confianza: number
  metrica_objetivo?: ClaveMetrica
  direccion?: Direccion
  sesion_id?: string
  pasos?: unknown
}

export interface DecisionRevisada extends DecisionIA {
  riesgo: Riesgo
  avisos: string[]
}

export interface Descartada { decision: DecisionIA; motivo: string }

/** Máximo de decisiones nuevas que puede añadir la IA además de las del motor. */
export const MAX_DECISIONES_IA = 2

type TipoSesion = 'rodaje' | 'calidad' | 'fuerza' | 'general'

export function tipoDeSesion(nombre: string): TipoSesion {
  const n = nombre.toLowerCase()
  if (/series|intervalo|fartlek|tempo|umbral|ritmo carrera|cuestas/.test(n)) return 'calidad'
  if (/rodaje|tirada|f[aá]cil|z2|zona 2|aer[oó]bic|regenerativ/.test(n)) return 'rodaje'
  if (/fuerza|h[ií]brid|gimnasio|gym|hyrox|estaci/.test(n)) return 'fuerza'
  return 'general'
}

/** Métricas que tienen sentido atar a cada tipo de sesión (las sesiones de calidad y de fuerza no mueven ninguna de las cinco). */
const METRICAS_PERMITIDAS: Record<TipoSesion, ClaveMetrica[] | 'todas'> = {
  rodaje: ['pct_suave', 'deriva', 'eficiencia', 'km_semana'],
  calidad: [],
  fuerza: [],
  general: 'todas',
}

const SUBE_CARGA = /\b(aument|sub[ei]r|subid|incremen|añad|alarg|más (volumen|km|series|carga|repeticion)|mayor (volumen|carga))/i
const OBJETO_CARGA = /(volumen|km|kil[oó]metr|seri[ea]|carga|distancia|repeticion|sesi[oó]n)/i
const NEGADO = /\b(no|sin|evita|evitar|nunca)\b[^.]{0,25}(aument|sub[ei]r|incremen|añad|alarg)/i

/** True si el texto propone aumentar volumen, series o carga (y no lo niega). */
export function proponeSubirCarga(texto: string): boolean {
  return SUBE_CARGA.test(texto) && OBJETO_CARGA.test(texto) && !NEGADO.test(texto)
}

/** Ritmos escritos en el texto (m:ss con minutos de 2 a 9, como 4:50 o 5:05), en segundos por km. */
export function ritmosEnTexto(texto: string): number[] {
  return [...texto.matchAll(/\b([2-9]):([0-5]\d)\b/g)].map(m => Number(m[1]) * 60 + Number(m[2]))
}

export function validarDecisionesIA(decisiones: DecisionIA[], estado: EstadoAtleta, motor: PropuestaRegla[]): { aceptadas: DecisionRevisada[]; descartadas: Descartada[] } {
  const aceptadas: DecisionRevisada[] = []
  const descartadas: Descartada[] = []
  const sobrecarga = ['rampa_alta', 'fatiga_alta', 'llega_cansado'].some(c => estado.alertas.includes(c))
  const cercaCompeticion = estado.diasCompeticion !== null && estado.diasCompeticion >= 0 && estado.diasCompeticion <= 14
  const cubiertas = new Set(motor.map(p => p.metrica_objetivo).filter(Boolean))

  for (const d of decisiones) {
    const texto = `${d.cambio} ${d.razon}`
    const avisos: string[] = []

    if (d.cambio.trim().length < 20 || /\b(NaN|undefined|null)\b/.test(texto)) { descartadas.push({ decision: d, motivo: 'Texto vacío o con valores sin calcular' }); continue }

    // Los ritmos que escribe la IA tienen que ser posibles para el VDOT del atleta (entre el de repeticiones y el fácil con margen).
    if (estado.ritmos) {
      const fuera = ritmosEnTexto(d.cambio).find(r => r < estado.ritmos!.R * 0.95 || r > estado.ritmos!.E * 1.3)
      if (fuera !== undefined) { descartadas.push({ decision: d, motivo: `Cita un ritmo (${Math.floor(fuera / 60)}:${String(fuera % 60).padStart(2, '0')}/km) imposible para su VDOT` }); continue }
    }

    const sube = proponeSubirCarga(d.cambio) || (d.direccion === 'sube' && (d.metrica_objetivo === 'carga_semana' || d.metrica_objetivo === 'km_semana'))
    if (sobrecarga && sube) { descartadas.push({ decision: d, motivo: 'Propone subir carga con una alerta de sobrecarga activa' }); continue }
    if (cercaCompeticion && sube) { descartadas.push({ decision: d, motivo: 'Propone subir carga a menos de 14 días de la competición' }); continue }

    let metrica = d.metrica_objetivo
    let direccion = d.direccion
    if (metrica && cubiertas.has(metrica)) { descartadas.push({ decision: d, motivo: `La métrica «${metrica}» ya la cubre una regla del motor` }); continue }
    if (metrica) {
      const permitidas = METRICAS_PERMITIDAS[tipoDeSesion(d.sesion)]
      if (permitidas !== 'todas' && !permitidas.includes(metrica)) {
        avisos.push(`Se quitó la métrica objetivo «${metrica}»: no encaja con una sesión de ${tipoDeSesion(d.sesion)}.`)
        metrica = undefined
        direccion = undefined
      }
    }

    aceptadas.push({ ...d, metrica_objetivo: metrica, direccion, riesgo: sube ? 'medio' : d.pasos ? 'medio' : 'bajo', avisos })
  }

  // Solo caben unas pocas decisiones nuevas: se quedan las de mayor confianza declarada.
  aceptadas.sort((a, b) => b.confianza - a.confianza)
  for (const sobrante of aceptadas.splice(MAX_DECISIONES_IA)) descartadas.push({ decision: sobrante, motivo: `Solo se admiten ${MAX_DECISIONES_IA} decisiones nuevas de la IA por análisis` })
  return { aceptadas, descartadas }
}
