#!/usr/bin/env tsx
/**
 * Carga curada de referencias de ciencia del entrenamiento de carrera (distribución de intensidad, fuerza y economía de carrera,
 * durabilidad, monitorización de la carga y su crítica, tapering, técnica) que usa el entrenador IA de rendimiento.
 * Cada trabajo se localiza en PubMed (por DOI o por autor y palabras del título) y se COMPRUEBA que el título devuelto contiene
 * la palabra esperada: si no coincide, no se inserta (evita atribuir a un paper lo que dice otro). Se guarda su abstract real;
 * los «puntos clave» solo dicen para qué se usa en NutriCoach, no resumen resultados.
 *
 * USO:  npx tsx scripts/cargar-papers-entrenamiento.ts          # simula y lista lo encontrado
 *       npx tsx scripts/cargar-papers-entrenamiento.ts --apply  # inserta los que no estén (por DOI o título)
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { searchPubMed } from '../lib/ingesta-papers/pubmed-api'
import { createServiceSupabase } from '../lib/supabase-server'

type Nivel = 'opinion_experto' | 'revision_sistematica' | 'meta_analisis' | 'rct' | 'estudio_observacional'
type Entrada = {
  busqueda: string // DOI (se busca como [aid]) o consulta PubMed
  esperado: string // palabra que debe aparecer en el título que devuelve PubMed
  disciplina: 'running' | 'hibrido' | 'general' | 'recuperacion'
  categoria: 'intensidad' | 'periodizacion' | 'volumen' | 'fuerza' | 'recuperacion' | 'hiit' | 'resistencia' | 'metodologia'
  tipo: 'guia_clinica' | 'revision' | 'meta_analisis' | 'estudio'
  nivel: Nivel
  tags: string[]
  uso: string
}

const BASE = ['running', 'entrenamiento_resistencia']
const ENTRADAS: Entrada[] = [
  // Distribución de intensidad
  { busqueda: '10.1123/ijspp.5.3.276', esperado: 'training intensity and duration distribution', disciplina: 'running', categoria: 'intensidad', tipo: 'revision', nivel: 'opinion_experto', tags: [...BASE, 'distribucion_intensidad', 'polarizado', 'piramidal', '80_20', 'zona_gris'], uso: 'Base del reparto de intensidad (suave/medio/duro) del panel de rendimiento: qué distribuciones usan los atletas de resistencia.' },
  { busqueda: '10.3389/fphys.2014.00033', esperado: 'polarized training', disciplina: 'running', categoria: 'intensidad', tipo: 'estudio', nivel: 'rct', tags: [...BASE, 'distribucion_intensidad', 'polarizado', 'umbral', 'vo2max'], uso: 'Ensayo aleatorizado que compara entrenamiento polarizado con umbral, alta intensidad y alto volumen.' },
  { busqueda: '10.3389/fphys.2019.00707', esperado: 'polarization-index', disciplina: 'running', categoria: 'intensidad', tipo: 'estudio', nivel: 'opinion_experto', tags: [...BASE, 'distribucion_intensidad', 'polarizado', 'piramidal', 'indice_polarizacion'], uso: 'Cómo clasificar si una distribución de intensidad es polarizada o no a partir del tiempo en tres zonas.' },
  { busqueda: 'Casado[au] AND world-class long-distance running performances are best predicted by volume of easy runs', esperado: 'easy runs', disciplina: 'running', categoria: 'volumen', tipo: 'estudio', nivel: 'estudio_observacional', tags: [...BASE, 'distribucion_intensidad', 'volumen', 'rodajes_suaves', 'elite'], uso: 'Qué componentes del entrenamiento predicen el rendimiento de fondistas de élite (volumen de rodajes suaves y trabajo de calidad).' },
  { busqueda: 'Doherty[au] AND training determinants of marathon performance meta-regression', esperado: 'marathon performance', disciplina: 'running', categoria: 'volumen', tipo: 'meta_analisis', nivel: 'meta_analisis', tags: [...BASE, 'maraton', 'volumen', 'determinantes_rendimiento', 'prediccion'], uso: 'Qué variables de entrenamiento se asocian al rendimiento en maratón (volumen semanal, tirada larga, intensidad).' },
  { busqueda: 'Fokkema[au] AND training for a (half-)marathon training volume and longest endurance run', esperado: 'marathon', disciplina: 'running', categoria: 'volumen', tipo: 'estudio', nivel: 'estudio_observacional', tags: [...BASE, 'maraton', 'media_maraton', 'volumen', 'tirada_larga', 'lesiones', 'corredor_popular'], uso: 'Volumen y tirada larga en corredores populares de media maratón y maratón, y su relación con rendimiento y lesiones.' },
  { busqueda: '10.1007/s40279-020-01322-8', esperado: 'exercise intensity', disciplina: 'general', categoria: 'metodologia', tipo: 'revision', nivel: 'opinion_experto', tags: ['intensidad', 'umbral', 'zonas', 'vt1', 'vt2', 'metodologia', 'running'], uso: 'Límites de los métodos para fijar zonas de intensidad (porcentajes del máximo frente a umbrales): por qué se usa el umbral personal.' },
  // Fuerza y economía de carrera
  { busqueda: '10.1007/s40279-017-0835-7', esperado: 'strength training', disciplina: 'running', categoria: 'fuerza', tipo: 'revision', nivel: 'revision_sistematica', tags: [...BASE, 'fuerza', 'economia_carrera', 'media_distancia', 'fondo'], uso: 'Efecto del entrenamiento de fuerza sobre los determinantes del rendimiento en media y larga distancia.' },
  { busqueda: '10.1519/JSC.0000000000001316', esperado: 'running economy', disciplina: 'running', categoria: 'fuerza', tipo: 'meta_analisis', nivel: 'meta_analisis', tags: [...BASE, 'fuerza', 'economia_carrera', 'corredor_entrenado'], uso: 'Metaanálisis del efecto de la fuerza sobre la economía de carrera en corredores entrenados.' },
  { busqueda: '10.1111/sms.12104', esperado: 'strength training', disciplina: 'running', categoria: 'fuerza', tipo: 'revision', nivel: 'opinion_experto', tags: [...BASE, 'fuerza', 'economia_carrera', 'ciclismo', 'optimizacion'], uso: 'Cómo optimizar el entrenamiento de fuerza para corredores y ciclistas de resistencia.' },
  { busqueda: '10.1186/s40798-015-0007-y', esperado: 'running economy', disciplina: 'running', categoria: 'metodologia', tipo: 'revision', nivel: 'opinion_experto', tags: [...BASE, 'economia_carrera', 'tecnica_carrera', 'biomecanica'], uso: 'Medición y factores que determinan la economía de carrera.' },
  { busqueda: '10.1007/s40279-016-0474-4', esperado: 'running technique', disciplina: 'running', categoria: 'metodologia', tipo: 'revision', nivel: 'opinion_experto', tags: [...BASE, 'economia_carrera', 'tecnica_carrera', 'cadencia', 'oscilacion_vertical', 'contacto_suelo'], uso: 'Qué factores biomecánicos modificables afectan a la economía de carrera (base del análisis de técnica).' },
  { busqueda: '10.1177/1941738113508544', esperado: 'stride frequency', disciplina: 'running', categoria: 'metodologia', tipo: 'revision', nivel: 'revision_sistematica', tags: [...BASE, 'tecnica_carrera', 'cadencia', 'zancada', 'biomecanica', 'lesiones'], uso: 'Cómo la frecuencia y la longitud de zancada cambian la mecánica de carrera y la carga sobre las articulaciones.' },
  // Durabilidad y fatiga
  { busqueda: '10.1007/s40279-021-01459-0', esperado: 'durability', disciplina: 'running', categoria: 'resistencia', tipo: 'revision', nivel: 'opinion_experto', tags: [...BASE, 'durabilidad', 'fatiga', 'deriva_cardiaca', 'perfil_fisiologico'], uso: 'Durabilidad: cómo se deterioran los marcadores fisiológicos con el tiempo de esfuerzo (base de la deriva cardiaca).' },
  { busqueda: '10.1152/japplphysiol.00647.2020', esperado: 'marathon', disciplina: 'running', categoria: 'resistencia', tipo: 'estudio', nivel: 'estudio_observacional', tags: [...BASE, 'maraton', 'economia_carrera', 'ritmo_competicion', 'demanda_fisiologica'], uso: 'Demandas fisiológicas de correr a ritmo de maratón de élite.' },
  { busqueda: 'Jones AM[au] AND Vanhatalo A[au] AND critical power concept applications to sports performance', esperado: 'critical power', disciplina: 'general', categoria: 'metodologia', tipo: 'revision', nivel: 'opinion_experto', tags: ['potencia_critica', 'ciclismo', 'running', 'intermitente', 'umbral'], uso: 'Concepto de potencia crítica aplicado al rendimiento (referencia para ciclismo y para esfuerzos intermitentes).' },
  // Carga, monitorización y su crítica
  { busqueda: '10.1097/00005768-199807000-00023', esperado: 'monitoring training', disciplina: 'general', categoria: 'metodologia', tipo: 'revision', nivel: 'estudio_observacional', tags: ['carga_entrenamiento', 'monotonia', 'tension', 'sobreentrenamiento', 'sesion_rpe'], uso: 'Monotonía y tensión del entrenamiento (Foster) y relación con el sobreentrenamiento.' },
  { busqueda: '10.1123/ijspp.2019-0864', esperado: 'acute', disciplina: 'general', categoria: 'metodologia', tipo: 'revision', nivel: 'opinion_experto', tags: ['carga_entrenamiento', 'acwr', 'critica', 'lesiones', 'monitorizacion'], uso: 'Problemas conceptuales del ratio carga aguda:crónica: por qué se muestra como termómetro y no como predictor de lesión.' },
  { busqueda: '10.1007/s40279-020-01378-6', esperado: 'acute', disciplina: 'general', categoria: 'metodologia', tipo: 'revision', nivel: 'opinion_experto', tags: ['carga_entrenamiento', 'acwr', 'critica', 'lesiones', 'monitorizacion'], uso: 'Papel de la carga crónica en el ACWR y críticas a su teoría subyacente.' },
  { busqueda: '10.3389/fphys.2014.00073', esperado: 'HR measures', disciplina: 'recuperacion', categoria: 'recuperacion', tipo: 'revision', nivel: 'opinion_experto', tags: ['hrv', 'frecuencia_cardiaca', 'monitorizacion', 'estado_entrenamiento', 'recuperacion'], uso: 'Cómo monitorizar el estado de entrenamiento con medidas de frecuencia cardiaca (reposo, recuperación, HRV).' },
  { busqueda: '10.2519/jospt.2014.5164', esperado: 'running distance', disciplina: 'running', categoria: 'volumen', tipo: 'estudio', nivel: 'estudio_observacional', tags: [...BASE, 'progresion_volumen', 'lesiones', 'regla_10_por_ciento', 'corredor_popular'], uso: 'Progresión semanal del kilometraje y lesiones por tipo: evidencia sobre la «regla del 10 %».' },
  { busqueda: '10.1123/ijspp.7.3.242', esperado: 'periodization', disciplina: 'general', categoria: 'periodizacion', tipo: 'revision', nivel: 'opinion_experto', tags: ['periodizacion', 'planificacion', 'evidencia', 'tradicion'], uso: 'Crítica a los paradigmas de periodización: qué está respaldado por evidencia y qué es tradición.' },
  // Intervalos
  { busqueda: '10.1007/s40279-013-0029-x', esperado: 'programming puzzle', disciplina: 'running', categoria: 'hiit', tipo: 'revision', nivel: 'opinion_experto', tags: [...BASE, 'hiit', 'intervalos', 'programacion', 'vo2max'], uso: 'Parte I (respuesta cardiopulmonar): cómo diseñar series largas y cortas para estimular el VO₂max.' },
  { busqueda: 'Buchheit M[au] AND Laursen PB[au] AND programming puzzle', esperado: 'programming puzzle', disciplina: 'running', categoria: 'hiit', tipo: 'revision', nivel: 'opinion_experto', tags: [...BASE, 'hiit', 'intervalos', 'programacion', 'vo2max'], uso: 'Variables para programar series (duración, intensidad, recuperación) y su efecto fisiológico.' },

  // Sobrecarga, carga y lesiones; retorno tras un parón
  { busqueda: '10.1249/MSS.0b013e318279a10a', esperado: 'overtraining', disciplina: 'recuperacion', categoria: 'recuperacion', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: [...BASE, 'sobreentrenamiento', 'fatiga', 'carga_entrenamiento', 'monitorizacion', 'descarga'], uso: 'Consenso europeo y americano sobre prevención, diagnóstico y tratamiento del síndrome de sobreentrenamiento (base de la regla de descarga).' },
  { busqueda: '10.1136/bjsports-2016-096581', esperado: 'load', disciplina: 'general', categoria: 'metodologia', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: [...BASE, 'carga_entrenamiento', 'lesiones', 'monitorizacion', 'acwr', 'progresion_volumen'], uso: 'Consenso del COI sobre carga de entrenamiento y lesión: cómo gestionar la carga sin presentar un ratio como predictor.' },
  { busqueda: '10.2165/00007256-200030030-00001', esperado: 'detraining', disciplina: 'general', categoria: 'periodizacion', tipo: 'revision', nivel: 'opinion_experto', tags: [...BASE, 'desentrenamiento', 'retorno', 'parón', 'vo2max'], uso: 'Parte II del desentrenamiento: qué se pierde con una falta prolongada de estímulo (base de la vuelta gradual tras un parón).' },
]

;(async () => {
  const aplicar = process.argv.includes('--apply')
  const db = createServiceSupabase()
  const { data: existentes } = await db.from('knowledge_base').select('doi, titulo')
  const dois = new Set((existentes ?? []).map(r => (r.doi ?? '').toLowerCase()).filter(Boolean))
  const titulos = new Set((existentes ?? []).map(r => (r.titulo ?? '').toLowerCase().trim()))
  const filas: Record<string, unknown>[] = []
  let noEncontrados = 0
  let noCoinciden = 0
  for (const e of ENTRADAS) {
    const esDoi = /^10\.\d{4,}\//.test(e.busqueda)
    const consulta = esDoi ? `${e.busqueda}[aid]` : e.busqueda
    const res = await searchPubMed(consulta, 'manual' as never, esDoi ? 1 : 3).catch(() => [])
    const p = esDoi ? res.find(r => (r.doi ?? '').toLowerCase() === e.busqueda.toLowerCase()) : res.find(r => r.titulo.toLowerCase().includes(e.esperado.toLowerCase())) ?? res[0]
    if (!p) { console.log(`✗ NO ENCONTRADO: ${e.busqueda.slice(0, 80)}`); noEncontrados++; continue }
    p.titulo = p.titulo.replace(/&#x[0-9a-f]+;/gi, '')
    if (!p.titulo.toLowerCase().includes(e.esperado.toLowerCase())) { console.log(`⚠ NO COINCIDE (esperaba «${e.esperado}»): ${p.titulo.slice(0, 100)} [${p.doi ?? 's/doi'}]`); noCoinciden++; continue }
    if (!p.abstract || p.abstract.length < 80) { console.log(`⚠ SIN ABSTRACT: ${p.titulo.slice(0, 90)}`); noCoinciden++; continue }
    if ((p.doi && dois.has(p.doi.toLowerCase())) || titulos.has(p.titulo.toLowerCase().trim())) { console.log(`= ya existe: ${p.titulo.slice(0, 90)}`); continue }
    console.log(`+ ${p.fecha_publicacion?.slice(0, 4)} ${p.titulo.slice(0, 100)} [${p.doi ?? 's/doi'}]`)
    filas.push({
      disciplina: e.disciplina, categoria: e.categoria, tipo: e.tipo, titulo: p.titulo,
      resumen: p.abstract.slice(0, 500), contenido_completo: p.abstract,
      puntos_clave: [`Uso en NutriCoach: ${e.uso}`, `Revista: ${p.revista ?? 's/d'} (${p.fecha_publicacion?.slice(0, 4) ?? 's/d'})`],
      fuente: [p.autores, p.revista, p.fecha_publicacion?.slice(0, 4)].filter(Boolean).join('. '), url_origen: p.enlace, doi: p.doi ?? null, tags: e.tags, poblacion: [], condiciones: [],
      nivel_evidencia: e.nivel, fuente_tipo: 'manual', verificado: true, activo: true, coach_id: null,
    })
    await new Promise(r => setTimeout(r, 400))
  }
  console.log(`\n${filas.length} por insertar de ${ENTRADAS.length} (${noEncontrados} no encontrados, ${noCoinciden} que no coinciden o sin abstract)`)
  if (aplicar && filas.length > 0) {
    const { error } = await db.from('knowledge_base').insert(filas)
    if (error) { console.error('Error insertando:', error.message); process.exit(1) }
    console.log('✓ insertados')
  } else if (!aplicar) console.log('(simulación; usa --apply para insertar)')
})()
