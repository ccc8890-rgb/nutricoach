// lib/rendimiento/plan-objetivo.ts
// Planificador hacia una carrera objetivo: viabilidad, fases, carga semanal y sesiones clave con pasos por zonas.
// Criterios: periodización por bloques (base → construcción → específica → puesta a punto), subida de carga gradual
// con descarga cada 4.ª semana (Banister/Coggan), reducción de volumen manteniendo intensidad antes de competir
// (Mujika y Padilla) y ritmos de Daniels. Es una propuesta para el coach: no escribe en ningún plan.
import { validarPasos, resumenSesion, type Paso, type PasoSimple } from '@/lib/entrenos/pasos'
import { ritmosDesdeVdot } from '@/lib/entrenos/ritmos'
import { vdotDeMarca } from './vdot'
import { lunesDe } from './panel'

export interface ObjetivoCarrera {
  distancia_m: number
  tiempo_s: number
  /** Fecha de la carrera (YYYY-MM-DD). */
  fecha: string
}

export interface EntradaPlan {
  hoy: string
  objetivo: ObjetivoCarrera
  vdot: number
  /** TSS medio por semana de las últimas 4 semanas. */
  cargaSemanalActual: number
  /** Km de carrera medios por semana de las últimas 4 semanas. */
  kmSemanaActual: number
  /** Tirada más larga de las últimas 6 semanas (km). */
  tiradaMaxKm: number
}

export type Fase = 'base' | 'construccion' | 'especifica' | 'taper' | 'carrera'
export type TipoClave = 'calidad1' | 'calidad2' | 'tirada'

export interface SesionClave {
  tipo: TipoClave
  titulo: string
  descripcion: string
  pasos: Paso[]
}

export interface SemanaPlan {
  n: number
  lunes: string
  fase: Fase
  descarga: boolean
  tssObjetivo: number
  kmObjetivo: number
  tiradaKm: number
  claves: SesionClave[]
}

export type Viabilidad = 'realista' | 'ambicioso' | 'poco_realista'

export interface PlanObjetivo {
  semanas: SemanaPlan[]
  viabilidad: {
    nivel: Viabilidad
    vdotNecesario: number
    vdotActual: number
    brecha: number
    semanasDisponibles: number
    /** Lo que correría hoy con su VDOT actual. */
    tiempoPrevistoHoy_s: number
    texto: string
  }
  ritmoCarrera_s_km: number
  avisos: string[]
}

const DIA = 86_400_000
/** Mejora de VDOT razonable por semana en un atleta ya entrenado (orientativa). */
const VDOT_POR_SEMANA = 0.15

/** Tiempo que corresponde a un VDOT para una distancia (inversa de vdotDeMarca, por bisección). */
export function tiempoParaVdot(distancia_m: number, vdot: number): number {
  let lo = distancia_m / 10 // 10 m/s
  let hi = distancia_m / 1.5
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const v = vdotDeMarca(distancia_m, mid) ?? 0
    if (v > vdot) lo = mid
    else hi = mid
  }
  return Math.round((lo + hi) / 2)
}

const redondear5 = (n: number) => Math.round(n / 5) * 5
const sumarDias = (f: string, n: number) => new Date(new Date(`${f}T12:00:00Z`).getTime() + n * DIA).toISOString().slice(0, 10)

function tamanoTaper(distancia_m: number): number {
  // Incluye la semana de carrera: 5-21 km → una semana previa reducida más la de carrera; maratón → dos previas.
  return distancia_m <= 22_000 ? 2 : 3
}
function tiradaTope(distancia_m: number): number {
  return distancia_m <= 5500 ? 14 : distancia_m <= 10_500 ? 16 : distancia_m <= 22_000 ? 22 : 32
}

const trabajoZ = (m: number, zona: 'E' | 'M' | 'T' | 'I' | 'R') => ({ tipo: 'trabajo' as const, duracion: { unidad: 'metros' as const, valor: m }, objetivo: { tipo: 'zona' as const, zona } })
const rec = (m: number) => ({ tipo: 'recuperacion' as const, duracion: { unidad: 'metros' as const, valor: m } })
const calentar = (m: number) => ({ tipo: 'calentamiento' as const, duracion: { unidad: 'metros' as const, valor: m } })
const enfriar = (m: number) => ({ tipo: 'enfriamiento' as const, duracion: { unidad: 'metros' as const, valor: m } })
const bloque = (veces: number, pasos: PasoSimple[]): Paso => ({ tipo: 'repetir', veces, pasos })

