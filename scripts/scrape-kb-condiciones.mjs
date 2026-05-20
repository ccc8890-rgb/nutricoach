/**
 * scrape-kb-condiciones.mjs — V3: nivel_evidencia mapeado correctamente
 *
 * El CHECK constraint de knowledge_base.nivel_evidencia solo permite:
 *   meta_analisis, rct, revision_sistematica, estudio_observacional, opinion_experto
 *
 * Uso: node scripts/scrape-kb-condiciones.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hopeqzwzmlrpktoeygxz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcGVxend6bWxycGt0b2V5Z3h6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyMjUxOSwiZXhwIjoyMDkyNjk4NTE5fQ.e0iP547fppOHFfFiWEo053tjl7FmcQMAZzvCPwcVSkc'
)

const DEEPSEEK_API_KEY = 'sk-a91e02bc988b4ef59460e31b2a2cef7d'
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

const NIVEL_MAP = {
  'guia_clinica': 'revision_sistematica',
  'practica_clinica': 'revision_sistematica',
  'guias': 'revision_sistematica',
  'consenso': 'revision_sistematica',
  'declaracion': 'revision_sistematica',
}

function mapNivel(nivel) {
  const lower = (nivel || '').toLowerCase()
  return NIVEL_MAP[lower] || nivel
}

const ALLOWED_NIVELES = ['meta_analisis', 'rct', 'revision_sistematica', 'estudio_observacional', 'opinion_experto']

// DOIs que SÍ hemos verificado que funcionan en Semantic Scholar
const ARTICLES = [
  // ── Diabetes ──
  {
    doi: '10.2337/dc21-S005',
    titulo_manual: 'ADA Standards of Care — Facilitating Behavior Change',
    condiciones: ['diabetes', 'diabetes_tipo_2', 'diabetes_tipo_1'],
    descripcion: 'Standards of Medical Care in Diabetes de la American Diabetes Association (2021)',
  },
  {
    doi: '10.2337/dc18-2315',
    titulo_manual: 'Gluten Intake and Risk of Islet Autoimmunity',
    condiciones: ['diabetes', 'diabetes_tipo_1', 'autoimmune'],
    descripcion: 'Estudio sobre ingesta de gluten y autoinmunidad pancreática en diabetes tipo 1',
  },
  {
    doi: '10.1111/dom.13671',
    titulo_manual: 'BMI and Insulin Use in Type 2 Diabetes',
    condiciones: ['diabetes', 'diabetes_tipo_2', 'obesidad'],
    descripcion: 'Identificación de pacientes con diabetes tipo 2 de alto coste según IMC y uso de insulina',
  },
  // ── Hipertensión / Cardiovascular ──
  {
    doi: '10.1161/HYP.0000000000000087',
    titulo_manual: 'Measurement of Blood Pressure in Humans',
    condiciones: ['hipertension', 'presion_alta', 'cardiovascular'],
    descripcion: 'Guía AHA para la medición precisa de la presión arterial en humanos',
  },
  {
    doi: '10.1056/NEJMoa1800389',
    titulo_manual: 'Mediterranean Diet for Primary Prevention of CVD',
    condiciones: ['hipertension', 'presion_alta', 'cardiovascular', 'obesidad', 'diabetes'],
    descripcion: 'Prevención primaria de enfermedad cardiovascular con dieta Mediterránea suplementada (PREDIMED)',
  },
  {
    doi: '10.1001/jama.2017.0947',
    titulo_manual: 'Dietary Factors and Mortality from Heart Disease',
    condiciones: ['hipertension', 'presion_alta', 'dash', 'cardiovascular', 'colesterol'],
    descripcion: 'Asociación entre factores dietéticos y mortalidad cardiovascular',
  },
  {
    doi: '10.1161/CIR.0000000000001031',
    titulo_manual: 'AHA Dietary Guidance to Improve Cardiovascular Health',
    condiciones: ['hipertension', 'presion_alta', 'cardiovascular', 'colesterol', 'obesidad'],
    descripcion: 'Guía dietética de la American Heart Association 2021 para salud cardiovascular',
  },
  // ── Obesidad / Metabolismo ──
  {
    doi: '10.1056/NEJMoa1614362',
    titulo_manual: 'Health Effects of Overweight and Obesity (GBD)',
    condiciones: ['obesidad', 'diabetes', 'cardiovascular', 'resistencia_insulina'],
    descripcion: 'Carga global de obesidad y sus efectos en la salud (GBD 2015)',
  },
  {
    doi: '10.1016/j.metabol.2015.06.015',
    titulo_manual: 'Thyroid and Metabolic Syndrome',
    condiciones: ['obesidad', 'resistencia_insulina', 'metabolico'],
    descripcion: 'Influencia de la disfunción tiroidea en síndrome metabólico',
  },
  // ── Nutrición general ──
  {
    doi: '10.1093/ajcn/73.1.1',
    titulo_manual: 'Dietary Patterns and Chronic Disease',
    condiciones: ['diabetes', 'cardiovascular', 'obesidad', 'hipertension'],
    descripcion: 'Utilidad de los patrones dietéticos para entender el rol de la dieta en enfermedades crónicas',
  },
  {
    doi: '10.1016/j.jand.2015.12.009',
    titulo_manual: 'AND Position Paper on Nutrition and Chronic Disease',
    condiciones: ['diabetes', 'cardiovascular', 'obesidad', 'hipertension', 'colesterol'],
    descripcion: 'Position paper de la Academy of Nutrition and Dietetics 2016',
  },
]

async function fetchDoi(doi) {
  const clean = doi.replace(/^https?:\/\/doi\.org\//i, '').replace(/^doi:/i, '').trim()
  const res = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/DOI:${clean}?fields=title,abstract,authors,year,journal`,
    { signal: AbortSignal.timeout(15000) }
  )
  if (!res.ok) return null
  const data = await res.json()
  const authors = (data.authors ?? []).map(a => a.name).slice(0, 5).join(', ')
  return `Título: ${data.title ?? ''}
Año: ${data.year ?? ''}
Revista: ${data.journal?.name ?? ''}
Autores: ${authors}
Abstract: ${data.abstract ?? 'No disponible'}`
}

async function generateWithDeepSeek(article) {
  const contenido = await fetchDoi(article.doi)

  const contextoDOI = contenido
    ? `CONTENIDO REAL DEL PAPER:\n${contenido.slice(0, 4000)}\n\n`
    : `(El DOI ${article.doi} no está disponible en Semantic Scholar, usa tu conocimiento para generar contenido basado en ${article.descripcion})\n\n`

  const prompt = `Eres un asistente de nutrición clínica experto en evidencia científica. Genera una entrada estructurada para una base de conocimiento de un coach nutricional basada en el siguiente paper.

${contextoDOI}
INSTRUCCIONES:
- Basa el contenido en la evidencia CIENTÍFICA REAL de este paper
- El resumen debe ser ACCIONABLE para un coach nutricional
- Los puntos clave deben ser CONCLUSIONES PRÁCTICAS
- El artículo es relevante para pacientes con: ${article.condiciones.join(', ')}
- La disciplina SIEMPRE es "nutricion", la categoría es "patologia"

IMPORTANTE: nivel_evidencia debe ser UNO de estos valores exactos:
meta_analisis, rct, revision_sistematica, estudio_observacional, opinion_experto

Responde SOLO con JSON válido, sin markdown:
{
  "titulo": "Nombre del estudio (Autor, Año) — Tema principal",
  "resumen": "Resumen en 3-5 frases con conclusiones accionables para un coach",
  "puntos_clave": ["punto práctico 1", "punto práctico 2", "punto práctico 3", "punto práctico 4", "punto práctico 5"],
  "fuente": "Autor(es), Año. Revista",
  "categoria": "patologia",
  "tipo": "estudio",
  "nivel_evidencia": "meta_analisis|rct|revision_sistematica|estudio_observacional|opinion_experto",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "poblacion": ["poblacion1", "poblacion2"],
  "condiciones": ${JSON.stringify(article.condiciones)}
}`

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(40000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DeepSeek HTTP ${res.status}: ${err}`)
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content ?? ''
  const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(jsonStr)
}

async function main() {
  console.log('🧬 Scrapeando artículos científicos para knowledge_base')
  console.log(`Total: ${ARTICLES.length} artículos\n`)

  let insertados = 0
  let errores = 0
  let duplicados = 0

  for (const [i, article] of ARTICLES.entries()) {
    console.log(`--- [${i + 1}/${ARTICLES.length}] DOI: ${article.doi} ---`)
    console.log(`  Condiciones: ${article.condiciones.join(', ')}`)

    try {
      const parsed = await generateWithDeepSeek(article)

      // Mapear nivel_evidencia a valores permitidos por el CHECK constraint
      const nivelMapeado = mapNivel(parsed.nivel_evidencia)
      if (!ALLOWED_NIVELES.includes(nivelMapeado)) {
        console.log(`  ⚠️ nivel_evidencia inválido: "${parsed.nivel_evidencia}" → usando "revision_sistematica"`)
        parsed.nivel_evidencia = 'revision_sistematica'
      } else {
        parsed.nivel_evidencia = nivelMapeado
      }

      console.log(`  ✅ DeepSeek: "${(parsed.titulo || '').slice(0, 70)}..." [${parsed.nivel_evidencia}]`)

      const insertData = {
        titulo: parsed.titulo || article.titulo_manual,
        resumen: parsed.resumen || '',
        puntos_clave: parsed.puntos_clave || [],
        fuente: parsed.fuente || article.descripcion,
        doi: article.doi,
        url_origen: `https://doi.org/${article.doi}`,
        disciplina: 'nutricion',
        categoria: 'patologia',
        tipo: parsed.tipo || 'estudio',
        nivel_evidencia: parsed.nivel_evidencia,
        tags: parsed.tags || article.condiciones,
        poblacion: parsed.poblacion || ['adultos', 'poblacion_general'],
        condiciones: article.condiciones,
        verificado: true,
        activo: true,
      }

      const { error: insertError } = await supabase
        .from('knowledge_base')
        .insert(insertData)

      if (insertError) {
        if (insertError.code === '23505') {
          console.log(`  ⚠️ Ya existe (duplicado por DOI)`)
          duplicados++
        } else {
          console.log(`  ❌ Insert error: ${insertError.message}`)
          errores++
        }
      } else {
        console.log(`  ✅ Insertado en knowledge_base`)
        insertados++
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`)
      errores++
    }
    console.log('')
  }

  console.log('══════ RESUMEN ══════')
  console.log(`✅ Insertados: ${insertados}`)
  console.log(`⚠️  Duplicados: ${duplicados}`)
  console.log(`❌ Errores: ${errores}`)

  // Verificación final
  console.log('\n═══ VERIFICACIÓN FINAL ═══\n')
  for (const cond of ['diabetes', 'hipertension', 'obesidad', 'cardiovascular', 'colesterol']) {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('titulo')
      .eq('activo', true)
      .is('coach_id', null)
      .in('disciplina', ['nutricion', 'general'])
      .or(`condiciones.ov.{"${cond}"}`)
      .limit(10)

    if (!error && data) {
      console.log(`🔍 "${cond}": ${data.length} artículos`)
      data.forEach(a => console.log(`   • ${a.titulo.slice(0, 75)}`))
    }
  }

  process.exit(0)
}

main().catch(err => {
  console.error('Error fatal:', err)
  process.exit(1)
})
