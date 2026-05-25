import assert from 'node:assert/strict'
import { evaluarPaper } from '../lib/ingesta-papers/evaluador'
import type { PaperExtraido } from '../lib/ingesta-papers/tipos'

const base: PaperExtraido = {
  titulo: 'Effects of acupuncture on stride, speed, and heart rate variability in Thoroughbred racehorses.',
  abstract: 'This randomized trial studied heart rate variability in racehorses after acupuncture.',
  enlace: 'https://pubmed.ncbi.nlm.nih.gov/test',
  fecha_publicacion: '2026',
  fuente_tipo: 'pubmed_rss',
  revista: 'Sports Medicine',
  autores: 'Example et al.',
  hallazgo_principal: 'High HRV response.',
  poblacion: 'Thoroughbred racehorses',
  intervencion: 'Acupuncture',
  resultado_principal: 'Improved HRV',
  diseno_estudio: 'rct',
  tamano_muestral: 100,
  keywords: ['heart rate variability', 'racehorses'],
  disciplina_sugerida: 'recuperacion',
  categoria_sugerida: 'recuperacion',
  tags_sugeridos: ['hrv', 'recuperacion'],
  condiciones_relacionadas: [],
}

const animal = evaluarPaper(base)
assert.equal(animal.recomendacion, 'descartar')
assert.match(animal.motivo_rechazo ?? '', /animal|veterinario/i)

const humano = evaluarPaper({
  ...base,
  titulo: 'Heart rate variability guided training in endurance athletes.',
  abstract: 'This randomized trial studied HRV-guided training in endurance athletes.',
  poblacion: 'endurance athletes',
  intervencion: 'HRV-guided training',
  keywords: ['heart rate variability', 'endurance athletes'],
  disciplina_sugerida: 'running',
})

assert.equal(humano.recomendacion, 'incluir')

console.log('ingesta-papers-domain-filter.test.ts OK')
