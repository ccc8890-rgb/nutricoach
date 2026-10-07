// Auditoría de solo lectura del recetario aprobado: nombres, clasificación, calorías por ración, duplicados, datos que faltan.
// Uso: node scripts/auditar-recetario-uso-2026-10-07.mjs [--json]
import fs from 'fs'; import { createClient } from '@supabase/supabase-js'
for (const l of fs.readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const rec=[]; for(let f=0;;f+=1000){const {data}=await db.from('recetas').select('id,nombre,categoria,tipo_plato,tipo_receta,kcal,proteinas,porciones,imagen_url,instrucciones,descripcion,verificacion,n_veces_asignada,receta_ingredientes!receta_ingredientes_receta_id_fkey(id)').eq('estado','aprobada').range(f,f+999); rec.push(...data); if(data.length<1000)break}
const norm=t=>(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()
const out={}
const add=(k,r,extra='')=>(out[k]??=[]).push(`${r.id.slice(0,8)} | ${r.nombre}${extra?' | '+extra:''}`)
const INGLES=/\b(chicken|beef|burger|bowl|wrap|tacos?|crispy|honey|bbq|loaded|smashed|sweet potato|mealprep|meal prep|overnight|oats|pancakes?|toast|cheese|healthy|protein|fit|sees|hot|hung|tupper|donut|muffins?|brownies?|cookies?|smoothie|shake|snack|bites?|balls)\b/i
const ES_COMUN=/\b(de|con|al|la|el|y|en|del|sin|a la|para)\b/i
for (const r of rec) {
  const n=r.nombre||''
  if (INGLES.test(n) && !ES_COMUN.test(n)) add('nombre en inglés/sin estructura clara',r)
  if (n.length>70) add('nombre muy largo (>70)',r,`${n.length} car.`)
  if (n===n.toUpperCase() && n.length>4) add('nombre en mayúsculas',r)
  if (!r.categoria) add('sin categoría',r,`${r.tipo_plato}/${r.tipo_receta}`)
  if (!r.imagen_url) add('sin foto',r)
  if (!r.instrucciones || r.instrucciones.length<80) add('instrucciones <80 car.',r)
  if ((r.receta_ingredientes??[]).length<3) add('<3 ingredientes',r,`${(r.receta_ingredientes??[]).length}`)
  if (!r.verificacion) add('sin verificar',r)
  const k=r.kcal||0
  if (['completa'].includes(r.tipo_receta) && /comida|cena/i.test(r.tipo_plato||'') && k<250) add('comida/cena completa con <250 kcal/ración',r,`${Math.round(k)} kcal`)
  if (['completa'].includes(r.tipo_receta) && /comida|cena/i.test(r.tipo_plato||'') && k>1100) add('comida/cena completa con >1100 kcal/ración',r,`${Math.round(k)} kcal · ${r.porciones}p`)
  if (/snack|merienda/i.test(r.tipo_plato||'') && k>600) add('snack/merienda con >600 kcal/ración',r,`${Math.round(k)} kcal`)
  if (/desayuno/i.test(r.tipo_plato||'') && r.tipo_receta==='completa' && k<150) add('desayuno completo con <150 kcal',r,`${Math.round(k)} kcal`)
  if (r.tipo_receta==='guarnicion' && k>450) add('guarnición con >450 kcal',r,`${Math.round(k)} kcal`)
  if (r.tipo_plato && r.categoria && /desayuno/i.test(r.tipo_plato) && /cena|comida/i.test(r.categoria)) add('tipo_plato Desayuno con categoría Comida/Cena',r,`${r.tipo_plato}/${r.categoria}`)
  if (r.tipo_plato && r.categoria && /cena|comida/i.test(r.tipo_plato) && /desayuno|merienda|snack|postre/i.test(r.categoria)) add('tipo_plato Comida/Cena con categoría desayuno/snack/postre',r,`${r.tipo_plato}/${r.categoria}`)
}
// Duplicados por nombre normalizado
const porNombre={}; for(const r of rec){(porNombre[norm(r.nombre)]??=[]).push(r)}
for(const [n,l] of Object.entries(porNombre)) if(l.length>1) for(const r of l) add('nombre duplicado',r,`${l.length} veces`)
// Casi duplicados: mismas 3 primeras palabras + misma categoría
const clave=r=>norm(r.nombre).split(' ').slice(0,3).join(' ')+'|'+r.categoria
const porClave={}; for(const r of rec){(porClave[clave(r)]??=[]).push(r)}
for(const [c,l] of Object.entries(porClave)) if(l.length>2) for(const r of l) add('3+ recetas con mismo arranque de nombre',r,c.split('|')[0])
console.log(`${rec.length} recetas aprobadas\n`)
for (const [k,l] of Object.entries(out).sort((a,b)=>b[1].length-a[1].length)) { console.log(`== ${k}: ${l.length}`); l.slice(0, process.argv.includes('--todo')?9999:12).forEach(x=>console.log('  '+x)) }
