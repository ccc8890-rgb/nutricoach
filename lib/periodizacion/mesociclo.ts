/**
 * mesociclo.ts — Planificación de mesociclos de periodización nutricional
 *
 * Un coach top-ed no ajusta día a día, planifica bloques estratégicos:
 * - Déficit 3-4 semanas → Diet Break / Refeed programado
 * - Carb Cycling sincronizado con volumen de entreno
 * - Reverse Dieting al salir de déficit
 * - Fases de carga alrededor de competiciones
 *
 * Basado en: Norton & Baker (2019), Helms et al. (2014), Trexler et al. (2014)
 */

export type SemanaTipo =
    | 'deficit'        // Déficit calórico estándar
    | 'deficit_profundo'  // Déficit más agresivo (solo corto plazo)
    | 'mantenimiento'  // Diet Break — calorías de mantenimiento
    | 'refeed'         // Mantenimiento con CHO elevado
    | 'superavit'      // Ganancia muscular controlada
    | 'carga'          // Carga de CHO pre-competición
    | 'deload'         // Reducción de volumen + ajuste calórico

export interface SemanaPlanificada {
    tipo: SemanaTipo
    kcal_modificador: number    // -0.15 = -15%, 0 = mantenimiento, +0.10 = +10%
    cho_modificador: number     // cambio específico en CHO
    grasa_modificador: number   // cambio específico en grasas
    duracion_dias: number       // normalmente 7
    etiqueta: string            // Para mostrar al coach/cliente
    notas: string
}

export interface MesocicloPlan {
    cliente_id: string
    semanas: SemanaPlanificada[]
    duracion_total_dias: number
    objetivo_mesociclo: string
    requiere_revision_coach: boolean
    alertas: string[]
}

interface PerfilMesociclo {
    objetivo: string
    semanas_en_deficit: number
    fatiga_acumulada: number     // 1-5
    adherencia: number           // 0-100%
    tls_semanal_promedio: number // carga de entrenamiento semanal
    tiene_competicion_proxima: boolean
    fecha_competicion?: string
    edad: number
}

// ──────────────────────────────────────────────────────────────
// Planificador de mesociclos
// ──────────────────────────────────────────────────────────────

export function planificarMesociclo(
    perfil: PerfilMesociclo,
    cliente_id: string
): MesocicloPlan {
    const alertas: string[] = []

    switch (perfil.objetivo) {
        case 'perder_grasa':
            return planificarPerdidaGrasa(perfil, cliente_id, alertas)
        case 'ganar_musculo':
            return planificarGananciaMuscular(perfil, cliente_id, alertas)
        case 'rendimiento':
            return planificarRendimiento(perfil, cliente_id, alertas)
        case 'recomposicion':
            return planificarRecomposicion(perfil, cliente_id, alertas)
        case 'mantenimiento':
            return planificarMantenimiento(perfil, cliente_id, alertas)
        default:
            return {
                cliente_id,
                semanas: [{
                    tipo: 'mantenimiento',
                    kcal_modificador: 0,
                    cho_modificador: 0,
                    grasa_modificador: 0,
                    duracion_dias: 7,
                    etiqueta: 'Evaluación inicial — semana de referencia',
                    notas: 'Primera semana sin cambios drásticos para evaluar respuesta.',
                }],
                duracion_total_dias: 7,
                objetivo_mesociclo: 'Evaluación inicial',
                requiere_revision_coach: true,
                alertas: [],
            }
    }
}

// ──────────────────────────────────────────────────────────────
// Pérdida de grasa con preservación muscular
// ──────────────────────────────────────────────────────────────

