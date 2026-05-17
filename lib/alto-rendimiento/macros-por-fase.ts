export interface MacrosTarget {
    cho_gkg: number
    prot_gkg: number
    grasa_gkg: number
}

export interface IntraProtocol {
    necesario_si_min: number
    cho_hora: number
    sodio_mg_hora: number
    formato: string
}

export type FaseDeportiva =
    | 'base'
    | 'construccion'
    | 'pico'
    | 'pico_maximo'
    | 'tapering'
    | 'carrera_inminente'
    | 'race_day'
    | 'recuperacion'
    | 'finalizada'

export type Disciplina =
    | 'hyrox'
    | 'running_5k'
    | 'running_10k'
    | 'running_hm'
    | 'running_maraton'
    | 'trail_corto'
    | 'trail_largo'
    | 'ultra'
    | 'ciclismo_fondo'
    | 'triatlon_sprint'
    | 'triatlon_olimpico'
    | 'triatlon_70_3'
    | 'ironman'
    | 'crossfit'
    | 'otro'

export const DISCIPLINA_LABELS: Record<Disciplina, string> = {
    hyrox: 'Hyrox',
    running_5k: 'Running 5K',
    running_10k: 'Running 10K',
    running_hm: 'Media maratón',
    running_maraton: 'Maratón',
    trail_corto: 'Trail corto (<30km)',
    trail_largo: 'Trail largo (30-80km)',
    ultra: 'Ultra trail (>80km)',
    ciclismo_fondo: 'Ciclismo fondo',
    triatlon_sprint: 'Triatlón Sprint',
    triatlon_olimpico: 'Triatlón Olímpico',
    triatlon_70_3: 'Triatlón 70.3',
    ironman: 'Ironman',
    crossfit: 'CrossFit/Functional',
    otro: 'Otro',
}

export const FASE_LABELS: Record<FaseDeportiva, string> = {
    base: 'Base',
    construccion: 'Construcción',
    pico: 'Pico',
    pico_maximo: 'Pico máximo',
    tapering: 'Tapering',
    carrera_inminente: 'Carrera inminente',
    race_day: 'Race Day',
    recuperacion: 'Recuperación',
    finalizada: 'Finalizada',
}

export const FASE_COLORES: Record<FaseDeportiva, { bg: string; text: string; badge: string }> = {
    base:              { bg: '#EFF6FF', text: '#1D4ED8', badge: 'bg-blue-100 text-blue-700' },
    construccion:      { bg: '#F0FDF4', text: '#15803D', badge: 'bg-green-100 text-green-700' },
    pico:              { bg: '#FFF7ED', text: '#C2410C', badge: 'bg-orange-100 text-orange-700' },
    pico_maximo:       { bg: '#FFF7ED', text: '#9A3412', badge: 'bg-orange-100 text-orange-800' },
    tapering:          { bg: '#FEF3C7', text: '#92400E', badge: 'bg-amber-100 text-amber-800' },
    carrera_inminente: { bg: '#FEF2F2', text: '#991B1B', badge: 'bg-red-100 text-red-800' },
    race_day:          { bg: '#4F46E5', text: '#FFFFFF', badge: 'bg-indigo-600 text-white' },
    recuperacion:      { bg: '#F5F3FF', text: '#6D28D9', badge: 'bg-purple-100 text-purple-700' },
    finalizada:        { bg: '#F9FAFB', text: '#6B7280', badge: 'bg-gray-100 text-gray-600' },
}