function ritmoRango(ritmoS: number) {
  return { tipo: 'ritmo' as const, min_seg_km: Math.round(ritmoS - 4), max_seg_km: Math.round(ritmoS + 4) }
}

function sesionesDeSemana(fase: Fase, descarga: boolean, idx: number, tiradaKm: number, ritmoCarrera: number, esRace: boolean, cal: number): SesionClave[] {
  const f = descarga ? 0.6 : 1
  const wu = () => calentar(cal)
  const cd = () => enfriar(cal)
  const reps = (n: number) => Math.max(2, Math.round(n * f))
  const tirada: SesionClave = {
    tipo: 'tirada',
    titulo: `Tirada larga ${tiradaKm} km`,
    descripcion: 'Rodaje largo en zona fácil. El pulso manda sobre el ritmo: si se dispara por calor, baja el ritmo.',
    pasos: [calentar(1000), { ...trabajoZ(Math.max(2000, Math.round(tiradaKm * 1000) - 1000), 'E') }],
  }
  if (esRace) {
    return [{
      tipo: 'calidad1', titulo: 'Activación previa a la carrera',
      descripcion: 'Trote suave y 4 progresiones cortas para llegar con piernas vivas.',
      pasos: [calentar(Math.min(cal, 1500)), bloque(4, [{ tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 20 }, objetivo: { tipo: 'zona', zona: 'R' } }, { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 60 } }]), enfriar(1000)],
    }]
  }
  if (fase === 'base') {
    const k = Math.min(4, 2 + Math.floor(idx / 2))
    return [
      { tipo: 'calidad1', titulo: `Tempo en bloques ${reps(k)}×8 min`, descripcion: 'Umbral dividido en bloques: sube el ritmo al que se aguanta sin acumular tanta fatiga como un tempo continuo.',
        pasos: [wu(), bloque(reps(k), [{ tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 480 }, objetivo: { tipo: 'zona', zona: 'T' } }, { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 120 } }]), cd()] },
      { tipo: 'calidad2', titulo: 'Rodaje con progresiones', descripcion: 'Rodaje fácil con 6 progresiones de 20 s para técnica y economía de carrera.',
        pasos: [calentar(cal + 1000), bloque(6, [{ tipo: 'trabajo', duracion: { unidad: 'segundos', valor: 20 }, objetivo: { tipo: 'zona', zona: 'R' } }, { tipo: 'recuperacion', duracion: { unidad: 'segundos', valor: 60 } }]), enfriar(cal)] },
      tirada,
    ]
  }
  if (fase === 'construccion') {
    const n = Math.min(6, 4 + Math.floor(idx / 3))
    return [
      { tipo: 'calidad1', titulo: `Intervalos ${reps(n)}×1000 m`, descripcion: 'Trabajo cercano al VO₂max: el estímulo que más sube el VDOT.',
        pasos: [wu(), bloque(reps(n), [trabajoZ(1000, 'I'), rec(400)]), cd()] },
      { tipo: 'calidad2', titulo: `Umbral continuo ${descarga ? 20 : 25} min`, descripcion: 'Tempo sostenido a ritmo de umbral.',
        pasos: [wu(), { tipo: 'trabajo', duracion: { unidad: 'segundos', valor: descarga ? 1200 : 1500 }, objetivo: { tipo: 'zona', zona: 'T' } }, cd()] },
      tirada,
    ]
  }
  if (fase === 'especifica') {
    return [
      { tipo: 'calidad1', titulo: `Ritmo de carrera ${reps(3)}×2000 m`, descripcion: 'Series largas al ritmo objetivo de la carrera: el cuerpo aprende el gesto y la sensación.',
        pasos: [wu(), bloque(reps(3), [{ tipo: 'trabajo', duracion: { unidad: 'metros', valor: 2000 }, objetivo: ritmoRango(ritmoCarrera) }, rec(400)]), cd()] },
      { tipo: 'calidad2', titulo: `Intervalos ${reps(5)}×1000 m`, descripcion: 'Mantiene el techo aeróbico mientras se afina el ritmo de carrera.',
        pasos: [wu(), bloque(reps(5), [trabajoZ(1000, 'I'), rec(400)]), cd()] },
      tirada,
    ]
  }
  // taper: se mantiene la intensidad y se recorta el volumen
  return [
    { tipo: 'calidad1', titulo: '4×1000 m al ritmo de carrera', descripcion: 'Última sesión de calidad: volumen bajo, ritmo de carrera, recuperación completa.',
      pasos: [wu(), bloque(4, [{ tipo: 'trabajo', duracion: { unidad: 'metros', valor: 1000 }, objetivo: ritmoRango(ritmoCarrera) }, rec(400)]), enfriar(Math.min(cal, 1500))] },
    { ...tirada, titulo: `Rodaje largo corto ${tiradaKm} km`, descripcion: 'Rodaje suave más corto para llegar descansado.' },
  ]
}

