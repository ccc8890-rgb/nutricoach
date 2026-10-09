/**
 * aplicar-correcciones-matches.mjs — corrige enlaces ingrediente→alimento APROBADOS por Carlos (09-10-2026).
 * Solo toca filas marcadas en salidas/matches-dudosos.json cuyo nombre esté en la tabla de abajo.
 *   node scripts/aplicar-correcciones-matches.mjs            # simulación
 *   node scripts/aplicar-correcciones-matches.mjs --aplica   # escribe + copia en salidas/ + recalcula macros
 * Deshacer: restaurar alimento_id desde salidas/copia-matches-<fecha>.json
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APLICA = process.argv.includes('--aplica')
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim()
const MAPA = {
  'yemas de huevo':'Yema de huevo','yema de huevo':'Yema de huevo','aceite de coco':'Aceite de coco',
  'tomates cherry':'Tomate cherry','tomate triturado natural':'Tomate triturado',
  'yogur griego 0%':'Yogur griego natural (0%)','yogur griego 0% grasa':'Yogur griego natural (0%)',
  'arroz blanco':'Arroz blanco','papel de arroz':'Hojas de papel de arroz','salmon fresco':'Salmón',
  'canela':'canela molida','mango maduro en cubos':'Mango maduro','queso mozzarella':'Queso Mozzarella Fresca',
  'mozzarella light rallada':'Mozzarella rallada baja en grasa',
  'salsa de tomate sin azucares anadidos':'Salsa de tomate',
  'salsa de tomate zero sin azucares anadidos':'Salsa de tomate Zero sin azúcares añadidos',
  'tortilla de trigo integral':'Tortillas trigo integrales','tortillas de trigo integral':'Tortillas trigo integrales',
  'zumo de limon':'Zumo de limón','cebolla caramelizada':'Cebolla caramelizada','spaghetti huevo':'Spaghetti al huevo',
  'salsa teriyaki':'Salsa Teriyaki','pistacho':'Pistachos','burger pavo espinacas':'Burger de pavo y espinacas',
  'salsa yogur':'Salsa Yogur','albahaca fresca':'Albahaca fresca','harina de maiz fina':'Harina fina de maíz',
  'zumo de naranja natural':'Zumo de naranja','carne de ternera (chuleta)':'Carne de ternera (chuleta)',
  'yogur natural alto en proteina':'Yogur de proteína (alto en proteínas)',
  'proteina en polvo sabor chocolate':'Proteína en polvo sabor chocolate',
  'proteina de suero sabor chocolate':'Proteína en polvo sabor chocolate',
  'pechuga de pollo':'Pechuga de pollo',
  // tanda 1 de revisión manual (09-10-2026)
  'canela en polvo':'canela molida','ajo crudo':'Ajo','yogur griego natural desnatado':'Yogur griego natural (0%)',
  'tortilla de trigo integral (tamano pequeno)':'Tortillas trigo integrales',
  'aove (aceite de oliva virgen extra)':'Aceite de oliva virgen extra','obleas de arroz (papel de arroz)':'Hojas de papel de arroz',
  'limon (ralladura y zumo)':'Limón','sal (para los panes planos)':'Sal','chocolate negro 75% (derretido)':'Chocolate negro 75-80%',
  'arroz blanco de grano largo':'Arroz blanco',
  'jamon de york (pechuga de pavo o pollo)':'Jamón York',
}
const dud = JSON.parse(fs.readFileSync('salidas/matches-dudosos.json','utf8'))
const ids = new Map()
for (const [k,nombre] of Object.entries(MAPA)) {
  if (ids.has(nombre)) continue
  const { data } = await sb.from('alimentos').select('id,nombre,fuente,calorias,created_at').ilike('nombre', nombre.replace(/[%_]/g,'\\$&'))
  const ex = (data||[]).filter(a=>norm(a.nombre)===norm(nombre))
  if (!ex.length) { console.log('⚠️ destino ausente:',nombre); continue }
  // duplicados con el mismo nombre: el más usado en recetas, y a igualdad el más antiguo
  for (const e of ex) e.usos=(await sb.from('receta_ingredientes').select('id',{count:'exact',head:true}).eq('alimento_id',e.id)).count||0
  ex.sort((x,y)=>y.usos-x.usos||x.created_at.localeCompare(y.created_at))
  ids.set(nombre, ex[0])
}
// Regla general (cualquier fila, no solo las marcadas): «chocolate negro» sin % → alimento genérico de Carlos
const GENERICOS = { 'Chocolate negro 75-80%': ['chocolate negro','chocolate','chocolate negro (para decorar)','chocolate negro derretido (opcional)','chocolate negro rallado (para decorar)','chocolate negro y/o con leche','chocolate negro (para brownie)','chocolate negro picado','chocolate negro derretido','chocolate negro rallado'] }
const cambios=[]
for (const [nombre, claves] of Object.entries(GENERICOS)) {
  const { data: g } = await sb.from('alimentos').select('id,nombre,calorias').eq('nombre', nombre).maybeSingle()
  if (!g) { console.log('⚠️ falta el alimento genérico', nombre); continue }
  const filas = []
  for (let f = 0; ; f += 1000) { const { data } = await sb.from('receta_ingredientes').select('id,receta_id,nombre_libre,alimento_id,alimentos(nombre,calorias)').ilike('nombre_libre','%chocolate%').range(f,f+999); filas.push(...data); if (data.length<1000) break }
  for (const i of filas) if (claves.includes(norm(i.nombre_libre)) && !/%/.test(i.nombre_libre) && i.alimento_id!==g.id)
    cambios.push({ id:i.id, receta_id:i.receta_id, receta:i.receta_id, ingrediente:i.nombre_libre, antes_id:i.alimento_id, antes:i.alimentos?.nombre, kcal_antes:i.alimentos?.calorias, despues_id:g.id, despues:g.nombre, kcal_despues:g.calorias })
}
for (const h of dud) {
  const destino = MAPA[norm(h.ingrediente)]; const d = destino && ids.get(destino)
  if (!d || d.id===h.alimento_id) continue
  if (cambios.some(c=>c.id===h.id)) continue
  cambios.push({ id:h.id, receta_id:h.receta_id, receta:h.receta, ingrediente:h.ingrediente, antes_id:h.alimento_id, antes:h.alimento, kcal_antes:h.kcal, despues_id:d.id, despues:d.nombre, kcal_despues:d.calorias })
}
console.log('filas a corregir:',cambios.length,'en',new Set(cambios.map(c=>c.receta_id)).size,'recetas')
const resumen={}; for(const c of cambios){const k=`${c.ingrediente}: ${c.antes} (${c.kcal_antes}) → ${c.despues} (${c.kcal_despues})`; resumen[k]=(resumen[k]||0)+1}
for(const [k,v] of Object.entries(resumen)) console.log(' ',v+'x',k)
if (!APLICA) { console.log('\nSimulación: nada escrito. Usa --aplica.'); process.exit(0) }
if (!cambios.length) { console.log('Nada que corregir.'); process.exit(0) }
const copia=`salidas/copia-matches-${new Date().toISOString().replace(/[:.]/g,'-')}.json`
fs.writeFileSync(copia, JSON.stringify(cambios,null,1)); console.log('Copia:',copia)
for (const c of cambios) { const {error}=await sb.from('receta_ingredientes').update({alimento_id:c.despues_id}).eq('id',c.id); if(error) console.log('ERROR',c.ingrediente,error.message) }
const antesKcal={}
for (const rid of new Set(cambios.map(c=>c.receta_id))) {
  const {data:r}=await sb.from('recetas').select('nombre,porciones,kcal').eq('id',rid).single()
  const {data:is}=await sb.from('receta_ingredientes').select('cantidad_gramos,alimentos(calorias,proteinas,carbohidratos,grasas,fibra)').eq('receta_id',rid)
  let k=0,p=0,c=0,g=0,fi=0,peso=0
  for(const x of is){ if(!x.alimentos||!x.cantidad_gramos) continue; const f=x.cantidad_gramos/100; k+=(x.alimentos.calorias||0)*f;p+=(x.alimentos.proteinas||0)*f;c+=(x.alimentos.carbohidratos||0)*f;g+=(x.alimentos.grasas||0)*f;fi+=(x.alimentos.fibra||0)*f;peso+=x.cantidad_gramos }
  const n=r.porciones||1, R=v=>Math.round(v/n*100)/100
  await sb.from('recetas').update({kcal:R(k),proteinas:R(p),carbohidratos:R(c),grasas:R(g),fibra:R(fi),kcal_100g:peso?Math.round(k/peso*100):null,proteinas_100g:peso?Math.round(p/peso*100):null,carbohidratos_100g:peso?Math.round(c/peso*100):null,grasas_100g:peso?Math.round(g/peso*100):null,fibra_100g:peso?Math.round(fi/peso*100):null,peso_total_g:peso,updated_at:new Date().toISOString()}).eq('id',rid)
  console.log('  recalculada:',r.nombre.slice(0,42).padEnd(43),Math.round(r.kcal),'→',Math.round(R(k)),'kcal/ración')
}
