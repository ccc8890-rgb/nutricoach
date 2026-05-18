import type { PerfilEntrenoCliente, SportModality, PlantillaEntrenamiento } from '@/types'

export interface RecomendacionEntreno {
  sport_modality?: SportModality
  tier: 'elite' | 'general'
  dias_semana: number
  intensidad: 'baja' | 'moderada' | 'alta'
  volumen: 'bajo' | 'medio' | 'alto'
  foco_principal: string
  advertencias: string[]
  filtros_plantilla: {
    sport_modality?: SportModality
    tier?: 'elite' | 'general'
    nivel?: 'principiante' | 'intermedio' | 'avanzado'
  }
  ajustes_adicionales: string[]
}

// Árbol de 9 decisiones para recomendar configuración de entrenamiento
export function evaluarPerfilEntreno(perfil: PerfilEntrenoCliente): RecomendacionEntreno {
  const advertencias: string[] = []
  const ajustes: string[] = []

  // ── Decisión 1: ¿Tiene modalidad deportiva definida? ──────────────────
  const sport_modality = perfil.sport_modality

  // ── Decisión 2: ¿Tiene métricas de rendimiento avanzadas? → Tier ──────
  const tieneMetricasAvanzadas =
    (perfil.ftp_watts && perfil.ftp_watts > 0) ||
    (perfil.vdot && perfil.vdot > 0) ||
    (perfil.rm_sentadilla_kg && perfil.rm_sentadilla_kg > 0)
  const tier: 'elite' | 'general' = tieneMetricasAvanzadas ? 'elite' : 'general'

  // ── Decisión 3: Días disponibles → volumen base ───────────────────────
  const dias = Math.max(1, Math.min(7, perfil.dias_disponibles ?? 3))
  let volumen: 'bajo' | 'medio' | 'alto' = 'medio'
  if (dias <= 2) volumen = 'bajo'
  else if (dias >= 5) volumen = 'alto'

  // ── Decisión 4: Capacidad de recuperación → ajustar volumen ──────────
  const recuperacion = perfil.capacidad_recuperacion ?? 'media'
  if (recuperacion === 'baja') {
    if (volumen === 'alto') { volumen = 'medio'; ajustes.push('Volumen reducido a medio por baja recuperación') }
    if (volumen === 'medio' && dias >= 4) { ajustes.push('Considera día de descanso activo extra') }
  }
  if (recuperacion === 'alta' && volumen === 'bajo' && dias >= 3) {
    ajustes.push('Alta capacidad de recuperación: puedes añadir trabajo accesorio')
  }

  // ── Decisión 5: Respuesta a volumen → ajustar volumen ────────────────
  const respuestaVol = perfil.respuesta_a_volumen ?? 'medio'
  if (respuestaVol === 'bajo' && volumen === 'alto') {
    volumen = 'medio'
    ajustes.push('Responde mejor a volumen medio — reducido de alto')
  }
  if (respuestaVol === 'alto' && volumen === 'medio' && recuperacion !== 'baja') {
    volumen = 'alto'
    ajustes.push('Alta respuesta a volumen — aumentado de medio a alto')
  }

  // ── Decisión 6: Plateau detectado → variedad o sobrecarga ────────────
  if (perfil.plateau_detectado) {
    const semanas = perfil.semanas_sin_progresion ?? 0
    if (semanas >= 6 && perfil.respuesta_psicologica !== 'variedad') {
      ajustes.push(`Plateau de ${semanas} semanas: priorizar deload + cambio de estímulo`)
    } else if (semanas >= 3) {
      ajustes.push(`Plateau de ${semanas} semanas: revisar progresión y técnica`)
    }
  }

  // ── Decisión 7: Lesiones → advertencias y restricciones ──────────────
  if (perfil.patron_lesiones && perfil.patron_lesiones.length > 0) {
    perfil.patron_lesiones.forEach(l => {
      if (l.zona) advertencias.push(`Historial de lesión: ${l.zona}${l.frecuencia ? ` (${l.frecuencia})` : ''}`)
    })
  }
  if (perfil.fisio_informe && perfil.fisio_informe.length > 0) {
    const ultimo = perfil.fisio_informe[perfil.fisio_informe.length - 1]
    if (ultimo.contraindicados && ultimo.contraindicados.length > 0) {
      advertencias.push(`Ejercicios contraindicados según fisio: ${ultimo.contraindicados.join(', ')}`)
    }
  }

  // ── Decisión 8: Equipo disponible → validar modalidad ────────────────
  const equipo = perfil.equipo_disponible ?? []
  if (sport_modality === 'gym_fuerza' && !equipo.includes('Barra olímpica')) {
    advertencias.push('Modalidad fuerza seleccionada pero sin barra olímpica indicada')
  }
  if (sport_modality === 'calistenia' && !equipo.includes('Barras dominadas')) {
    advertencias.push('Calistenia seleccionada pero sin barras de dominadas indicadas')
  }
  if (equipo.length === 0) {
    ajustes.push('Sin equipo especificado — usar plantillas de peso corporal como base')
  }

  // ── Decisión 9: Psicología → foco de progresión ──────────────────────
  const psicologia = perfil.respuesta_psicologica ?? 'rutina'
  let foco_principal = 'Progresión lineal con seguimiento semanal'
  if (psicologia === 'variedad') {
    foco_principal = 'Bloques cortos con variación de estímulos cada 3-4 semanas'
    if (perfil.plateau_detectado) ajustes.push('Alta respuesta a variedad: rotar ejercicios principales cada 4 semanas')
  } else if (psicologia === 'competicion') {
    foco_principal = 'Periodización orientada a picos de rendimiento con testing de métricas'
    if (tier === 'elite') ajustes.push('Programar tests de FTP/VDOT/RM cada 6-8 semanas')
  }

  // Nivel para filtro de plantilla
  const nivel = perfil.nivel

  return {
    sport_modality,
    tier,
    dias_semana: dias,
    intensidad: recuperacion === 'alta' ? 'alta' : recuperacion === 'baja' ? 'baja' : 'moderada',
    volumen,
    foco_principal,
    advertencias,
    filtros_plantilla: {
      sport_modality,
      tier,
      nivel,
    },
    ajustes_adicionales: ajustes,
  }
}

// Filtra plantillas según la recomendación del motor
export function filtrarPlantillasPorPerfil(
  plantillas: PlantillaEntrenamiento[],
  rec: RecomendacionEntreno
): PlantillaEntrenamiento[] {
  let resultado = plantillas

  if (rec.filtros_plantilla.sport_modality) {
    const modality = rec.filtros_plantilla.sport_modality
    resultado = resultado.filter(p => p.sport_modality === modality)
  }

  if (rec.filtros_plantilla.tier) {
    resultado = resultado.filter(p => (p.tier ?? 'general') === rec.filtros_plantilla.tier)
  }

  if (rec.filtros_plantilla.nivel && resultado.length > 0) {
    const porNivel = resultado.filter(p => p.nivel === rec.filtros_plantilla.nivel)
    if (porNivel.length > 0) resultado = porNivel
  }

  // Si no hay match exacto, devolver todas las de esa modalidad sin filtro de tier
  if (resultado.length === 0 && rec.filtros_plantilla.sport_modality) {
    resultado = plantillas.filter(p => p.sport_modality === rec.filtros_plantilla.sport_modality)
  }

  // Fallback final: todas las plantillas
  if (resultado.length === 0) resultado = plantillas

  return resultado
}
