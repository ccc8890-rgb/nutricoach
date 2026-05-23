# Plan: Generación de Planes Personalizada + Vinculación Portal Cliente

> **COMPLETADO 23-05-2026** — Todos los tasks implementados, build verde, pushed a main.
> Ver commits `b440238` → `34b6e20` para el historial completo.

**Goal:** Reescribir el pipeline de generación de planes de dieta IA para que filtre el recetario por intolerancias y macros antes de enviarlo a DeepSeek, garantice que todos los `comida_alimentos` tengan `alimento_id != NULL`, escale ingredientes de forma inteligente por rol, y ofrezca 2 alternativas macroequivalentes por comida en el portal del cliente.

**Spec de referencia:** `docs/superpowers/specs/2026-05-23-plan-generation-portal-design.md`

## Estado

| Task | Estado | Commit |
|------|--------|--------|
| 1. SQL migration (5 tablas, 15 columnas) | ✅ | `b440238` |
| 2. TypeScript types (7 nuevos tipos) | ✅ | `df2cca1` |
| 3. `lib/ingredient-roles.ts` | ✅ | `df2cca1` |
| 4. `lib/plan-recetas.ts` | ✅ | `df2cca1` |
| 5. `lib/nutricion-peri-entreno.ts` (peri-entreno) | ✅ | `df2cca1` |
| 6. Script `clasificar-tipo-receta.mjs` (352 recetas) | ✅ | `cdd316b` |
| 7. Script `inferir-roles-ingredientes.mjs` (1000 ingred.) | ✅ | `cdd316b` |
| 8. Onboarding forms (+4 campos) | ✅ | `1ee87a5` |
| 9. `generar-plan-inicial/route.ts` refactor | ✅ | `1d4be1a` |
| 10. `GET /api/recetas/alternativas` | ✅ | `90db7c1` |
| 11. `RecetaIngredienteItem.tsx` | ✅ | `90db7c1` |
| 12. `MealCard.tsx` | ✅ | `90db7c1` |
| 13. `MiPlan.tsx` drawer alternativas | ✅ | `34b6e20` |
| 14. `MisPlatos.tsx` + `mis-platos` API | ✅ | `90db7c1` |
| 15. CSS placeholders MealCard | ✅ | `90db7c1` |
| 16. Build + push to main | ✅ | 0 errores, 113 páginas |
