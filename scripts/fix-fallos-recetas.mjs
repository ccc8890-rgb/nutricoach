#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const p = resolve(ROOT, '.env.local');
if (existsSync(p)) {
  for (const l of readFileSync(p,'utf-8').split('\n')) {
    const t=l.trim(); if(!t||t.startsWith('#')) continue;
    const eq=t.indexOf('='); if(eq===-1) continue;
    process.env[t.slice(0,eq).trim()]=t.slice(eq+1).trim().replace(/^["']|["']$/g,'');
  }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DRY = !process.argv.includes('--apply');
async function pag(t,s,f={},ps=1000) {
  const a=[]; let fr=0;
  while(true) {
    let q=sb.from(t).select(s);
    for(const[k,v]of Object.entries(f)){
      if(v===null)q=q.is(k,null);
      else if(Array.isArray(v))q=q.in(k,v);
      else q=q.eq(k,v);
    }
    const{data,d}=await q.range(fr,fr+ps-1);
    if(d) throw d;
    if(!data||data.length===0)break;
    a.push(...data); fr+=ps;
    if(data.length<ps)break;
  }
  return a;
}
const MACROS_FIX = {
  'bicarbonato sodico': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
  'bicarbonato de sodio': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
  'edulcorante': { calorias: 20, proteinas: 0, carbohidratos: 5, grasas: 0 },
  'caseina micelar en polvo': { calorias: 370, proteinas: 80, carbohidratos: 5, grasas: 3 },
  'overnight oats de proteina y vainilla': { calorias: 110, proteinas: 15, carbohidratos: 10, grasas: 1 },
  'avena con proteina en polvo': { calorias: 380, proteinas: 30, carbohidratos: 55, grasas: 6 },
  'proteina en polvo sabor lotus': { calorias: 380, proteinas: 75, carbohidratos: 5, grasas: 5 },
  'panela azucar moreno can integral': { calorias: 380, proteinas: 0, carbohidratos: 95, grasas: 0 },
  'bombon almendrado azucar': { calorias: 500, proteinas: 8, carbohidratos: 60, grasas: 25 },
  'barritas proteinas sabor coco chocolate enervit sport': { calorias: 180, proteinas: 15, carbohidratos: 20, grasas: 5 },
  'muesli sin azucar': { calorias: 370, proteinas: 10, carbohidratos: 65, grasas: 8 },
  'sal en escamas para decorar': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
  'yogur griego cabra': { calorias: 65, proteinas: 5, carbohidratos: 4, grasas: 3 },
  'endulzante': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
  'edulcorante liquido': { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0 },
};
const MAL_MATCHES = [
  { nombre: 'Spaghetti al huevo', recetas: null, acciones: 'desvincular' },
  { nombre: 'Croquetas Artesanas Jamon Iberico', recetas: null, acciones: 'desvincular' },
  { nombre: 'Burger pavo espinacas', recetas: null, acciones: 'desvincular' },
  { nombre: 'Espaguetis Bolonesa', recetas: null, acciones: 'desvincular' },
  { nombre: 'Agua mineral con gas grande Fonter', recetas: null, acciones: 'desvincular' },
  { nombre: 'Bolsas Cubitos Hielo Caja', recetas: null, acciones: 'desvincular' },
];
async function fixHummus() {
  console.log('\n=== FIX A: ELIMINAR PANELA DEL HUMMUS ===');
  const { data: recetas } = await sb.from('recetas').select('id,nombre').ilike('nombre','%hummus%');
  if (!recetas) return;
  for (const r of recetas) {
    const { data: ings } = await sb.from('receta_ingredientes').select('id,nombre_libre,alimento_id').eq('receta_id',r.id);
    if (!ings) continue;
    const panela = ings.find(i => i.nombre_libre && /panela/i.test(i.nombre_libre));
    if (!panela) continue;
    console.log(`  ${r.nombre}: encontrado "${panela.nombre_libre}" (${panela.id})`);
    if (!DRY) {
      // Delete the ingredient
      const { error: del } = await sb.from('receta_ingredientes').delete().eq('id', panela.id);
      if (del) console.log(`    ERROR: ${del.message}`);
      else {
        console.log(`    Eliminado!`);
        try { await sb.rpc('calcular_macros_receta', { p_receta_id: r.id }); } catch(e) { console.log(`    Recalc: ${e.message}`); }
      }
    } else {
      console.log(`    [DRY-RUN] Se eliminaria este ingrediente fantasma`);
    }
  }
}
async function fixMacrosAlimentos() {
  console.log('\n=== FIX B: ASIGNAR MACROS A ALIMENTOS CON CALORIAS=0 ===');
  const { data: alimentos } = await sb.from('alimentos').select('id,nombre,calorias');
  if (!alimentos) return;
  const norm = n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  let fixed = 0;
  for (const a of alimentos) {
    const na = norm(a.nombre);
    for (const [key, macros] of Object.entries(MACROS_FIX)) {
      if (na === key || na.includes(key) || key.includes(na)) {
        if (a.calorias !== undefined && a.calorias !== null && a.calorias > 0) continue;
        console.log(`  "${a.nombre}" (${a.calorias}kcal) -> ${macros.calorias} kcal`);
        if (!DRY) {
          const { error } = await sb.from('alimentos').update(macros).eq('id', a.id);
          if (error) console.log(`    ERROR: ${error.message}`);
          else fixed++;
        } else {
          fixed++;
        }
        break;
      }
    }
  }
  console.log(`  Total: ${fixed} alimentos ${DRY ? 'a corregir' : 'corregidos'}`);
  return fixed;
}
async function fixMalMatches() {
  console.log('\n=== FIX C: DESVINCULAR MAL MATCHES ===');
  const all = await pag('receta_ingredientes','id,receta_id,nombre_libre,alimento_id');
  const norm = n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  let count = 0;
  const recetasSet = new Set();
  for (const ing of all) {
    if (!ing.alimento_id || !ing.nombre_libre) continue;
    const ni = norm(ing.nombre_libre);
    // Check alimento name too
    const { data: al } = await sb.from('alimentos').select('nombre').eq('id', ing.alimento_id).single().catch(()=>{});
    if (!al) continue;
    const na = norm(al.nombre);
    for (const mm of MAL_MATCHES) {
      const nm = norm(mm.nombre);
      if (ni.includes(nm) || na.includes(nm)) {
        console.log(`  "${ing.nombre_libre}" -> "${al.nombre}" en receta ${ing.receta_id?.slice(0,8)}`);
        if (!DRY) {
          const { error } = await sb.from('receta_ingredientes').update({ alimento_id: null }).eq('id', ing.id);
          if (!error) { count++; recetasSet.add(ing.receta_id); }
        } else { count++; recetasSet.add(ing.receta_id); }
        break;
      }
    }
  }
  console.log(`  Total: ${count} ingredientes a desvincular en ${recetasSet.size} recetas`);
  if (!DRY && recetasSet.size > 0) {
    console.log(`  Recalculando macros de ${recetasSet.size} recetas...`);
    for (const rid of recetasSet) {
      try { await sb.rpc('calcular_macros_receta', { p_receta_id: rid }); } catch {}
    }
  }
}
async function fixYogurGriego() {
  // Yogur
 Griego with calorias=0
  console.log('\n=== FIX D: Yogur Griego Cabra (calorias=0) ===');
  const { data: yogur } = await sb.from('alimentos').select('id,nombre,calorias').ilike('nombre','%yogur griego cabra%');
  if (yogur && yogur.length > 0) {
    for (const y of yogur) {
      if (!y.calorias || y.calorias === 0) {
        console.log(`  "${y.nombre}" (${y.calorias}kcal) -> 65 kcal`);
        if (!DRY) {
          await sb.from('alimentos').update({ calorias: 65, proteinas: 5, carbohidratos: 4, grasas: 3 }).eq('id', y.id);
        }
      }
    }
  }
}
async function fixRecalcular{
