#!/usr/bin/env node
/**
 * fix-bug4-trigger-left-join.mjs
 *
 * Aplica el fix del BUG 4 en el trigger calcular_macros_receta():
 *   JOIN → LEFT JOIN
 * 
 * Para que ingredientes sin alimento_id no causen que la receta
 * termine con 0 kcal (el INNER JOIN eliminaba TODAS las filas si
 * al menos 1 ingrediente no tenía alimento_id).
 *
 * También crea la función si no existe.
 *
 * USO:
 *   node scripts/fix-bug4-trigger-left-join.mjs
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

const SQL = `
-- Fix BUG 4: Recrear calcular_macros_receta con LEFT JOIN
-- para que ingredientes sin alimento_id no rompan el cálculo
CREATE OR REPLACE FUNCTION public.calcular_macros_receta(p_receta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_kcal       numeric := 0;
  total_proteinas  numeric := 0;
  total_carbohidratos numeric := 0;
  total_grasas     numeric := 0;
  total_fibra      numeric := 0;
  peso_total       numeric := 0;
  porciones        numeric;
BEGIN
  -- Obtener el número de porciones de la receta (por defecto 1 si es nulo)
  SELECT COALESCE(porciones, 1) INTO porciones
  FROM public.recetas
  WHERE id = p_receta_id;

  -- Sumar contribuciones de cada ingrediente
  -- Usamos LEFT JOIN para que ingredientes sin alimento_id no maten el cálculo
  SELECT
    COALESCE(SUM(a.calorias       / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.proteinas      / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.carbohidratos  / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.grasas         / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(a.fibra          / 100.0 * ri.cantidad_gramos), 0),
    COALESCE(SUM(ri.cantidad_gramos), 0)
  INTO
    total_kcal,
    total_proteinas,
    total_carbohidratos,
    total_grasas,
    total_fibra,
    peso_total
  FROM public.receta_ingredientes ri
  LEFT JOIN public.alimentos a ON a.id = ri.alimento_id  -- ← FIX: LEFT JOIN
  WHERE ri.receta_id = p_receta_id;

  -- Actualizar la receta con los valores calculados
  UPDATE public.recetas
  SET
    kcal             = CASE WHEN porciones > 0 THEN total_kcal / porciones ELSE 0 END,
    proteinas        = CASE WHEN porciones > 0 THEN total_proteinas / porciones ELSE 0 END,
    carbohidratos    = CASE WHEN porciones > 0 THEN total_carbohidratos / porciones ELSE 0 END,
    grasas           = CASE WHEN porciones > 0 THEN total_grasas / porciones ELSE 0 END,
    fibra            = CASE WHEN porciones > 0 THEN total_fibra / porciones ELSE 0 END,
    kcal_100g        = CASE WHEN peso_total > 0 THEN total_kcal / peso_total * 100 ELSE NULL END,
    proteinas_100g   = CASE WHEN peso_total > 0 THEN total_proteinas / peso_total * 100 ELSE NULL END,
    carbohidratos_100g = CASE WHEN peso_total > 0 THEN total_carbohidratos / peso_total * 100 ELSE NULL END,
    grasas_100g      = CASE WHEN peso_total > 0 THEN total_grasas / peso_total * 100 ELSE NULL END,
    fibra_100g       = CASE WHEN peso_total > 0 THEN total_fibra / peso_total * 100 ELSE NULL END,
    peso_total_g     = peso_total,
    updated_at       = now()
  WHERE id = p_receta_id;
END;
$$;
`

async function main() {
    console.log('Aplicando fix BUG 4: JOIN → LEFT JOIN en calcular_macros_receta()...')

    const { error } = await supabase.rpc('exec_sql', { sql: SQL })

    if (error) {
        // Si exec_sql no existe, intentamos con query directa
        console.log(`⚠️  exec_sql RPC no disponible: ${error.message}`)
        console.log('Intentando método alternativo...')

        const { error: sqlError } = await supabase.from('_exec_sql').select('*').csv()
            .then(async () => {
                // No podemos ejecutar SQL CREATE FUNCTION fácilmente desde el cliente JS
                // Así que imprimimos el SQL para copiar/pegar en Supabase SQL Editor
                console.log('\n═══════════════════════════════════════════════════════════')
                console.log('📋 COPIA Y PEGA ESTE SQL EN SUPABASE SQL EDITOR:')
                console.log('   Dashboard → hopeqzwzmlrpktoeygxz → SQL Editor')
                console.log('═══════════════════════════════════════════════════════════\n')
                console.log(SQL)
                console.log('\n═══════════════════════════════════════════════════════════')
            })

        // Fallback: imprimir el SQL
        console.log('\n═══════════════════════════════════════════════════════════')
        console.log('📋 COPIA Y PEGA ESTE SQL EN SUPABASE SQL EDITOR:')
        console.log('   Dashboard → SQL Editor (https://supabase.com/dashboard/project/hopeqzwzmlrpktoeygxz)')
        console.log('═══════════════════════════════════════════════════════════\n')
        console.log(SQL)
        console.log('\n═══════════════════════════════════════════════════════════')
        return
    }

    console.log('✅ LEFT JOIN aplicado correctamente en calcular_macros_receta()')
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})