function planificarPerdidaGrasa(
    perfil: PerfilMesociclo,
    cliente_id: string,
    alertas: string[]
): MesocicloPlan {
    const semanas: SemanaPlanificada[] = []
    const semanasPlan = Math.min(perfil.semanas_en_deficit + 4, 12) // Máx 12 semanas déficit continuo

    // Bloque 1: Déficit progresivo (semanas 1-4 o hasta fatiga)
    for (let i = 0; i < Math.min(4, semanasPlan); i++) {
        // Déficit más profundo si buena adherencia
        const deficit = perfil.adherencia > 80 ? -0.20 : -0.15
        semanas.push({
            tipo: 'deficit',
            kcal_modificador: deficit,
            cho_modificador: perfil.tls_semanal_promedio > 200 ? -0.10 : -0.20,
            grasa_modificador: 0, // Grasas se mantienen en mínimo 0.5g/kg
            duracion_dias: 7,
            etiqueta: i === 0 ? 'Inicio déficit' : `Semana ${i + 1} déficit`,
            notas: i === 0
                ? 'Fase inicial. Monitorizar hambre y energía. Ajustar si fatiga >3/5.'
                : 'Continuar déficit. Revisar adherencia semanal.',
        })
    }

    // Diet Break / Refeed si lleva >4 semanas en déficit o fatiga alta
    if (perfil.semanas_en_deficit >= 4 || perfil.fatiga_acumulada >= 3) {
        // Refeed si buena adherencia y fatiga moderada
        if (perfil.fatiga_acumulada < 4 && perfil.adherencia > 70) {
            semanas.push({
                tipo: 'refeed',
                kcal_modificador: 0,    // Mantenimiento calórico
                cho_modificador: +0.30, // +30% CHO para reponer glucógeno y leptina
                grasa_modificador: -0.15, // -15% grasas para compensar
                duracion_dias: 7,
                etiqueta: '🔋 Refeed programado',
                notas: 'Refeed de 7 días. Recuperación de leptina, glucógeno y adherencia mental. Esperar retención hídrica temporal (+1-2kg).',
            })
        } else if (perfil.fatiga_acumulada >= 4) {
            // Diet Break completo si fatiga alta
            semanas.push({
                tipo: 'mantenimiento',
                kcal_modificador: 0,
                cho_modificador: 0,
                grasa_modificador: 0,
                duracion_dias: 7,
                etiqueta: '🔄 Diet Break — mantenimiento',
                notas: 'Diet break de 1-2 semanas. Calorías a mantenimiento. La siguiente tanda de déficit será más efectiva.',
            })
            alertas.push('Diet Break activado por fatiga alta ≥4/5. Priorizar recuperación antes de continuar déficit.')
        }
    }

    // Si tiene alta carga de entreno, añadir carb cycling
    if (perfil.tls_semanal_promedio > 200) {
        alertas.push('Carga de entreno alta: activar carb cycling (días intensos +CHO, descanso -CHO)')
    }

    // Añadir deload si lleva muchas semanas
    if (perfil.semanas_en_deficit >= 6) {
        semanas.push({
            tipo: 'deload',
            kcal_modificador: 0,
            cho_modificador: +0.10,
            grasa_modificador: 0,
            duracion_dias: 7,
            etiqueta: '📉 Semana de deload',
            notas: 'Reducir volumen entreno 40-50%. Calorías ligeramente elevadas para recuperación.',
        })
    }

    // Reverse diet al finalizar déficit
    const duracion = semanas.reduce((s, w) => s + w.duracion_dias, 0)
    if (duracion >= 56) {
        // 8+ semanas en déficit → añadir reverse diet
        semanas.push({
            tipo: 'mantenimiento',
            kcal_modificador: 0,
            cho_modificador: +0.05,
            grasa_modificador: +0.05,
            duracion_dias: 7,
            etiqueta: '📈 Inicio Reverse Diet — semana 1/4',
            notas: 'Subir 50-100 kcal/semana durante 4 semanas hasta alcanzar mantenimiento calculado. Evitar rebote calórico.',
        })
    }

    return {
        cliente_id,
        semanas,
        duracion_total_dias: duracion,
        objetivo_mesociclo: 'Pérdida de grasa con preservación muscular',
        requiere_revision_coach: perfil.adherencia < 60,
        alertas,
    }
}

