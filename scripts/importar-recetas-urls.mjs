#!/usr/bin/env node
/**
 * importar-recetas-urls.mjs
 * Scrapea una lista de URLs de recetas y las inserta en Supabase como 'en_revision'.
 * No requiere el servidor Next.js — usa Supabase service_role directamente.
 *
 * Uso:
 *   node scripts/importar-recetas-urls.mjs
 *   node scripts/importar-recetas-urls.mjs --dry-run   (no inserta, solo muestra extracción)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// ── Cargar .env.local ──────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
  if (!process.env[key]) process.env[key] = val
}

const DRY_RUN = process.argv.includes('--dry-run')
const SOLO_URL = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] ?? null

// ── Supabase ───────────────────────────────────────────────────────────────
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// ── URLs a importar ────────────────────────────────────────────────────────
const URLS = [
  // COMIDAS
  { url: 'https://www.myprotein.es/thezone/recetas/poke-bowl-de-salmon-en-airfryer/', categoria: 'Comida' },
  { url: 'https://www.myprotein.es/thezone/recetas/pollo-picante-con-cuscus/', categoria: 'Comida' },
  { url: 'https://www.vitonica.com/recetas-saludables/curry-rapido-de-pollo-y-garbanzos-receta-saludable', categoria: 'Comida' },
  { url: 'https://nutricionconq.com/lentejas-con-pollo-y-verdura/', categoria: 'Comida' },
  { url: 'https://www.myprotein.es/thezone/recetas/pollo-al-pesto-con-verduras/', categoria: 'Comida' },
  // CENAS
  { url: 'https://www.myprotein.es/thezone/recetas/pollo-teriyaki-con-arroz/', categoria: 'Cena' },
  { url: 'https://www.myprotein.es/thezone/recetas/wraps-coreanos-picantes/', categoria: 'Cena' },
  { url: 'https://paulasapron.com/salmon-al-horno-con-esparragos/', categoria: 'Cena' },
  { url: 'https://www.dietfarma.com/receta/ensalada-de-pollo-con-tomate-cherry-queso-curado-huevo-y-jamon-serrano', categoria: 'Cena' },
  { url: 'https://cookpad.com/es/recetas/10876867-tortilla-de-claras-con-champinones', categoria: 'Cena' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
function extractTextFromHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractImageUrl(image) {
  if (!image) return null
  if (typeof image === 'string') return image
  if (Array.isArray(image) && image.length > 0) {
    const first = image[0]
    if (typeof first === 'string') return first
    if (typeof first === 'object' && first !== null && 'url' in first) return first.url
  }
  if (typeof image === 'object' && image !== null && 'url' in image) return image.url
  return null
}

function extractYieldNumber(yieldStr) {
  if (!yieldStr) return null
  const match = String(yieldStr).match(/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

function parseISODuration(duration) {
  if (!duration) return null
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return null
  return parseInt(match[1] || '0') * 60 + parseInt(match[2] || '0')
}

function extractJSONLD(html) {
  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (item['@type'] === 'Recipe' && item.name) return item
      }
    } catch { /* skip */ }
  }
  return null
}

function buildFromJSONLD(item) {
  const instructions = []
  if (typeof item.recipeInstructions === 'string') {
    instructions.push(item.recipeInstructions)
  } else if (Array.isArray(item.recipeInstructions)) {
    for (const step of item.recipeInstructions) {
      if (typeof step === 'string') instructions.push(step)
      else if (step?.text) instructions.push(step.text)
      else if (step?.name) instructions.push(step.name)
    }
  }

  return {
    nombre: item.name,
    descripcion: item.description || null,
    porciones: extractYieldNumber(item.recipeYield),
    tiempo_prep_min: parseISODuration(item.prepTime),
    tiempo_coccion_min: parseISODuration(item.cookTime || item.totalTime),
    ingredientes: (item.recipeIngredient || []).map(i => ({ nombre_libre: i, cantidad_gramos: 100 })),
    instrucciones: instructions.length > 0 ? instructions.map((s, i) => `${i + 1}. ${s}`).join('\n') : null,
    imagen_url: extractImageUrl(item.image),
    autor_original: item.author?.name || null,
  }
}

