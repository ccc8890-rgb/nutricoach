// lib/entrenos/reparto-semana.ts
// Reparto de los días de la semana de un plan híbrido (fuerza/Hyrox + carrera). Determinista: la IA redacta las sesiones, pero NO decide el día
// de cada una. Las sesiones de carrera conservan los días del esqueleto del macrociclo (calidad nunca seguida ni el día antes de la tirada) y las
// híbridas se colocan alrededor de ellas con reglas fijas.
//
// Reglas (criterio de entrenador de híbridos, no cifras de un estudio):
//  - Una sesión híbrida con trabajo de pierna (sentadilla, wall balls, sled push, zancadas…) no va el día de la tirada ni de una sesión de
//    calidad, ni el día anterior a ninguna de las dos: llegaría con las piernas cargadas a la sesión que más importa de la semana.
//  - Dos sesiones de pierna, con al menos 2 días entre ellas (≥ 48 h de recuperación del mismo grupo).
//  - Una híbrida de tren superior puede compartir día con un rodaje fácil (doble sesión), nunca con tirada o calidad.
//  - Los días distintos de entreno no superan los días disponibles del atleta; siempre queda al menos un día de descanso completo.
export const DIAS_NOMBRE = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const

export type TipoRunEsqueleto = 'rodaje' | 'tirada' | 'tempo' | 'series' | 'ritmo_carrera' | 'strides'
const ES_CALIDAD = (t: string) => t === 'tempo' || t === 'series' || t === 'ritmo_carrera'

export interface RunFijo { tipo: string; dia: number }
export interface HibridaPlan { pierna: boolean; /** Lleva carrera tras la estación (Hyrox): no el día antes de la tirada. */ conCarrera?: boolean }

const PIERNA = /sentadilla|squat|wall ?ball|zancada|lunge|peso muerto|deadlift|sled push|empuje de trineo|prensa|hip thrust|b[uú]lgara|burpee broad|step ?up|thruster/i

/** ¿La sesión tiene trabajo de pierna? Mira el nombre y los ejercicios. */
/** ¿La sesión híbrida incluye carrera tras la estación (ejercicio «Carrera continua»)? */
export function tieneCarreraTrasEstacion(s: { ejercicios?: { nombre?: string | null }[] | null }): boolean {
  return (s.ejercicios ?? []).some(e => /carrera continua|carrera comprometida/i.test(e.nombre ?? ''))
}

export function tieneTrabajoDePierna(s: { nombre?: string | null; ejercicios?: { nombre?: string | null; bloque?: string | null }[] | null }): boolean {
  if (PIERNA.test(s.nombre ?? '')) return true
  return (s.ejercicios ?? []).some(e => e.bloque !== 'calentamiento' && e.bloque !== 'movilidad' && PIERNA.test(e.nombre ?? ''))
}

export function diaNumero(d?: string | null): number {
  const t = (d ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].indexOf(t)
}

export interface ResultadoReparto {
  /** Día (0 = lunes) de cada híbrida, en el mismo orden que la entrada. */
  dias: number[]
  /** Cosas que no se han podido cumplir del todo. */
  avisos: string[]
}

const comb = (n: number, k: number): number[][] => {
  if (k === 0) return [[]]
  const out: number[][] = []
  const rec = (ini: number, cur: number[]) => {
    if (cur.length === k) { out.push([...cur]); return }
    for (let i = ini; i < n; i++) { cur.push(i); rec(i + 1, cur); cur.pop() }
  }
  rec(0, [])
  return out
}

/**
 * Coloca las híbridas en los días de la semana respetando las reglas de arriba. Prueba todas las combinaciones (7 elegir k ≤ 6) y se queda con la
 * de menor penalización; con empate, la primera por orden de días. Si ninguna cumple todas las reglas duras, devuelve la menos mala y lo avisa.
 */
