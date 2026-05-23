export interface CheckInResumen {
  fecha: string
  adherencia?: number | null
  energia?: number | null
  sueno?: number | null
}

export interface AdherenciaScore {
  score: number          // 0-100
  tendencia: 'mejora' | 'estable' | 'bajando'
  riesgo_abandono: 'bajo' | 'medio' | 'alto'
  semanas_sin_checkin: number
  checkins_ultimas_4_semanas: number
  media_adherencia: number | null
  media_energia: number | null
  media_sueno: number | null
  alertas: string[]
}

export function calcularAdherencia(checkins: CheckInResumen[]): AdherenciaScore {
  const alertas: string[] = []
  const ahora = new Date()
  const hace4s = new Date(ahora.getTime() - 28 * 24 * 60 * 60 * 1000)
  const hace2s = new Date(ahora.getTime() - 14 * 24 * 60 * 60 * 1000)

  // Ordenar por fecha descendente
  const ordenados = [...checkins].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  // Semanas sin check-in
  const ultimo = ordenados[0]
  let semanas_sin_checkin = 0
  if (ultimo) {
    const diasDesde = Math.floor((ahora.getTime() - new Date(ultimo.fecha).getTime()) / (1000 * 60 * 60 * 24))
    semanas_sin_checkin = Math.floor(diasDesde / 7)
  } else {
    semanas_sin_checkin = 99
  }

  // Check-ins en las últimas 4 semanas
  const recientes = ordenados.filter(c => new Date(c.fecha) >= hace4s)
  const checkins_ultimas_4_semanas = recientes.length

  // Medias de los últimos 4 check-ins
  const ultimos4 = ordenados.slice(0, 4)
  const adhs = ultimos4.map(c => c.adherencia).filter((v): v is number => v != null)
  const energias = ultimos4.map(c => c.energia).filter((v): v is number => v != null)
  const suenos = ultimos4.map(c => c.sueno).filter((v): v is number => v != null)

  const media_adherencia = adhs.length > 0 ? Math.round(adhs.reduce((s, v) => s + v, 0) / adhs.length) : null
  const media_energia = energias.length > 0 ? Math.round(energias.reduce((s, v) => s + v, 0) / energias.length * 10) / 10 : null
  const media_sueno = suenos.length > 0 ? Math.round(suenos.reduce((s, v) => s + v, 0) / suenos.length * 10) / 10 : null

  // Tendencia: comparar últimas 2 semanas vs 2 anteriores
  const ult2s = ordenados.filter(c => new Date(c.fecha) >= hace2s)
  const ant2s = ordenados.filter(c => new Date(c.fecha) < hace2s && new Date(c.fecha) >= hace4s)
  let tendencia: AdherenciaScore['tendencia'] = 'estable'
  if (ult2s.length > 0 && ant2s.length > 0) {
    const mediaUlt = ult2s.reduce((s, c) => s + (c.adherencia ?? 5), 0) / ult2s.length
    const mediaAnt = ant2s.reduce((s, c) => s + (c.adherencia ?? 5), 0) / ant2s.length
    if (mediaUlt > mediaAnt + 5) tendencia = 'mejora'
    else if (mediaUlt < mediaAnt - 5) tendencia = 'bajando'
  }

  // Score compuesto (0-100)
  let score = 50

  // Frecuencia de check-in (esperado: 1/semana → 4 en 4 semanas)
  const frecuencia_pct = Math.min(checkins_ultimas_4_semanas / 4, 1)
  score = 20 + frecuencia_pct * 40 // 20-60 por frecuencia

  // Adherencia media
  if (media_adherencia !== null) {
    score += (media_adherencia / 100) * 25 // 0-25 por adherencia
  }

  // Energía media (1-10 escala)
  if (media_energia !== null) {
    score += (media_energia / 10) * 10 // 0-10 por energía
  }

  // Penalización si lleva > 2 semanas sin check-in
  if (semanas_sin_checkin >= 2) score -= 15
  if (semanas_sin_checkin >= 4) score -= 15

  score = Math.max(0, Math.min(100, Math.round(score)))

  // Riesgo abandono
  let riesgo_abandono: AdherenciaScore['riesgo_abandono'] = 'bajo'
  if (score < 40 || semanas_sin_checkin >= 3) riesgo_abandono = 'alto'
  else if (score < 60 || semanas_sin_checkin >= 2 || tendencia === 'bajando') riesgo_abandono = 'medio'

  // Alertas
  if (semanas_sin_checkin >= 2) alertas.push(`Sin check-in ${semanas_sin_checkin} semanas`)
  if (media_adherencia !== null && media_adherencia < 50) alertas.push(`Adherencia baja: ${media_adherencia}%`)
  if (media_energia !== null && media_energia < 4) alertas.push(`Energía muy baja: ${media_energia}/10`)
  if (tendencia === 'bajando') alertas.push('Tendencia a la baja')

  return {
    score,
    tendencia,
    riesgo_abandono,
    semanas_sin_checkin,
    checkins_ultimas_4_semanas,
    media_adherencia,
    media_energia,
    media_sueno,
    alertas,
  }
}