const EXTRACCION_PROMPT = (texto) => `Extrae la receta de este texto web y devuelve SOLO un JSON con esta estructura exacta en español:
{
  "nombre": string,
  "descripcion": string | null,
  "porciones": number | null,
  "tiempo_prep_min": number | null,
  "tiempo_coccion_min": number | null,
  "dificultad": "Fácil"|"Medio"|"Difícil" | null,
  "tipo_coccion": "No Bake"|"Sartén/Wok"|"Horno"|"Microondas"|"Freidora de Aire"|"Vapor"|"Olla/Cazuela"|"Plancha" | null,
  "ingredientes": [{"nombre_libre": string, "cantidad_gramos": number}],
  "instrucciones": string | null,
  "consejos": string | null,
  "imagen_url": string | null
}
Para ingredientes: usa nombres canónicos en español, estima gramos según cantidades del texto.
TEXTO: ${texto}`

async function geminiExtract(html) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY no configurada')
  const texto = extractTextFromHtml(html).substring(0, 15000)
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: EXTRACCION_PROMPT(texto) }] }] }),
    }
  )
  if (!res.ok) throw new Error(`Gemini error ${res.status}`)
  const data = await res.json()
  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  text = text.trim().replace(/^```json|^```|```$/gm, '').trim()
  return JSON.parse(text)
}

async function deepseekExtract(html) {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error('DEEPSEEK_API_KEY no configurada')
  const texto = extractTextFromHtml(html).substring(0, 15000)
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: EXTRACCION_PROMPT(texto) }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek error ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content ?? ''
  return JSON.parse(text)
}

async function matchIngredient(nombre) {
  const q = nombre.toLowerCase().trim()
  if (!q || q.length < 2) return null

  // 1. Exacto
  const { data: exact } = await sb.from('alimentos').select('id, nombre').eq('es_comestible', true).ilike('nombre', q).limit(1)
  if (exact?.length) return exact[0]

  // 2. Starts-with (prefiere con macros)
  const { data: sw } = await sb.from('alimentos').select('id, nombre, calorias').eq('es_comestible', true).ilike('nombre', q + '%').limit(5)
  if (sw?.length) {
    const conMacros = sw.filter(a => (a.calorias ?? 0) > 0)
    if (conMacros.length) { conMacros.sort((a, b) => a.nombre.length - b.nombre.length); return conMacros[0] }
    return sw[0]
  }

  // 3. Contains por palabras significativas
  const tokens = q.split(/\s+/).filter(t => t.length > 3)
  for (const token of tokens) {
    const { data: ct } = await sb.from('alimentos').select('id, nombre, calorias').eq('es_comestible', true).ilike('nombre', `%${token}%`).limit(10)
    if (ct?.length) {
      const conMacros = ct.filter(a => (a.calorias ?? 0) > 0)
      if (conMacros.length) { conMacros.sort((a, b) => a.nombre.length - b.nombre.length); return conMacros[0] }
      return ct[0]
    }
  }
  return null
}

async function getCoachId() {
  const { data } = await sb.from('perfiles').select('id').eq('rol', 'coach').limit(1)
  if (data?.length) return data[0].id
  // fallback: buscar por email en auth
  const { data: { users } } = await sb.auth.admin.listUsers()
  const coach = users?.find(u => u.email === 'ccc8890@gmail.com')
  return coach?.id ?? null
}

// ── Main ───────────────────────────────────────────────────────────────────
async function procesarURL(urlEntry, coachId) {
  const { url, categoria } = urlEntry
  console.log(`\n📥 Procesando: ${url}`)

  // Fetch HTML
  let html = ''
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    })
    html = await res.text()
  } catch (err) {
    console.error(`  ❌ Error al descargar: ${err.message}`)
    return { url, ok: false, error: err.message }
  }

  // Extracción: JSON-LD → Gemini
  let extracted = null
  const jsonLd = extractJSONLD(html)
  if (jsonLd) {
    extracted = buildFromJSONLD(jsonLd)
    console.log(`  ✅ JSON-LD encontrado: "${extracted.nombre}"`)
  } else {
    console.log(`  ⚠️  Sin JSON-LD — probando Gemini Flash...`)
    let geminiOk = false
    try {
      extracted = await geminiExtract(html)
      geminiOk = true
      console.log(`  ✅ Gemini: "${extracted.nombre}"`)
    } catch (err) {
      console.warn(`  ⚠️  Gemini falló (${err.message}) — usando DeepSeek...`)
    }
    if (!geminiOk) {
      try {
        extracted = await deepseekExtract(html)
        console.log(`  ✅ DeepSeek: "${extracted.nombre}"`)
      } catch (err) {
        console.error(`  ❌ DeepSeek también falló: ${err.message}`)
        return { url, ok: false, error: 'AI extraction failed' }
      }
    }
  }

  if (!extracted?.nombre) {
    console.error('  ❌ No se encontró nombre de receta')
    return { url, ok: false, error: 'Sin nombre' }
  }

  // Forzar categoría del listado (más fiable que lo que detecte el scraper)
  extracted.categoria = categoria

  // Match ingredientes
  const ingredientesFinales = []
  const ingredientes = extracted.ingredientes || []
  console.log(`  🔍 Matcheando ${ingredientes.length} ingredientes...`)

  for (let i = 0; i < ingredientes.length; i++) {
    const ing = ingredientes[i]
    const nombre = ing.nombre_libre || ing.nombre || ''
    const gramos = ing.cantidad_gramos || 100
    const match = await matchIngredient(nombre)
    ingredientesFinales.push({
      nombre_libre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
      alimento_id: match?.id ?? null,
      cantidad_gramos: gramos,
      orden: i,
      es_opcional: false,
    })
    if (match) process.stdout.write('.')
    else process.stdout.write('?')
  }
  console.log('')

  const matched = ingredientesFinales.filter(i => i.alimento_id !== null).length
  console.log(`  📊 ${matched}/${ingredientes.length} ingredientes matcheados`)

  if (DRY_RUN) {
    console.log(`  🔎 DRY-RUN — no se inserta en BD`)
    console.log(`     Nombre: ${extracted.nombre}`)
    console.log(`     Categoría: ${extracted.categoria}`)
    console.log(`     Porciones: ${extracted.porciones}`)
    console.log(`     Tiempo prep: ${extracted.tiempo_prep_min} min`)
    console.log(`     Ingredientes: ${ingredientesFinales.map(i => i.nombre_libre).join(', ')}`)
    return { url, ok: true, dry: true, nombre: extracted.nombre }
  }

  // Insertar receta
  const { data: receta, error: insertErr } = await sb
    .from('recetas')
    .insert({
      coach_id: coachId,
      nombre: extracted.nombre,
      descripcion: extracted.descripcion ?? null,
      instrucciones: extracted.instrucciones ?? null,
      consejos: extracted.consejos ?? null,
      categoria: extracted.categoria,
      tipo_coccion: extracted.tipo_coccion ?? null,
      dificultad: extracted.dificultad ?? null,
      porciones: extracted.porciones ?? 1,
      tiempo_prep_min: extracted.tiempo_prep_min ?? null,
      tiempo_coccion_min: extracted.tiempo_coccion_min ?? null,
      imagen_url: extracted.imagen_url ?? null,
      url_origen: url,
      fuente: 'url',
      fuente_tipo: 'web',
      estado: 'en_revision',
    })
    .select('id')
    .single()

  if (insertErr || !receta) {
    console.error(`  ❌ Error insertando receta: ${insertErr?.message}`)
    return { url, ok: false, error: insertErr?.message }
  }

  // Insertar ingredientes
  if (ingredientesFinales.length > 0) {
    const { error: ingErr } = await sb.from('receta_ingredientes').insert(
      ingredientesFinales.map(i => ({ ...i, receta_id: receta.id }))
    )
    if (ingErr) console.warn(`  ⚠️  Error en ingredientes: ${ingErr.message}`)
  }

  // Calcular macros desde ingredientes matcheados
  const idsAlimentos = [...new Set(ingredientesFinales.map(i => i.alimento_id).filter(Boolean))]
  if (idsAlimentos.length > 0) {
    const { data: alimData } = await sb.from('alimentos').select('id, calorias, proteinas, carbohidratos, grasas, fibra').in('id', idsAlimentos)
    if (alimData?.length) {
      const map = Object.fromEntries(alimData.map(a => [a.id, a]))
      const porciones = extracted.porciones ?? 1
      let totalKcal = 0, totalProt = 0, totalCH = 0, totalG = 0, totalF = 0
      for (const ing of ingredientesFinales) {
        if (!ing.alimento_id || !map[ing.alimento_id]) continue
        const a = map[ing.alimento_id]
        const factor = (ing.cantidad_gramos || 0) / 100
        totalKcal += (a.calorias || 0) * factor
        totalProt += (a.proteinas || 0) * factor
        totalCH += (a.carbohidratos || 0) * factor
        totalG += (a.grasas || 0) * factor
        totalF += (a.fibra || 0) * factor
      }
      await sb.from('recetas').update({
        kcal: Math.round(totalKcal / porciones * 10) / 10,
        proteinas: Math.round(totalProt / porciones * 10) / 10,
        carbohidratos: Math.round(totalCH / porciones * 10) / 10,
        grasas: Math.round(totalG / porciones * 10) / 10,
        fibra: Math.round(totalF / porciones * 10) / 10,
      }).eq('id', receta.id)
    }
  }

  console.log(`  ✅ Insertada con ID: ${receta.id} → /recetas/${receta.id}`)
  return { url, ok: true, id: receta.id, nombre: extracted.nombre, categoria }
}

async function main() {
  console.log('🍽️  Importador de recetas NutriCoach')
  console.log(`   Modo: ${DRY_RUN ? 'DRY-RUN (sin escritura)' : 'PRODUCCIÓN'}`)
  console.log(`   URLs a procesar: ${SOLO_URL ? 1 : URLS.length}`)

  // Obtener coach ID
  const coachId = await getCoachId()
  if (!coachId) {
    console.error('❌ No se encontró el coach (ccc8890@gmail.com) en la BD')
    process.exit(1)
  }
  console.log(`   Coach ID: ${coachId}`)

  const urlsAProcesar = SOLO_URL ? URLS.filter(u => u.url === SOLO_URL) : URLS
  if (!urlsAProcesar.length) {
    console.error('❌ URL no encontrada en la lista. Usa el valor exacto de la URL.')
    process.exit(1)
  }

  const resultados = []
  for (const entry of urlsAProcesar) {
    try {
      const res = await procesarURL(entry, coachId)
      resultados.push(res)
      // Pausa entre requests para no saturar APIs
      await new Promise(r => setTimeout(r, 2000))
    } catch (err) {
      console.error(`  💥 Error inesperado: ${err.message}`)
      resultados.push({ url: entry.url, ok: false, error: err.message })
    }
  }

  // Resumen
  console.log('\n────────────────────────────────────────')
  console.log('📋 RESUMEN FINAL')
  const ok = resultados.filter(r => r.ok)
  const fail = resultados.filter(r => !r.ok)
  console.log(`   ✅ OK: ${ok.length}`)
  console.log(`   ❌ Fallos: ${fail.length}`)
  if (ok.length) {
    console.log('\n   Recetas importadas (estado: en_revision):')
    for (const r of ok) {
      if (!r.dry) console.log(`   → [${r.categoria}] ${r.nombre}  /recetas/${r.id}`)
    }
  }
  if (fail.length) {
    console.log('\n   Fallos:')
    for (const r of fail) console.log(`   ✗ ${r.url} — ${r.error}`)
  }
  console.log('\n💡 Para revisar: abre /recetas en la app, filtra por "En revisión"')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
