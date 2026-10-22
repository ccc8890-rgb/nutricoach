/**
 * corregir-marcadas.mjs — el motor atiende las recetas marcadas «Corregir» (Reportar problema) para que Carlos solo haga la revisión final.
 * Por ahora cubre el aspecto «foto»: regenera la foto con el mismo método y estilo del recetario (gpt-image-1.5 txt2img, ~0,034 $),
 * la sube a Cloudinary, guarda la anterior en recetas_auditoria y, si «foto» era lo único marcado, quita «Corregir» para que
 * la receta vuelva a «Por aprobar». NUNCA aprueba: siempre termina en en_revision.
 *
 *   node scripts/corregir-marcadas.mjs                  → lista qué haría (no gasta)
 *   node scripts/corregir-marcadas.mjs --aplica         → regenera (lo usa la pasada autónoma)
 *   node scripts/corregir-marcadas.mjs --aplica --limite=5
 * Sin saldo de OpenAI: avisa y deja las marcas como están (se reintenta en la siguiente pasada).
 */
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const APLICA = process.argv.includes('--aplica')
const LIMITE = Number(process.argv.find(a => a.startsWith('--limite='))?.split('=')[1] ?? 10)
const SALIDA = 'salidas/fotos-corregidas'
const ANCHOS = [96, 384, 640, 1080]   // igual que lib/cloudinary-loader.ts
const hoy = () => new Date().toLocaleDateString('es-ES')

// Aspectos pendientes = los de la última línea «A corregir:» y que el motor aún no haya atendido después de ella
function pendientes(notas) {
  const lineas = (notas ?? '').split('\n')
  const i = lineas.map(l => l.includes('A corregir:')).lastIndexOf(true)
  if (i < 0) return { aspectos: [], hechos: [] }
  const aspectos = (lineas[i].split('A corregir:')[1] ?? '').split('—')[0].split(',').map(s => s.trim()).filter(Boolean)
  const hechos = lineas.slice(i + 1).filter(l => l.includes('Motor:')).join(' ')
  return { aspectos, hechos }
}

const prompt = (r) => {
  const ings = (r.receta_ingredientes || []).filter(i => Number(i.cantidad_gramos) > 0).map(i => i.nombre_libre).filter(Boolean).slice(0, 6).join(', ')
  return `Photorealistic food photo of "${r.nombre}" as plated by a Spanish nutrition coach for Instagram.
Key ingredients clearly visible: ${ings}.
Simple ceramic plate or bowl on a wooden table or white countertop, home kitchen. Natural window light, soft and diffused, not dramatic. Overhead or 45 degree angle, slightly imperfect home plating, warm Mediterranean tones. Square 1:1 format.
No text, no watermarks, no people, no hands, no logos.`
}

async function generar(p, reintentos = 0) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1.5', prompt: p, n: 1, size: '1024x1024', quality: 'medium', output_format: 'jpeg' }),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) {
    const cuerpo = await res.text()
    if (cuerpo.includes('insufficient_quota') || cuerpo.includes('billing_hard_limit') || cuerpo.includes('credit_balance')) return 'SIN_SALDO'
    if (res.status === 429 && reintentos < 3) { await new Promise(r => setTimeout(r, 20000)); return generar(p, reintentos + 1) }
    throw new Error(`OpenAI ${res.status}: ${cuerpo.slice(0, 160)}`)
  }
  const b64 = (await res.json()).data?.[0]?.b64_json
  if (!b64) throw new Error('respuesta vacía')
  return Buffer.from(b64, 'base64')
}

const subir = (buf, id) => new Promise((ok, ko) => {
  cloudinary.uploader.upload_stream({ folder: 'nutricoach/recetas', public_id: id, resource_type: 'image', format: 'webp', overwrite: true, invalidate: true, quality: 'auto:good' },
    (e, r) => e || !r ? ko(e ?? new Error('Cloudinary sin resultado')) : ok(r.secure_url)).end(buf)
})

const { data: marcadas, error } = await db.from('recetas')
  .select('id, nombre, estado, tags, notas_coach, imagen_url, imagen_tipo, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre, cantidad_gramos)')
  .contains('tags', ['Corregir']).in('estado', ['en_revision', 'borrador'])
if (error) { console.error(error.message); process.exit(1) }

const lista = (marcadas ?? []).map(r => ({ r, ...pendientes(r.notas_coach) }))
  .filter(x => x.aspectos.includes('foto') && !x.hechos.includes('foto regenerada'))
console.log(`Marcadas «Corregir» con foto pendiente: ${lista.length} · a procesar: ${Math.min(lista.length, LIMITE)} · coste ~${(Math.min(lista.length, LIMITE) * 0.034).toFixed(2)} $`)
if (!APLICA) { lista.forEach(({ r }, i) => console.log(`  ${i + 1}. ${r.nombre}`)); console.log('\nSimulación. Añade --aplica.'); process.exit(0) }

if (!existsSync(SALIDA)) mkdirSync(SALIDA, { recursive: true })
let ok = 0, errores = 0
for (const [i, { r, aspectos }] of lista.slice(0, LIMITE).entries()) {
  process.stdout.write(`[${i + 1}] ${r.nombre.slice(0, 55)} ... `)
  try {
    const buf = await generar(prompt(r))
    if (buf === 'SIN_SALDO') { console.log('⛔ OpenAI sin saldo: se reintentará en la próxima pasada'); break }
    writeFileSync(`${SALIDA}/${r.id}.jpg`, buf)
    const url = await subir(buf, r.id)
    const { error: e2 } = await db.from('recetas').update({ imagen_url: url, imagen_tipo: 'txt2img', imagen_needs_review: true }).eq('id', r.id)
    if (e2) throw e2
    await Promise.allSettled(ANCHOS.map(w => fetch(url.replace('/upload/', `/upload/f_webp,q_75,w_${w},c_limit/`)).then(x => x.arrayBuffer())))
    // Si «foto» era lo único marcado, la receta vuelve a «Por aprobar»; si no, sigue marcada por lo demás
    const soloFoto = aspectos.every(a => a === 'foto')
    const nota = `[${hoy()}] Motor: foto regenerada${soloFoto ? ' (lista para revisar)' : ''}`
    await db.from('recetas').update({
      notas_coach: [r.notas_coach, nota].filter(Boolean).join('\n'),
      ...(soloFoto ? { tags: (r.tags ?? []).filter(t => t !== 'Corregir' && t !== 'Reporte cliente') } : {}),
    }).eq('id', r.id)
    await db.from('recetas_auditoria').insert({ receta_id: r.id, evento: 'correccion_foto_motor', issues: { imagen_anterior: r.imagen_url, imagen_tipo_anterior: r.imagen_tipo }, origen: 'motor_correcciones' })
    console.log(`✅ ${soloFoto ? 'lista para revisar' : 'foto hecha, quedan otros aspectos'}`)
    ok++
  } catch (e) { console.log(`❌ ${e.message}`); errores++ }
  await new Promise(r => setTimeout(r, 1500))
}
console.log(`Fotos regeneradas: ${ok} · errores: ${errores} · coste real ~${(ok * 0.034).toFixed(2)} $`)
