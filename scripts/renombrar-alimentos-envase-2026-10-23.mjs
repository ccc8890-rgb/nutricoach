/**
 * Quita del nombre de los alimentos usados en recetas las palabras de envase (Botella, Paquete, Frasco, Bandeja, Pack de, Hacendado…).
 * - Renombra el alimento (mismo registro: no se pierden precios ni vínculos del scraper, que empareja por nombre flexible).
 * - Si ya existe un alimento con el nombre limpio, NO fusiona: solo repunta receta_ingredientes y recalcula macros.
 * - No toca descriptores legítimos («Atún en lata al natural», «Leche de coco (lata)»…).
 * Simula por defecto; --aplica escribe y guarda copia en salidas/23-10-2026_BACKUP-renombrar-alimentos-envase.json
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')]}))
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const APLICA=process.argv.includes('--aplica')
const all=async(t,c)=>{const o=[];for(let i=0;;i+=1000){const{data,error}=await db.from(t).select(c).range(i,i+999);if(error)throw error;o.push(...data);if(data.length<1000)break}return o}
const ENV=/\b(botella|brik|bandeja|bote|tarrina|pack de|pack|lata|hacendado|bolsa|frasco|cristal|paquete)\b/gi
const SALTAR=new Set(['Atún en lata al natural','Atún en lata (escurrido)','Leche de coco (lata)','Bizcocho de soja (producto proteico)'])
const MANUAL={'Pimentón Dulce D.O.P de la Vera Lata':'Pimentón dulce D.O.P. de la Vera','Pimiento Piquillo de Lodosa Frasco':'Pimiento piquillo de Lodosa','Pimiento Morrón Lata Pack de 3':'Pimiento morrón','Gran Salsa Mostaza Bote':'Salsa de mostaza','Agua Mineral Gas Botella Cristal':'Agua mineral con gas','Agua Mineral Gas Botella':'Agua mineral con gas','Dulce de Leche Lata':'Dulce de leche','Salteado de verduras Hacendado ultracongelado':'Salteado de verduras ultracongelado'}
const frase=s=>s.charAt(0).toUpperCase()+s.slice(1).toLowerCase()
const ri=await all('receta_ingredientes','id,receta_id,alimento_id,alimentos(id,nombre)')
const alimentos=await all('alimentos','id,nombre,calorias,proteinas,carbohidratos,grasas')
const usados=new Map();for(const x of ri){if(x.alimentos)usados.set(x.alimentos.id,x.alimentos)}
const porNombre=new Map(alimentos.map(a=>[a.nombre.toLowerCase(),a]))
const renombrar=[],repuntar=[],nuevos=new Map()
for(const a of usados.values()){ENV.lastIndex=0;if(!ENV.test(a.nombre)||SALTAR.has(a.nombre))continue;ENV.lastIndex=0
  const limpio=MANUAL[a.nombre]??frase(a.nombre.replace(ENV,' ').replace(/\s+/g,' ').replace(/[ ,.-]+$/,'').trim())
  const ya=porNombre.get(limpio.toLowerCase())??nuevos.get(limpio.toLowerCase())
  if(ya&&ya.id!==a.id)repuntar.push({de:a,a:ya,limpio})
  else{renombrar.push({a,limpio});nuevos.set(limpio.toLowerCase(),a)}}
console.log(`RENOMBRAR ${renombrar.length}`);renombrar.forEach(r=>console.log(`  ${r.a.nombre}  →  ${r.limpio}`))
console.log(`REPUNTAR en recetas ${repuntar.length}`);repuntar.forEach(r=>console.log(`  ${r.de.nombre} → ${r.a.nombre}`))
if(!APLICA){console.log('\nSimulación. Añade --aplica.');process.exit(0)}
const copia={renombrados:renombrar.map(r=>({id:r.a.id,antes:r.a.nombre})),repuntados:[]}
for(const r of renombrar){const{error}=await db.from('alimentos').update({nombre:r.limpio}).eq('id',r.a.id);if(error)console.log('ERR',r.a.nombre,error.message)}
const recetasTocadas=new Set()
for(const r of repuntar){const filas=ri.filter(x=>x.alimento_id===r.de.id);for(const f of filas){copia.repuntados.push({id:f.id,receta_id:f.receta_id,alimento_antes:r.de.id});await db.from('receta_ingredientes').update({alimento_id:r.a.id}).eq('id',f.id);recetasTocadas.add(f.receta_id)}}
for(const rid of recetasTocadas){const{data:rec}=await db.from('recetas').select('porciones,kcal').eq('id',rid).single();const{data:i}=await db.from('receta_ingredientes').select('cantidad_gramos,alimentos(calorias,proteinas,carbohidratos,grasas)').eq('receta_id',rid);const t={k:0,p:0,c:0,g:0};for(const x of i){const f=x.cantidad_gramos/100,a=x.alimentos;if(!a)continue;t.k+=a.calorias*f;t.p+=a.proteinas*f;t.c+=a.carbohidratos*f;t.g+=a.grasas*f}const n=rec.porciones||1;await db.from('recetas').update({kcal:+(t.k/n).toFixed(1),proteinas:+(t.p/n).toFixed(1),carbohidratos:+(t.c/n).toFixed(1),grasas:+(t.g/n).toFixed(1)}).eq('id',rid);console.log('MACROS',rid.slice(0,8),Math.round(rec.kcal),'→',(t.k/n).toFixed(1))}
fs.writeFileSync('salidas/23-10-2026_BACKUP-renombrar-alimentos-envase.json',JSON.stringify(copia,null,1));console.log('Hecho. Copia guardada.')
