export interface RecomendacionDescanso {
  titulo: string
  consejo: string
  icono: string
}

// Tips indexados por número de sesiones semanales (carga) y día de la semana
const TIPS_BAJA_CARGA: RecomendacionDescanso[] = [
  {
    titulo: 'Descanso activo',
    consejo: 'Un paseo de 30 min a ritmo suave es suficiente. Mueve sin acumular fatiga.',
    icono: '🚶',
  },
  {
    titulo: 'Movilidad',
    consejo: 'Dedica 10-15 min a movilidad de caderas y hombros. Ayuda a recuperar mejor que el reposo total.',
    icono: '🧘',
  },
]

const TIPS_ALTA_CARGA: RecomendacionDescanso[] = [
  {
    titulo: 'Recuperación prioritaria',
    consejo: 'Con muchas sesiones en la semana, el descanso activo es tan importante como el entreno. Prioriza el sueño y la hidratación.',
    icono: '😴',
  },
  {
    titulo: 'Proteína de recuperación',
    consejo: 'Asegura 1.6-2.2 g proteína/kg incluso en descanso. Los músculos se reparan fuera del gym.',
    icono: '🥩',
  },
  {
    titulo: 'Hidratos en descanso',
    consejo: 'No reducas drásticamente los carbohidratos en días de descanso — sirven para reponer glucógeno muscular.',
    icono: '🍚',
  },
]

const TIPS_GENERALES: RecomendacionDescanso[] = [
  {
    titulo: 'Día de recarga',
    consejo: 'El crecimiento muscular ocurre fuera del gym. Este día es parte del plan, no un día perdido.',
    icono: '💡',
  },
  {
    titulo: 'Escucha tu cuerpo',
    consejo: 'Fatiga alta = más descanso, no más entreno. Si tienes agujetas fuertes, hoy está justificado el reposo total.',
    icono: '🎯',
  },
]

/**
 * Devuelve una recomendación de descanso basada en la carga semanal.
 * @param diasEntrenoSemana - número de sesiones de entreno en el plan esta semana
 * @param diaSemana - nombre del día (para variar el tip)
 */
export function getRecomendacionDescanso(
  diasEntrenoSemana: number,
  diaSemana?: string
): RecomendacionDescanso {
  const pool =
    diasEntrenoSemana >= 5
      ? TIPS_ALTA_CARGA
      : diasEntrenoSemana <= 2
        ? TIPS_BAJA_CARGA
        : TIPS_GENERALES

  // Seed determinista por día para que no cambie al re-renderizar
  const seed = diaSemana
    ? ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].indexOf(diaSemana)
    : 0
  return pool[Math.abs(seed) % pool.length]
}
