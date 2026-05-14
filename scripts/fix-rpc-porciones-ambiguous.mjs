#!/usr/bin/env node
/**
 * fix-rpc-porciones-ambiguous.mjs
 *
 * FIX: La variable PL/pgSQL `porciones` colisiona con la columna
 * `recetas.porciones` causando error "column reference 'porciones' is ambiguous"
 * al ejecutar calcular_macros_receta().
 *
 * Solución: renombrar variable a `v_porciones`.
 *
 * USO:
 *   node scripts/fix-rpc-porciones-ambiguous.mjs
 */

console.log('\n═══════════════════════════════════════════════════════════')
console.log('📋 COPIA Y PEGA ESTE SQL EN SUPABASE SQL EDITOR:')
console.log('   https://supabase.com/dashboard/project/hopeqzwzmlrpktoeygxz/sql/new')
console.log('═══════════════════════════════════════════════════════════\n')

const SQL_FIX = `
-- FIX: Renombrar variable porciones → v_porciones para evitar
-- colisión con columna recetas.porciones en el UPDATE
CREATE OR REPLACE FUNCTION public.calcular_macros_receta(p_receta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_kcal         numeric := 0;
  total_proteinas    numeric := 0;
  total_carbohidratos numeric := 0;
  total_grasas       numeric := 0;
  total_fibra        numeric := 0;
  peso_total         numeric := 0;
  v_porciones        numeric;
BEGIN
  -- Obtener el número de porciones de la receta (por defecto 1 si es nulo)
  SELECT COALESCE(porciones, 1) INTO v_porciones
  FROM public.recetas
  WHERE id = p_receta_id;

  -- Sumar contribuciones de cada ingrediente
  -- LEFT JOIN para que ingredientes sin alimento_id no maten el cálculo
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
  LEFT JOIN public.alimentos a ON a.id = ri.alimento_id
  WHERE ri.receta_id = p_receta_id;

  -- Actualizar la receta con los valores calculados
  UPDATE public.recetas
  SET
    kcal                = CASE WHEN v_porciones > 0 THEN total_kcal / v_porciones ELSE 0 END,
    proteinas           = CASE WHEN v_porciones > 0 THEN total_proteinas / v_porciones ELSE 0 END,
    carbohidratos       = CASE WHEN v_porciones > 0 THEN total_carbohidratos / v_porciones ELSE 0 END,
    grasas              = CASE WHEN v_porciones > 0 THEN total_grasas / v_porciones ELSE 0 END,
    fibra               = CASE WHEN v_porciones > 0 THEN total_fibra / v_porciones ELSE 0 END,
    kcal_100g           = CASE WHEN peso_total > 0 THEN total_kcal / peso_total * 100 ELSE NULL END,
    proteinas_100g      = CASE WHEN peso_total > 0 THEN total_proteinas / peso_total * 100 ELSE NULL END,
    carbohidratos_100g  = CASE WHEN peso_total > 0 THEN total_carbohidratos / peso_total * 100 ELSE NULL END,
    grasas_100g         = CASE WHEN peso_total > 0 THEN total_grasas / peso_total * 100 ELSE NULL END,
    fibra_100g          = CASE WHEN peso_total > 0 THEN total_fibra / peso_total * 100 ELSE NULL END,
    peso_total_g        = peso_total,
    kcal_por_porcion    = CASE WHEN v_porciones > 0 THEN total_kcal / v_porciones ELSE 0 END,
    proteinas_por_porcion = CASE WHEN v_porciones > 0 THEN total_proteinas / v_porciones ELSE 0 END,
    carbohidratos_por_porcion = CASE WHEN v_porciones > 0 THEN total_carbohidratos / v_porciones ELSE 0 END,
    grasas_por_porcion  = CASE WHEN v_porciones > 0 THEN total_grasas / v_porciones ELSE 0 END,
    updated_at          = now()
  WHERE id = p_receta_id;
END;
$$;
`

console.log(SQL_FIX)
console.log('\n═══════════════════════════════════════════════════════════')
console.log('🧪 Después de ejecutar, prueba con:')
console.log("   SELECT calcular_macros_receta('UN-UUID-DE-RECETA-AQUI');")
console.log('═══════════════════════════════════════════════════════════\n')