export function repartirHibridas(runs: RunFijo[], hibridas: HibridaPlan[], diasDisponibles: number | null): ResultadoReparto {
  const n = hibridas.length
  const avisos: string[] = []
  if (n === 0) return { dias: [], avisos }
  const tirada = runs.filter(r => r.tipo === 'tirada').map(r => r.dia)
  const calidad = runs.filter(r => ES_CALIDAD(r.tipo)).map(r => r.dia)
  const facilesDias = runs.filter(r => !ES_CALIDAD(r.tipo) && r.tipo !== 'tirada').map(r => r.dia)
  const runDias = new Set(runs.map(r => r.dia))
  const clave = [...tirada, ...calidad]
  const antesDeClave = new Set(clave.map(d => d - 1))
  const despuesDeTirada = new Set(tirada.map(d => d + 1))
  const indicesPierna = hibridas.map((h, i) => (h.pierna ? i : -1)).filter(i => i >= 0)

  let mejor: { dias: number[]; puntos: number; duras: number } | null = null
  // Cada elección de n días distintos × todas las permutaciones sobre las híbridas (para decidir cuál va en cada día).
  const permutaciones = (a: number[]): number[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => permutaciones([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])))
  for (const dias of comb(7, n)) {
    for (const asign of permutaciones(dias)) {
      let duras = 0
      let puntos = 0
      const usados = new Set([...runDias, ...asign])
      // Reglas duras (penalización alta: solo se incumplen si no hay otra opción).
      for (let i = 0; i < n; i++) {
        const d = asign[i]
        if (clave.includes(d)) { duras++; puntos += 1000 } // ni tirada ni calidad el mismo día
        // Carrera tras la estación: carga las piernas menos que una de pierna, pero no el día antes de la tirada larga.
        if (hibridas[i].conCarrera && tirada.includes(d + 1)) puntos += 500
        if (hibridas[i].pierna) {
          if (antesDeClave.has(d)) { duras++; puntos += 1000 }
          if (despuesDeTirada.has(d)) puntos += 40 // pierna el día después de la tirada: se evita, no es regla dura
        }
      }
      for (let a = 0; a < indicesPierna.length; a++) for (let b = a + 1; b < indicesPierna.length; b++) {
        if (Math.abs(asign[indicesPierna[a]] - asign[indicesPierna[b]]) < 2) { duras++; puntos += 1000 }
      }
      if (diasDisponibles !== null && usados.size > diasDisponibles) { duras++; puntos += 1000 * (usados.size - diasDisponibles) }
      if (usados.size >= 7) { duras++; puntos += 1000 } // siempre un día de descanso completo
      // Preferencias: pocas dobles, la doble con un rodaje fácil, hibridas repartidas y sin tres días seguidos de entreno.
      for (let i = 0; i < n; i++) if (runDias.has(asign[i])) { puntos += 6; if (!facilesDias.includes(asign[i])) puntos += 20; if (hibridas[i].pierna) puntos += 25 }
      const orden = [...usados].sort((x, y) => x - y)
      let racha = 1
      for (let i = 1; i < orden.length; i++) { racha = orden[i] === orden[i - 1] + 1 ? racha + 1 : 1; if (racha >= 4) puntos += 15 }
      // Una híbrida el día de después de una calidad: aceptable pero menos buena.
      for (let i = 0; i < n; i++) if (calidad.includes(asign[i] - 1)) puntos += 4
      // Preferir que el descanso caiga en lunes o domingo (empieza y acaba la semana) en igualdad de condiciones.
      for (const d of [0, 1, 2, 3, 4, 5, 6]) if (!usados.has(d)) puntos += d === 0 || d === 6 ? 0 : 2
      if (!mejor || puntos < mejor.puntos) mejor = { dias: asign, puntos, duras }
    }
  }
  const m = mejor!
  if (m.duras > 0) {
    avisos.push('No existe un reparto que cumpla todas las reglas (pierna lejos de tirada/calidad, 48 h entre sesiones de pierna, días disponibles): se ha elegido el menos malo; conviene que el coach lo revise.')
  }
  return { dias: m.dias, avisos }
}

