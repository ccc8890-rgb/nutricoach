#!/usr/bin/env tsx
/**
 * Carga curada de papers de referencia (consensos, revisiones y metaanálisis) para la periodización
 * nutricional por competición y la suplementación deportiva. Cada trabajo se localiza en PubMed por DOI
 * (o por palabras del título si no tiene), se guarda su abstract real y se etiqueta para que el motor
 * lo encuentre por tags. No se inventan hallazgos: los «puntos clave» solo dicen para qué se usa en NutriCoach.
 *
 * USO:  npx tsx scripts/cargar-papers-clave.ts          # simula y lista lo encontrado
 *       npx tsx scripts/cargar-papers-clave.ts --apply  # inserta los que no estén (por DOI o título)
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

const CARGA = ['carga_hidratos', 'carbohidratos', 'hidratos']
const ENTRADAS: Entrada[] = [
  { busqueda: '10.1080/02640414.2011.585473', disciplina: 'nutricion', categoria: 'competicion', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: [...CARGA, 'tapering', 'competicion', 'pre_carrera', 'recuperacion', 'maraton', 'media_maraton'], uso: 'Base de la carga de hidratos previa a la prueba, la comida previa, los hidratos durante el esfuerzo y la recuperación.' },
  { busqueda: '10.1016/j.jand.2015.12.006', disciplina: 'nutricion', categoria: 'competicion', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: ['carbohidratos', 'proteina', 'hidratacion', 'suplementacion', 'competicion', 'recuperacion', 'sodio'], uso: 'Posición ACSM/AND/DC: necesidades de hidratos por carga de entrenamiento, proteína, hidratación y suplementos.' },
  { busqueda: '10.1007/s40279-014-0148-z', disciplina: 'nutricion', categoria: 'competicion', tipo: 'revision', nivel: 'revision_sistematica', tags: ['carbohidratos', 'hidratos', 'intra_entreno', 'geles', 'maltodextrina', 'maurten', 'competicion'], uso: 'Dosis de hidratos durante el esfuerzo según duración (30-60 g/h y hasta 90 g/h con hidratos de varios transportadores).' },
  { busqueda: '10.1007/s40279-017-0690-6', disciplina: 'nutricion', categoria: 'competicion', tipo: 'revision', nivel: 'revision_sistematica', tags: ['carbohidratos', 'intra_entreno', 'geles', 'tolerancia_digestiva', 'competicion'], uso: 'Entrenar el intestino: por qué probar geles y bebidas en entreno antes de la prueba.' },
  { busqueda: '10.1080/02640414.2011.610348', disciplina: 'triatlon', categoria: 'competicion', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: ['triatlon', 'maraton', 'media_maraton', 'ciclismo', 'carbohidratos', 'hidratacion', 'competicion'], uso: 'Recomendaciones de maratón, triatlón y ciclismo de ruta: hidratos, líquidos y electrolitos por duración.' },
  { busqueda: 'nutritional[ti] AND recommendations[ti] AND competing[ti] AND Ironman[ti] AND triathlon[ti]', disciplina: 'triatlon', categoria: 'competicion', tipo: 'revision', nivel: 'opinion_experto', tags: ['triatlon', 'ironman', 'triatlon_70_3', 'carbohidratos', 'hidratacion', 'sodio', 'competicion'], uso: 'Estrategia nutricional de distancia Ironman: hidratos, líquidos y sodio durante la prueba.' },
  { busqueda: '10.3390/nu17111846', disciplina: 'triatlon', categoria: 'competicion', tipo: 'revision', nivel: 'revision_sistematica', tags: ['triatlon', 'triatlon_sprint', 'triatlon_olimpico', 'triatlon_70_3', 'ironman', 'carbohidratos', 'recuperacion'], uso: 'Nutrición del triatleta para entrenar, competir y recuperar (2025).' },
  { busqueda: '10.1080/02640414.2011.589469', disciplina: 'running', categoria: 'competicion', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: ['running_5k', 'running_10k', 'media_distancia', 'competicion', 'carbohidratos', 'cafeina', 'bicarbonato'], uso: 'Nutrición para pruebas de potencia y media distancia (5-10 km): carga, comida previa y ayudas ergogénicas.' },
  { busqueda: '10.3390/nu10121995', disciplina: 'running', categoria: 'competicion', tipo: 'revision', nivel: 'revision_sistematica', tags: ['ultra', 'trail_largo', 'carbohidratos', 'sodio', 'hidratacion', 'competicion', 'tolerancia_digestiva'], uso: 'Estrategias nutricionales en ultrarresistencia: hidratos, sodio, líquidos y tolerancia digestiva.' },
  { busqueda: '10.1080/15502783.2025.2509674', disciplina: 'hyrox', categoria: 'competicion', tipo: 'revision', nivel: 'revision_sistematica', tags: ['hyrox', 'crossfit', 'hibrido', 'carbohidratos', 'cafeina', 'creatina', 'suplementacion', 'competicion'], uso: 'Revisión de alcance de nutrición en CrossFit: base para extrapolar a Hyrox (esfuerzo mixto de fuerza y carrera).' },
  { busqueda: '10.3390/nu18182969', disciplina: 'hyrox', categoria: 'suplementacion', tipo: 'revision', nivel: 'revision_sistematica', tags: ['hyrox', 'crossfit', 'cafeina', 'suplementacion', 'competicion'], uso: 'Cafeína aguda en CrossFit (revisión sistemática): referencia para esfuerzos mixtos de alta intensidad como Hyrox.' },
  { busqueda: '10.1123/ijspp.2026-0098', disciplina: 'hyrox', categoria: 'competicion', tipo: 'estudio', nivel: 'estudio_observacional', tags: ['hyrox', 'hibrido', 'ritmo', 'carrera', 'competicion'], uso: 'Demanda de carrera y ritmo en una competición oficial de Hyrox (duración y carga del esfuerzo).' },
  { busqueda: '10.1136/bjsports-2018-099027', disciplina: 'nutricion', categoria: 'suplementacion', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: ['suplementacion', 'cafeina', 'creatina', 'bicarbonato', 'nitrato', 'beta_alanina', 'hierro', 'vitamina_d', 'antidopaje'], uso: 'Consenso IOC 2018: qué suplementos tienen evidencia y cuáles no en deportistas de alto rendimiento.' },
  { busqueda: '10.1186/s12970-020-00383-4', disciplina: 'nutricion', categoria: 'suplementacion', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: ['suplementacion', 'cafeina', 'rendimiento', 'competicion', 'hyrox', 'running_10k'], uso: 'Posición ISSN sobre cafeína: dosis (3-6 mg/kg), momento y precauciones.' },
  { busqueda: '10.1186/s12970-017-0173-z', disciplina: 'nutricion', categoria: 'suplementacion', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: ['suplementacion', 'creatina', 'fuerza', 'hyrox', 'crossfit', 'hibrido'], uso: 'Posición ISSN sobre creatina: eficacia, dosis de 3-5 g/día y seguridad.' },
  { busqueda: '10.1186/s12970-015-0090-y', disciplina: 'nutricion', categoria: 'suplementacion', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: ['suplementacion', 'beta_alanina', 'hyrox', 'alta_intensidad'], uso: 'Posición ISSN sobre beta-alanina: dosis, tiempo de carga y efecto en esfuerzos de 1-4 min.' },
  { busqueda: '10.1186/s12970-021-00469-7', disciplina: 'nutricion', categoria: 'suplementacion', tipo: 'meta_analisis', nivel: 'meta_analisis', tags: ['suplementacion', 'bicarbonato', 'competicion', 'alta_intensidad', 'tolerancia_digestiva'], uso: 'Revisión paraguas del bicarbonato sódico y el rendimiento (efecto y molestias digestivas).' },
  { busqueda: '10.1007/s40279-025-02194-6', disciplina: 'nutricion', categoria: 'suplementacion', tipo: 'meta_analisis', nivel: 'meta_analisis', tags: ['suplementacion', 'nitrato', 'remolacha', 'rendimiento', 'competicion'], uso: 'Revisión paraguas (2025) del nitrato dietético y el rendimiento.' },
  { busqueda: '10.1186/s12970-021-00450-4', disciplina: 'nutricion', categoria: 'suplementacion', tipo: 'meta_analisis', nivel: 'meta_analisis', tags: ['suplementacion', 'nitrato', 'remolacha', 'resistencia', 'media_maraton', 'maraton'], uso: 'Nitrato dietético en el rendimiento de resistencia y la respuesta cardiorrespiratoria.' },
  { busqueda: '10.1249/mss.0b013e31802ca597', disciplina: 'nutricion', categoria: 'hidratacion', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: ['hidratacion', 'sodio', 'electrolitos', 'competicion', 'ultra', 'maraton'], uso: 'Posición ACSM sobre reposición de líquidos: pérdida de peso <2 %, individualizar y evitar sobrehidratar.' },
  { busqueda: '10.1249/01.MSS.0000074448.73931.11', disciplina: 'general', categoria: 'periodizacion', tipo: 'revision', nivel: 'revision_sistematica', tags: ['tapering', 'competicion', 'periodizacion', 'carga_entrenamiento', 'maraton', 'media_maraton', 'hyrox'], uso: 'Bases científicas del tapering: reducción de volumen manteniendo intensidad y frecuencia.' },
  { busqueda: '10.1249/mss.0b013e31806010e0', disciplina: 'general', categoria: 'periodizacion', tipo: 'meta_analisis', nivel: 'meta_analisis', tags: ['tapering', 'competicion', 'periodizacion', 'carga_entrenamiento', 'duracion_taper'], uso: 'Metaanálisis del tapering: duración y reducción de volumen óptimas para mejorar el rendimiento.' },
  { busqueda: '10.1111/sms.70379', disciplina: 'nutricion', categoria: 'competicion', tipo: 'meta_analisis', nivel: 'meta_analisis', tags: [...CARGA, 'glucogeno', 'tapering', 'competicion'], uso: 'Metaanálisis (2026) de la ingesta de hidratos y el glucógeno muscular: cuánto hay que comer para llenar reservas.' },
  { busqueda: '10.1186/s12970-017-0189-4', disciplina: 'nutricion', categoria: 'metabolismo', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: ['timing', 'nutrient_timing', 'pre-entreno', 'post-entreno', 'proteina', 'carbohidratos', 'doble_sesion'], uso: 'Posición ISSN sobre momento de ingesta de nutrientes: antes, durante y después del ejercicio y recuperación entre sesiones.' },
  { busqueda: '10.1123/ijsnem.20.6.515', disciplina: 'nutricion', categoria: 'metabolismo', tipo: 'revision', nivel: 'opinion_experto', tags: ['recuperacion', 'post-entreno', 'entre_sesiones', 'doble_sesion', 'glucogeno', 'carbohidratos', 'proteina'], uso: 'Estrategias nutricionales de recuperación tras el ejercicio (hidratos y proteína, ritmo de reposición), base para dobles sesiones.' },
  { busqueda: '10.1007/s40279-018-0867-7', disciplina: 'nutricion', categoria: 'periodizacion', tipo: 'revision', nivel: 'opinion_experto', tags: ['periodizacion_hidratos', 'glucogeno', 'carbohidratos', 'train_low', 'carga_entrenamiento'], uso: 'Marco teórico de la periodización de hidratos según la sesión (glucógeno alto o bajo); decisión del coach, no automática.' },
  { busqueda: '10.1186/s12970-017-0177-8', disciplina: 'nutricion', categoria: 'metabolismo', tipo: 'guia_clinica', nivel: 'opinion_experto', tags: ['proteina', 'distribucion_proteina', 'post-entreno', 'recuperacion', 'rendimiento'], uso: 'Posición ISSN sobre proteína y ejercicio: dosis diaria, reparto por tomas y momento.' },
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
