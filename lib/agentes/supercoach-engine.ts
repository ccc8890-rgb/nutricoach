import type { TipoAgente, TipoTarea, ResultadoAgente } from './types'

type Severidad = 'alta' | 'media' | 'baja'

export interface SupercoachInput {
  clienteId: string
  planNutricion: {
    kcal_objetivo: number
    proteinas_objetivo: number
    carbohidratos_objetivo: number
    grasas_objetivo: number
  } | null
  planEntreno: {
    nombre: string
    sesiones_por_semana?: number | null
  } | null
  perfilEntreno: {
    sport_modality?: string | null
    dias_disponibles?: number | null
    capacidad_recuperacion?: 'baja' | 'media' | 'alta' | string | null
  } | null
  actividad: {
    resumen: {
      tiene_datos: boolean
      tdee_media: number | null
      tss_total: number
      readiness_media: number | null
      hrv_media: number | null
      sesiones: number
      minutos_alta_intensidad_total: number
    }
    flags: Array<{ tipo: string; severidad: Severidad; titulo: string; accion: string }>
  } | null
  rendimiento: {
    sesiones_7d: number
    sesiones_objetivo_semana: number | null
    adherencia_7d_pct: number | null
    rpe_media_7d: number | null
  }
}

export type SupercoachAction = ResultadoAgente & {
  agente: TipoAgente
  tipo: TipoTarea
}

