// ── Configuración de fuentes PubMed vía NCBI E-utilities API ─────
// Usa esearch + efetch en lugar de erss.cgi (RSS) que es inestable.
// PubMed API: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/

export interface FuentePubMed {
  id: string
  nombre: string
  /** Término de búsqueda PubMed (formato: term=(query)&retmax=20) */
  query: string
  disciplina: string
  categoria: string
  activa: boolean
}

/**
 * 8 fuentes de búsqueda PubMed usando NCBI E-utilities.
 * Cada query se pasa a esearch.fcgi que devuelve PMIDs,
 * luego efetch.fcgi obtiene los abstracts completos.
 *
 * Límite NCBI: 10 requests/sec sin API key, 10 requests/sec CON API key
 * https://www.ncbi.nlm.nih.gov/books/NBK25497/
 */
export const FUENTES_PUBMED: FuentePubMed[] = [
  {
    id: 'pubmed-nutricion-deportiva',
    nombre: 'PubMed — Nutrición Deportiva',
    query: '(sports nutrition[Title/Abstract]) AND (protein OR carbohydrate OR creatine) AND (supplementation[Title/Abstract]) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'nutricion',
    categoria: 'suplementacion',
    activa: true,
  },
  {
    id: 'pubmed-composicion-corporal',
    nombre: 'PubMed — Composición Corporal',
    query: '(body composition[Title/Abstract]) AND (diet OR protein OR energy restriction) AND (weight loss OR fat loss) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'nutricion',
    categoria: 'composicion_corporal',
    activa: true,
  },
  {
    id: 'pubmed-proteina-ejercicio',
    nombre: 'PubMed — Proteína y Ejercicio',
    query: '(dietary proteins[MeSH]) AND (resistance training[Title/Abstract]) AND (muscle protein synthesis[Title/Abstract]) AND (english[Filter])',
    disciplina: 'nutricion',
    categoria: 'proteina',
    activa: true,
  },
  {
    id: 'pubmed-periodizacion',
    nombre: 'PubMed — Periodización Nutricional',
    query: '(nutritional periodization[Title/Abstract]) OR (dietary periodization[Title/Abstract]) OR (carb cycling[Title/Abstract]) AND (english[Filter])',
    disciplina: 'nutricion',
    categoria: 'periodizacion',
    activa: true,
  },
  {
    id: 'pubmed-ejercicio-fuerza',
    nombre: 'PubMed — Ejercicio de Fuerza',
    query: '(resistance training[MeSH]) AND (hypertrophy[Title/Abstract] OR strength[Title/Abstract]) AND (training volume OR training frequency) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'fuerza',
    categoria: 'volumen',
    activa: true,
  },
  {
    id: 'pubmed-running-rendimiento',
    nombre: 'PubMed — Running y Rendimiento',
    query: '(running[MeSH]) AND (nutrition[Title/Abstract] OR carbohydrate OR hydration) AND (endurance performance[Title/Abstract]) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'running',
    categoria: 'resistencia',
    activa: true,
  },
  {
    id: 'pubmed-patologia-nutricion',
    nombre: 'PubMed — Nutrición Clínica y Patologías',
    query: '(diabetes OR hypertension OR dyslipidemia OR NAFLD) AND (diet OR nutrition OR protein OR carbohydrate) AND (management[Title/Abstract]) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'nutricion',
    categoria: 'patologia',
    activa: true,
  },
  {
    id: 'pubmed-entreno-hiit',
    nombre: 'PubMed — HIIT y Metabolismo',
    query: '(HIIT[Title/Abstract] OR high intensity interval training[Title/Abstract]) AND (metabolism[Title/Abstract] OR body composition[Title/Abstract]) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'hibrido',
    categoria: 'hiit',
    activa: true,
  },
  // ── Fuentes clínicas especializadas (MeSH queries específicas) ──
  {
    id: 'pubmed-tiroides',
    nombre: 'PubMed — Tiroides y Metabolismo',
    query: '(hypothyroidism[MeSH] OR thyroid[MeSH]) AND (diet[MeSH] OR nutrition[MeSH] OR iodine OR selenium OR weight management) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'nutricion',
    categoria: 'tiroides',
    activa: true,
  },
  {
    id: 'pubmed-pcos-sop',
    nombre: 'PubMed — SOP/PCOS y Nutrición',
    query: '(polycystic ovary syndrome[MeSH] OR PCOS[Title/Abstract]) AND (diet[MeSH] OR nutrition OR insulin resistance OR weight loss OR metformin) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'nutricion',
    categoria: 'sop',
    activa: true,
  },
  {
    id: 'pubmed-menopausia',
    nombre: 'PubMed — Menopausia y Salud Ósea',
    query: '(menopause[MeSH] OR postmenopause[MeSH]) AND (diet[MeSH] OR nutrition OR bone density OR protein OR calcium OR vitamin D) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'nutricion',
    categoria: 'menopausia',
    activa: true,
  },
  {
    id: 'pubmed-salud-osea',
    nombre: 'PubMed — Salud Ósea y Sarcopenia',
    query: '(bone density[MeSH] OR sarcopenia[MeSH]) AND (protein[MeSH] OR exercise[MeSH] OR nutrition OR vitamin D OR calcium) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'nutricion',
    categoria: 'salud_osea',
    activa: true,
  },
  {
    id: 'pubmed-ansiedad-alimentacion',
    nombre: 'PubMed — Salud Mental y Nutrición',
    query: '(mental health[MeSH] OR anxiety[MeSH] OR depression[MeSH]) AND (diet[MeSH] OR nutrition OR gut microbiome OR omega-3) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'nutricion',
    categoria: 'salud_mental',
    activa: true,
  },
  {
    id: 'pubmed-rehabilitacion',
    nombre: 'PubMed — Rehabilitación y Recuperación',
    query: '(rehabilitation[MeSH] OR injury recovery[Title/Abstract]) AND (nutrition[MeSH] OR protein[MeSH] OR physical therapy) AND (english[Filter]) NOT (review[Filter])',
    disciplina: 'nutricion',
    categoria: 'rehabilitacion',
    activa: true,
  },
]

/** Obtiene las fuentes activas */
export function getFuentesActivas(): FuentePubMed[] {
  return FUENTES_PUBMED.filter(f => f.activa)
}

/** Agrupa fuentes por disciplina */
export function getFuentesPorDisciplina(): Record<string, FuentePubMed[]> {
  const agrupado: Record<string, FuentePubMed[]> = {}
  for (const fuente of FUENTES_PUBMED) {
    if (!fuente.activa) continue
    if (!agrupado[fuente.disciplina]) agrupado[fuente.disciplina] = []
    agrupado[fuente.disciplina].push(fuente)
  }
  return agrupado
}
