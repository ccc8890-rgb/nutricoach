#!/usr/bin/env node
/**
 * fix-todos-fallos-recetas.mjs
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  CORRECCIÓN AUTOMÁTICA DE FALLOS EN RECETAS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Basado en el diagnóstico de diagnosticar-recetas-fallos.mjs
 * Corrige:
 *
 *   FIX 1: Asignar macros a alimentos conocidos con calorias=0
 *          (Sal=0kcal, bicarbonato=0kcal, agua=0kcal, edulcorante=0kcal...)
 *          Estos son correctos y NO deben cambiarse.
 *
 *   FIX 2: Eliminar ingredientes fantasma en Hummus (panela)
 *          "Panela azucar moreno can integral" → NO está en el hummus real
 *
 *   FIX 3: Asignar macros a alimentos que DEBERÍAN tenerlas
 *          (caseína, proteína en polvo, overnight oats...)
 *
 *   FIX 4: Recalcular macros de recetas afectadas
 *
 * USO:
 *   node scripts/fix-todos-fallos-recetas.mjs              → dry-run
 *   node scripts/fix-todos-fallos-recetas.mjs --apply      → aplica cambios
 *   node scripts/fix-todos-fallos-recetas.mjs --fix-hummus → solo fix panela
 *   node scripts/fix-todos-fallos-recetas.mjs --fix-m