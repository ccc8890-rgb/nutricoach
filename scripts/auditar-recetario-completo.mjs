#!/usr/bin/env node
/**
 * auditar-recetario-completo.mjs
 *
 * Auditoría exhaustiva de TODA la base de datos de recetas y alimentos.
 * Busca 12 tipos de anomalías:
 *   F01 - Recetas duplicadas (mismo nombre normalizado)
 *   F02 - Alimentos duplicados (mismo nombre normalizado, macros distintos)
 *   F03 - Alimentos con valores imposibles (kcal>2000, prot>100, etc.)
 *   F04 - Alimentos con macros NULLs mezclados (ej: calorias!=NULL pero proteinas=NULL)
 *   F05 - Recetas sin categoría/tags
 *   F06 - Recetas con 0 ingredientes en receta_ingredientes
 *   F07 - Ingredientes huérfanos (alimento_id apunta a alimento inexistente)
 *   F08 - Ingredientes con cantidad_gramos NULL o 0
 *   F09 - Recetas cuyos macros almacenados no coinciden con suma de ingredientes
 *   F10 - Alimentos que parecen recetas completas (contienen palabras como "spaghetti", "croquetas")
 *   F11 - Recetas con ingredientes duplicados (mismo nombre_libre, misma receta)
 *   F12 - Alimentos con mismo nombre normalizado pero calorías muy diferentes (>50% diff)
 *
 * Uso:
 *   node scripts/auditar-recetario-completo.mjs
 *   node scripts/auditar-recetario-completo.mjs --detalle
 *   node scripts/auditar-recetario-completo.mjs --json
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Config ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DETALLE = process.argv.includes('--detalle');
const GUARDAR_JSON = process.argv.includes('--json');

// ─── Env ────────────────────────────────────────────────────────────────────
const envPath = resolve(ROOT, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ─── Helpers ────────────────────────────────────────────────────────────────
function ts() { return new Date().toISOString().slice(11, 19); }
function log(m) { console.log(`[${ts()}] ${m}`); }

async function pag(table, select, filters = {}, pageSize = 1000) {
  const acc = [];
  let from = 0;
  while (true) {
    let q = sb.from(table).select(select);
    for (const [k, v] of Object.entries(filters)) {
      if (v === null) q = q.is(k, null);
      else if (Array.isArray(v)) q = q.in(k, v);
      else q = q.eq(k, v);
    }
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw new Error(`pag(${table}): ${error.message}`);
    if (!data || data.length === 0) break;
    acc.push(...data);
    from += pageSize;
    if (data.length < pageSize) break;
  }
  return acc;
}

function norm(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Palabras que indican que un alimento es en realidad una receta completa
const NOMBRES_RECETA = [
  'spaghetti', 'espaguetis', 'croquetas', 'burger', 'hamburguesa',
  'bolonesa', 'bolognese', 'lasaña', 'lasagna', 'canelones',
  'tortilla de', 'tortilla ', 'revuelto', 'salteado', 'guiso',
  'estofado', 'potaje', 'cocido', 'pizza', 'empanada', 'empanadilla',
  'tarta', 'pastel', 'bizcocho', 'budin', 'pudin', 'flan',
  'helado', 'sorbete', 'crema de verduras', 'sopa de',
  'berenjenas rellenas', 'pimientos rellenos', 'calabacines rellenos',
  'lentejas con', 'garbanzos con', 'alubias con', 'fabada',
  'paella', 'risotto', 'wrap', 'burrito', 'quesadilla', 'taco',
  'sandwich', 'bocadillo', 'tostada', 'bruschetta',
  'macarrones', 'fettuccine', 'tagliatelle', 'ravioli',
  'cannelloni', 'moussaka', 'couscous', 'hummus',
  'frittata', 'quiche', 'clafoutis', 'crumble',
  'costillas', 'albondigas', 'chili', 'goulash', 'teriyaki',
];

async function main() {
  log('═'.repeat(60));
  log('🔍 AUDITORÍA EXHAUSTIVA DE RECETARIO');
  log('═'.repeat(60));
  log('Modo: DIAGNÓSTICO');
  console.log('');

  const resultados = {};

  // ────────────────────────────────────────────────────────────────
  // F01 — RECETAS DUPLICADAS
  // ────────────────────────────────────────────────────────────────
  log('📋 F01: Recetas duplicadas por nombre similar...');
  {
    const recetas = await pag('recetas', 'id, nombre, kcal');
    const grupos = new Map();
    for (const r of recetas) {
      const n = norm(r.nombre);
      if (!grupos.has(n)) grupos.set(n, []);
      grupos.get(n).push(r);
    }
    const dupes = [...grupos.entries()].filter(([, v]) => v.length > 1);
    resultados.F01_recetas_duplicadas = dupes.map(([n, rs]) => ({
      nombre_normalizado: n,
      variantes: rs.map(r => ({ id: r.id, nombre: r.nombre, kcal: r.kcal })),
    }));
    if (DETALLE && dupes.length > 0) {
      for (const [n, rs] of dupes) {
        log(`  ⚠️  "${n}" → ${rs.map(r => r.nombre).join(' | ')}`);
      }
    }
    log(`  → ${dupes.length} grupo(s) duplicado(s)`);
  }

  // ────────────────────────────────────────────────────────────────
  // F02 — ALIMENTOS DUPLICADOS
  // ────────────────────────────────────────────────────────────────
  log('📋 F02: Alimentos duplicados por nombre similar...');
  {
    const alimentos = await pag('alimentos', 'id, nombre, calorias, proteinas, carbohidratos, grasas');
    const grupos = new Map();
    for (const a of alimentos) {
      const n = norm(a.nombre);
      if (!grupos.has(n)) grupos.set(n, []);
      grupos.get(n).push(a);
    }
    const dupes = [...grupos.entries()]
      .filter(([, v]) => v.length > 1)
      .map(([n, as]) => ({
        nombre_normalizado: n,
        variantes: as.map(a => ({ id: a.id, nombre: a.nombre, calorias: a.calorias })),
      }));
    resultados.F02_alimentos_duplicados = dupes;
    if (DETALLE) {
      for (const d of dupes.slice(0, 20)) {
        log(`  ⚠️  "${d.nombre_normalizado}" → ${d.variantes.length} variantes`);
        for (const v of d.variantes) {
          log(`    ${v.id.slice(0, 8)} "${v.nombre}" (${v.calorias ?? '?'} kcal)`);
        }
      }
      if (dupes.length > 20) log(`    ... y ${dupes.length - 20} más`);
    }
    log(`  → ${dupes.length} grupo(s) duplicado(s)`);
  }

  // ────────────────────────────────────────────────────────────────
  // F03 — VALORES IMPOSIBLES EN ALIMENTOS
  // ────────────────────────────────────────────────────────────────
  log('📋 F03: Alimentos con valores imposibles (por 100g)...');
  {
    const alimentos = await pag('alimentos', 'id, nombre, calorias, proteinas, carbohidratos, grasas');
    const anomalos = [];
    for (const a of alimentos) {
      const issues = [];
      if (a.calorias !== null && a.calorias > 2000) issues.push(`kcal=${a.calorias}>2000`);
      if (a.proteinas !== null && a.proteinas > 100) issues.push(`prot=${a.proteinas}>100`);
      if (a.grasas !== null && a.grasas > 100) issues.push(`grasas=${a.grasas}>100`);
      if (a.carbohidratos !== null && a.carbohidratos > 100) issues.push(`carbs=${a.carbohidratos}>100`);
      if (issues.length > 0) anomalos.push({ id: a.id, nombre: a.nombre, issues });
    }
    resultados.F03_valores_imposibles = anomalos;
    if (DETALLE) {
      for (const a of anomalos.slice(0, 30)) {
        log(`  ❌ "${a.nombre}" → ${a.issues.join(', ')}`);
      }
      if (anomalos.length > 30) log(`    ... y ${anomalos.length - 30} más`);
    }
    log(`  → ${anomalos.length} alimento(s) con valores imposibles`);
  }

  // ────────────────────────────────────────────────────────────────
  // F04 — MACROS INCOMPLETOS (NULLs mezclados)
  // ────────────────────────────────────────────────────────────────
  log('📋 F04: Alimentos con macros incompletos (mezcla NULL/no-NULL)...');
  {
    const alimentos = await pag('alimentos', 'id, nombre, calorias, proteinas, carbohidratos, grasas');
    const incompletos = [];
    for (const a of alimentos) {
      const campos = ['calorias', 'proteinas', 'carbohidratos', 'grasas'];
      const noNulos = campos.filter(c => a[c] !== null && a[c] !== undefined);
      const nulos = campos.filter(c => a[c] === null || a[c] === undefined);
      if (noNulos.length > 0 && nulos.length > 0) {
        // Skip si calorias es 0 y es algo que sabemos legítimo (agua, sal, etc.)
        if (noNulos.length === 1 && a.calorias === 0) continue;
        incompletos.push({ id: a.id, nombre: a.nombre, tiene: noNulos, falta: nulos });
      }
    }
    resultados.F04_macros_incompletos = incompletos;
    if (DETALLE) {
      for (const a of incompletos.slice(0, 20)) {
        log(`  ⚠️  "${a.nombre}" → falta: ${a.falta.join(', ')}`);
      }
      if (incompletos.length > 20) log(`    ... y ${incompletos.length - 20} más`);
    }
    log(`  → ${incompletos.length} alimento(s) con macros incompletos`);
  }

  // ────────────────────────────────────────────────────────────────
  // F05 — RECETAS SIN CATEGORÍA/TAGS
  // ────────────────────────────────────────────────────────────────
  log('📋 F05: Recetas sin categoría o tags...');
  {
    const recetas = await pag('recetas', 'id, nombre, tags, categoria');
    const sinTags = recetas.filter(r => !r.tags || (Array.isArray(r.tags) && r.tags.length === 0));
    const sinCat = recetas.filter(r => !r.categoria);
    resultados.F05_sin_tags = sinTags.map(r => ({ id: r.id, nombre: r.nombre }));
    resultados.F05_sin_categoria = sinCat.map(r => ({ id: r.id, nombre: r.nombre }));
    if (DETALLE) {
      log(`  Sin tags: ${sinTags.length}`);
      log(`  Sin categoría: ${sinCat.length}`);
      if (sinTags.length > 0 && sinTags.length <= 15) {
        for (const r of sinTags) log(`    "${r.nombre}"`);
      } else if (sinTags.length > 0) {
        log(`    (lista omitida — ${sinTags.length} items)`);
      }
    }
    log(`  → ${sinTags.length} sin tags, ${sinCat.length} sin categoría`);
  }

  // ────────────────────────────────────────────────────────────────
  // F06 — RECETAS SIN INGREDIENTES
  // ────────────────────────────────────────────────────────────────
  log('📋 F06: Recetas con 0 ingredientes...');
  {
    const recetas = await pag('recetas', 'id, nombre');
    const recetasIds = recetas.map(r => r.id);
    const countIngredientes = new Map();
    for (let i = 0; i < recetasIds.length; i += 100) {
      const batch = recetasIds.slice(i, i + 100);
      const { data } = await sb.from('receta_ingredientes').select('receta_id, id').in('receta_id', batch);
      if (data) {
        for (const ing of data) {
          countIngredientes.set(ing.receta_id, (countIngredientes.get(ing.receta_id) || 0) + 1);
        }
      }
    }
    const vacias = recetas.filter(r => !countIngredientes.has(r.id) || countIngredientes.get(r.id) === 0);
    resultados.F06_recetas_vacias = vacias.map(r => ({ id: r.id, nombre: r.nombre }));
    if (DETALLE && vacias.length > 0) {
      for (const r of vacias) log(`  ❌ "${r.nombre}" (${r.id.slice(0, 8)})`);
    }
    log(`  → ${vacias.length} receta(s) vacía(s)`);
  }

  // ────────────────────────────────────────────────────────────────
  // F07 — INGREDIENTES HUÉRFANOS
  // ────────────────────────────────────────────────────────────────
  log('📋 F07: Ingredientes huérfanos (alimento_id no existe)...');
  {
    const alimentos = await pag('alimentos', 'id');
    const alimentosSet = new Set(alimentos.map(a => a.id));
    const ingredientes = await pag('receta_ingredientes', 'id, receta_id, nombre_libre, alimento_id');
    const huerfanos = ingredientes.filter(ing => ing.alimento_id && !alimentosSet.has(ing.alimento_id));
    resultados.F07_ingredientes_huerfanos = huerfanos.map(ing => ({
      id: ing.id,
      receta_id: ing.receta_id,
      nombre_libre: ing.nombre_libre,
      alimento_id: ing.alimento_id,
    }));
    if (DETALLE) {
      for (const ing of huerfanos.slice(0, 20)) {
        log(`  ❌ "${ing.nombre_libre}" → alimento_id ${ing.alimento_id} no existe`);
      }
      if (huerfanos.length > 20) log(`    ... y ${huerfanos.length - 20} más`);
    }
    log(`  → ${huerfanos.length} ingrediente(s) huérfano(s)`);
  }

  // ────────────────────────────────────────────────────────────────
  // F08 — INGREDIENTES CON CANTIDAD 0 O NULL
  // ────────────────────────────────────────────────────────────────
  log('📋 F08: Ingredientes con cantidad_gramos NULL o 0...');
  {
    const ingredientes = await pag('receta_ingredientes', 'id, receta_id, nombre_libre, cantidad_gramos');
    const sinCantidad = [];
    for (const ing of ingredientes) {
      if (ing.cantidad_gramos === null || ing.cantidad_gramos === undefined || ing.cantidad_gramos === 0) {
        sinCantidad.push(ing);
      }
    }
    resultados.F08_ingredientes_sin_cantidad = sinCantidad.map(ing => ({
      id: ing.id,
      receta_id: ing.receta_id,
      nombre_libre: ing.nombre_libre,
      cantidad_gramos: ing.cantidad_gramos,
    }));
    if (DETALLE) {
      for (const ing of sinCantidad.slice(0, 20)) {
        log(`  ⚠️  "${ing.nombre_libre}" → cantidad=${ing.cantidad_gramos}g`);
      }
      if (sinCantidad.length > 20) log(`    ... y ${sinCantidad.length - 20} más`);
    }
    log(`  → ${sinCantidad.length} ingrediente(s) sin cantidad`);
  }

  // ────────────────────────────────────────────────────────────────
  // F09 — MACROS INCOHERENTES (calculado vs almacenado)
  // ────────────────────────────────────────────────────────────────
  log('📋 F09: Macros almacenados vs calculados (kcal)...');
  {
    const recetas = await pag('recetas', 'id, nombre, kcal, proteinas, carbohidratos, grasas, porciones');
    const ingredientes = await pag('receta_ingredientes', 'id, receta_id, nombre_libre, cantidad_gramos, alimento_id');
    const alimentos = await pag('alimentos', 'id, nombre, calorias, proteinas, carbohidratos, grasas');
    const alMap = new Map(alimentos.map(a => [a.id, a]));

    // Grupo ingredientes por receta
    const ingsPorReceta = new Map();
    for (const ing of ingredientes) {
      if (!ingsPorReceta.has(ing.receta_id)) ingsPorReceta.set(ing.receta_id, []);
      ingsPorReceta.get(ing.receta_id).push(ing);
    }

    const incoherentes = [];
    for (const rec of recetas) {
      const ings = ingsPorReceta.get(rec.id) || [];
      if (ings.length === 0) continue;
      if (rec.kcal === null || rec.kcal === undefined) continue;

      // Calcular macros desde ingredientes
      let calcKcal = 0, calcProt = 0, calcCarbs = 0, calcGras = 0;
      let tieneMacros = false;
      for (const ing of ings) {
        if (!ing.alimento_id) continue;
        const al = alMap.get(ing.alimento_id);
        if (!al) continue;
        const factor = (ing.cantidad_gramos || 0) / 100;
        if (al.calorias !== null && al.calorias > 0) {
          calcKcal += al.calorias * factor;
          calcProt += (al.proteinas || 0) * factor;
          calcCarbs += (al.carbohidratos || 0) * factor;
          calcGras += (al.grasas || 0) * factor;
          tieneMacros = true;
        }
      }

      if (!tieneMacros) continue;

      const diffKcal = Math.abs(calcKcal - rec.kcal);
      const pctDiff = diffKcal / Math.max(calcKcal, rec.kcal, 1);
      if (pctDiff > 0.30 && diffKcal > 50) {
        incoherentes.push({
          id: rec.id,
          nombre: rec.nombre,
          porciones: rec.porciones,
          almacenado: { kcal: rec.kcal, proteinas: rec.proteinas, carbohidratos: rec.carbohidratos, grasas: rec.grasas },
          calculado: { kcal: Math.round(calcKcal), proteinas: Math.round(calcProt), carbohidratos: Math.round(calcCarbs), grasas: Math.round(calcGras) },
          diff_pct: Math.round(pctDiff * 100),
        });
      }
    }

    incoherentes.sort((a, b) => b.diff_pct - a.diff_pct);
    resultados.F09_macros_incoherentes = incoherentes;
    if (DETALLE) {
      for (const r of incoherentes.slice(0, 30)) {
        log(`  ⚠️  "${r.nombre}" → almacenado:${r.almacenado.kcal}kcal vs calculado:${r.calculado.kcal}kcal (${r.diff_pct}%)`);
      }
      if (incoherentes.length > 30) log(`    ... y ${incoherentes.length - 30} más`);
    }
    log(`  → ${incoherentes.length} receta(s) con macros incoherentes (>30% diff)`);
  }

  // ────────────────────────────────────────────────────────────────
  // F10 — ALIMENTOS QUE PARECEN RECETAS
  // ────────────────────────────────────────────────────────────────
  log('📋 F10: Alimentos con nombre de receta completa...');
  {
    const alimentos = await pag('alimentos', 'id, nombre, calorias');
    const sospechosos = [];
    for (const a of alimentos) {
      const n = norm(a.nombre);
      for (const patron of NOMBRES_RECETA) {
        if (n.includes(patron)) {
          sospechosos.push({ id: a.id, nombre: a.nombre, calorias: a.calorias, patron_detectado: patron });
          break;
        }
      }
    }
    resultados.F10_alimentos_son_recetas = sospechosos;
    if (DETALLE) {
      for (const a of sospechosos.slice(0, 30)) {
        log(`  ⚠️  "${a.nombre}" (${a.calorias ?? '?'} kcal) → patrón "${a.patron_detectado}"`);
      }
      if (sospechosos.length > 30) log(`    ... y ${sospechosos.length - 30} más`);
    }
    log(`  → ${sospechosos.length} alimento(s) con nombre de receta`);
  }

  // ────────────────────────────────────────────────────────────────
  // F11 — INGREDIENTES DUPLICADOS EN UNA MISMA RECETA
  // ────────────────────────────────────────────────────────────────
  log('📋 F11: Ingredientes duplicados en misma receta...');
  {
    const ingredientes = await pag('receta_ingredientes', 'id, receta_id, nombre_libre, cantidad_gramos, alimento_id');
    const grupos = new Map();
    for (const ing of ingredientes) {
      if (!ing.nombre_libre) continue;
      const key = `${ing.receta_id}::${norm(ing.nombre_libre)}`;
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(ing);
    }
    const duplicados = [...grupos.entries()].filter(([, v]) => v.length > 1);
    resultados.F11_ingredientes_duplicados_receta = duplicados.map(([key, ings]) => {
      const [recetaId] = key.split('::');
      return {
        receta_id: recetaId,
        nombre: ings[0].nombre_libre,
        ocurrencias: ings.map(i => ({ id: i.id, cantidad: i.cantidad_gramos, alimento_id: i.alimento_id })),
      };
    });
    if (DETALLE) {
      for (const d of duplicados.slice(0, 20)) {
        const [rid, nom] = d[0].split('::');
        const cantidades = d[1].map(i => i.cantidad_gramos).join('g, ');
        log(`  ⚠️  "${nom}" x${d[1].length} (${cantidades}g) en receta ${rid.slice(0, 8)}`);
      }
      if (duplicados.length > 20) log(`    ... y ${duplicados.length - 20} más`);
    }
    log(`  → ${duplicados.length} caso(s) de ingrediente duplicado en misma receta`);
  }

  // ────────────────────────────────────────────────────────────────
  // F12 — MISMO NOMBRE, MACROS DISTINTOS
  // ────────────────────────────────────────────────────────────────
  log('📋 F12: Alimentos con mismo nombre pero macros muy distintos...');
  {
    const alimentos = await pag('alimentos', 'id, nombre, calorias, proteinas, carbohidratos, grasas');
    const grupos = new Map();
    for (const a of alimentos) {
      const n = norm(a.nombre);
      if (!grupos.has(n)) grupos.set(n, []);
      grupos.get(n).push(a);
    }
    const conflictivos = [];
    for (const [nombre, variantes] of grupos) {
      if (variantes.length < 2) continue;
      const conKcal = variantes.filter(a => a.calorias !== null && a.calorias !== undefined && a.calorias > 0);
      if (conKcal.length < 2) continue;
      const minKcal = Math.min(...conKcal.map(a => a.calorias));
      const maxKcal = Math.max(...conKcal.map(a => a.calorias));
      if (maxKcal > 0 && (maxKcal - minKcal) / maxKcal > 0.50) {
        conflictivos.push({
          nombre_normalizado: nombre,
          variantes: variantes.map(a => ({ id: a.id, nombre: a.nombre, calorias: a.calorias, proteinas: a.proteinas, grasas: a.grasas, carbohidratos: a.carbohidratos })),
          diff_pct: Math.round(((maxKcal - minKcal) / maxKcal) * 100),
        });
      }
    }
    conflictivos.sort((a, b) => b.diff_pct - a.diff_pct);
    resultados.F12_macros_distintos_mismo_nombre = conflictivos;
    if (DETALLE) {
      for (const c of conflictivos.slice(0, 20)) {
        log(`  ⚠️  "${c.nombre_normalizado}" diff ${c.diff_pct}%`);
        for (const v of c.variantes) {
          log(`    ${v.id.slice(0, 8)} "${v.nombre}" (${v.calorias ?? '?'} kcal, P:${v.proteinas ?? '?'}, G:${v.grasas ?? '?'}, C:${v.carbohidratos ?? '?'})`);
        }
      }
      if (conflictivos.length > 20) log(`    ... y ${conflictivos.length - 20} más`);
    }
    log(`  → ${conflictivos.length} grupo(s) con macros inconsistentes`);
  }

  // ────────────────────────────────────────────────────────────────
  // RESUMEN GLOBAL
  // ────────────────────────────────────────────────────────────────
  console.log('');
  log('═'.repeat(60));
  log('📊 RESUMEN GLOBAL DE AUDITORÍA');
  log('═'.repeat(60));
  const items = [
    ['F01 Recetas duplicadas', resultados.F01_recetas_duplicadas?.length ?? 0],
    ['F02 Alimentos duplicados', resultados.F02_alimentos_duplicados?.length ?? 0],
    ['F03 Valores imposibles', resultados.F03_valores_imposibles?.length ?? 0],
    ['F04 Macros incompletos', resultados.F04_macros_incompletos?.length ?? 0],
    ['F05a Sin tags', resultados.F05_sin_tags?.length ?? 0],
    ['F05b Sin categoría', resultados.F05_sin_categoria?.length ?? 0],
    ['F06 Recetas vacías', resultados.F06_recetas_vacias?.length ?? 0],
    ['F07 Ingredientes huérfanos', resultados.F07_ingredientes_huerfanos?.length ?? 0],
    ['F08 Sin cantidad_gramos', resultados.F08_ingredientes_sin_cantidad?.length ?? 0],
    ['F09 Macros incoherentes', resultados.F09_macros_incoherentes?.length ?? 0],
    ['F10 Alimentos-receta', resultados.F10_alimentos_son_recetas?.length ?? 0],
    ['F11 Ingredientes duplicados', resultados.F11_ingredientes_duplicados_receta?.length ?? 0],
    ['F12 Macros inconsistentes', resultados.F12_macros_distintos_mismo_nombre?.length ?? 0],
  ];
  let total = 0;
  for (const [name, count] of items) {
    const icono = count > 0 ? '❌' : '✅';
    console.log(`  ${icono} ${name}: ${count}`);
    total += count;
  }
  console.log('');
  log(`TOTAL DE ANOMALÍAS DETECTADAS: ${total}`);

  // Guardar JSON
  if (GUARDAR_JSON) {
    const outDir = resolve(ROOT, 'salidas');
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `auditoria-recetario-${new Date().toISOString().slice(0, 10)}.json`);
    writeFileSync(outPath, JSON.stringify({
      ejecutado: new Date().toISOString(),
      resumen: Object.fromEntries(items),
      total_anomalias: total,
      resultados,
    }, null, 2));
    log(`JSON guardado: ${outPath}`);
  }

  console.log('');
  log('✅ Auditoría completada');
}

main().catch(err => {
  console.error(`\n❌ Error fatal:`, err);
  process.exit(1);
});
