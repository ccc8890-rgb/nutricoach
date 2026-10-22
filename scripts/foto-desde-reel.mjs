/**
 * foto-desde-reel.mjs — foto REAL de una receta que viene de un reel: fotograma del propio vídeo, recortado en cuadrado y retocado
 * (sin subtítulos, marca de agua, logos ni manos) con el edit de OpenAI. Mantiene el plato tal cual sale en el vídeo.
 *
 *   node scripts/foto-desde-reel.mjs --id=<uuid> --t=26.0 [--crop=0.26] [--aplica]
 *     --t      segundo del vídeo donde sale el plato (mira antes los fotogramas: ffmpeg -ss <t> -frames:v 1 …)
 *     --crop   fracción de alto donde empieza el recorte cuadrado (vídeo vertical 9:16; 0 = arriba)
 *   Sin --aplica solo deja el fotograma sin retocar en salidas/fotos-reel/ para revisarlo (no gasta).
 * Instagram necesita cookies del navegador (yt-dlp --cookies-from-browser chrome); TikTok y YouTube no.
 * Guarda la foto anterior en recetas_auditoria (evento foto_desde_reel). Coste del edit ≈ 0,05 $.
 */
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { spawnSync } from 'child_process'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const arg = n => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1]
const ID = arg('id'), T = arg('t'), CROP = arg('crop') ?? '0.26', APLICA = process.argv.includes('--aplica')
if (!ID || !T) { console.error('Uso: --id=<uuid> --t=<segundos> [--crop=0.26] [--aplica]'); process.exit(1) }
const SAL = 'salidas/fotos-reel'; if (!existsSync(SAL)) mkdirSync(SAL, { recursive: true })
const ANCHOS = [96, 384, 640, 1080]

const { data: r } = await db.from('recetas').select('id, nombre, url_origen, imagen_url, imagen_tipo, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre, cantidad_gramos)').eq('id', ID).single()
if (!r?.url_origen) { console.error('La receta no tiene url_origen'); process.exit(1) }
const sh = (cmd, args) => { const x = spawnSync(cmd, args, { encoding: 'utf8' }); if (x.status !== 0) throw new Error(`${cmd}: ${(x.stderr || '').slice(-300)}`); return x }

const video = `${SAL}/${ID}.mp4`, frame = `${SAL}/${ID}_frame.png`
if (!existsSync(video)) {
  const esIG = r.url_origen.includes('instagram.com')
  sh('yt-dlp', [...(esIG ? ['--cookies-from-browser', 'chrome'] : []), '-f', 'best[height<=1080][ext=mp4]/best', '-o', video, r.url_origen])
}
sh('ffmpeg', ['-v', 'error', '-ss', T, '-i', video, '-frames:v', '1', '-vf', `crop=iw:iw:0:ih*${CROP}`, '-y', frame])
console.log(`${r.nombre}\nFotograma en ${frame}`)
if (!APLICA) { console.log('Revísalo y repite con --aplica'); process.exit(0) }

const ings = (r.receta_ingredientes || []).filter(i => Number(i.cantidad_gramos) > 0).map(i => i.nombre_libre).slice(0, 8).join(', ')
const prompt = `This is a frame from a cooking video. Edit it into a clean photo of the finished dish: remove ALL subtitles/captions, watermarks, social-media logos and usernames, and any hands, utensils or packaging that are not part of the plated food. Keep the same container (pan, bowl or plate), the same surface and background and the same camera angle as in the frame. Keep the dish itself exactly as it is (same ingredients, colours and arrangement: ${ings}). Where something is removed, fill in naturally with the surrounding food, plate and surface. Do not add any new food, garnish or props. Keep realistic natural lighting and a candid home-photo look. Square image.`
const form = new FormData()
form.append('model', 'gpt-image-1.5'); form.append('prompt', prompt); form.append('size', '1024x1024'); form.append('quality', 'medium'); form.append('output_format', 'jpeg')
form.append('image', new Blob([readFileSync(frame)], { type: 'image/png' }), 'frame.png')
const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form, signal: AbortSignal.timeout(180000) })
if (!res.ok) { console.error('OpenAI', res.status, (await res.text()).slice(0, 300)); process.exit(2) }
const buf = Buffer.from((await res.json()).data[0].b64_json, 'base64')
const out = `${SAL}/${ID}_final.jpg`; writeFileSync(out, buf); console.log(`Retocada en ${out}`)
if (process.argv.includes('--solo-local')) process.exit(0)

const url = await new Promise((ok, ko) => cloudinary.uploader.upload_stream({ folder: 'nutricoach/recetas', public_id: ID, resource_type: 'image', format: 'webp', overwrite: true, invalidate: true, quality: 'auto:good' },
  (e, x) => e || !x ? ko(e ?? new Error('sin resultado')) : ok(x.secure_url)).end(buf))
await db.from('recetas_auditoria').insert({ receta_id: ID, evento: 'foto_desde_reel', issues: { imagen_anterior: r.imagen_url, imagen_tipo_anterior: r.imagen_tipo, t: T }, origen: 'foto_desde_reel' })
await db.from('recetas').update({ imagen_url: url, imagen_tipo: null, imagen_needs_review: true }).eq('id', ID)
await Promise.allSettled(ANCHOS.map(w => fetch(url.replace('/upload/', `/upload/f_webp,q_75,w_${w},c_limit/`)).then(x => x.arrayBuffer())))
console.log('Subida y guardada:', url)
