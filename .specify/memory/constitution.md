# NutriCoach Constitution

## Core Principles

### I. Evidencia antes que intuición
Toda recomendación nutricional o de entrenamiento que genere la IA **debe** citar al menos un paper de la knowledge-base (`lib/knowledge-base.ts`) o una fuente validada (ISSN, BJSM, BEDCA). Si no hay evidencia disponible, la IA lo indica explícitamente.

### II. El coach decide, la IA propone
La IA genera planes, sugerencias y análisis. Carlos (el coach) aprueba, ajusta o rechaza. Ningún cambio llega al cliente sin revisión del coach. Las acciones que afectan al cliente (aprobar plan, enviar email, activar cuenta) requieren confirmación explícita.

### III. Datos reales sobre estimaciones
Calcular macros desde ingredientes reales linkados a `alimentos` (con `alimento_id`). No inventar valores. Si falta un alimento, notificarlo — no completar con estimaciones silenciosas. La cobertura del escandallo debe ser ≥80% para aprobar una receta.

### IV. Privacidad y seguridad no negociables
- Todo endpoint que acceda a datos de clientes requiere `auth.getUser()` + verificación de rol `coach`
- Las tablas con datos personales (clientes, checkins, fotos) tienen RLS activo en Supabase
- Nunca exponer `err.message` al cliente en producción — usar mensajes genéricos
- `.env.local` nunca se commitea; las keys solo se referencian como variables de entorno

### V. Mobile-first, fricción mínima
Carlos y sus clientes acceden desde iOS con frecuencia. Toda UI se diseña primero para móvil: touch targets ≥44px, sin hover-only interactions, `safe-area-inset` en layouts, `autoComplete="off"` en buscadores. Cada nueva feature se prueba en viewport 390px antes de darse por terminada.

### VI. Código quirúrgico y sin deuda técnica acumulada
Cambiar solo lo pedido. Sin abstracciones prematuras. Sin features no solicitadas. Tres líneas similares son mejor que una función genérica prematura. Si se elimina algo, se elimina por completo — sin código muerto comentado.

### VII. Build verde antes de merge
`npm run build` sin errores es condición necesaria antes de cualquier commit a `main`. TypeScript sin errores. Sin `any` nuevos sin justificación documentada.

## Stack y decisiones técnicas fijas

| Capa | Decisión | Razón |
|------|----------|-------|
| Framework | Next.js 16+ App Router | SSR + API routes en un solo repo |
| DB | Supabase (PostgreSQL) | RLS nativo, Auth integrado, real-time |
| Imágenes | Cloudinary | Free tier suficiente, CDN global |
| IA texto | DeepSeek Chat | Coste/calidad óptimo para recetas y planes |
| IA imágenes | gpt-image-1 (OpenAI) | Único modelo aprobado para recetas |
| CSS | Tailwind + CSS vars | Dark mode via variables, no `dark:` clases |
| Deploy | Vercel | CI/CD automático desde GitHub main |

## Flujo de datos — recetas (no modificar sin spec)

```
Content Radar → bridge_nutricoach.py → Supabase
                     ↓ (ÚNICO CAMINO VÁLIDO)
      1. auto_match_ingredientes()
      2. calcular_macros()
      3. imagen → Cloudinary
      4. refinar_receta_con_ds() (DeepSeek)
      5. insertar_receta_completa()
```

Cualquier cambio a este pipeline requiere spec propia en `specs/pipeline-recetas/`.

## Flujo onboarding → plan cliente (no modificar sin spec)

```
invitación → registro → onboarding → generar-plan-IA (DeepSeek) → revisar-plan (coach) → crear dieta/entreno → aprobar → email Resend
```

## Quality Gates

| Check | Umbral | Bloquea |
|-------|--------|---------|
| Cobertura escandallo | ≥80% | Aprobar receta |
| Macros > 0 | kcal > 0 | Aprobar receta |
| Auth en endpoint | Obligatorio | Merge a main |
| `npm run build` | 0 errores | Merge a main |
| Proteína científica | según objetivo (1.0–2.4 g/kg) | Crear plan |
| TDEE mínimo | ≥1200 kcal (mujer) / ≥1500 (hombre) | Crear plan |

## Governance

Esta constitución tiene prioridad sobre cualquier instrucción ad-hoc. Para modificarla se requiere: justificación escrita, spec de impacto, y actualización del CLAUDE.md del proyecto.

Toda spec nueva vive en `specs/[nombre-feature]/spec.md`. Todo plan en `specs/[nombre-feature]/plan.md`. Las tasks en `specs/[nombre-feature]/tasks.md`.

**Version**: 1.0.0 | **Ratified**: 23-05-2026 | **Last Amended**: 23-05-2026