// ──────────────────────────────────────────────────────────────
// Ganancia muscular controlada
// ──────────────────────────────────────────────────────────────

function planificarGananciaMuscular(
    perfil: PerfilMesociclo,
    cliente_id: string,
    alertas: string[]
): MesocicloPlan {
    const semanas: SemanaPlanificada[] = []

    for (let i = 0; i < 4; i++) {
        semanas.push({
            tipo: 'superavit',
            kcal_modificador: +0.10,   // +10% sobre mantenimiento
            cho_modificador: +0.15,    // +15% CHO
            grasa_modificador: 0,       // Grasas se mantienen
            duracion_dias: 7,
            etiqueta: `Semana ${i + 1} — superávit controlado`,
            notas: i === 0
                ? 'Inicio fase de volumen. Superávit mínimo efectivo (+200-300 kcal/día).'
                : 'Monitorizar ganancia de peso semanal. Objetivo: 0.25-0.5 kg/semana.',
        })
    }

    // Evaluación de calidad del bulk (control de grasa)
    semanas.push({
        tipo: 'mantenimiento',
        kcal_modificador: 0,
        cho_modificador: -0.15,  // Bajar CHO para redistribuir
        grasa_modificador: -0.10,
        duracion_dias: 7,
        etiqueta: '📊 Mini-cut evaluativo',
        notas: 'Semana de mantenimiento para evaluar composición. Si ganancia de grasa >50% del peso total, iniciar mini-cut de 2-3 semanas.',
    })

    return {
        cliente_id,
        semanas,
        duracion_total_dias: 35,
        objetivo_mesociclo: 'Ganancia muscular con mínimo acúmulo de grasa',
        requiere_revision_coach: true,
        alertas,
    }
}

// ──────────────────────────────────────────────────────────────
// Rendimiento deportivo / Competición
// ──────────────────────────────────────────────────────────────

function planificarRendimiento(
    perfil: PerfilMesociclo,
    cliente_id: string,
    alertas: string[]
): MesocicloPlan {
    const semanas: SemanaPlanificada[] = []

    // Fase de carga general (base)
    for (let i = 0; i < 3; i++) {
        semanas.push({
            tipo: 'carga',
            kcal_modificador: +0.05,
            cho_modificador: +0.15,
            grasa_modificador: -0.10,
            duracion_dias: 7,
            etiqueta: `Fase base — semana ${i + 1}/3`,
            notas: 'Priorizar disponibilidad de CHO y recuperación. NO restringir calorías.',
        })
    }

    // Si tiene competición próxima, añadir carga específica
    if (perfil.tiene_competicion_proxima) {
        semanas.push({
            tipo: 'carga',
            kcal_modificador: +0.10,
            cho_modificador: +0.30, // Carga de CHO agresiva
            grasa_modificador: -0.20,
            duracion_dias: 3,
            etiqueta: '🏆 Carga pre-competición (D-3 a D-1)',
            notas: 'Carga de CHO: 8-10 g/kg/día. Reducir grasa y fibra para minimizar molestias GI. Hidratación con electrolitos.',
        })

        semanas.push({
            tipo: 'mantenimiento',
            kcal_modificador: 0,
            cho_modificador: 0,
            grasa_modificador: 0,
            duracion_dias: 1,
            etiqueta: '🏆 DÍA DE COMPETICIÓN',
            notas: 'Desayuno CHO 3-4h antes. Geles/bebida intra-competición según duración. Recuperación CHO+proteína post.',
        })
    }

    return {
        cliente_id,
        semanas,
        duracion_total_dias: semanas.reduce((s, w) => s + w.duracion_dias, 0),
        objetivo_mesociclo: 'Rendimiento deportivo optimizado',
        requiere_revision_coach: false,
        alertas,
    }
}

// ──────────────────────────────────────────────────────────────
// Recomposición corporal
// ──────────────────────────────────────────────────────────────

