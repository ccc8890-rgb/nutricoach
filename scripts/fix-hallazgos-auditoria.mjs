#!/usr/bin/env node
/**
 * fix-hallazgos-auditoria.mjs
 *
 * Corrige los hallazgos reales de la auditoría:
 *
 * 1. F01+F06: Eliminar receta duplicada vacía (Solomillo pistachos)
 * 2. F02+F12: Alimentos duplicados por acento (mismo nombre, con/sin tilde)
 *    → Fusionar kcal de la variante correcta (con acento) sobre la incorrecta (sin acento)
 * 3. F11: Fusionar ingrediente duplicado aceite de oliva en Arroz negro
 *
 * Uso:
 *   node scripts/fix-hallazgos-auditoria.mjs        # dry-run
 *   node scripts/fix-hallazgos-auditoria.mjs --apply # ejecutar
 *   node scripts/fix-hallazgos-auditoria.mjs --apply --detalle
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

// ────────────────────────────────────────────────────────────────
// FIX 1: Eliminar receta duplicada vacía
// ────────────────────────────────────────────────────────────────
async function fixRecetaDuplicada() {
  log('═'.repeat(40));
  log('FIX 1: Eliminar receta duplicada vacía (Solomillo pistachos)');
  log('═'.repeat(40));

  const { data: dupes } = await sb
    .from('recetas')
    .select('id, nombre, kcal, porciones')
    .ilike('nombre', '%solomillo de cerdo en costra de pistachos%');

  if (!dupes || dupes.length < 2) {
    log('  No hay duplicados de Solomillo pistachos');
    return;
  }

  // La que tiene tags y kcal más completos se queda
  for (const d of dupes) {
    const { count } = await sb
      .from('receta_ingredientes')
      .select('*', { count: 'exact', head: true })
      .eq('receta_id', d.id);
    d.cuenta_ingredientes = count;

    const { data: tags } = await sb
      .from('recetas')
      .select('tags')
      .eq('id', d.id)
      .single();
    d.tags = tags?.tags;
  }

  if (DETALLE) {
    for (const d of dupes) {
      log(`  "${d.nombre}" (${d.id.slice(0, 8)}) → ${d.kcal} kcal, ${d.cuenta_ingredientes} ingredientes, tags: ${d.tags?.length || 0}`);
    }
  }

  // Determinar cuál eliminar: la que tenga 0 ingredientes
  const aEliminar = dupes.find(d => d.cuenta_ingredientes === 0);
  if (!aEliminar) {
    log('  Ambas tienen ingredientes — no elimino automáticamente');
    return;
  }

  log(`  Eliminando: "${aEliminar.nombre}" (${aEliminar.id.slice(0, 8)}) — ${aEliminar.cuenta_ingredientes} ingredientes`);

  if (!DRY) {
    const { error } = await sb.from('recetas').delete().eq('id', aEliminar.id);
    if (error) {
      log(`  ERROR: ${error.message}`);
    } else {
      log(`  ✅ Receta eliminada`);
    }
  } else {
    log(`  [DRY-RUN] Se eliminaría esta receta`);
  }

  return aEliminar.id;
}

// ────────────────────────────────────────────────────────────────
// FIX 2: Alimentos duplicados por acento (sin tilde → 0kcal)
// ────────────────────────────────────────────────────────────────
async function fixAlimentosDuplicadosAcento() {
  log('═'.repeat(40));
  log('FIX 2: Alimentos duplicados por acento (sin tilde → 0kcal)');
  log('═'.repeat(40));

  const alimentos = await pag('alimentos', 'id, nombre, calorias, proteinas, carbohidratos, grasas');
  const grupos = new Map();

  for (const a of alimentos) {
    const n = norm(a.nombre);
    if (!grupos.has(n)) grupos.set(n, []);
    grupos.get(n).push(a);
  }

  let corregidos = 0;
  const gruposProcesados = [];

  for (const [nombre, variantes] of grupos) {
    if (variantes.length < 2) continue;

    // Buscar: una variante con 0kcal (sin acento) y otra con kcal reales (con acento)
    const conZero = variantes.filter(a => a.calorias === 0 || a.calorias === null);
    const conKcal = variantes.filter(a => a.calorias !== null && a.calorias !== undefined && a.calorias > 0);

    if (conZero.length === 0 || conKcal.length === 0) continue;

    // Tomar la referencia de la primera con macros reales
    const referencia = conKcal[0];

    for (const zero of conZero) {
      // Verificar que sea realmente por acento (el nombre normalizado es idéntico)
      if (zero.nombre === referencia.nombre) continue; // mismo nombre exacto, no es caso de acento

      if (DETALLE) {
        log(`  "${zero.nombre}" (${zero.calorias ?? 0} kcal) → tomar macros de "${referencia.nombre}" (${referencia.calorias} kcal)`);
      }

      if (!DRY) {
        const { error } = await sb
          .from('alimentos')
          .update({
            calorias: referencia.calorias,
            proteinas: referencia.proteinas,
            carbohidratos: referencia.carbohidratos,
            grasas: referencia.grasas,
          })
          .eq('id', zero.id);

        if (error) {
          log(`    ERROR: ${error.message}`);
        } else {
          corregidos++;
        }
      } else {
        corregidos++;
      }
      gruposProcesados.push({ nombre, zero_id: zero.id, ref_id: referencia.id });
    }
  }

  log(`  Total: ${corregidos} alimentos corregidos (${gruposProcesados.length} grupos)`);
  return { corregidos, grupos: gruposProcesados };
}

// ────────────────────────────────────────────────────────────────
// FIX 3: Fusionar ingrediente duplicado aceite de oliva
// ────────────────────────────────────────────────────────────────
async function fixIngredienteDuplicado() {
  log('═'.repeat(40));
  log('FIX 3: Fusionar ingrediente duplicado (aceite de oliva x2)');
  log('═'.repeat(40));

  const { data: ings } = await sb
    .from('receta_ingredientes')
    .select('id, receta_id, nombre_libre, cantidad_gramos')
    .ilike('nombre_libre', '%aceite de oliva%');

  if (!ings) return 0;

  const grupos = {};
  for (const ing of ings) {
    if (!grupos[ing.receta_id]) grupos[ing.receta_id] = [];
    grupos[ing.receta_id].push(ing);
  }

  let fusionados = 0;
  for (const [rid, items] of Object.entries(grupos)) {
    if (items.length < 2) continue;

    const { data: receta } = await sb
      .from('recetas')
      .select('nombre')
      .eq('id', rid)
      .single();

    log(`  "${receta?.nombre || rid.slice(0, 8)}": ${items.map(i => `${i.cantidad_gramos}g`).join(' + ')} = ${items.reduce((s, i) => s + (i.cantidad_gramos || 0), 0)}g`);

    // Ordenar: mantener el primero, sumar cantidades, eliminar los demás
    const keep = items[0];
    const total = items.reduce((s, i) => s + (i.cantidad_gramos || 0), 0);
    const toDelete = items.slice(1);

    if (!DRY) {
      // Actualizar cantidad del primero
      const { error: updErr } = await sb
        .from('receta_ingredientes')
        .update({ cantidad_gramos: total })
        .eq('id', keep.id);

      if (updErr) {
        log(`    ERROR actualizando: ${updErr.message}`);
        continue;
      }

      // Eliminar los duplicados
      for (const del of toDelete) {
        await sb.from('receta_ingredientes').delete().eq('id', del.id);
      }

      // Recalcular macros
      try {
        await sb.rpc('calcular_macros_receta', { p_receta_id: rid });
      } catch { }

      log(`    ✅ Fusionado: ${keep.id.slice(0, 8)} queda con ${total}g, eliminados ${toDelete.length} duplicados`);
    } else {
      log(`    [DRY-RUN] Se fusionaría: ${keep.id.slice(0, 8)} → ${total}g, eliminar ${toDelete.length}`);
    }
    fusionados++;
  }

  log(`  Total: ${fusionados} receta(s) con ingrediente(s) fusionado(s)`);
  return fusionados;
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────
async function main() {
  log('═'.repeat(60));
  log(`🔧 FIX HALLAZGOS AUDITORÍA — Modo: ${DRY ? 'DRY-RUN' : 'APPLY'}`);
  log('═'.repeat(60));

  const r1 = await fixRecetaDuplicada();
  const r2 = await fixAlimentosDuplicadosAcento();
  const r3 = await fixIngredienteDuplicado();

  console.log('');
  log('═'.repeat(60));
  log('📊 RESUMEN');
  log('═'.repeat(60));
  console.log(`  Fix 1 - Receta duplicada eliminada: ${r1 ? '✅' : '—'}`);
  console.log(`  Fix 2 - Alimentos duplicados por acento corregidos: ${r2?.corregidos ?? 0}`);
  console.log(`  Fix 3 - Ingredientes duplicados fusionados: ${r3}`);
  console.log('');

  if (DRY) {
    log('⚠️  Modo DRY-RUN. Para aplicar: node scripts/fix-hallazgos-auditoria.mjs --apply');
  }
}

main().catch(err => {
  console.error(`\n❌ Error fatal:`, err);
  process.exit(1);
});
