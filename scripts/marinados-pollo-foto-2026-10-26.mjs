import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'
import { readFileSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ID = '392195a9-b0e1-481d-8994-e49a4686a42a'
const buf = readFileSync('salidas/fotos-reel/392195a9_recorte.jpg')
const url = await new Promise((ok, ko) => cloudinary.uploader.upload_stream({ folder: 'nutricoach/recetas', public_id: ID, resource_type: 'image', format: 'webp', overwrite: true, invalidate: true, quality: 'auto:good' }, (e, x) => e || !x ? ko(e ?? new Error('sin resultado')) : ok(x.secure_url)).end(buf))
await db.from('recetas').update({ imagen_url: url, imagen_tipo: null, imagen_needs_review: true, imagen_estado: 'revisar' }).eq('id', ID)
await Promise.allSettled([96, 384, 640, 1080].map(w => fetch(url.replace('/upload/', `/upload/f_webp,q_75,w_${w},c_limit/`)).then(x => x.arrayBuffer())))
console.log(url)
