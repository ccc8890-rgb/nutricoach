export interface UmbralesPeriodizacion {
    energia_fatiga: number          // energía <= este valor = fatiga alta (escala 1-10 del check-in)
    adherencia_buena: number        // % adherencia para considerar "buena"
    adherencia_mala: number         // % adherencia por debajo = alerta coach
    sueno_minimo: number            // calidad de sueño (1-10) por debajo = problema
    sueno_optimo: number            // calidad de sueño (1-10) para considerar adecuado
    semanas_deficit_refeed: number  // semanas en déficit para sugerir refeed
    tls_dia_intenso: number         // TLS diario > este = día intenso
    tls_dia_descanso: number        // TLS diario < este = día descanso/recuperación
    ajuste_calorico_pct: number     // % de incremento calórico semanal (0.10 = 10%)
    ajuste_cho_intenso_pct: number  // % incremento CHO en días intensos
    ajuste_cho_descanso_pct: number // % reducción CHO en días de descanso
}

export const UMBRALES_DEFAULT: UmbralesPeriodizacion = {
    energia_fatiga: 4,               // energía 1-4 de 10 → fatiga alta (antes 1-2 de 5: el formulario es 1-10). Umbral = criterio de dietista; la base es que lo subjetivo detecta antes la fatiga (Saw 2016, doi:10.1136/bjsports-2015-094758)
    adherencia_buena: 80,
    adherencia_mala: 60,
    sueno_minimo: 5,                 // calidad 1-4 de 10 → problema de sueño (criterio, antes «6 horas»)
    sueno_optimo: 7,                 // calidad ≥ 7 de 10 → adecuado
    semanas_deficit_refeed: 4,       // 4+ semanas en déficit continuado
    tls_dia_intenso: 30,             // >30 pts TLS = día intenso
    tls_dia_descanso: 10,            // <10 pts TLS = día descanso
    ajuste_calorico_pct: 0.10,       // +10% kcal semana de carga alta
    ajuste_cho_intenso_pct: 0.175,   // +17.5% CHO días intensos
    ajuste_cho_descanso_pct: 0.15,   // -15% CHO días de descanso
}
