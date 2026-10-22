/**
 * Casos parecidos a los de la sesión 22→23-10 (ingredientes mal enlazados). Simula por defecto; --aplica escribe (copia en salidas/).
 * - 4 recetas saladas con «golosinas de fruta» donde era zumo de lima/limón; manzanas asadas: golosinas fuera (receta y paso);
 *   mayonesas: sardina de 10 g que no aparece en los pasos; 2 recetas de fresas enlazadas a un yogur Activia → Fresas.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,'')]}))
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const APLICA=process.argv.includes('--aplica')
const alim=async n=>{const{data}=await db.from('alimentos').select('id,nombre,calorias').ilike('nombre',n).eq('es_comestible',true).limit(3);return data}
const LIMON=(await alim('Limón'))?.[0], LIMA=(await alim('Lima'))?.[0], FRESAS=(await alim('Fresas'))?.[0]
console.log('Limón',LIMON,'Lima',LIMA,'Fresas',FRESAS)
const G='Golosinas Rega Relli%'
const cambios=[
  {rec:'9173949b',buscar:G,nombre:'Zumo de lima',alimento:LIMA??LIMON},
  {rec:'aba951fa',buscar:G,nombre:'Zumo de limón',alimento:LIMON},
  {rec:'baddf1f8',buscar:G,nombre:'Zumo de limón',alimento:LIMON},
  {rec:'e639ece9',buscar:G,nombre:'Zumo de limón',alimento:LIMON},
  {rec:'7a7ea0c1',buscar:'fresas frescas laminadas',nombre:'Fresas frescas laminadas',alimento:FRESAS},
  {rec:'0fec0ae9',buscar:'fresas congeladas%',nombre:'Fresas congeladas (descongeladas y trituradas)',alimento:FRESAS},
]
const quitar=[{rec:'2e24b916',buscar:G},{rec:'f2a06508',buscar:'Sardina fresca'}]
const ids=async p=>{const{data}=await db.from('recetas').select('id').gte('id',p+'-0000-0000-0000-000000000000').lte('id',p+'-ffff-ffff-ffff-ffffffffffff');return data[0].id}
const copia=[];const tocadas=new Set()
async function recalcula(rid){const{data:r}=await db.from('recetas').select('porciones').eq('id',rid).single();const{data:i}=await db.from('receta_ingredientes').select('cantidad_gramos,alimentos(calorias,proteinas,carbohidratos,grasas)').eq('receta_id',rid);const t={k:0,p:0,c:0,g:0};for(const x of i){const f=x.cantidad_gramos/100,a=x.alimentos;if(!a)continue;t.k+=a.calorias*f;t.p+=a.proteinas*f;t.c+=a.carbohidratos*f;t.g+=a.grasas*f}const n=r.porciones||1;return{kcal:+(t.k/n).toFixed(1),proteinas:+(t.p/n).toFixed(1),carbohidratos:+(t.c/n).toFixed(1),grasas:+(t.g/n).toFixed(1)}}
for(const c of cambios){const rid=await ids(c.rec);const{data:f}=await db.from('receta_ingredientes').select('*').eq('receta_id',rid).ilike('nombre_libre',c.buscar);for(const x of f){copia.push(x);console.log('CAMBIA',rid.slice(0,8),x.nombre_libre.slice(0,30),'→',c.nombre,'/',c.alimento.nombre);if(APLICA)await db.from('receta_ingredientes').update({nombre_libre:c.nombre,alimento_id:c.alimento.id}).eq('id',x.id);tocadas.add(rid)}}
for(const q of quitar){const rid=await ids(q.rec);const{data:f}=await db.from('receta_ingredientes').select('*').eq('receta_id',rid).ilike('nombre_libre',q.buscar);for(const x of f){copia.push(x);console.log('QUITA',rid.slice(0,8),x.nombre_libre.slice(0,40),x.cantidad_gramos+'g');if(APLICA)await db.from('receta_ingredientes').delete().eq('id',x.id);tocadas.add(rid)}}
if(APLICA){
  // manzanas asadas: quitar la frase de las golosinas en los pasos
  const rid=await ids('2e24b916');const{data:r}=await db.from('recetas').select('instrucciones').eq('id',rid).single()
  copia.push({receta_id:rid,instrucciones_antes:r.instrucciones})
  const nueva=r.instrucciones.replace(/ Reparte las golosinas rellenas de zumo de fruta \(10 g\) en trozos pequeños por encima\./,'')
  await db.from('recetas').update({instrucciones:nueva}).eq('id',rid)
  fs.writeFileSync('salidas/23-10-2026_BACKUP-casos-similares.json',JSON.stringify(copia,null,1))
}
for(const rid of tocadas){const m=await recalcula(rid);const{data:r}=await db.from('recetas').select('nombre,kcal').eq('id',rid).single();console.log('MACROS',r.nombre.slice(0,40),Math.round(r.kcal),'→',m.kcal,'kcal',m.proteinas+'P');if(APLICA)await db.from('recetas').update(m).eq('id',rid)}
if(!APLICA)console.log('\nSimulación. Añade --aplica.')