function roundTo25(value: number): number {
  return Math.round(value / 25) * 25
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function modalidadLabel(value?: string | null): string {
  const labels: Record<string, string> = {
    gym_estetica: 'gimnasio estética',
    gym_fuerza: 'fuerza',
    funcional: 'funcional',
    hyrox: 'Hyrox',
    ciclismo: 'ciclismo',
    running: 'running',
    hibrido: 'híbrido',
    calistenia: 'calistenia',
    natacion: 'natación',
    triatlon: 'triatlón',
  }
  return value ? labels[value] ?? value : 'sin modalidad definida'
}

export function crearAccionesSupercoach(input: SupercoachInput): SupercoachAction[] {
  const acciones: SupercoachAction[] = []
  const actividad = input.actividad
  const resumen = actividad?.resumen
  const flags = actividad?.flags ?? []
  const modalidad = modalidadLabel(input.perfilEntreno?.sport_modality)

  const cargaAlta = Boolean(
    flags.some(f => f.tipo === 'carga_alta' || f.severidad === 'alta') ||
    (resumen && (resumen.tss_total >= 400 || resumen.minutos_alta_intensidad_total >= 180))
  )
  const tdeeAlto = Boolean(
    input.planNutricion &&
    resumen?.tdee_media &&
    resumen.tdee_media - input.planNutricion.kcal_objetivo >= 350
  )
  const recuperacionBaja = Boolean(
    flags.some(f => f.tipo === 'recuperacion_baja') ||
    (resumen?.readiness_media !== null && resumen?.readiness_media !== undefined && resumen.readiness_media < 50) ||
    (resumen?.hrv_media !== null && resumen?.hrv_media !== undefined && resumen.hrv_media < 45)
  )

  if (input.planNutricion && resumen?.tiene_datos && (tdeeAlto || cargaAlta)) {
    const kcalExtra = cargaAlta ? 200 : 150
    const choExtra = cargaAlta ? 50 : 35
    const kcal = roundTo25(input.planNutricion.kcal_objetivo + kcalExtra)
    const carbohidratos = Math.round(input.planNutricion.carbohidratos_objetivo + choExtra)

    acciones.push({
      agente: 'supercoach',
      tipo: 'ajuste_nutricion_carga',
      propuesta: `Ajustar nutrición esta semana por carga real de ${modalidad}: subir a ${kcal} kcal y ${carbohidratos} g de carbohidratos, manteniendo proteína estable. Aplicar especialmente alrededor de sesiones clave.`,
      razonamiento: `TDEE medio ${resumen.tdee_media ?? 'sin dato'} kcal, TSS ${resumen.tss_total}, alta intensidad ${resumen.minutos_alta_intensidad_total} min y readiness ${resumen.readiness_media ?? 'sin dato'}. El objetivo es proteger rendimiento y recuperación sin rehacer toda la dieta.`,
      payload: {
        accion_aplicable: 'actualizar_macros',
        origen: 'supercoach_director',
        ajustes: {
          kcal,
          proteinas: input.planNutricion.proteinas_objetivo,
          carbohidratos,
          grasas: input.planNutricion.grasas_objetivo,
        },
        contexto: {
          modalidad,
          tdee_media: resumen.tdee_media,
          tss_total: resumen.tss_total,
          readiness_media: resumen.readiness_media,
        },
        mensaje_cliente: `Esta semana vamos a reforzar un poco los carbohidratos alrededor de los entrenos para sostener rendimiento y recuperación. Mantén el resto del plan igual y dime si notas más energía o menos hambre.`,
        senales_proxima_semana: ['Energía en sesiones clave', 'Hambre nocturna', 'HRV/readiness', 'Peso medio semanal'],
      },
      fuentes: [
        {
          autores: 'ISSN',
          año: 2018,
          titulo: 'Nutrient timing and exercise performance',
          conclusión: 'El timing de carbohidratos ayuda a sostener rendimiento en semanas de alta carga.',
        },
      ],
      prioridad: cargaAlta || recuperacionBaja ? 2 : 4,
      score_confianza: 0.78,
      requiere_aprobacion: true,
    })
  }

  const adherencia = input.rendimiento.adherencia_7d_pct
  const objetivoSesiones = input.rendimiento.sesiones_objetivo_semana ?? input.planEntreno?.sesiones_por_semana ?? input.perfilEntreno?.dias_disponibles ?? null

  if (input.planEntreno && objetivoSesiones && adherencia !== null && adherencia < 70) {
    const sesionesAjustadas = clamp(Math.min(objetivoSesiones - 1, input.rendimiento.sesiones_7d + 2), 2, objetivoSesiones)

    acciones.push({
      agente: 'supercoach',
      tipo: 'actualizacion_plan',
      propuesta: `Reducir temporalmente la semana a ${sesionesAjustadas} sesiones y priorizar cumplimiento antes de subir volumen. Mantener una sesión clave de calidad y el resto fácil/técnico.`,
      razonamiento: `Adherencia ${adherencia}% (${input.rendimiento.sesiones_7d}/${objetivoSesiones}). Para ${modalidad}, ahora conviene bajar fricción, asegurar consistencia y reconstruir progresión desde una semana cumplible.`,
      payload: {
        accion_aplicable: 'actualizar_plan_entreno',
        origen: 'supercoach_director',
        plan_update: {
          sesiones_por_semana: sesionesAjustadas,
        },
        mensaje_cliente: `Esta semana simplificamos el plan para asegurar cumplimiento: menos sesiones, mejor ejecutadas. Prioridad a completar lo pactado y salir con buenas sensaciones.`,
        senales_proxima_semana: ['Sesiones completadas', 'RPE medio', 'Motivación', 'Dolor o molestias'],
      },
      fuentes: [],
      prioridad: adherencia < 50 ? 3 : 5,
      score_confianza: 0.74,
      requiere_aprobacion: true,
    })
  }

  if (recuperacionBaja && !cargaAlta) {
    acciones.push({
      agente: 'supercoach',
      tipo: 'alerta_readiness',
      propuesta: 'No progresar carga hasta revisar recuperación. Proponer 48-72h de baja intensidad, sueño prioritario y check-in breve de fatiga.',
      razonamiento: `Readiness ${resumen?.readiness_media ?? 'sin dato'} y HRV ${resumen?.hrv_media ?? 'sin dato'}. La señal apunta a recuperar antes de añadir estrés.`,
      payload: {
        accion_aplicable: 'mensaje_cliente',
        origen: 'supercoach_director',
        mensaje_cliente: 'Veo señales de recuperación baja. Hoy prioriza intensidad baja, sueño y sensaciones. Prefiero que acumulemos bien antes que forzar una sesión mala.',
        senales_proxima_semana: ['Sueño', 'HRV/readiness', 'Dolor muscular', 'RPE de calentamiento'],
      },
      fuentes: [],
      prioridad: 3,
      score_confianza: 0.7,
      requiere_aprobacion: true,
    })
  }

  return acciones
}
