// Aparca las recetas sin fuente real (sin url_origen): etiqueta 'Aparcada' y quita la foto IA. Uso: node scripts/aparcar-recetas-sin-fuente.mjs [--apply]
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const apply = process.argv.includes('--apply')
let rs=[]; for(let i=0;;i+=1000){const {data,error}=await sb.from('recetas').select('id,nombre,tags,imagen_url,imagen_tipo,estado').is('url_origen',null).neq('estado','descartada').range(i,i+999); if(error) throw error; rs=rs.concat(data); if(data.length<1000)break}
const pend = rs.filter(r=>!(r.tags||[]).includes('Aparcada'))
const conFotoIA = pend.filter(r=>r.imagen_tipo==='txt2img')
console.log('sin fuente', rs.length, '| por aparcar', pend.length, '| con foto IA a quitar', conFotoIA.length)
if(!apply){console.log('simulación; usa --apply');process.exit(0)}
fs.writeFileSync('salidas/23-10-2026_BACKUP-aparcar-recetas.json', JSON.stringify(pend))
let n=0
for(const r of pend){ const upd={tags:[...(r.tags||[]),'Aparcada']}; if(r.imagen_tipo==='txt2img'){upd.imagen_url=null;upd.imagen_tipo=null}
  const {error}=await sb.from('recetas').update(upd).eq('id',r.id); if(error){console.error(r.id,error.message);process.exit(1)} n++ }
console.log('aparcadas', n)
