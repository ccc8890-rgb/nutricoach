// ── Configuración de fuentes RSS para PubMed ──────────────────────
// Basado en términos de búsqueda de nutrición deportiva y composición corporal.

export interface FuenteRSS {
  id: string
  nombre: string
  url: string
  tipo: 'pubmed_rss'
  disciplina: string
  categoria: string
  activa: boolean
}

/**
 * Fuentes RSS de PubMed con términos de búsqueda relevantes.
 * Cada URL es un PubMed RSS feed con términos específicos.
 *
 * Formato: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?rss_guid=<guid>
 * También se puede usar: https://pubmed.ncbi.nlm.nih.gov/rss/search/<term>/...
 *
 * Usamos el formato directo de PubMed RSS:
 * https://eutils.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?term=<encoded query>
 */
export const FUENTES_RSS: FuenteRSS[] = [
  {
    id: 'pubmed-nutricion-deportiva',
    nombre: 'PubMed — Nutrición Deportiva',
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?term=(sports%20nutrition%5BTitle%2FAbstract%5D)%20AND%20(protein%20OR%20carbohydrate%20OR%20creatine)%20AND%20(supplementation%5BTitle%2FAbstract%5D)%20AND%20(english%5BFilter%5D)%20NOT%20(review%5BFilter%5D)&retmax=20',
    tipo: 'pubmed_rss',
    disciplina: 'nutricion',
    categoria: 'suplementacion',
    activa: true,
  },
  {
    id: 'pubmed-composicion-corporal',
    nombre: 'PubMed — Composición Corporal',
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?term=(body%20composition%5BTitle%2FAbstract%5D)%20AND%20(diet%20OR%20protein%20OR%20energy%20restriction)%20AND%20(weight%20loss%20OR%20fat%20loss)%20AND%20(english%5BFilter%5D)%20NOT%20(review%5BFilter%5D)&retmax=20',
    tipo: 'pubmed_rss',
    disciplina: 'nutricion',
    categoria: 'composicion_corporal',
    activa: true,
  },
  {
    id: 'pubmed-proteina-ejercicio',
    nombre: 'PubMed — Proteína y Ejercicio',
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?term=(dietary%20proteins%5BMeSH%5D)%20AND%20(resistance%20training%5BTitle%2FAbstract%5D)%20AND%20(muscle%20protein%20synthesis%5BTitle%2FAbstract%5D)%20AND%20(english%5BFilter%5D)&retmax=20',
    tipo: 'pubmed_rss',
    disciplina: 'nutricion',
    categoria: 'proteina',
    activa: true,
  },
  {
    id: 'pubmed-periodizacion',
    nombre: 'PubMed — Periodización Nutricional',
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?term=(nutritional%20periodization%5BTitle%2FAbstract%5D)%20OR%20(dietary%20periodization%5BTitle%2FAbstract%5D)%20OR%20(carb%20cycling%5BTitle%2FAbstract%5D)%20AND%20(english%5BFilter%5D)&retmax=20',
    tipo: 'pubmed_rss',
    disciplina: 'nutricion',
    categoria: 'periodizacion',
    activa: true,
  },
  {
    id: 'pubmed-ejercicio-fuerza',
    nombre: 'PubMed — Ejercicio de Fuerza',
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?term=(resistance%20training%5BMeSH%5D)%20AND%20(hypertrophy%5BTitle%2FAbstract%5D%20OR%20strength%5BTitle%2FAbstract%5D)%20AND%20(training%20volume%20OR%20training%20frequency)%20AND%20(english%5BFilter%5D)%20NOT%20(review%5BFilter%5D)&retmax=20',
    tipo: 'pubmed_rss',
    disciplina: 'fuerza',
    categoria: 'volumen',
    activa: true,
  },
  {
    id: 'pubmed-running-rendimiento',
    nombre: 'PubMed — Running y Rendimiento',
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?term=(running%5BMeSH%5D)%20AND%20(nutrition%5BTitle%2FAbstract%5D%20OR%20carbohydrate%20OR%20hydration)%20AND%20(endurance%20performance%5BTitle%2FAbstract%5D)%20AND%20(english%5BFilter%5D)%20NOT%20(review%5BFilter%5D)&retmax=20',
    tipo: 'pubmed_rss',
    disciplina: 'running',
    categoria: 'resistencia',
    activa: true,
  },
  {
    id: 'pubmed-patologia-nutricion',
    nombre: 'PubMed — Nutrición Clínica y Patologías',
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?term=(diabetes%20OR%20hypertension%20OR%20dyslipidemia%20OR%20NAFLD)%20AND%20(diet%20OR%20nutrition%20OR%20protein%20OR%20carbohydrate)%20AND%20(management%5BTitle%2FAbstract%5D)%20AND%20(english%5BFilter%5D)%20NOT%20(review%5BFilter%5D)&retmax=20',
    tipo: 'pubmed_rss',
    disciplina: 'nutricion',
    categoria: 'patologia',
    activa: true,
  },
  {
    id: 'pubmed-entreno-hiit',
    nombre: 'PubMed — HIIT y Metabolismo',
    url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/erss.cgi?term=(HIIT%5BTitle%2FAbstract%5D%20OR%20high%20intensity%20interval%20training%5BTitle%2FAbstract%5D)%20AND%20(metabolism%5BTitle%2FAbstract%5D%20OR%20body%20composition%5BTitle%2FAbstract%5D)%20AND%20(english%5BFilter%5D)%20NOT%20(review%5BFilter%5D)&retmax=20',
    tipo: 'pubmed_rss',
    disciplina: 'hibrido',
    categoria: 'hiit',
    activa: true,
  },
]

/** Obtiene las fuentes activas */
export function getFuentesActivas(): FuenteRSS[] {
  return FUENTES_RSS.filter(f => f.activa)
}

/** Agrupa fuentes por disciplina */
export function getFuentesPorDisciplina(): Record<string, FuenteRSS[]> {
  const agrupado: Record<string, FuenteRSS[]> = {}
  for (const fuente of FUENTES_RSS) {
    if (!fuente.activa) continue
    if (!agrupado[fuente.disciplina]) agrupado[fuente.disciplina] = []
    agrupado[fuente.disciplina].push(fuente)
  }
  return agrupado
}