function planificarRecomposicion(
    perfil: PerfilMesociclo,
    cliente_id: string,
    alertas: string[]
): MesocicloPlan {
    const semanas: SemanaPlanificada[] = []

    // Recomp necesita paciencia — bloques largos
    for (let i = 0; i < 8; i++) {
        semanas.push({
            tipo: i < 4 ? 'deficit' : 'mantenimiento',
            kcal_modificador: i < 4 ? -0.10 : 0,    // Déficit muy leve primero
            cho_modificador: 0,
            grasa_modificador: 0,
            duracion_dias: 7,
            etiqueta: i < 4
                ? `Recomp — déficit leve semana ${i + 1}/4`
                : `Recomp — mantenimiento semana ${i - 3}/4`,
            notas: i === 0
                ? 'Recomposición: proceso lento (12-16 semanas). Déficit mínimo. Proteína ≥2.2 g/kg. No obsesionarse con báscula.'
                : 'Fase de mantenimiento. El cuerpo sigue recomponiendo si el estímulo de entreno es adecuado.',
        })
    }

    alertas.push('Recomposición: cambios visibles en 12-16 semanas. Usar fotos y circunferencias, NO solo peso.')

    return {
        cliente_id,
        semanas,
        duracion_total_dias: 56,
        objetivo_mesociclo: 'Recomposición corporal (pérdida grasa + ganancia muscular simultánea)',
        requiere_revision_coach: true,
        alertas,
    }
}

// ──────────────────────────────────────────────────────────────
// Mantenimiento activo
// ──────────────────────────────────────────────────────────────

function planificarMantenimiento(
    perfil: PerfilMesociclo,
    cliente_id: string,
    alertas: string[]
): MesocicloPlan {
    const semanas: SemanaPlanificada[] = []
    for (let i = 0; i < 4; i++) {
        semanas.push({
            tipo: 'mantenimiento',
            kcal_modificador: 0,
            cho_modificador: 0,
            grasa_modificador: 0,
            duracion_dias: 7,
            etiqueta: `Mantenimiento — semana ${i + 1}/4`,
            notas: 'Equilibrio calórico. Progresión de entreno para mejorar composición sin déficit.',
        })
    }

    return {
        cliente_id,
        semanas,
        duracion_total_dias: 28,
        objetivo_mesociclo: 'Mantenimiento con recomposición progresiva',
        requiere_revision_coach: false,
        alertas,
    }
}

// ──────────────────────────────────────────────────────────────
// Generar resumen legible del mesociclo
// ──────────────────────────────────────────────────────────────

export function formatearMesociclo(plan: MesocicloPlan): string {
    const lineas = [
        `📋 MESOCICLO: ${plan.objetivo_mesociclo}`,
        `📆 Duración: ${plan.duracion_total_dias} días (${plan.semanas.length} bloques)`,
        '',
        '┌──────────┬────────────────────────────────┬────────────┐',
        '│ Semana   │ Tipo                           │ Δ kcal/CHO │',
        '├──────────┼────────────────────────────────┼────────────┤',
    ]

    plan.semanas.forEach((s, i) => {
        const nro = `#${i + 1}`.padEnd(8)
        const tipo = s.etiqueta.padEnd(32).slice(0, 32)
        const ajuste = ` ${s.kcal_modificador >= 0 ? '+' : ''}${(s.kcal_modificador * 100).toFixed(0)}% / ${s.cho_modificador >= 0 ? '+' : ''}${(s.cho_modificador * 100).toFixed(0)}% CHO`.padEnd(12)
        lineas.push(`│ ${nro}│ ${tipo} │ ${ajuste}│`)
    })

    lineas.push('└──────────┴────────────────────────────────┴────────────┘')
    lineas.push('')

    if (plan.alertas.length > 0) {
        lineas.push('⚠️  ALERTAS:')
        plan.alertas.forEach(a => lineas.push(`  • ${a}`))
    }

    if (plan.requiere_revision_coach) {
        lineas.push('')
        lineas.push('👨‍⚕️ Requiere revisión del coach antes de aplicar.')
    }

    return lineas.join('\n')
}
