/**
 * Genera la foto de las recetas SIN imagen creadas desde una fecha, las sube a Cloudinary, actualiza recetas.imagen_url
 * (imagen_tipo='txt2img') y precalienta las variantes del loader.
 * Modelo: gpt-image-1.5 txt2img (~0,034 $/imagen, medium 1024x1024). Estilo: food blogger español (ver CLAUDE.md).
 *
 *   node scripts/generar-fotos-lote.mjs --desde=2026-10-01                 → lista (no gasta)
 *   node scripts/generar-fotos-lote.mjs --desde=2026-10-01 --prueba --genera   → solo 3
 *   node scripts/generar-fotos-lote.mjs --desde=2026-10-01 --genera        → todas las que falten
 * Guarda copia local en salidas/fotos-lote/ y salta las que ya tengan imagen (se puede relanzar).
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

const GENERA = process.argv.includes('--genera')
const PRUEBA = process.argv.includes('--prueba')
const desde = process.argv.find(a => a.startsWith('--desde='))?.split('=')[1] ?? '1970-01-01'
const SALIDA = 'salidas/fotos-lote'
const ANCHOS = [96, 384, 640, 1080]   // igual que lib/cloudinary-loader.ts y calentar-imagenes-cloudinary.mjs

const prompt = (r) => {
  const ings = (r.receta_ingredientes || []).map(i => i.nombre_libre).filter(Boolean).slice(0, 6).join(', ')
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
    if (cuerpo.includes('insufficient_quota') || cuerpo.includes('credit_balance_exhausted')) { console.error('\n⛔ OpenAI sin saldo: recarga en platform.openai.com/settings/organization/billing'); process.exit(2) }
    if (res.status === 429 && reintentos < 3) { await new Promise(r => setTimeout(r, 20000)); return generar(p, reintentos + 1) }   // rate limit real, no falta de saldo
    throw new Error(`OpenAI ${res.status}: ${cuerpo.slice(0, 200)}`)
  }
  const b64 = (await res.json()).data?.[0]?.b64_json
  if (!b64) throw new Error('respuesta vacía')
  return Buffer.from(b64, 'base64')
}

const subir = (buf, id) => new Promise((ok, ko) => {
  cloudinary.uploader.upload_stream({ folder: 'nutricoach/recetas', public_id: id, resource_type: 'image', format: 'webp', overwrite: true, quality: 'auto:good' },
    (e, r) => e || !r ? ko(e ?? new Error('Cloudinary sin resultado')) : ok(r.secure_url)).end(buf)
})

const { data: todas, error } = await db.from('recetas')
  .select('id, nombre, estado, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre)')
  .is('imagen_url', null).gte('created_at', desde).order('created_at')
if (error) { console.error(error.message); process.exit(1) }
const lista = PRUEBA ? todas.slice(0, 3) : todas
console.log(`Recetas sin foto desde ${desde}: ${todas.length} · a procesar: ${lista.length} · coste estimado ~${(lista.length * 0.034).toFixed(2)} $`)
if (!GENERA) { lista.forEach((r, i) => console.log(`  ${i + 1}. ${r.nombre} (${r.estado})`)); console.log('\nSimulación. Añade --genera.'); process.exit(0) }

if (!existsSync(SALIDA)) mkdirSync(SALIDA, { recursive: true })
let ok = 0, errores = 0
for (const [i, r] of lista.entries()) {
  process.stdout.write(`[${i + 1}/${lista.length}] ${r.nombre.slice(0, 55)} ... `)
  try {
    const buf = await generar(prompt(r))
    writeFileSync(`${SALIDA}/${r.id}.jpg`, buf)
    const url = await subir(buf, r.id)
    const { error: e2 } = await db.from('recetas').update({ imagen_url: url, imagen_tipo: 'txt2img' }).eq('id', r.id).is('imagen_url', null)
    if (e2) throw e2
    await Promise.allSettled(ANCHOS.map(w => fetch(url.replace('/upload/', `/upload/f_webp,q_75,w_${w},c_limit/`)).then(x => x.arrayBuffer())))
    console.log(`✅ ${(buf.length / 1024).toFixed(0)}KB`)
    ok++
  } catch (e) { console.log(`❌ ${e.message}`); errores++ }
  await new Promise(r => setTimeout(r, 1500))
}
console.log(`\nGeneradas: ${ok} · errores: ${errores} · coste real ~${(ok * 0.034).toFixed(2)} $`)
