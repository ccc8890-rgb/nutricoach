/**
 * foto-reel-auto.mjs — elige SOLO el fotograma del reel para la foto de una receta y, con --aplica, la rehace con foto-desde-reel.mjs.
 *   node scripts/foto-reel-auto.mjs --id=<uuid>            → baja el vídeo, elige fotograma y recorte con visión y los deja en salidas/fotos-reel/ (no cambia nada)
 *   node scripts/foto-reel-auto.mjs --id=<uuid> --aplica   → además retoca (≈0,05 $), sube a Cloudinary y guarda la anterior en recetas_auditoria
 * El fotograma lo elige gpt-4o-mini (barato) viendo 16 candidatos repartidos por el vídeo: plato terminado, nítido, sin cara ni texto encima.
 * Instagram: cookies de IG_COOKIES_FILE (launchd no puede leer las del navegador) o, a mano, las de Chrome. Nunca aprueba: la receta sigue en revisión.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { spawnSync } from 'child_process'
import { homedir } from 'os'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const arg = n => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1]
const ID = arg('id'), APLICA = process.argv.includes('--aplica')
if (!ID) { console.error('Uso: --id=<uuid> [--aplica]'); process.exit(1) }
const SAL = 'salidas/fotos-reel'; if (!existsSync(SAL)) mkdirSync(SAL, { recursive: true })
const PATH = { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin' }
const sh = (cmd, args) => { const x = spawnSync(cmd, args, { encoding: 'utf8', env: PATH, maxBuffer: 1 << 26 }); if (x.status !== 0) throw new Error(`${cmd}: ${(x.stderr || '').slice(-300)}`); return x.stdout }

const { data: r } = await db.from('recetas').select('id, nombre, url_origen, receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre, cantidad_gramos)').eq('id', ID).single()
if (!r?.url_origen) { console.error('La receta no tiene url_origen'); process.exit(1) }

// 1) vídeo
const video = `${SAL}/${ID}.mp4`
if (!existsSync(video)) {
  const cookiesIG = `${homedir()}/Library/Application Support/ContentRadar/ig-cookies.txt`
  const esIG = r.url_origen.includes('instagram.com')
  const cookies = !esIG ? [] : existsSync(cookiesIG) ? ['--cookies', cookiesIG] : ['--cookies-from-browser', 'chrome']
  sh('yt-dlp', [...cookies, '-f', 'best[height<=1080][ext=mp4]/best', '-o', video, r.url_origen])
}
const dur = parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]))
if (!(dur > 2)) throw new Error('vídeo sin duración válida')

// 2) 16 candidatos repartidos (se descarta el primer y último 4 %, donde suele haber portada y rótulos)
const N = 16, ini = dur * 0.04, paso = (dur * 0.92) / N
const tiempos = Array.from({ length: N }, (_, i) => +(ini + paso * (i + 0.5)).toFixed(2))
const buffers = tiempos.map((t, i) => spawnSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', video, '-frames:v', '1', '-vf', 'scale=360:-2', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-'], { env: PATH, maxBuffer: 1 << 26 }).stdout)

// 3) visión: cada fotograma se valora por separado (más fiable que pedir «el mejor») y la decisión se toma aquí con esos datos
const ings = (r.receta_ingredientes || []).filter(i => Number(i.cantidad_gramos) > 0).map(i => i.nombre_libre).slice(0, 8).join(', ')
const content = [{ type: 'text', text: `Hay ${N} fotogramas numerados del 1 al ${N} de un vídeo de cocina de la receta «${r.nombre}» (ingredientes: ${ings}).
Valora CADA fotograma para usarlo como foto principal de la receta (se recortará un cuadrado del ancho completo). Devuelve SOLO JSON:
{"frames":[{"n":1,"plato":0,"cara":false,"texto":false,"manos":false,"tapado":false,"nitido":true,"crop_y":0.0}, ...]}
- plato: 0 = no se ve la comida; 1 = ingredientes crudos o a medio hacer; 2 = comida casi terminada o poco clara; 3 = el PLATO TERMINADO se ve claro y apetecible, bien encuadrado.
- cara: true si se ve la cara de una persona (aunque sea parcial).
- texto: true si hay subtítulos o rótulos grandes sobre la imagen.
- manos: true si se ven manos o utensilios en primer plano.
- tapado: true si algo (botella, mano, utensilio, cámara) tapa o corta parte de la comida en el cuadrado.
- nitido: true si no está borroso ni en movimiento.
- crop_y: de 0 a 0.43, fracción de la altura donde debe empezar el cuadrado. El plato/recipiente debe quedar ENTERO dentro del cuadrado y centrado: si la comida está en la parte baja del fotograma, usa un valor alto (0.3-0.43); si está arriba, 0.` },
  ...buffers.flatMap((b, i) => [{ type: 'text', text: `Fotograma ${i + 1}:` }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b.toString('base64')}`, detail: 'low' } }])]
const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-4o', response_format: { type: 'json_object' }, max_tokens: 1500, messages: [{ role: 'user', content }] }), signal: AbortSignal.timeout(120000) })
if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`)
const valoraciones = (JSON.parse((await res.json()).choices[0].message.content).frames ?? []).filter(f => f.n >= 1 && f.n <= N)
const puntos = f => (Number(f.plato) || 0) * 3 - (f.cara ? 10 : 0) - (f.texto ? 3 : 0) - (f.manos ? 2.5 : 0) - (f.tapado ? 4 : 0) + (f.nitido ? 1 : 0)
const mejor = [...valoraciones].sort((a, b) => puntos(b) - puntos(a))[0]
if (!mejor || mejor.cara || (Number(mejor.plato) || 0) < 2) { console.log(`${r.nombre}\n  ningún fotograma sirve (sin plato claro o con cara): se queda para elegir a mano`); process.exit(3) }
const frame = Math.round(mejor.n), crop = Math.min(0.43, Math.max(0, Number(mejor.crop_y) || 0))
const t = tiempos[frame - 1]
console.log(`${r.nombre}\n  fotograma ${frame}/${N} (t=${t}s, crop=${crop.toFixed(2)}): plato ${mejor.plato}/3${mejor.texto ? ', con texto' : ''}${mejor.manos ? ', con manos' : ''}`)

// 4) recorte local para revisar y, con --aplica, retoque y subida
sh('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', video, '-frames:v', '1', '-vf', `crop=iw:iw:0:ih*${crop}`, '-y', `${SAL}/${ID}_elegido.png`])
console.log(`  recorte en ${SAL}/${ID}_elegido.png`)
if (!APLICA) process.exit(0)
const x = spawnSync('node', ['scripts/foto-desde-reel.mjs', `--id=${ID}`, `--t=${t}`, `--crop=${crop}`, '--aplica'], { encoding: 'utf8', env: PATH, timeout: 5 * 60 * 1000 })
console.log((x.stdout || '').split('\n').filter(l => /Subida|OpenAI|Error/.test(l)).join('\n') || (x.stderr || '').slice(-300))
process.exit(x.status === 0 ? 0 : 2)
