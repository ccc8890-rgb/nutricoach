// ── Barrel exports: lib/ingesta-papers ────────────────────────────

export { ejecutarIngesta } from './ingestador'
export { extractPapers } from './extractor'
export { evaluarPaper, evaluarPapers } from './evaluador'
export { fetchRSS, parsePubMedRSS } from './rss-parser'
export { FUENTES_RSS, getFuentesActivas, getFuentesPorDisciplina } from './fuentes'

export type {
  FuenteTipo,
  DisenoEstudio,
  PaperRaw,
  PaperExtraido,
  PaperEvaluado,
  ResultadoIngesta,
} from './tipos'
