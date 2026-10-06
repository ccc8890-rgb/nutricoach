/**
 * subir-lote-fotos-ia.mjs — sube a Cloudinary + actualiza recetas.imagen_url SOLO las fotos que Carlos aprobó en el panel.
 *   node scripts/subir-lote-fotos-ia.mjs --lote=1 [--json=~/Downloads/aprobadas-lote1.json]        → simulación
 *   node scripts/subir-lote-fotos-ia.mjs --lote=1 --json=... --sube                                → sube
 * Solo escribe en recetas que SIGUEN sin imagen_url (nunca pisa una foto existente). Precalienta las 4 variantes del loader.
 */
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'
import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d
const LOTE = arg('lote', 1)
const JSON_PATH = (arg('json', `${homedir()}/Downloads/seleccion-lote${LOTE}.json`)).replace(/^~/, homedir())
const SUBE = process.argv.includes('--sube')
const ANCHOS = [96, 384, 640, 1080]
if (!existsSync(JSON_PATH)) { console.error(`No existe ${JSON_PATH}. Descárgalo desde el panel (botón "Descargar aprobadas.json").`); process.exit(1) }
const sel = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
const ids = Array.isArray(sel) ? sel : sel.ok
console.log(`Aprobadas: ${ids.length}${SUBE ? '' : ' (simulación, añade --sube)'}`)
const subir = (buf, id) => new Promise((ok, ko) => cloudinary.uploader.upload_stream(
  { folder: 'nutricoach/recetas', public_id: id, resource_type: 'image', format: 'webp', overwrite: true, quality: 'auto:good' },
  (e, r) => e || !r ? ko(e ?? new Error('sin resultado')) : ok(r.secure_url)).end(buf))
let ok = 0
for (const id of ids) {
  const file = `salidas/fotos-ia-lote-${LOTE}/${id}.jpg`
  if (!existsSync(file)) { console.log(`✗ sin archivo ${id}`); continue }
  if (!SUBE) { console.log(`· ${id}`); continue }
  const { data: r } = await db.from('recetas').select('imagen_url').eq('id', id).single()
  if (r?.imagen_url) { console.log(`↷ ya tiene foto, no se pisa: ${id}`); continue }
  const url = await subir(readFileSync(file), id)
  const { error } = await db.from('recetas').update({ imagen_url: url, imagen_tipo: 'txt2img' }).eq('id', id).is('imagen_url', null)
  if (error) { console.log(`✗ ${id}: ${error.message}`); continue }
  await Promise.allSettled(ANCHOS.map(w => fetch(url.replace('/upload/', `/upload/f_webp,q_75,w_${w},c_limit/`)).then(x => x.arrayBuffer())))
  ok++; console.log(`✓ ${id}`)
}
if (SUBE) console.log(`\nSubidas: ${ok}/${ids.length}`)
