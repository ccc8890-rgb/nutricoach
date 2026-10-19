#!/usr/bin/env tsx
/**
 * Carga curada (20-10-2026) de estudios sobre ritmo de cambio de peso, superávit/déficit, autoseguimiento,
 * pausas en la dieta y monitorización subjetiva del deportista: base de las reglas de tendencia de peso y de
 * escalas del check-in de NutriCoach. Cada trabajo se localiza en PubMed por DOI
 * (o por palabras del título si no tiene), se guarda su abstract real y se etiqueta para que el motor
 * lo encuentre por tags. No se inventan hallazgos: los «puntos clave» solo dicen para qué se usa en NutriCoach.
 *
 * USO:  npx tsx scripts/cargar-papers-seguimiento.ts          # simula y lista lo encontrado
 *       npx tsx scripts/cargar-papers-seguimiento.ts --apply  # inserta los que no estén (por DOI o título)
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { searchPubMed } from '../lib/ingesta-papers/pubmed-api'
import { createServiceSupabase } from '../lib/supabase-server'

type Entrada = {
  busqueda: string // DOI (se busca como [aid]) o consulta PubMed por palabras
  disciplina: string
  categoria: string
  tipo: 'guia_clinica' | 'revision' | 'meta_analisis' | 'estudio'
  nivel: 'opinion_experto' | 'revision_sistematica' | 'meta_analisis' | 'rct' | 'estudio_observacional'
  tags: string[]
  uso: string
}

const ENTRADAS: Entrada[] = [
  { busqueda: '10.1123/ijsnem.21.2.97', disciplina: 'nutricion', categoria: 'composicion_corporal', tipo: 'estudio', nivel: 'rct', tags: ['perdida_peso', 'ritmo_cambio_peso', 'deficit_calorico', 'masa_muscular', 'atletas', 'composicion_corporal'], uso: 'Ritmo de pérdida de peso: 0,7 % frente a 1,4 % del peso por semana en atletas; base del aviso por pérdida demasiado rápida.' },
  { busqueda: '10.1186/1550-2783-11-20', disciplina: 'nutricion', categoria: 'composicion_corporal', tipo: 'revision', nivel: 'revision_sistematica', tags: ['perdida_peso', 'ritmo_cambio_peso', 'deficit_calorico', 'proteina', 'diet_break', 'composicion_corporal'], uso: 'Recomendaciones de ritmo de pérdida de grasa (≈0,5-1 % del peso/semana), proteína y pausas en la dieta en deportistas de fuerza.' },
  { busqueda: '10.3390/sports7070154', disciplina: 'nutricion', categoria: 'composicion_corporal', tipo: 'revision', nivel: 'revision_sistematica', tags: ['ganancia_peso', 'ritmo_cambio_peso', 'superavit_calorico', 'hipertrofia', 'composicion_corporal'], uso: 'Ritmo de ganancia en fase de volumen (≈0,25-0,5 % del peso/semana en principiantes e intermedios); base de la regla de ganancia.' },
  { busqueda: '10.3389/fnut.2019.00131', disciplina: 'nutricion', categoria: 'composicion_corporal', tipo: 'revision', nivel: 'revision_sistematica', tags: ['ganancia_peso', 'superavit_calorico', 'hipertrofia', 'entrenamiento_fuerza'], uso: 'Si hace falta superávit para maximizar la hipertrofia: matiza la regla de ganancia de peso.' },
  { busqueda: '10.1136/bjsports-2015-094758', disciplina: 'general', categoria: 'recuperacion', tipo: 'revision', nivel: 'revision_sistematica', tags: ['monitorizacion', 'bienestar_subjetivo', 'fatiga', 'sueno', 'carga_entrenamiento', 'checkin'], uso: 'Las medidas subjetivas (energía, sueño, ánimo) son más sensibles que las objetivas: respalda usar el check-in del cliente para detectar fatiga.' },
  { busqueda: '10.1038/ijo.2017.206', disciplina: 'nutricion', categoria: 'composicion_corporal', tipo: 'estudio', nivel: 'rct', tags: ['diet_break', 'restriccion_energetica_intermitente', 'perdida_peso', 'adaptacion_metabolica', 'meseta'], uso: 'MATADOR: restricción intermitente con pausas de mantenimiento mejora la eficiencia de la pérdida; base de las pausas en la dieta.' },
  { busqueda: '10.1016/j.jada.2010.10.008', disciplina: 'nutricion', categoria: 'metodologia', tipo: 'revision', nivel: 'revision_sistematica', tags: ['autoseguimiento', 'adherencia', 'perdida_peso', 'conducta', 'checkin'], uso: 'El autoseguimiento (peso, comidas) se asocia a mayor pérdida de peso: respalda registrar el peso en cada check-in.' },
  { busqueda: 'Achieving an Optimal Fat Loss Phase in Resistance-Trained Athletes[ti]', disciplina: 'nutricion', categoria: 'composicion_corporal', tipo: 'revision', nivel: 'revision_sistematica', tags: ['perdida_peso', 'ritmo_cambio_peso', 'diet_break', 'proteina', 'entrenamiento_fuerza', 'composicion_corporal'], uso: 'Revisión narrativa de la fase de pérdida de grasa en deportistas de fuerza: ritmo, déficit, proteína y pausas.' },
]

;(async () => {
  const aplicar = process.argv.includes('--apply')
  const db = createServiceSupabase()
  const { data: existentes } = await db.from('knowledge_base').select('doi, titulo')
  const dois = new Set((existentes ?? []).map(r => (r.doi ?? '').toLowerCase()).filter(Boolean))
  const titulos = new Set((existentes ?? []).map(r => (r.titulo ?? '').toLowerCase().trim()))
  const filas: Record<string, unknown>[] = []
  for (const e of ENTRADAS) {
    const esDoi = /^10\.\d{4,}\//.test(e.busqueda)
    const consulta = esDoi ? `${e.busqueda}[aid]` : e.busqueda
    const res = await searchPubMed(consulta, 'manual' as never, esDoi ? 1 : 3).catch(() => [])
    const p = esDoi ? res.find(r => (r.doi ?? '').toLowerCase() === e.busqueda.toLowerCase()) : res[0]
    if (!p) { console.log(`✗ NO ENCONTRADO: ${e.busqueda.slice(0, 70)}`); continue }
    if ((p.doi && dois.has(p.doi.toLowerCase())) || titulos.has(p.titulo.toLowerCase().trim())) { console.log(`= ya existe: ${p.titulo.slice(0, 80)}`); continue }
    p.titulo = p.titulo.replace(/&#x[0-9a-f]+;/gi, '')
    console.log(`+ ${p.fecha_publicacion?.slice(0, 4)} ${p.titulo.slice(0, 90)} [${p.doi ?? 's/doi'}]`)
    filas.push({
      disciplina: e.disciplina, categoria: e.categoria, tipo: e.tipo, titulo: p.titulo,
      resumen: p.abstract.slice(0, 500), contenido_completo: p.abstract,
      puntos_clave: [`Uso en NutriCoach: ${e.uso}`, `Revista: ${p.revista ?? 's/d'} (${p.fecha_publicacion?.slice(0, 4) ?? 's/d'})`],
      fuente: p.revista ?? p.autores ?? '', url_origen: p.enlace, doi: p.doi ?? null, tags: e.tags, poblacion: [], condiciones: [],
      nivel_evidencia: e.nivel, fuente_tipo: 'manual', verificado: true, activo: true, coach_id: null,
    })
    await new Promise(r => setTimeout(r, 400))
  }
  console.log(`\n${filas.length} por insertar de ${ENTRADAS.length}`)
  if (aplicar && filas.length > 0) {
    const { error } = await db.from('knowledge_base').insert(filas)
    if (error) { console.error('Error insertando:', error.message); process.exit(1) }
    console.log('✓ insertados')
  } else if (!aplicar) console.log('(simulación; usa --apply para insertar)')
})()