// Macros por fase y disciplina (g/kg peso corporal)
// Fuentes: Jeukendrup (2011), Burke et al. (2011), Thomas et al. (2016)
export const MACROS_POR_FASE: Record<string, Partial<Record<FaseDeportiva, MacrosTarget>>> = {
    hyrox: {
        base:              { cho_gkg: 5.5,  prot_gkg: 1.7, grasa_gkg: 1.1 },
        construccion:      { cho_gkg: 7.0,  prot_gkg: 1.8, grasa_gkg: 1.0 },
        pico:              { cho_gkg: 8.5,  prot_gkg: 1.8, grasa_gkg: 0.9 },
        pico_maximo:       { cho_gkg: 9.0,  prot_gkg: 1.8, grasa_gkg: 0.8 },
        tapering:          { cho_gkg: 10.0, prot_gkg: 1.8, grasa_gkg: 0.8 },
        recuperacion:      { cho_gkg: 6.0,  prot_gkg: 2.0, grasa_gkg: 1.0 },
    },
    running_5k: {
        base:              { cho_gkg: 4.0,  prot_gkg: 1.6, grasa_gkg: 1.2 },
        construccion:      { cho_gkg: 5.5,  prot_gkg: 1.7, grasa_gkg: 1.1 },
        pico:              { cho_gkg: 7.0,  prot_gkg: 1.7, grasa_gkg: 1.0 },
        tapering:          { cho_gkg: 8.0,  prot_gkg: 1.7, grasa_gkg: 0.9 },
        recuperacion:      { cho_gkg: 5.0,  prot_gkg: 1.8, grasa_gkg: 1.0 },
    },
    running_10k: {
        base:              { cho_gkg: 4.5,  prot_gkg: 1.6, grasa_gkg: 1.2 },
        construccion:      { cho_gkg: 6.0,  prot_gkg: 1.7, grasa_gkg: 1.0 },
        pico:              { cho_gkg: 7.5,  prot_gkg: 1.7, grasa_gkg: 1.0 },
        tapering:          { cho_gkg: 9.0,  prot_gkg: 1.7, grasa_gkg: 0.9 },
        recuperacion:      { cho_gkg: 5.0,  prot_gkg: 1.8, grasa_gkg: 1.0 },
    },
    running_hm: {
        base:              { cho_gkg: 5.0,  prot_gkg: 1.6, grasa_gkg: 1.2 },
        construccion:      { cho_gkg: 6.5,  prot_gkg: 1.7, grasa_gkg: 1.0 },
        pico:              { cho_gkg: 8.0,  prot_gkg: 1.8, grasa_gkg: 0.9 },
        pico_maximo:       { cho_gkg: 9.0,  prot_gkg: 1.8, grasa_gkg: 0.9 },
        tapering:          { cho_gkg: 10.0, prot_gkg: 1.8, grasa_gkg: 0.8 },
        recuperacion:      { cho_gkg: 5.5,  prot_gkg: 2.0, grasa_gkg: 1.0 },
    },
    running_maraton: {
        base:              { cho_gkg: 5.0,  prot_gkg: 1.6, grasa_gkg: 1.2 },
        construccion:      { cho_gkg: 7.0,  prot_gkg: 1.7, grasa_gkg: 1.0 },
        pico:              { cho_gkg: 9.0,  prot_gkg: 1.8, grasa_gkg: 0.9 },
        pico_maximo:       { cho_gkg: 10.0, prot_gkg: 1.8, grasa_gkg: 0.8 },
        tapering:          { cho_gkg: 11.0, prot_gkg: 1.8, grasa_gkg: 0.8 },
        recuperacion:      { cho_gkg: 5.0,  prot_gkg: 2.0, grasa_gkg: 1.0 },
    },
    trail_corto: {
        base:              { cho_gkg: 5.0,  prot_gkg: 1.7, grasa_gkg: 1.2 },
        construccion:      { cho_gkg: 6.5,  prot_gkg: 1.8, grasa_gkg: 1.1 },
        pico:              { cho_gkg: 8.0,  prot_gkg: 1.8, grasa_gkg: 1.0 },
        tapering:          { cho_gkg: 10.0, prot_gkg: 1.8, grasa_gkg: 0.9 },
        recuperacion:      { cho_gkg: 6.0,  prot_gkg: 2.0, grasa_gkg: 1.0 },
    },
    trail_largo: {
        base:              { cho_gkg: 5.5,  prot_gkg: 1.7, grasa_gkg: 1.2 },
        construccion:      { cho_gkg: 7.5,  prot_gkg: 1.8, grasa_gkg: 1.1 },
        pico:              { cho_gkg: 9.0,  prot_gkg: 1.9, grasa_gkg: 1.0 },
        tapering:          { cho_gkg: 11.0, prot_gkg: 1.9, grasa_gkg: 0.9 },
        recuperacion:      { cho_gkg: 6.0,  prot_gkg: 2.2, grasa_gkg: 1.0 },
    },
    ultra: {
        base:              { cho_gkg: 6.0,  prot_gkg: 1.8, grasa_gkg: 1.3 },
        construccion:      { cho_gkg: 8.0,  prot_gkg: 1.9, grasa_gkg: 1.2 },
        pico:              { cho_gkg: 10.0, prot_gkg: 2.0, grasa_gkg: 1.1 },
        tapering:          { cho_gkg: 12.0, prot_gkg: 2.0, grasa_gkg: 1.0 },
        recuperacion:      { cho_gkg: 7.0,  prot_gkg: 2.5, grasa_gkg: 1.2 },
    },
    ciclismo_fondo: {
        base:              { cho_gkg: 5.0,  prot_gkg: 1.6, grasa_gkg: 1.2 },
        construccion:      { cho_gkg: 7.0,  prot_gkg: 1.7, grasa_gkg: 1.0 },
        pico:              { cho_gkg: 9.0,  prot_gkg: 1.8, grasa_gkg: 0.9 },
        tapering:          { cho_gkg: 10.0, prot_gkg: 1.8, grasa_gkg: 0.8 },
        recuperacion:      { cho_gkg: 5.5,  prot_gkg: 1.9, grasa_gkg: 1.0 },
    },
    triatlon_sprint: {
        base:              { cho_gkg: 5.0,  prot_gkg: 1.7, grasa_gkg: 1.1 },
        construccion:      { cho_gkg: 6.5,  prot_gkg: 1.8, grasa_gkg: 1.0 },
        pico:              { cho_gkg: 8.0,  prot_gkg: 1.8, grasa_gkg: 0.9 },
        tapering:          { cho_gkg: 9.0,  prot_gkg: 1.8, grasa_gkg: 0.8 },
        recuperacion:      { cho_gkg: 5.5,  prot_gkg: 2.0, grasa_gkg: 1.0 },
    },
    triatlon_olimpico: {
        base:              { cho_gkg: 5.5,  prot_gkg: 1.7, grasa_gkg: 1.1 },
        construccion:      { cho_gkg: 7.0,  prot_gkg: 1.8, grasa_gkg: 1.0 },
        pico:              { cho_gkg: 9.0,  prot_gkg: 1.8, grasa_gkg: 0.9 },
        tapering:          { cho_gkg: 10.0, prot_gkg: 1.8, grasa_gkg: 0.8 },
        recuperacion:      { cho_gkg: 6.0,  prot_gkg: 2.0, grasa_gkg: 1.0 },
    },
    triatlon_70_3: {
        base:              { cho_gkg: 6.0,  prot_gkg: 1.7, grasa_gkg: 1.2 },
        construccion:      { cho_gkg: 8.0,  prot_gkg: 1.8, grasa_gkg: 1.0 },
        pico:              { cho_gkg: 10.0, prot_gkg: 1.8, grasa_gkg: 0.9 },
        tapering:          { cho_gkg: 11.0, prot_gkg: 1.8, grasa_gkg: 0.8 },
        recuperacion:      { cho_gkg: 6.0,  prot_gkg: 2.1, grasa_gkg: 1.0 },
    },
    ironman: {
        base:              { cho_gkg: 6.0,  prot_gkg: 1.7, grasa_gkg: 1.2 },
        construccion:      { cho_gkg: 8.0,  prot_gkg: 1.8, grasa_gkg: 1.0 },
        pico:              { cho_gkg: 10.0, prot_gkg: 1.8, grasa_gkg: 0.9 },
        tapering:          { cho_gkg: 12.0, prot_gkg: 1.8, grasa_gkg: 0.8 },
        recuperacion:      { cho_gkg: 6.0,  prot_gkg: 2.2, grasa_gkg: 1.0 },
    },
    crossfit: {
        base:              { cho_gkg: 4.5,  prot_gkg: 1.8, grasa_gkg: 1.1 },
        construccion:      { cho_gkg: 6.0,  prot_gkg: 1.9, grasa_gkg: 1.0 },
        pico:              { cho_gkg: 7.5,  prot_gkg: 2.0, grasa_gkg: 0.9 },
        tapering:          { cho_gkg: 8.0,  prot_gkg: 2.0, grasa_gkg: 0.9 },
        recuperacion:      { cho_gkg: 5.5,  prot_gkg: 2.2, grasa_gkg: 1.0 },
    },
}