export interface SesionReparto {
  nombre?: string | null
  dia_semana?: string | null
  tipo_sesion?: string | null
  ejercicios?: { nombre?: string | null; bloque?: string | null }[] | null
}

export interface HallazgoReparto { nivel: 'error' | 'aviso'; codigo: string; texto: string }

/** Revisión de la semana completa (carrera + híbridas): días disponibles y piernas cargadas ante la sesión importante. */
export function validarRepartoSemana(
  sesiones: (SesionReparto & { esCarrera: boolean; tipoCarrera?: string })[],
  diasDisponibles: number | null,
): HallazgoReparto[] {
  const h: HallazgoReparto[] = []
  const dias = new Set(sesiones.map(s => diaNumero(s.dia_semana)).filter(d => d >= 0))
  if (diasDisponibles !== null && dias.size > diasDisponibles) h.push({ nivel: 'aviso', codigo: 'mas_dias_que_disponibles', texto: `El plan usa ${dias.size} días distintos de entreno y el atleta tiene ${diasDisponibles} disponibles: hay que juntar sesiones en un mismo día.` })
  const tirada = sesiones.filter(s => s.esCarrera && s.tipoCarrera === 'tirada').map(s => diaNumero(s.dia_semana)).filter(d => d >= 0)
  const calidad = sesiones.filter(s => s.esCarrera && s.tipoCarrera && ES_CALIDAD(s.tipoCarrera)).map(s => diaNumero(s.dia_semana)).filter(d => d >= 0)
  const piernas = sesiones.filter(s => !s.esCarrera && tieneTrabajoDePierna(s))
  for (const s of piernas) {
    const d = diaNumero(s.dia_semana)
    if (d < 0) continue
    if (tirada.includes(d + 1)) h.push({ nivel: 'aviso', codigo: 'pierna_antes_tirada', texto: `«${s.nombre}» tiene trabajo de pierna el día anterior a la tirada larga: llegaría con las piernas cargadas.` })
    if (calidad.includes(d + 1)) h.push({ nivel: 'aviso', codigo: 'pierna_antes_calidad', texto: `«${s.nombre}» tiene trabajo de pierna el día anterior a una sesión de calidad.` })
    if (tirada.includes(d) || calidad.includes(d)) h.push({ nivel: 'aviso', codigo: 'pierna_con_carrera_clave', texto: `«${s.nombre}» (con pierna) cae el mismo día que la tirada o una sesión de calidad.` })
  }
  // Carrera comprometida (estación + 400-500 m corriendo) en una híbrida: carga las piernas menos que una sesión de pierna, pero no el día antes de la tirada.
  for (const s of sesiones.filter(x => !x.esCarrera && (x.ejercicios ?? []).some(e => /carrera continua|carrera comprometida/i.test(e.nombre ?? '')))) {
    const d = diaNumero(s.dia_semana)
    if (d >= 0 && tirada.includes(d + 1)) h.push({ nivel: 'aviso', codigo: 'carrera_comprometida_antes_tirada', texto: `«${s.nombre}» incluye carrera tras la estación el día anterior a la tirada larga: mejor moverla o quitar esa carrera.` })
  }
  if (dias.size >= 7) h.push({ nivel: 'aviso', codigo: 'sin_dia_de_descanso', texto: 'El plan entrena los 7 días de la semana: falta al menos un día completo de descanso.' })
  const diasPierna = piernas.map(s => diaNumero(s.dia_semana)).filter(d => d >= 0).sort((a, b) => a - b)
  for (let i = 1; i < diasPierna.length; i++) if (diasPierna[i] - diasPierna[i - 1] < 2) h.push({ nivel: 'aviso', codigo: 'pierna_seguida', texto: 'Hay dos sesiones con trabajo de pierna con menos de 48 h entre ellas.' })
  return h
}
