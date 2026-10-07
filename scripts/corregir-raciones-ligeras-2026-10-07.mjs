// Comidas/cenas «completa» de <250 kcal por ración (revisión 07-10-2026). Simula por defecto; --apply escribe.
//  · cremas, sopas y verduras asadas → guarnición (se sirven con un plato, no solos)
//  · platos únicos guardados como «2 raciones» con 300-500 kcal el plato entero → 1 ración (los macros por ración se multiplican)
// (Rape, calabacín relleno, pechuga de pavo y sepia se quedan en 2 raciones: como plato único tendrían 60-70 g de proteína)
// Guarda copia de lo que cambia en salidas/ y se revierte con --revertir
import fs from 'fs'; import { createClient } from '@supabase/supabase-js'
for (const l of fs.readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY)
const APPLY=process.argv.includes('--apply'), REV=process.argv.includes('--revertir')
const COPIA='salidas/07-10-2026_copia-raciones-ligeras.json'
const GUARNICION=['5ccbdc31','e6cac1b5','9f5d9509','18cd18b1','889f70bd','0334de5b']          // sopa de pescado, cremas, zanahorias, coliflor
const UNA_RACION=['0fa9717a','341b17e4','67192690','29524d3e','90aa1f6c','fe0e8035','069d9981','788fd2b5','3567e27b','4bdd030d'] // platos únicos
const COLS='id,nombre,tipo_receta,porciones,kcal,proteinas,carbohidratos,grasas,fibra,tipo_plato'
const {data}=await db.from('recetas').select(COLS).eq('estado','aprobada')
const por=id=>data.find(r=>r.id.startsWith(id))
if (REV) { for (const r of JSON.parse(fs.readFileSync(COPIA,'utf8'))) { const {error}=await db.from('recetas').update(r).eq('id',r.id); console.log('revertida',r.nombre,error?.message??'ok') } process.exit(0) }
const copia=[]
for (const id of GUARNICION) { const r=por(id); if(!r) continue; copia.push(r); console.log(`${r.nombre} → guarnición`); if(APPLY) await db.from('recetas').update({tipo_receta:'guarnicion'}).eq('id',r.id) }
for (const id of UNA_RACION) { const r=por(id); if(!r||r.porciones!==2) { console.log('omitida',id); continue }
  const f=2; const nuevo={porciones:1,kcal:+(r.kcal*f).toFixed(1),proteinas:+(r.proteinas*f).toFixed(1),carbohidratos:+(r.carbohidratos*f).toFixed(1),grasas:+(r.grasas*f).toFixed(1),fibra:r.fibra==null?null:+(r.fibra*f).toFixed(1)}
  copia.push(r); console.log(`${r.nombre} → 1 ración: ${Math.round(r.kcal)} → ${Math.round(nuevo.kcal)} kcal, P ${Math.round(nuevo.proteinas)}`); if(APPLY) { const {error}=await db.from('recetas').update(nuevo).eq('id',r.id); if(error) console.log('  ERROR',error.message) } }
if(APPLY){ fs.writeFileSync(COPIA,JSON.stringify(copia,null,1)); console.log('copia en',COPIA) } else console.log('(simulación; --apply escribe, --revertir deshace)')