// Macros genéricos (fallback cuando la disciplina no tiene datos específicos)
export const MACROS_GENERICOS: Record<FaseDeportiva, MacrosTarget> = {
    base:              { cho_gkg: 4.5,  prot_gkg: 1.6, grasa_gkg: 1.2 },
    construccion:      { cho_gkg: 6.0,  prot_gkg: 1.7, grasa_gkg: 1.0 },
    pico:              { cho_gkg: 7.5,  prot_gkg: 1.8, grasa_gkg: 0.9 },
    pico_maximo:       { cho_gkg: 9.0,  prot_gkg: 1.8, grasa_gkg: 0.8 },
    tapering:          { cho_gkg: 10.0, prot_gkg: 1.8, grasa_gkg: 0.8 },
    carrera_inminente: { cho_gkg: 10.0, prot_gkg: 1.8, grasa_gkg: 0.8 },
    race_day:          { cho_gkg: 8.0,  prot_gkg: 1.5, grasa_gkg: 0.6 },
    recuperacion:      { cho_gkg: 5.5,  prot_gkg: 2.0, grasa_gkg: 1.0 },
    finalizada:        { cho_gkg: 4.5,  prot_gkg: 1.6, grasa_gkg: 1.2 },
}

export function getMacrosPorFase(disciplina: string, fase: FaseDeportiva): MacrosTarget {
    return MACROS_POR_FASE[disciplina]?.[fase] ?? MACROS_GENERICOS[fase]
}

