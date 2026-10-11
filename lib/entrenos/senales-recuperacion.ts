// lib/entrenos/senales-recuperacion.ts
// Qué señales de recuperación del reloj son FIABLES para este atleta, para que el plan no proponga autorregular con datos que no existen.
export interface FilaSenales { fecha: string; rhr: number | null; hrv: number | null; sueno_h: number | null; training_readiness: number | null; body_battery_max: number | null }

export interface SenalesRecuperacion {
  dias: number
  rhr: boolean
  preparacion: boolean
  bateria: boolean
  /** HRV con valores distintos de un día a otro (si es siempre el mismo valor es la media semanal repetida, no una medida diaria). */
  hrvDiaria: boolean
  /** Noches con horas de sueño registradas. */
  nochesSueno: number
}

/** `filas`: los últimos días de Garmin Connect (de más antiguo a más reciente). */
export function senalesRecuperacion(filas: FilaSenales[]): SenalesRecuperacion {
  const con = (f: (x: FilaSenales) => number | null) => filas.filter(x => f(x) != null).length
  const hrv = filas.map(x => x.hrv).filter((v): v is number => v != null)
  return {
    dias: filas.length,
    rhr: con(x => x.rhr) >= Math.max(3, filas.length * 0.5),
    preparacion: con(x => x.training_readiness) >= Math.max(3, filas.length * 0.5),
    bateria: con(x => x.body_battery_max) >= Math.max(3, filas.length * 0.5),
    hrvDiaria: new Set(hrv).size >= Math.min(5, Math.max(2, Math.floor(hrv.length / 2))),
    nochesSueno: filas.filter(x => x.sueno_h != null && x.sueno_h > 0).length,
  }
}

export function textoSenales(s: SenalesRecuperacion): string {
  if (s.dias === 0) return '- SEÑALES DE RECUPERACIÓN: sin datos del reloj; no propongas ajustar el entrenamiento con HRV ni sueño.'
  const si = [s.rhr && 'pulso en reposo', s.preparacion && 'preparación para entrenar de Garmin', s.bateria && 'batería corporal'].filter(Boolean)
  const no = [!s.hrvDiaria && 'HRV diaria (el reloj solo entrega una media semanal repetida)', s.nochesSueno < Math.ceil(s.dias / 2) && `sueño (solo ${s.nochesSueno} de ${s.dias} noches registradas)`].filter(Boolean)
  return `- SEÑALES DE RECUPERACIÓN (últimos ${s.dias} días): FIABLES → ${si.join(', ') || 'ninguna'}. NO DISPONIBLES → ${no.join('; ') || 'ninguna'}. Si propones autorregulación diaria, básala solo en las fiables; no uses las no disponibles.`
}
