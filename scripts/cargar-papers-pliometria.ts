#!/usr/bin/env tsx
/**
 * Carga curada de la evidencia sobre pliometría (saltos) y fuerza para corredores y atletas híbridos (Hyrox), que consulta el generador de planes.
 * Cada trabajo se localiza en PubMed (por DOI o por autor y palabras del título) y se COMPRUEBA que el título devuelto contiene
 * la palabra esperada: si no coincide, no se inserta (evita atribuir a un paper lo que dice otro). Se guarda su abstract real;
 * los «puntos clave» solo dicen para qué se usa en NutriCoach, no resumen resultados.
 *
 * USO:  npx tsx scripts/cargar-papers-pliometria.ts          # simula y lista lo encontrado
 *       npx tsx scripts/cargar-papers-pliometria.ts --apply  # inserta los que no estén (por DOI o título)
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

const BASE = ['running', 'entrenamiento_resistencia', 'pliometria', 'saltos']
const ENTRADAS: Entrada[] = [
  { busqueda: '10.1080/02640414.2021.1916261', esperado: 'jump training', disciplina: 'running', categoria: 'fuerza', tipo: 'meta_analisis', nivel: 'meta_analisis', tags: [...BASE, 'fuerza', 'economia_carrera', 'corredor_popular', 'corredor_entrenado', 'hibrido'], uso: 'Metaanálisis de 21 estudios: el entrenamiento de saltos mejora la economía de carrera, la fuerza reactiva y el rendimiento en contrarreloj en corredores de fondo (base de incluir pliometría).' },
  { busqueda: '10.1186/s40798-022-00511-1', esperado: 'plyometric', disciplina: 'running', categoria: 'fuerza', tipo: 'meta_analisis', nivel: 'meta_analisis', tags: [...BASE, 'fuerza', 'economia_carrera', 'entrenamiento_fuerza', 'hibrido'], uso: 'Compara fuerza máxima con cargas altas frente a pliometría: la fuerza pesada mejora más la economía de carrera, por lo que la pliometría es un complemento y no un sustituto.' },
  { busqueda: '10.1007/s40279-024-02018-z', esperado: 'strength training methods', disciplina: 'running', categoria: 'fuerza', tipo: 'revision', nivel: 'revision_sistematica', tags: [...BASE, 'fuerza', 'fuerza_resistencia', 'economia_carrera', 'hibrido'], uso: 'Compara métodos de fuerza (carga alta, submáxima, pliométrico, combinado) sobre el rendimiento de corredores de fondo.' },
  { busqueda: '10.1007/s40279-017-0835-7', esperado: 'strength training', disciplina: 'running', categoria: 'fuerza', tipo: 'revision', nivel: 'revision_sistematica', tags: [...BASE, 'fuerza', 'economia_carrera', 'hibrido'], uso: 'Efecto del entrenamiento de fuerza (incluida la pliometría) sobre los determinantes fisiológicos del rendimiento de fondo.' },
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

  // Los que ya estaban en la base se etiquetan también como pliometría/saltos/híbrido para que el generador los ofrezca.
  for (const e of ENTRADAS.filter(x => /^10\./.test(x.busqueda))) {
    const { data: fila } = await db.from('knowledge_base').select('id, tags').ilike('doi', e.busqueda).maybeSingle()
    if (!fila) continue
    const tags = [...new Set([...(fila.tags ?? []), ...e.tags])]
    if (tags.length === (fila.tags ?? []).length) continue
    console.log(`${aplicar ? '~ etiqueta' : '~ etiquetaría'}: ${e.busqueda} (+${tags.length - (fila.tags ?? []).length})`)
    if (aplicar) await db.from('knowledge_base').update({ tags }).eq('id', fila.id)
  }
})()