export function calcularMacrosAbsolutos(
    macrosGkg: MacrosTarget,
    pesoKg: number
): { cho_g: number; prot_g: number; grasa_g: number; kcal: number } {
    const cho_g   = Math.round(macrosGkg.cho_gkg   * pesoKg)
    const prot_g  = Math.round(macrosGkg.prot_gkg  * pesoKg)
    const grasa_g = Math.round(macrosGkg.grasa_gkg * pesoKg)
    const kcal    = cho_g * 4 + prot_g * 4 + grasa_g * 9
    return { cho_g, prot_g, grasa_g, kcal }
}

// Protocolo intra-carrera por disciplina
export const INTRA_CARRERA: Partial<Record<string, IntraProtocol>> = {
    hyrox: {
        necesario_si_min: 60,
        cho_hora: 45,
        sodio_mg_hora: 400,
        formato: 'Gel + agua cada 30 min. Bebida isotónica si >75 min',
    },
    running_hm: {
        necesario_si_min: 0,
        cho_hora: 60,
        sodio_mg_hora: 450,
        formato: 'Gel cada 5-6 km + agua. Isotónica opcional desde km 10',
    },
    running_maraton: {
        necesario_si_min: 0,
        cho_hora: 75,
        sodio_mg_hora: 500,
        formato: 'Gel cada 5 km + agua. Bebida isotónica cada 10 km',
    },
    trail_largo: {
        necesario_si_min: 0,
        cho_hora: 80,
        sodio_mg_hora: 600,
        formato: 'Gel + comida sólida (dátiles, plátano) cada 45-60 min',
    },
    ultra: {
        necesario_si_min: 0,
        cho_hora: 90,
        sodio_mg_hora: 700,
        formato: 'Comida real + gel. Sodio cada hora. Cafeína en tramos nocturnos',
    },
    ironman: {
        necesario_si_min: 0,
        cho_hora: 85,
        sodio_mg_hora: 700,
        formato: 'Bici: bebida + gel. Carrera: gel + cola + agua',
    },
    triatlon_70_3: {
        necesario_si_min: 0,
        cho_hora: 70,
        sodio_mg_hora: 500,
        formato: 'Bici: bebida isotónica + gel. Carrera: gel + agua',
    },
}
