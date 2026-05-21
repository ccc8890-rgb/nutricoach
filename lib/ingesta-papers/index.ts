// ── Barrel exports: lib/ingesta-papers ────────────────────────────

export { ejecutarIngesta } from './ingestador'
export { extractPapers } from './extractor'
export { evaluarPaper, evaluarPapers } from './evaluador'
export { searchPubMed } from './pubmed-api'
export { FUENTES_PUBMED, getFuentesActivas, getFuentesPorDisciplina } from './fuentes'

export type {
  FuenteTipo,
  DisenoEstudio,
  PaperRaw,
  PaperExtraido,
  PaperEvaluado,
  ResultadoIngesta,
} from './tipos'
