// Recetas aprobadas con etiqueta Vegano/Vegetariano que llevan ingredientes animales (por categoría o por nombre).
// Uso: node scripts/auditar-etiquetas-vegano-2026-10-07.mjs [--apply]  (sin --apply solo informa)
import fs from 'fs'; import { createClient } from '@supabase/supabase-js'
for (const l of fs.readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const APPLY=process.argv.includes('--apply')
const norm=t=>(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
const CARNE_PESCADO=/\b(pollo|pavo|ternera|cerdo|cordero|jamon|bacon|panceta|chorizo|salchicha|atun|salmon|caballa|bacalao|merluza|sardina|anchoa|boqueron|dorada|lubina|pescadilla|sepia|calamar|pulpo|gamba|langostino|mejillon|almeja|marisco|carne|pato|conejo|hamburguesa|lomo|solomillo|pastrami|gelatina)/
const HUEVO_LACTEO=/\b(huevo|clara|yema|leche de vaca|queso|yogur|skyr|requeson|mantequilla|nata|kefir|whey|caseina|miel)\b/
const CAT_CARNE=/carne|pescado|marisco/i, CAT_ANIMAL=/huevo|l[aá]cteo/i
const rec=[]; for(let f=0;;f+=1000){const {data}=await db.from('recetas').select('id,nombre,intolerancias,receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre,alimento:alimentos(nombre,categoria))').eq('estado','aprobada').range(f,f+999); rec.push(...data); if(data.length<1000)break}
let n=0
for (const r of rec) {
  const t=r.intolerancias??[]; const esVegano=t.includes('Vegano'), esVeg=t.includes('Vegetariano')
  if(!esVegano && !esVeg) continue
  const ings=r.receta_ingredientes??[]
  const carne=ings.filter(i=>CAT_CARNE.test(i.alimento?.categoria??'')||CARNE_PESCADO.test(norm(i.nombre_libre)+' '+norm(i.alimento?.nombre)))
  const animal=ings.filter(i=>CAT_ANIMAL.test(i.alimento?.categoria??'')||HUEVO_LACTEO.test(norm(i.nombre_libre)+' '+norm(i.alimento?.nombre)))
  const quitar=[]
  if(carne.length){ quitar.push('Vegano','Vegetariano') }
  else if(esVegano && animal.length){ quitar.push('Vegano') }
  if(!quitar.length) continue
  n++; console.log(`${r.nombre} → quitar ${quitar.filter(x=>t.includes(x)).join('+')} (${[...carne,...animal].map(i=>i.nombre_libre).slice(0,3).join(', ')})`)
  if(APPLY){ const nuevas=t.filter(x=>!quitar.includes(x)); const {error}=await db.from('recetas').update({intolerancias:nuevas}).eq('id',r.id); if(error) console.log('ERROR',error.message) }
}
console.log(`${n} recetas con etiqueta incorrecta${APPLY?' (corregidas)':' (sin aplicar)'}`)