export function generarPlan(e: EntradaPlan): PlanObjetivo | { error: string } {
  const { objetivo } = e
  if (objetivo.distancia_m < 3000 || objetivo.distancia_m > 50_000) return { error: 'La distancia debe estar entre 3 y 50 km' }
  if (objetivo.tiempo_s <= 0) return { error: 'Falta el tiempo objetivo' }
  const lunesHoy = lunesDe(e.hoy)
  // Si ya es viernes o más tarde, la semana en curso no da para empezar un bloque: se arranca el lunes siguiente.
  const dowHoy = (new Date(`${e.hoy}T12:00:00Z`).getUTCDay() + 6) % 7
  const inicio = dowHoy >= 4 ? sumarDias(lunesHoy, 7) : lunesHoy
  const lunesCarrera = lunesDe(objetivo.fecha)
  const semanasN = Math.round((new Date(`${lunesCarrera}T12:00:00Z`).getTime() - new Date(`${inicio}T12:00:00Z`).getTime()) / (7 * DIA)) + 1
  if (objetivo.fecha <= e.hoy) return { error: 'La carrera debe ser en el futuro' }
  if (semanasN < 4) return { error: 'Hacen falta al menos 4 semanas de preparación' }
  if (semanasN > 24) return { error: 'Planificar más de 24 semanas no tiene sentido: elige una carrera más cercana' }

  const ritmoCarrera = (objetivo.tiempo_s / objetivo.distancia_m) * 1000
  const nTaper = Math.min(tamanoTaper(objetivo.distancia_m), semanasN - 3)
  const trabajo = semanasN - nTaper
  const nEsp = trabajo >= 6 ? Math.max(1, Math.round(trabajo * 0.3)) : 0
  const nCon = Math.round(trabajo * 0.35)
  const nBase = trabajo - nEsp - nCon

  const tssPorKm = e.kmSemanaActual > 5 ? Math.min(14, Math.max(6, e.cargaSemanalActual / e.kmSemanaActual)) : 8
  const tssInicial = Math.max(60, e.cargaSemanalActual)
  const tope = tiradaTope(objetivo.distancia_m)

  const semanas: SemanaPlan[] = []
  let ultimaNormal = tssInicial
  // La tirada arranca en torno al 40 % del volumen semanal actual (sin pasar de su salida más larga reciente):
  // una semana atípica de mucho volumen no debe marcar el punto de partida.
  const kmInicial = Math.max(10, Math.round(tssInicial / tssPorKm))
  let tirada = Math.min(tope, Math.max(8, Math.min(Math.round(e.tiradaMaxKm || 10), Math.round(kmInicial * 0.4))))
  const ritmos = ritmosDesdeVdot(e.vdot)
  let pico = tssInicial
  for (let i = 0; i < semanasN; i++) {
    const esUltima = i === semanasN - 1
    let fase: Fase = i < nBase ? 'base' : i < nBase + nCon ? 'construccion' : i < trabajo ? 'especifica' : 'taper'
    if (esUltima) fase = 'carrera'
    const enTaper = fase === 'taper' || fase === 'carrera'
    // La descarga de cada 4.ª semana se omite en la última semana de trabajo: la puesta a punto ya hace de descarga.
    const descarga = !enTaper && (i + 1) % 4 === 0 && i + 1 < trabajo
    let tss: number
    if (enTaper) tss = pico * (esUltima ? 0.5 : nTaper >= 3 && i < semanasN - 2 ? 0.8 : 0.65)
    else if (descarga) tss = ultimaNormal * 0.7
    else { tss = i === 0 ? tssInicial : ultimaNormal * 1.07; ultimaNormal = tss; pico = Math.max(pico, tss) }
    const tiradaSemana = enTaper ? Math.round(tirada * (esUltima ? 0.35 : 0.6)) : descarga ? Math.round(tirada * 0.7) : tirada
    if (!enTaper && !descarga) tirada = Math.min(tope, tirada + 1)
    const kmPorTss = Math.round(tss / tssPorKm)
    // Calentamientos y vueltas a la calma más cortos cuando el volumen semanal es bajo.
    const cal = kmPorTss < 24 ? 1500 : 2000
    const claves = sesionesDeSemana(fase, descarga, i, tiradaSemana, ritmoCarrera, esUltima, cal)
    // El volumen de la semana nunca puede ser menor que el de sus propias sesiones clave.
    const kmClaves = claves.reduce((a, c) => a + resumenSesion(c.pasos, ritmos).distancia_m / 1000, 0)
    const kmSemana = Math.max(kmPorTss, Math.round(kmClaves))
    semanas.push({
      n: i + 1,
      lunes: sumarDias(inicio, i * 7),
      fase,
      descarga,
      tssObjetivo: redondear5(tss),
      kmObjetivo: kmSemana,
      tiradaKm: tiradaSemana,
      claves,
    })
  }

  const vdotNecesario = vdotDeMarca(objetivo.distancia_m, objetivo.tiempo_s) ?? e.vdot
  const brecha = Math.round((vdotNecesario - e.vdot) * 10) / 10
  const posible = VDOT_POR_SEMANA * semanasN
  const nivel: Viabilidad = brecha <= posible * 0.5 ? 'realista' : brecha <= posible * 1.2 ? 'ambicioso' : 'poco_realista'
  const previsto = tiempoParaVdot(objetivo.distancia_m, e.vdot)
  const mmss = (s: number) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' : ''}${String(Math.floor((s % 3600) / 60)).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`
  const texto = nivel === 'realista'
    ? `Con VDOT ${e.vdot} correría hoy ${mmss(previsto)}; el objetivo (${mmss(objetivo.tiempo_s)}) pide VDOT ${vdotNecesario}, a ${Math.max(brecha, 0)} puntos. En ${semanasN} semanas es alcanzable con un bloque bien ejecutado.`
    : nivel === 'ambicioso'
      ? `Con VDOT ${e.vdot} correría hoy ${mmss(previsto)}; el objetivo (${mmss(objetivo.tiempo_s)}) pide VDOT ${vdotNecesario}, a ${brecha} puntos. Es exigente para ${semanasN} semanas: posible si todo sale bien y se cumple lo planificado.`
      : `Con VDOT ${e.vdot} correría hoy ${mmss(previsto)}; el objetivo (${mmss(objetivo.tiempo_s)}) pide VDOT ${vdotNecesario}, a ${brecha} puntos. En ${semanasN} semanas es poco realista; conviene un objetivo más cercano o más semanas.`

  const avisos: string[] = []
  if (e.cargaSemanalActual < 60) avisos.push('Su carga semanal actual es muy baja: el plan arranca desde un mínimo de 60 TSS/semana.')
  if (tiradaTope(objetivo.distancia_m) < e.tiradaMaxKm) avisos.push('Su tirada más larga ya supera la que haría falta para esta distancia.')
  if (nEsp === 0) avisos.push('Hay pocas semanas para una fase específica: el bloque es sobre todo de base y construcción.')

  // Cada sesión generada debe ser un conjunto de pasos válido para el reloj.
  for (const s of semanas) for (const c of s.claves) {
    const v = validarPasos(c.pasos)
    if (!v.ok) return { error: `Plan inconsistente en la semana ${s.n}: ${v.error}` }
  }
  return { semanas, viabilidad: { nivel, vdotNecesario, vdotActual: e.vdot, brecha, semanasDisponibles: semanasN, tiempoPrevistoHoy_s: previsto, texto }, ritmoCarrera_s_km: Math.round(ritmoCarrera), avisos }
}
