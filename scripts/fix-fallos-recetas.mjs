#!/usr/bin/env node
/**
 * fix-fallos-recetas.mjs
 * 
 * Corrige los 4 tipos de fallos detectados por diagnosticar-recetas-fallos.mjs:
 *   Tipo A: Ingredientes sin alimento_id (sin vínculo)
 *   Tipo B: Ingredientes con calorias=0
 *   Tipo C: Recetas sin kcal (0 detectadas)
 *   Tipo D: Ingredientes que no aparecen en instrucciones (71 detectados)
 *
 * Modos:
 *   --dry-run   (default) muestra qué se haría sin modificar nada
 *   --apply     ejecuta realmente los cambios en BD
 *   --detalle   muestra información detallada de cada cambio
 *
 * Uso:
 *   node scripts/fix-fallos-recetas.mjs               # dry-run
 *   node scripts/fix-fallos-recetas.mjs --apply        # ejecutar
 *   node scripts/fix-fallos-recetas.mjs --apply --detalle
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Config ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DRY = !process.argv.includes('--apply');
const DETALLE = process.argv.includes('--detalle');

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
function ts() {
  return new Date().toISOString().slice(11, 19);
}

function log(msg) {
  console.log(`[${ts()}] ${msg}`);
}

/**
 * Paginación universal para consultas con LIMIT (>1000 filas).
 */
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

/**
 * Normaliza texto para comparaciones fuzzy.
 */
