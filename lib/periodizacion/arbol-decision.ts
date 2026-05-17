import { UMBRALES_DEFAULT, UmbralesPeriodizacion } from './umbrales'

export type AccionPeriodizacion =
    | 'refeed_sugerir'
    | 'higiene_sueno'
    | 'mensaje_apoyo'
    | 'ajuste_calorico_10pct'
    | 'alerta_coach_solo'
    | 'sin_accion'

export const ACCION_LABELS: Record<AccionPeriodizacion, string> = {
    refeed_sugerir: 'Refeed sugerido',
    higiene_sueno: 'Higiene de sueño',
    mensaje_apoyo: 'Mensaje de apoyo',
    ajuste_calorico_10pct: 'Ajuste calórico +10%',
    alerta_coach_solo: 'Alerta al coach',
    sin_accion: 'Sin acción',
}

export const ACCION_DESCRIPTIONS: Record<AccionPeriodizacion, string> = {
    refeed_sugerir:
        'El cliente lleva varias semanas en déficit con buena adherencia y señales de fatiga. Se sugiere un día/semana de recarga de carbohidratos. Requiere aprobación del coach.',
    higiene_sueno:
        'El cliente reporta fatiga con pocas horas de sueño. Priorizar descanso antes de ajustar macros.',
    mensaje_apoyo:
        'El cliente está fatigado pero cumple bien el plan y duerme correctamente. Un mensaje de apoyo puede ayudar a mantener la adherencia.',
    ajuste_calorico_10pct:
        'La carga de entrenamiento supera el umbral con fatiga reportada. Se incrementan las calorías un 10% esta semana.',
    alerta_coach_solo:
        'Adherencia baja detectada. El coach debe intervenir de forma personalizada.',
    sin_accion:
        'Todos los indicadores en rango. Mantener el plan actual.',
}

export interface InputCheckin {
    energia: number           // 1-5 del check-in (1=muy baja energía, 5=muy alta)
    horas_sueno: number       // horas de sueño reportadas
    adherencia: number        // 0-100 porcentaje de cumplimiento
    tls_semanal: number       // TLS acumulado de la semana actual
    semanas_en_deficit: number
    umbral_carga_alta: number // del perfil del cliente (default 80)
}

export interface ResultadoEvaluacion {
    accion: AccionPeriodizacion
    label: string
    descripcion: string
    requiere_aprobacion_coach: boolean
    input_snapshot: InputCheckin
}

export function evaluarCheckin(
    input: InputCheckin,
    umbrales: UmbralesPeriodizacion = UMBRALES_DEFAULT
): ResultadoEvaluacion {
    const {
        energia,
        horas_sueno,
        adherencia,
        tls_semanal,
        semanas_en_deficit,
        umbral_carga_alta,
    } = input

    const fatiga_alta = energia <= umbrales.energia_fatiga

    let accion: AccionPeriodizacion = 'sin_accion'

    // Prioridad 1: refeed — fatiga + muchas semanas en déficit + buena adherencia
    if (
        fatiga_alta &&
        semanas_en_deficit >= umbrales.semanas_deficit_refeed &&
        adherencia >= umbrales.adherencia_buena
    ) {
        accion = 'refeed_sugerir'

    // Prioridad 2: sueño — fatiga + pocas horas de sueño
    } else if (fatiga_alta && horas_sueno < umbrales.sueno_minimo) {
        accion = 'higiene_sueno'

    // Prioridad 3: ajuste calórico — fatiga + entrenamiento por encima del umbral
    } else if (fatiga_alta && tls_semanal > umbral_carga_alta) {
        accion = 'ajuste_calorico_10pct'

    // Prioridad 4: mensaje de apoyo — fatiga pero buena adherencia y sueño
    } else if (
        fatiga_alta &&
        horas_sueno >= umbrales.sueno_optimo &&
        adherencia >= umbrales.adherencia_buena + 5
    ) {
        accion = 'mensaje_apoyo'

    // Prioridad 5: alerta coach — adherencia baja sin fatiga reportada
    } else if (adherencia < umbrales.adherencia_mala) {
        accion = 'alerta_coach_solo'
    }

    return {
        accion,
        label: ACCION_LABELS[accion],
        descripcion: ACCION_DESCRIPTIONS[accion],
        requiere_aprobacion_coach: accion === 'refeed_sugerir' || accion === 'alerta_coach_solo',
        input_snapshot: input,
    }
}
