/**
 * distribucion-proteinas.ts — Distribución estratégica de proteína por comida
 * Basado en evidencia de MPS (Muscle Protein Synthesis):
 *   - Leucine threshold: ≥2-3g leucina ≈ 20-40g proteína por comida
 *   - Edad >50: resistencia anabólica → necesita 30-45g por comida
 *   - Frecuencia óptima: 4-5 comidas/día (Schoenfeld & Aragon 2018)
 */

export interface DistribucionProteinas {
    total: number
    g_por_kg: number
    comidas: {
        nombre: string
        orden: number
        proteinas_g: number
        leucina_g: number       // estimado ~8% del total de proteína
        mps_activada: boolean   // true si alcanza threshold de leucina
        es_post_entreno: boolean
        hora_sugerida: string
    }[]
    prioridad_post_entreno: boolean
    riesgo_sarcopenia: boolean // >50 años con baja proteína en alguna comida
}

interface PerfilProteinas {
    edad: number
    peso: number
    objetivo: string
    sexo?: string
    gProteinaFinal: number    // g/kg
    horaEntreno?: string
    numComidas?: number
    proteinas?: string[]       // fuentes proteicas preferidas
}

/**
 * Distribuye estratégicamente la proteína total del día entre comidas
 * para maximizar MPS y adaptarse al perfil del cliente.
 */
export function distribuirProteinas(
    perfil: PerfilProteinas,
    nombresComidas: string[] = ['Desayuno', 'Comida', 'Merienda', 'Cena']
): DistribucionProteinas {
    const total = Math.round(perfil.peso * perfil.gProteinaFinal)
    const edad = perfil.edad
    const numComidas = perfil.numComidas ?? nombresComidas.length
    const esMayor = edad > 50
    const esDeficit = perfil.objetivo === 'perder_grasa' || perfil.objetivo === 'recomposicion'
    const horaEntreno = perfil.horaEntreno

    // Threshold MPS por edad (Katsanos et al. 2006, Moore et al. 2015)
    const THRESHOLD_MPS = esMayor ? 30 : 20     // g proteína por comida
    const THRESHOLD_MAXIMO = esMayor ? 50 : 45  // g máximos útiles por comida

    // Calcular proteína base por comida
    const porcionBase = Math.floor(total / numComidas)

    // Identificar qué comida es post-entreno
    const comidas = nombresComidas.slice(0, numComidas).map((nombre, i) => {
        const orden = i + 1
        let proteinas_g = porcionBase

        // Determinar si esta comida es post-entreno
        const esPostEntreno = !!(
            horaEntreno &&
            ((i === 0 && horaEntreno <= '09:00') ||        // Entreno temprano → desayuno
                (i === 1 && horaEntreno >= '10:00' && horaEntreno <= '14:00') ||  // Entreno medio → comida
                (i === 2 && horaEntreno >= '15:00' && horaEntreno <= '18:00') ||  // Entreno tarde → merienda
                (i === 3 && horaEntreno >= '19:00'))           // Entreno noche → cena
        )

        // La comida post-entreno recibe +10g de proteína
        if (esPostEntreno) {
            proteinas_g = Math.min(porcionBase + 10, THRESHOLD_MAXIMO)
        }

        // Asegurar que cada comida alcanza el threshold MPS (>50 años necesita más)
        if (proteinas_g < THRESHOLD_MPS) {
            proteinas_g = THRESHOLD_MPS
        }

        // Si es déficit, asegurar mínimos para evitar catabolismo
        if (esDeficit && proteinas_g < 25) {
            proteinas_g = 25
        }

        const leucina_g = Math.round(proteinas_g * 0.08 * 10) / 10  // ~8% de la proteína es leucina

        return {
            nombre,
            orden,
            proteinas_g,
            leucina_g,
            mps_activada: proteinas_g >= THRESHOLD_MPS,
            es_post_entreno: esPostEntreno,
            hora_sugerida: '',
        }
    })

    // Ajustar el total redistribuyendo el excedente o déficit
    const sumaActual = comidas.reduce((s, c) => s + c.proteinas_g, 0)
    const dif = total - sumaActual

    if (dif !== 0) {
        // Añadir/quitar de la comida post-entreno o de la mayor
        const targetIdx = comidas.findIndex(c => c.es_post_entreno)
        const idx = targetIdx >= 0 ? targetIdx : 0
        comidas[idx].proteinas_g = Math.max(
            THRESHOLD_MPS,
            Math.min(comidas[idx].proteinas_g + dif, THRESHOLD_MAXIMO)
        )
    }

    // Verificar riesgo de sarcopenia
    const riesgoSarcopenia = esMayor && comidas.some(c => c.proteinas_g < 30)

    return {
        total,
        g_por_kg: perfil.gProteinaFinal,
        comidas,
        prioridad_post_entreno: comidas.some(c => c.es_post_entreno),
        riesgo_sarcopenia: riesgoSarcopenia,
    }
}

/**
 * Calcula el ratio leucina total del día y verifica si cumple
 * objetivos minimos de MPS.
 */
export function verificarLeucina(distribucion: DistribucionProteinas): {
    leucina_total: number
    comidas_con_mps: number
    alerta: string | null
} {
    const leucinaTotal = Math.round(distribucion.comidas.reduce((s, c) => s + c.leucina_g, 0) * 10) / 10
    const comidasConMPS = distribucion.comidas.filter(c => c.mps_activada).length

    let alerta: string | null = null
    if (comidasConMPS < 3) {
        alerta = `Solo ${comidasConMPS}/${distribucion.comidas.length} comidas activan MPS. Objetivo: ≥3 comidas con ≥${distribucion.comidas[0]?.mps_activada ? '20' : '30'}g proteína.`
    }
    if (distribucion.riesgo_sarcopenia) {
        alerta = 'Cliente >50a con posible resistencia anabólica. Asegurar ≥30g proteína en TODAS las comidas.'
    }

    return { leucina_total: leucinaTotal, comidas_con_mps: comidasConMPS, alerta }
}