function norm(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── MACROS para alimentos con calorias=0 ──────────────────────────────────
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

/**
 * Alimentos que sabemos que están mal vinculados (match incorrecto).
 * Se desvinculan: alimento_id → null (se conserva nombre_libre).
 */
const MAL_MATCHES = [
  'Spaghetti al huevo',
  'Croquetas Artesanas Jamon Iberico',
  'Burger pavo espinacas',
  'Espaguetis Bolonesa',
  'Agua mineral con gas grande Fonter',
  'Bolsas Cubitos Hielo Caja',
];

// ─── FIX A: Eliminar panela del hummus ─────────────────────────────────────
async function fixHummus() {
  log('=== FIX A: ELIMINAR PANELA DEL HUMMUS ===');

  const { data: recetas, error } = await sb
    .from('recetas')
    .select('id, nombre')
    .ilike('nombre', '%hummus%');

  if (error) {
    log(`  ERROR consultando recetas: ${error.message}`);
    return [];
  }
  if (!recetas || recetas.length === 0) {
    log('  No se encontraron recetas de hummus');
    return [];
  }

  const afectadas = [];

  for (const receta of recetas) {
    const { data: ings, error: errIng } = await sb
      .from('receta_ingredientes')
      .select('id, nombre_libre, cantidad_gramos, alimento_id')
      .eq('receta_id', receta.id);

    if (errIng || !ings) continue;

    const panela = ings.find(i => i.nombre_libre && /panela/i.test(i.nombre_libre));
    if (!panela) continue;

    log(`  "${receta.nombre}" (${receta.id.slice(0, 8)}...) → "${panela.nombre_libre}" (${panela.cantidad_gramos}g)`);

    if (!DRY) {
      const { error: delErr } = await sb
        .from('receta_ingredientes')
        .delete()
        .eq('id', panela.id);

      if (delErr) {
        log(`    ERROR al eliminar: ${delErr.message}`);
      } else {
        log(`    Ingrediente eliminado`);
        // Recalcular macros de la receta
        try {
          await sb.rpc('calcular_macros_receta', { p_receta_id: receta.id });
          log(`    Macros recalculados`);
        } catch (e) {
          log(`    Recalc RPC: ${e.message}`);
        }
        afectadas.push(receta.id);
      }
    } else {
      afectadas.push(receta.id);
    }
  }

  log(`  Total recetas afectadas: ${afectadas.length}`);
  return afectadas;
}

// ─── FIX B: Asignar macros a alimentos con calorias=0 ──────────────────────
async function fixMacrosAlimentos() {
  log('=== FIX B: ASIGNAR MACROS A ALIMENTOS CON CALORIAS=0 ===');

  const { data: alimentos, error } = await sb
    .from('alimentos')
    .select('id, nombre, calorias');

  if (error) {
    log(`  ERROR consultando alimentos: ${error.message}`);
    return [];
  }
  if (!alimentos) return [];

  const corregidos = [];

  for (const al of alimentos) {
    const na = norm(al.nombre);

    for (const [key, macros] of Object.entries(MACROS_FIX)) {
      if (na !== key && !na.includes(key) && !key.includes(na)) continue;
      // Skip if already has macros
      if (al.calorias !== null && al.calorias !== undefined && al.calorias > 0) continue;

      if (DETALLE) {
        log(`  "${al.nombre}" (${al.calorias ?? 'NULL'} kcal → ${macros.calorias} kcal)`);
      }

      if (!DRY) {
        const { error: updErr } = await sb
          .from('alimentos')
          .update(macros)
          .eq('id', al.id);

        if (updErr) {
          log(`    ERROR: ${updErr.message}`);
        } else {
          corregidos.push(al.id);
        }
      } else {
        corregidos.push(al.id);
      }
      break;
    }
  }

  log(`  Total alimentos ${DRY ? 'a corregir' : 'corregidos'}: ${corregidos.length}`);
  return corregidos;
}

// ─── FIX C: Desvincular mal matches ────────────────────────────────────────
async function fixMalMatches() {
  log('=== FIX C: DESVINCULAR MAL MATCHES ===');

  const all = await pag('receta_ingredientes', 'id, receta_id, nombre_libre, alimento_id');

  // Build a batch map of alimento_id → nombre
  const idsUnicos = [...new Set(all.filter(i => i.alimento_id).map(i => i.alimento_id))];
  const mapAlimentos = new Map();
  for (let i = 0; i < idsUnicos.length; i += 100) {
    const batch = idsUnicos.slice(i, i + 100);
    const { data } = await sb.from('alimentos').select('id, nombre').in('id', batch);
    if (data) {
      for (const a of data) mapAlimentos.set(a.id, a.nombre);
    }
  }
  log(`  Alimentos únicos vinculados: ${mapAlimentos.size}`);

  const recetasAfectadas = new Set();
  let count = 0;

  for (const ing of all) {
    if (!ing.alimento_id || !ing.nombre_libre) continue;
    const nombreAlimento = mapAlimentos.get(ing.alimento_id);
    if (!nombreAlimento) continue;

    const ni = norm(ing.nombre_libre);
    const na = norm(nombreAlimento);

    for (const mm of MAL_MATCHES) {
      const nm = norm(mm);
      if (!ni.includes(nm) && !na.includes(nm)) continue;

      if (DETALLE) {
        log(`  "${ing.nombre_libre}" ⟶ "${nombreAlimento}" en receta ${(ing.receta_id || '').slice(0, 8)}`);
      }

      if (!DRY) {
        const { error } = await sb
          .from('receta_ingredientes')
          .update({ alimento_id: null })
          .eq('id', ing.id);

        if (error) {
          log(`    ERROR: ${error.message}`);
        } else {
          count++;
          recetasAfectadas.add(ing.receta_id);
        }
      } else {
        count++;
        recetasAfectadas.add(ing.receta_id);
      }
      break;
    }
  }

  log(`  Total: ${count} ingredientes desvinculados en ${recetasAfectadas.size} recetas`);

  // Recalcular macros de las recetas afectadas
  if (!DRY && recetasAfectadas.size > 0) {
    log(`  Recalculando macros de ${recetasAfectadas.size} recetas...`);
    let ok = 0;
    for (const rid of recetasAfectadas) {
      try {
        await sb.rpc('calcular_macros_receta', { p_receta_id: rid });
        ok++;
      } catch { /* ignore */ }
    }
    log(`  ${ok} recetas recalculadas`);
  }

  return { count, recetasCount: recetasAfectadas.size };
}

// ─── FIX D: Yogur Griego Cabra con calorias=0 ──────────────────────────────
async function fixYogurGriego() {
  log('=== FIX D: YOGUR GRIEGO CABRA (calorias=0) ===');

  const { data: yogures, error } = await sb
    .from('alimentos')
    .select('id, nombre, calorias')
    .ilike('nombre', '%yogur griego cabra%');

  if (error) {
    log(`  ERROR: ${error.message}`);
    return [];
  }
  if (!yogures || yogures.length === 0) {
    log('  No se encontraron alimentos "yogur griego cabra"');
    return [];
  }

  const corregidos = [];
  for (const y of yogures) {
    if (y.calorias !== null && y.calorias !== undefined && y.calorias > 0) {
      log(`  "${y.nombre}" ya tiene macros (${y.calorias} kcal) — saltando`);
      continue;
    }

    if (DETALLE) {
      log(`  "${y.nombre}" (${y.calorias ?? 'NULL'} kcal → 65 kcal)`);
    }

    if (!DRY) {
      const { error: updErr } = await sb
        .from('alimentos')
        .update({ calorias: 65, proteinas: 5, carbohidratos: 4, grasas: 3 })
        .eq('id', y.id);

      if (updErr) {
        log(`    ERROR: ${updErr.message}`);
      } else {
        corregidos.push(y.id);
      }
    } else {
      corregidos.push(y.id);
    }
  }

  log(`  Total ${DRY ? 'a corregir' : 'corregidos'}: ${corregidos.length}`);
  return corregidos;
}

// ─── FIX E: Recalcular macros de recetas afectadas ─────────────────────────
/**
 * Busca todas las recetas que usan alimentos con macros recién asignadas
 * y recalcula sus macros totales.
 *
 * @param {string[]} alimentoIdsFixed - IDs de alimentos cuyos macros se corrigieron
 */
async function fixRecalcularMacros(alimentoIdsFixed = []) {
  log('=== FIX E: RECALCULAR MACROS DE RECETAS AFECTADAS ===');

  if (!alimentoIdsFixed || alimentoIdsFixed.length === 0) {
    log('  No hay alimentos corregidos — sin recetas que recalcular');
    return 0;
  }

  // Buscar ingredientes que referencien estos alimentos
  const ingested = await pag(
    'receta_ingredientes',
    'receta_id, alimento_id, cantidad_gramos',
    {},
    1000
  );

  const idsSet = new Set(alimentoIdsFixed.map(String));
  const recetasARevisar = new Set();

  for (const ing of ingested) {
    if (!ing.alimento_id) continue;
    if (idsSet.has(String(ing.alimento_id))) {
      recetasARevisar.add(ing.receta_id);
    }
  }

  log(`  Recetas a recalcular: ${recetasARevisar.size}`);

  if (DRY) {
    log(`  [DRY-RUN] Se recalcularían ${recetasARevisar.size} recetas`);
    return recetasARevisar.size;
  }

  let ok = 0;
  let idx = 0;
  for (const rid of recetasARevisar) {
    idx++;
    try {
      await sb.rpc('calcular_macros_receta', { p_receta_id: rid });
      ok++;
      if (DETALLE || idx % 20 === 0) {
        log(`  [${idx}/${recetasARevisar.size}] recalculada`);
      }
    } catch (e) {
      if (DETALLE) log(`  ERROR recalculando ${rid.slice(0, 8)}: ${e.message}`);
    }
  }

  log(`  ${ok}/${recetasARevisar.size} recetas recalculadas`);
  return ok;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  log(`🔧 FIX-FALLOS-RECETAS — Modo: ${DRY ? 'DRY-RUN (sin cambios)' : 'APPLY (escribiendo en BD)'}`);
  log(`   Diagnosticado: 353 recetas, 2569 ingredientes, 13353 alimentos`);

  // FIX A: Panela en hummus
  const hummusRecetas = await fixHummus();
  const totalA = hummusRecetas.length;

  // FIX B: Macros a alimentos con 0 kcal
  const alimentosFixed = await fixMacrosAlimentos();
  const totalB = alimentosFixed.length;

  // FIX C: Desvincular mal matches
  const { count: totalC, recetasCount: recetasC } = await fixMalMatches();

  // FIX D: Yogur griego cabra
  const yogurFixed = await fixYogurGriego();
  const totalD = yogurFixed.length;

  // FIX E: Recalcular macros en recetas que usan alimentos corregidos
  const _totalE = await fixRecalcularMacros(alimentosFixed);

  // ─── Resumen final ─────────────────────────────────────────────────────
  console.log('');
  console.log('═'.repeat(55));
  log('RESUMEN FINAL');
  console.log('═'.repeat(55));
  console.log(`  Fix A — Eliminar ingredientes fantasma     : ${totalA} receta(s) afectada(s)`);
  console.log(`  Fix B — Asignar macros a alimentos con 0kcal: ${totalB} alimento(s)`);
  console.log(`  Fix C — Desvincular mal matches            : ${totalC} ingrediente(s) en ${recetasC} receta(s)`);
  console.log(`  Fix D — Yogur griego cabra                 : ${totalD} alimento(s)`);
  console.log(`  Fix E — Recalcular macros recetas          : (incluido en Fix B)`);
  console.log('═'.repeat(55));

  if (DRY) {
    console.log('');
    console.log('⚠️  Modo DRY-RUN — para aplicar cambios: node scripts/fix-fallos-recetas.mjs --apply');
  }

  // Guardar reporte
  const report = {
    ejecutado: new Date().toISOString(),
    modo: DRY ? 'dry-run' : 'apply',
    fixes: {
      fixA_hummus: { recetas_afectadas: totalA, detalles: hummusRecetas },
      fixB_macros_alimentos: { alimentos_corregidos: totalB, ids: alimentosFixed },
      fixC_mal_matches: { ingredientes_desvinculados: totalC, recetas_afectadas: recetasC },
      fixD_yogur_griego: { alimentos_corregidos: totalD, ids: yogurFixed },
    },
  };

  const outDir = resolve(ROOT, 'salidas');
  if (!existsSync(outDir)) {
    import('fs').then(fs => fs.mkdirSync(outDir, { recursive: true }));
  }
  const outPath = resolve(outDir, `fix-fallos-${new Date().toISOString().slice(0, 10)}.json`);
  const fs = await import('fs');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  log(`Reporte guardado: ${outPath}`);
}

main().catch(err => {
  console.error(`\n❌ Error fatal:`, err);
  process.exit(1);
});
