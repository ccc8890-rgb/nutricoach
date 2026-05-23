#!/usr/bin/env node
/**
 * auditar-y-corregir-f09-f12.mjs
 *
 * Ataca los dos pendientes de la auditoría:
 *
 * F09 (corregido): Compara kcal almacenada (por ración) vs suma de ingredientes / porciones
 *   → Detecta mismatches REALES donde la BD está mal
 *
 * F12 (investigación): 25 grupos con mismo nombre normalizado pero macros muy distintos
 *   → Clasifica en:
 *      - erróneo (todos macros ~cero) → corregible
 *      - mismo alimento, distinto acento → corregible si una variante tiene kcal=0
 *      - productos distintos (light vs normal, etc.) → no corregible
 *
 * Uso:
 *   node scripts/auditar-y-corregir-f09-f12.mjs              # dry-run
 *   node scripts/auditar-y-corregir-f09-f12.mjs --apply      # aplicar fixes
 *   node scripts/auditar-y-corregir-f09-f12.mjs --detalle    # verbose
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

function redondearMacros(macros) {
  return {
    kcal: Math.round(macros.kcal * 10) / 10,
    proteinas: Math.round(macros.proteinas * 10) / 10,
    carbohidratos: Math.round(macros.carbohidratos * 10) / 10,
    grasas: Math.round(macros.grasas * 10) / 10,
  };
}

// ────────────────────────────────────────────────────────────────
// F09 CORREGIDO: Comparar kcal almacenada (por ración) vs
//                 suma de ingredientes / porciones
// ────────────────────────────────────────────────────────────────
async function analizarF09() {
  console.log('\n' + '═'.repeat(60));
  log('F09 (CORREGIDO): Macros almacenados vs calculados POR RACION');
  console.log('═'.repeat(60));

  const recetas = await pag('recetas', 'id, nombre, kcal, proteinas, carbohidratos, grasas, porciones');
  const ingredientes = await pag('receta_ingredientes', 'id, receta_id, nombre_libre, cantidad_gramos, alimento_id');
  const alimentos = await pag('alimentos', 'id, nombre, calorias, proteinas, carbohidratos, grasas');
  const alMap = new Map(alimentos.map(a => [a.id, a]));

  const ingsPorReceta = new Map();
  for (const ing of ingredientes) {
    if (!ingsPorReceta.has(ing.receta_id)) ingsPorReceta.set(ing.receta_id, []);
    ingsPorReceta.get(ing.receta_id).push(ing);
  }

  const reales = [];
  const sinPorciones = [];
  const totalRecetas = recetas.length;
  let conDatos = 0;

  for (const rec of recetas) {
    const ings = ingsPorReceta.get(rec.id) || [];
    if (ings.length === 0) continue;
    if (rec.kcal === null || rec.kcal === undefined) continue;
    conDatos++;

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

    const porciones = rec.porciones || 1;
    const calcPorRacion = {
      kcal: calcKcal / porciones,
      proteinas: calcProt / porciones,
      carbohidratos: calcCarbs / porciones,
      grasas: calcGras / porciones,
    };

    const almacenado = {
      kcal: rec.kcal,
      proteinas: rec.proteinas || 0,
      carbohidratos: rec.carbohidratos || 0,
      grasas: rec.grasas || 0,
    };

    const diffKcal = Math.abs(calcPorRacion.kcal - almacenado.kcal);
    const pctDiff = diffKcal / Math.max(calcPorRacion.kcal, almacenado.kcal, 1);

    const diffProt = Math.abs(calcPorRacion.proteinas - almacenado.proteinas);
    const pctDiffProt = diffProt / Math.max(calcPorRacion.proteinas, almacenado.proteinas, 1);
    const diffGras = Math.abs(calcPorRacion.grasas - almacenado.grasas);
    const diffCarbs = Math.abs(calcPorRacion.carbohidratos - almacenado.carbohidratos);

    const esMismatch = pctDiff > 0.30 && diffKcal > 20;
    const esMacroMismatch = (pctDiffProt > 0.30 && diffProt > 5) ||
      (diffGras > 5 && Math.abs(calcPorRacion.grasas - almacenado.grasas) / Math.max(calcPorRacion.grasas, almacenado.grasas, 1) > 0.30) ||
      (diffCarbs > 5 && Math.abs(calcPorRacion.carbohidratos - almacenado.carbohidratos) / Math.max(calcPorRacion.carbohidratos, almacenado.carbohidratos, 1) > 0.30);

    const entry = {
      id: rec.id.slice(0, 8),
      nombre: rec.nombre,
      porciones: rec.porciones,
      almacenado: redondearMacros(almacenado),
      calculado_por_racion: redondearMacros(calcPorRacion),
      calculado_total: redondearMacros({ kcal: calcKcal, proteinas: calcProt, carbohidratos: calcCarbs, grasas: calcGras }),
      diff_kcal_pct: Math.round(pctDiff * 100),
      n_ingredientes: ings.length,
    };

    if (esMismatch || esMacroMismatch) {
      reales.push(entry);
    } else if (!rec.porciones || rec.porciones <= 1) {
      if (pctDiff > 0.30) {
        sinPorciones.push(entry);
      }
    }
  }

  log(`  Total recetas: ${totalRecetas}`);
  log(`  Con datos (kcal+ingredientes): ${conDatos}`);
  log(`  Mismatches REALES (>30% diff por racion): ${reales.length}`);
  log(`  Sin porciones (no verificables): ${sinPorciones.length}`);

  if (DETALLE && reales.length > 0) {
    reales.sort((a, b) => b.diff_kcal_pct - a.diff_kcal_pct);
    for (const r of reales.slice(0, 50)) {
      console.log(`  !  "${r.nombre}"`);
      console.log(`       Almacenado: ${r.almacenado.kcal} kcal | Calculado x racion: ${r.calculado_por_racion.kcal} kcal | Total: ${r.calculado_total.kcal} kcal (${r.porciones} porc.)`);
      console.log(`       Diff: ${r.diff_kcal_pct}% | Ingredientes: ${r.n_ingredientes}`);
      console.log(`       Prot: ${r.almacenado.proteinas}/${r.calculado_por_racion.proteinas} | Carbs: ${r.almacenado.carbohidratos}/${r.calculado_por_racion.carbohidratos} | Grasas: ${r.almacenado.grasas}/${r.calculado_por_racion.grasas}`);
    }
    if (reales.length > 50) log(`    ... y ${reales.length - 50} mas`);
  }

  return { reales, sinPorciones, totalRecetas, conDatos };
}

// ────────────────────────────────────────────────────────────────
// F12: Investigar 25 grupos con mismo nombre, macros muy distintos
// ────────────────────────────────────────────────────────────────
async function analizarF12() {
  console.log('\n' + '═'.repeat(60));
  log('F12 (INVESTIGACION): Mismo nombre normalizado, macros muy distintos');
  console.log('═'.repeat(60));

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
        variantes: variantes.map(a => ({
          id: a.id.slice(0, 8),
          nombre: a.nombre,
          calorias: a.calorias,
          proteinas: a.proteinas,
          grasas: a.grasas,
          carbohidratos: a.carbohidratos,
        })),
        min_kcal: minKcal,
        max_kcal: maxKcal,
        diff_pct: Math.round(((maxKcal - minKcal) / maxKcal) * 100),
      });
    }
  }

  conflictivos.sort((a, b) => b.diff_pct - a.diff_pct);

  log(`  Grupos con macros inconsistentes (>50% diff): ${conflictivos.length}`);
  console.log('');

  // Clasificar cada grupo
  const clasificados = {
    sospechoso_erroneo: [],     // Todos macros ~0 en una variante -> claramente error
    requiere_revision: [],      // Tiene algunos macros pero kcal irrealmente baja
    mismo_accento: [],          // Mismo alimento con/sin acento
    productos_distintos: [],    // Productos legítimamente diferentes
  };

  for (const c of conflictivos) {
    const variantes = c.variantes;
    const conKcal = variantes.filter(v => v.calorias !== null && v.calorias !== undefined && v.calorias > 0);
    const kcalBajas = conKcal.filter(v => v.calorias <= 25);
    const kcalNormales = conKcal.filter(v => v.calorias >= 50);

    // Detectar caso de acento: nombres exactos diferentes pero normalizados iguales
    const nombresExactos = [...new Set(variantes.map(v => v.nombre.toLowerCase().trim()))];
    const esCasoAcento = nombresExactos.length > 1 &&
      nombresExactos.some(n1 => nombresExactos.some(n2 => n2 !== n1 && norm(n2) === norm(n1)));

    if (kcalBajas.length === 1 && kcalNormales.length >= 1 && c.min_kcal <= 25) {
      const baja = kcalBajas[0];
      // Comprobar si todos los macros son ~0
      const protCero = baja.proteinas === null || baja.proteinas === undefined || baja.proteinas <= 0.5;
      const grasCero = baja.grasas === null || baja.grasas === undefined || baja.grasas <= 0.5;
      const carbCero = baja.carbohidratos === null || baja.carbohidratos === undefined || baja.carbohidratos <= 1;

      if (protCero && grasCero && carbCero) {
        // Todos macros cercanos a 0 -> claramente erróneo (no es light, es error de carga)
        clasificados.sospechoso_erroneo.push({
          ...c,
          tipo: 'macros_cero',
          variante_baja: baja,
          variantes_normales: kcalNormales,
        });
      } else {
        // Tiene macros parciales -> posible light o producto diferente
        clasificados.requiere_revision.push({
          ...c,
          tipo: 'posible_light_o_parcial',
          variante_baja: baja,
          variantes_normales: kcalNormales,
        });
      }
    } else if (esCasoAcento) {
      clasificados.mismo_accento.push(c);
    } else {
      const nombresDiferentes = [...new Set(variantes.map(v => v.nombre))];
      clasificados.productos_distintos.push({
        ...c,
        nombres_unicos: nombresDiferentes,
      });
    }
  }

  // Mostrar resultados
  console.log(`  1. ERRONEOS (corregibles - macros ~0): ${clasificados.sospechoso_erroneo.length}`);
  for (const c of clasificados.sospechoso_erroneo) {
    console.log(`\n     !  "${c.nombre_normalizado}"`);
    console.log(`         MAL: "${c.variante_baja.nombre}" -> ${c.variante_baja.calorias} kcal (P:${c.variante_baja.proteinas ?? 0} G:${c.variante_baja.grasas ?? 0} C:${c.variante_baja.carbohidratos ?? 0})`);
    for (const vn of c.variantes_normales) {
      console.log(`         BIEN: "${vn.nombre}" -> ${vn.calorias} kcal (P:${vn.proteinas ?? 0} G:${vn.grasas ?? 0} C:${vn.carbohidratos ?? 0})`);
    }
  }

  console.log(`\n  2. REQUIEREN REVISION (kcal baja pero con macros parciales): ${clasificados.requiere_revision.length}`);
  for (const c of clasificados.requiere_revision) {
    console.log(`\n     ?  "${c.nombre_normalizado}"`);
    console.log(`         BAJA: "${c.variante_baja.nombre}" -> ${c.variante_baja.calorias} kcal (P:${c.variante_baja.proteinas ?? 0} G:${c.variante_baja.grasas ?? 0} C:${c.variante_baja.carbohidratos ?? 0})`);
    for (const vn of c.variantes_normales) {
      console.log(`         NORMAL: "${vn.nombre}" -> ${vn.calorias} kcal (P:${vn.proteinas ?? 0} G:${vn.grasas ?? 0} C:${vn.carbohidratos ?? 0})`);
    }
  }

  if (DETALLE) {
    console.log(`\n  3. MISMO ACENTO (${clasificados.mismo_accento.length}):`);
    for (const c of clasificados.mismo_accento) {
      console.log(`     "${c.nombre_normalizado}" -> diff ${c.diff_pct}%`);
    }

    console.log(`\n  4. PRODUCTOS DISTINTOS (${clasificados.productos_distintos.length}):`);
    for (const c of clasificados.productos_distintos.slice(0, 15)) {
      console.log(`     "${c.nombre_normalizado}" -> ${c.min_kcal} - ${c.max_kcal} kcal (diff ${c.diff_pct}%)`);
      console.log(`       Nombres: ${c.nombres_unicos.join(' | ')}`);
    }
    if (clasificados.productos_distintos.length > 15) {
      console.log(`       ... y ${clasificados.productos_distintos.length - 15} mas`);
    }
  }

  return clasificados;
}

// ────────────────────────────────────────────────────────────────
// FIX: Corregir los F12 sospechosos (macros ~0 -> copiar de normal)
// ────────────────────────────────────────────────────────────────
async function fixF12Erroneos(erroneos) {
  console.log('\n' + '═'.repeat(60));
  log(`FIX F12: Corregir ${erroneos.length} alimentos con macros ~0`);
  console.log('═'.repeat(60));

  let corregidos = 0;

  for (const c of erroneos) {
    const baja = c.variante_baja;
    const ref = c.variantes_normales[0];

    log(`\n  "${c.nombre_normalizado}": "${baja.nombre}" (${baja.calorias} kcal) -> tomar macros de "${ref.nombre}" (${ref.calorias} kcal)`);

    if (!DRY) {
      // Obtener IDs completos por nombre exacto
      const { data: fullBajo } = await sb
        .from('alimentos')
        .select('id, nombre, calorias, proteinas, carbohidratos, grasas')
        .ilike('nombre', baja.nombre)
        .limit(1)
        .single();

      const { data: fullRef } = await sb
        .from('alimentos')
        .select('id, calorias, proteinas, carbohidratos, grasas')
        .ilike('nombre', ref.nombre)
        .limit(1)
        .single();

      if (fullBajo && fullRef) {
        const { error } = await sb
          .from('alimentos')
          .update({
            calorias: fullRef.calorias,
            proteinas: fullRef.proteinas,
            carbohidratos: fullRef.carbohidratos,
            grasas: fullRef.grasas,
          })
          .eq('id', fullBajo.id);

        if (error) {
          console.log(`    ERROR: ${error.message}`);
        } else {
          console.log(`    CORREGIDO: "${baja.nombre}" -> ${ref.calorias} kcal`);
          corregidos++;
        }
      } else {
        console.log(`    ERROR: No se pudo encontrar el alimento exacto`);
      }
    } else {
      console.log(`    [DRY-RUN] Se copiarian macros de "${ref.nombre}" -> "${baja.nombre}"`);
      corregidos++;
    }
  }

  console.log(`\n  Resumen: ${corregidos} corregidos`);
  return corregidos;
}

// ────────────────────────────────────────────────────────────────
// FIX F09: Recalcular macros de recetas con mismatches reales
// ────────────────────────────────────────────────────────────────
async function fixF09Recetas(mismatches) {
  console.log('\n' + '═'.repeat(60));
  log(`FIX F09: Recalcular macros de ${mismatches.length} recetas con mismatch real`);
  console.log('═'.repeat(60));

  let recalculadas = 0;

  for (const r of mismatches.slice(0, 20)) {
    log(`  "${r.nombre}" (${r.id})`);
    log(`    Almacenado: ${r.almacenado.kcal} kcal | Calculado: ${r.calculado_por_racion.kcal} kcal/racion (${r.diff_kcal_pct}% diff)`);

    if (!DRY) {
      try {
        const { data: recetaFull } = await sb
          .from('recetas')
          .select('id')
          .eq('id', r.id)
          .single();

        if (recetaFull) {
          await sb.rpc('calcular_macros_receta', { p_receta_id: recetaFull.id });
          console.log(`    RECALCULADO via RPC`);
          recalculadas++;
        }
      } catch (e) {
        console.log(`    Error: ${e.message}`);
      }
    } else {
      console.log(`    [DRY-RUN] Se recalcularia via RPC`);
      recalculadas++;
    }
  }

  if (mismatches.length > 20) {
    console.log(`\n  ! ${mismatches.length - 20} recetas mas no procesadas (limite 20)`);
  }

  return recalculadas;
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(60));
  log(`AUDITORIA F09+F12 - Modo: ${DRY ? 'DRY-RUN' : 'APPLY'}`);
  console.log('═'.repeat(60));
  console.log('');

  // F09: Analizar
  const f09 = await analizarF09();

  // F09: Fix si hay mismatches
  let f09corregidas = 0;
  if (f09.reales.length > 0) {
    f09corregidas = await fixF09Recetas(f09.reales);
  } else {
    log('\nF09: No hay mismatches reales. El bug original (no dividir por porciones) esta confirmado.');
  }

  // F12: Investigar
  console.log('\n' + '═'.repeat(60));
  const f12 = await analizarF12();

  // F12: Corregir erróneos
  let f12corregidos = 0;
  if (f12.sospechoso_erroneo.length > 0) {
    f12corregidos = await fixF12Erroneos(f12.sospechoso_erroneo);
  } else {
    log('\nF12: No hay alimentos con macros ~0 para corregir.');
  }

  // Resumen
  console.log('\n' + '═'.repeat(60));
  log('RESUMEN FINAL');
  console.log('═'.repeat(60));
  console.log('');
  console.log(`  F09:`);
  console.log(`    Total recetas: ${f09.totalRecetas}`);
  console.log(`    Con datos: ${f09.conDatos}`);
  console.log(`    Mismatches reales: ${f09.reales.length}`);
  console.log(`    Corregidas: ${f09corregidas}`);
  console.log('');
  console.log(`  F12:`);
  console.log(`    Erroneos (macros ~0, corregibles): ${f12.sospechoso_erroneo.length}`);
  console.log(`    Requiere revision (kcal baja parcial): ${f12.requiere_revision.length}`);
  console.log(`    Mismo acento: ${f12.mismo_accento.length}`);
  console.log(`    Productos distintos: ${f12.productos_distintos.length}`);
  console.log(`    Corregidos: ${f12corregidos}`);
  console.log('');

  if (DRY) {
    console.log('Modo DRY-RUN. Para aplicar: node scripts/auditar-y-corregir-f09-f12.mjs --apply');
  }

  // Guardar reporte JSON
  const outDir = resolve(ROOT, 'salidas');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `auditoria-f09-f12-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(outPath, JSON.stringify({
    ejecutado: new Date().toISOString(),
    modo: DRY ? 'dry-run' : 'apply',
    F09: {
      total_recetas: f09.totalRecetas,
      con_datos: f09.conDatos,
      mismatches_reales: f09.reales.length,
      corregidas: f09corregidas,
      mismatches: f09.reales,
    },
    F12: {
      erroneos: f12.sospechoso_erroneo.length,
      requiere_revision: f12.requiere_revision.length,
      mismo_accento: f12.mismo_accento.length,
      productos_distintos: f12.productos_distintos.length,
      corregidos: f12corregidos,
      detalle_erroneos: f12.sospechoso_erroneo,
      detalle_revision: f12.requiere_revision,
    },
  }, null, 2));
  log(`Reporte guardado: ${outPath}`);
}

main().catch(err => {
  console.error(`\nError fatal:`, err);
  process.exit(1);
});
