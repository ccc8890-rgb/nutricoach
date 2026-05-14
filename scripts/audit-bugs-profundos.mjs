/**
 * audit-bugs-profundos.mjs
 *
 * Auditoría en profundidad de bugs detectados.
 * Investigación detallada de cada anomalía.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) return
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

async function main() {
    // 1. DUPLICADO
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('1. DUPLICADO: Arroz del senyoret');
    const { data: dup } = await supabase.from('recetas').select('id, nombre, kcal, porciones, categoria, tipo_plato, instrucciones').ilike('nombre', '%arroz del senyoret%');
    for (const r of dup || []) {
        console.log(`  ID: ${r.id}`);
        console.log(`  Nombre: "${r.nombre}"`);
        console.log(`  kcal: ${r.kcal} | porciones: ${r.porciones}`);
        console.log(`  categoria: ${r.categoria} | tipo_plato: ${r.tipo_plato}`);
        console.log(`  instrucciones: ${(r.instrucciones || '').substring(0, 100)}...`);
        console.log('');
    }

    // 2. MACROS SOSPECHOSOS - investigar ingredientes
    console.log('══════════════════════════════════════════════════════════');
    console.log('2. MACROS SOSPECHOSOS - INVESTIGACIÓN');

    const sospechosos = [
        'Bowl de pollo encurtido en 10 minutos',
        'Dulce de Leche Saludable',
        'Lubina al horno con verduras asadas',
        'Taco BigMac',
        'Pan plano sin amasado con mantequilla de ajo',
        'Tarta de chocolate fundente',
    ];

    for (const nombre of sospechosos) {
        console.log(`\n--- ${nombre} ---`);
        const { data: recs } = await supabase.from('recetas').select('*').ilike('nombre', nombre);
        if (!recs || !recs[0]) { console.log('  No encontrada'); continue; }
        const r = recs[0];
        console.log(`  kcal=${r.kcal} | porc=${r.porciones} | peso=${r.peso_total_g}g | kcal_100g=${r.kcal_100g}`);

        const { data: ings } = await supabase.from('receta_ingredientes').select('id, nombre_libre, cantidad_gramos, alimento_id').eq('receta_id', r.id);
        if (!ings || ings.length === 0) { console.log('  SIN INGREDIENTES'); continue; }

        for (const ing of ings) {
            const { data: a } = await supabase.from('alimentos').select('nombre, calorias').eq('id', ing.alimento_id).single();
            if (a) {
                console.log(`  ${ing.nombre_libre}: ${ing.cantidad_gramos}g → ${a.nombre} (${a.calorias} kcal/100g) => ${Math.round((a.calorias || 0) * ing.cantidad_gramos / 100)} kcal`);
            } else {
                console.log(`  ${ing.nombre_libre}: ${ing.cantidad_gramos}g → ALIMENTO NO EXISTE (${ing.alimento_id})`);
            }
        }

        // calcular total esperado
        let total = 0, peso = 0;
        for (const ing of ings) {
            const { data: a } = await supabase.from('alimentos').select('calorias').eq('id', ing.alimento_id).single();
            if (a && ing.cantidad_gramos) {
                total += (a.calorias || 0) * ing.cantidad_gramos / 100;
                peso += ing.cantidad_gramos;
            }
        }
        console.log(`  TOTAL ESPERADO: ${Math.round(total)} kcal (total), ${Math.round(total / (r.porciones || 1))} kcal/porc, ${Math.round(total / peso * 100)} kcal/100g`);
    }

    // 3. 75 RECETAS SIN INGREDIENTES - verificar si tienen kcal
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('3. RECETAS SIN INGREDIENTES - REVISIÓN');
    const { data: recetas } = await supabase.from('recetas').select('*');
    const { data: ings } = await supabase.from('receta_ingredientes').select('*');
    const ingPorR = {};
    for (const i of (ings || [])) {
        if (!ingPorR[i.receta_id]) ingPorR[i.receta_id] = [];
        ingPorR[i.receta_id].push(i);
    }

    let conKcalSinIngs = 0;
    for (const r of recetas || []) {
        if ((!ingPorR[r.id] || ingPorR[r.id].length === 0) && r.kcal && r.kcal > 0) {
            conKcalSinIngs++;
            if (conKcalSinIngs <= 10) {
                console.log(`  ⚠️ "${r.nombre}" tiene kcal=${Math.round(r.kcal)} pero 0 ingredientes`);
            }
        }
    }
    if (conKcalSinIngs === 0) console.log('  ✅ Todas las recetas sin ingredientes tienen kcal=0 (correcto)');

    // 4. 27 ALIMENTOS CON 0 kcal USADOS - filtrar los que realmente deberían tener macros
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('4. ALIMENTOS CON 0 kcal USADOS - PRIORIDAD');
    const { data: alims } = await supabase.from('alimentos').select('*');
    const alimMap = {}; for (const a of (alims || [])) alimMap[a.id] = a;

    const alimIdsUsados = new Set((ings || []).filter(i => i.alimento_id).map(i => i.alimento_id));
    const alimsZeroUsados = (alims || []).filter(a => alimIdsUsados.has(a.id) && (!a.calorias || a.calorias === 0));

    // Clasificar: los que SÍ deberían tener macros (ingredientes reales) vs los que están bien en 0
    const DEBERIAN_TENER = [];
    const OK_CERO = [];

    const ceroOk = ['sal', 'agua', 'bicarbonato', 'edulcorante', 'vinagre'];

    for (const a of alimsZeroUsados) {
        const name = a.nombre.toLowerCase();
        const esCeroOk = ceroOk.some(p => name.includes(p)) ||
            name.includes('sal ') || name.startsWith('sal') ||
            name.includes('agua') ||
            name.includes('bicarbonato') ||
            name.includes('edulcorante') ||
            (name.includes('vinagre') && !name.includes('balsámico') && !name.includes('manzana'));

        if (esCeroOk) {
            OK_CERO.push(a);
        } else {
            DEBERIAN_TENER.push(a);
        }
    }

    console.log(`\n  Alimentos con 0 kcal que están BIEN así:`);
    for (const a of OK_CERO) {
        const count = (ings || []).filter(i => i.alimento_id === a.id).length;
        console.log(`   ✅ "${a.nombre}" (${count} usos) — correcto en 0`);
    }

    console.log(`\n  Alimentos con 0 kcal que DEBERÍAN TENER macros:`);
    for (const a of DEBERIAN_TENER) {
        const count = (ings || []).filter(i => i.alimento_id === a.id).length;
        console.log(`   ❌ "${a.nombre}" (${count} usos) — DEBE tener macros`);
    }

    // 5. kcal_100g inconsistencies (4 recetas)
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('5. INCONSISTENCIAS kcal_100g (dif > 5)');
    let count = 0;
    for (const r of recetas || []) {
        if (!r.kcal || !r.peso_total_g || !r.kcal_100g) continue;
        const calc100g = Math.round((r.kcal * (r.porciones || 1)) / r.peso_total_g * 100);
        const diff = Math.abs(calc100g - Math.round(r.kcal_100g));
        if (diff > 5) {
            count++;
            console.log(`  ⚠️ "${r.nombre}": BD=${Math.round(r.kcal_100g)} vs calc=${calc100g} (dif=${diff})`);
        }
    }
    console.log(`  Total: ${count}`);

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  ANÁLISIS COMPLETADO');
    console.log('══════════════════════════════════════════════════════════');
}

main().catch(console.error);
