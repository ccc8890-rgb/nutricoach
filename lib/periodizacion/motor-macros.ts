import { UMBRALES_DEFAULT, UmbralesPeriodizacion } from './umbrales'

export interface MacrosBase {
    kcal: number
    proteinas: number
    carbohidratos: number
    grasas: number
}

export interface AjusteMacros extends MacrosBase {
    kcal_ajustado: number
    proteinas_ajustadas: number
    carbohidratos_ajustados: number
    grasas_ajustadas: number
    descripcion: string
}

// Ajuste semanal por fatiga + carga alta: +10% kcal distribuido en CHO y grasas
export function calcularAjusteCaloricoSemanal(
    macrosBase: MacrosBase,
    pct: number = UMBRALES_DEFAULT.ajuste_calorico_pct
): AjusteMacros {
    const kcal_extra = Math.round(macrosBase.kcal * pct)
    const kcal_ajustado = macrosBase.kcal + kcal_extra

    // 70% del extra en CHO, 30% en grasas. Proteína invariable.
    const cho_extra_g = Math.round((kcal_extra * 0.70) / 4)
    const grasa_extra_g = Math.round((kcal_extra * 0.30) / 9)

    return {
        kcal: macrosBase.kcal,
        proteinas: macrosBase.proteinas,
        carbohidratos: macrosBase.carbohidratos,
        grasas: macrosBase.grasas,
        kcal_ajustado,
        proteinas_ajustadas: macrosBase.proteinas,
        carbohidratos_ajustados: macrosBase.carbohidratos + cho_extra_g,
        grasas_ajustadas: macrosBase.grasas + grasa_extra_g,
        descripcion: `+${Math.round(pct * 100)}% calorías esta semana → ${kcal_ajustado} kcal (+${cho_extra_g}g CHO, +${grasa_extra_g}g grasas). Proteína sin cambios.`,
    }
}

// Periodización diaria por TLS: días intensos más CHO, días descanso menos CHO
export function calcularAjustePorTLS(
    macrosBase: MacrosBase,
    tls_diario: number,
    umbrales: UmbralesPeriodizacion = UMBRALES_DEFAULT
): AjusteMacros {
    if (tls_diario > umbrales.tls_dia_intenso) {
        const cho_extra_g = Math.round(macrosBase.carbohidratos * umbrales.ajuste_cho_intenso_pct)
        const grasas_reduccion_g = Math.max(
            Math.round((cho_extra_g * 4) / 9),
            0
        )
        return {
            kcal: macrosBase.kcal,
            proteinas: macrosBase.proteinas,
            carbohidratos: macrosBase.carbohidratos,
            grasas: macrosBase.grasas,
            kcal_ajustado: macrosBase.kcal,
            proteinas_ajustadas: macrosBase.proteinas,
            carbohidratos_ajustados: macrosBase.carbohidratos + cho_extra_g,
            grasas_ajustadas: Math.max(macrosBase.grasas - grasas_reduccion_g, 30),
            descripcion: `Día intenso (TLS ${tls_diario} pts): +${cho_extra_g}g CHO, -${grasas_reduccion_g}g grasas. Calorías totales estables.`,
        }
    }

    if (tls_diario < umbrales.tls_dia_descanso) {
        const cho_reduccion_g = Math.round(macrosBase.carbohidratos * umbrales.ajuste_cho_descanso_pct)
        const grasa_extra_g = Math.round((cho_reduccion_g * 4) / 9)
        return {
            kcal: macrosBase.kcal,
            proteinas: macrosBase.proteinas,
            carbohidratos: macrosBase.carbohidratos,
            grasas: macrosBase.grasas,
            kcal_ajustado: macrosBase.kcal,
            proteinas_ajustadas: macrosBase.proteinas,
            carbohidratos_ajustados: Math.max(macrosBase.carbohidratos - cho_reduccion_g, 50),
            grasas_ajustadas: macrosBase.grasas + grasa_extra_g,
            descripcion: `Día descanso (TLS ${tls_diario} pts): -${cho_reduccion_g}g CHO, +${grasa_extra_g}g grasas. Calorías totales estables.`,
        }
    }

    // Día normal: sin ajuste
    return {
        ...macrosBase,
        kcal_ajustado: macrosBase.kcal,
        proteinas_ajustadas: macrosBase.proteinas,
        carbohidratos_ajustados: macrosBase.carbohidratos,
        grasas_ajustadas: macrosBase.grasas,
        descripcion: `Día normal (TLS ${tls_diario} pts): mantener plan base.`,
    }
}
