export interface UmbralesPeriodizacion {
    energia_fatiga: number          // energia <= este valor = fatiga alta (escala 1-5)
    adherencia_buena: number        // % adherencia para considerar "buena"
    adherencia_mala: number         // % adherencia por debajo = alerta coach
    sueno_minimo: number            // horas de sueño por debajo = problema
    sueno_optimo: number            // horas de sueño para considerar adecuado
    semanas_deficit_refeed: number  // semanas en déficit para sugerir refeed
    tls_dia_intenso: number         // TLS diario > este = día intenso
    tls_dia_descanso: number        // TLS diario < este = día descanso/recuperación
    ajuste_calorico_pct: number     // % de incremento calórico semanal (0.10 = 10%)
    ajuste_cho_intenso_pct: number  // % incremento CHO en días intensos
    ajuste_cho_descanso_pct: number // % reducción CHO en días de descanso
}

export const UMBRALES_DEFAULT: UmbralesPeriodizacion = {
    energia_fatiga: 2,               // energia 1-2 → fatiga alta
    adherencia_buena: 80,
    adherencia_mala: 60,
    sueno_minimo: 6,
    sueno_optimo: 7,
    semanas_deficit_refeed: 4,       // 4+ semanas en déficit continuado
    tls_dia_intenso: 30,             // >30 pts TLS = día intenso
    tls_dia_descanso: 10,            // <10 pts TLS = día descanso
    ajuste_calorico_pct: 0.10,       // +10% kcal semana de carga alta
    ajuste_cho_intenso_pct: 0.175,   // +17.5% CHO días intensos
    ajuste_cho_descanso_pct: 0.15,   // -15% CHO días de descanso
}
