# 🤖 INSTRUCCIONES PARA DEEPSEEK — Continuación cuando Claude se queda sin tokens

> **Lee ESTE archivo + `ESTADO.md` antes de tocar nada. Nada más.**

---

## ⚡ RESUMEN EN 60 SEGUNDOS

**Qué es:** App web Next.js 14 para Carlos (dietista). Reemplaza Harbiz.
**Stack:** Next.js 14 App Router + Supabase (PostgreSQL) + Tailwind + DeepSeek V3.
**Estado:** MVP casi completo. Recetario, dietas, portal cliente, IA — todo funciona. Ajustes finos en curso.
**Servidor:** `cd ~/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach && npm run dev` → localhost:3000
**Login:** `ccc8890@gmail.com` / `Coach0jXQbzIp3M!2026`

---

## 📋 LO QUE DEBES HACER (según el momento)

### SI ACABAS DE TOMAR EL RELEVO (sin instrucción específica de Carlos)

Lee en orden:
1. `ESTADO.md` — **Sección "PENDIENTES"** → empieza por los 🔴
2. Ejecuta el pending más urgente
3. Reporta a Carlos lo que hiciste + qué sigue

### SI CARLOS TE DA UNA TAREA CONCRETA

1. Lee `ESTADO.md` para contexto (sección relevante)
2. Localiza los archivos implicados (ver sección ARCHIVOS CLAVE abajo)
3. Implementa, verifica en navegador, documenta al final

---

## 🔴 PENDIENTES INMEDIATOS (05-05-2026)

### Paso 1 — SQL en Supabase (Carlos lo ejecuta, tú se lo recuerdas)
```sql
-- Ejecutar en Supabase Dashboard → SQL Editor
ALTER TABLE public.recetas ADD COLUMN IF NOT EXISTS descripcion_porcion text;
UPDATE public.recetas SET estado = 'aprobada' WHERE estado IS NULL;
```

### Paso 2 — Backfill recetas (ejecutar en terminal)
```bash
cd ~/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npx tsx scripts/backfill-recetas.ts
```
Rellena instrucciones + ingredientes de recetas importadas de CSV sin datos.

### Paso 3 — Probar flujo recetas
1. Ir a http://localhost:3000/recetas/nueva
2. Pegar URL de receta real (directo al paladar, mypersonalfood, etc.)
3. Verificar: se crea, redirige a detalle, muestra `descripcion_porcion`
4. Ir a `/recetas/cola` → aprobar → aparece en recetario

### Paso 4 — Próxima feature sugerida
**Recalculadora de porciones en UI:** Input "¿Cuántas porciones comes?" que multiplica macros en tiempo real.
- Dónde: `app/recetas/[id]/page.tsx` — card verde de macros
- Lógica: state local `[multiplicador, setMultiplicador]` con input tipo number (default 1)
- Mostrar: `{Math.round(macrosPorPorcion.kcal * multiplicador)} kcal`
- Tiene sentido porque Carlos explicó que cada receta es un mundo (15 galletas → comes 1 o 2)

---

## 🏗️ ARCHIVOS CLAVE POR ÁREA

### Recetas
| Archivo | Qué hace |
|---------|----------|
| `app/recetas/page.tsx` | Lista con filtros |
| `app/recetas/[id]/page.tsx` | Detalle + macros |
| `app/recetas/[id]/editar/page.tsx` | Formulario edición |
| `app/recetas/nueva/page.tsx` | Crear receta (modo URL + modo manual) |
| `app/recetas/cola/page.tsx` | Revisión pendientes |
| `app/api/scrape-receta/route.ts` | Scraper web → BD |
| `scripts/backfill-recetas.ts` | Backfill masivo de recetas con URL |

### Dietas / Planes
| Archivo | Qué hace |
|---------|----------|
| `app/dietas/page.tsx` | Lista dietas coach |
| `app/dietas/[id]/page.tsx` | Editor dieta completo |
| `app/dietas/nueva/page.tsx` | Crear dieta manual |
| `app/api/generar-dieta-ia/route.ts` | Genera dieta con DeepSeek |
| `lib/deepseek.ts` | Prompts + llamadas IA (dieta, informe, macros) |

### Clientes
| Archivo | Qué hace |
|---------|----------|
| `app/clientes/[id]/page.tsx` | Detalle cliente (4 tabs) |
| `app/cliente/[codigo]/page.tsx` | Portal cliente (sin auth) |
| `components/PortalCliente/` | Componentes del portal |

### Base de datos
| Archivo | Qué hace |
|---------|----------|
| `lib/supabase-server.ts` | `createApiSupabase(req)` para auth, `createServiceSupabase()` para bypass RLS |
| `lib/supabase.ts` | Cliente browser (solo para componentes client) |
| `types/index.ts` | Tipos TypeScript del proyecto |

---

## 🔒 REGLAS ABSOLUTAS

```
✅ PUEDES sin preguntar:
  - Implementar features de PENDIENTES
  - Bugfixes
  - Mejoras de UX menores

❌ NO puedes sin preguntar a Carlos:
  - Cambiar Supabase, Next.js, DeepSeek
  - Eliminar funcionalidad existente
  - Cambios arquitectónicos
  - Features fuera de lo que Carlos pidió

⚠️ SIEMPRE verifica antes de tocar:
  - Si una API route hace select() de tabla → debe usar createApiSupabase(req) o createServiceSupabase()
  - NUNCA usar supabase cliente browser en API routes (importado desde @/lib/supabase)
  - Tablas de catálogo público (alimentos, ejercicios) → createServiceSupabase()
  - Operaciones con auth → createApiSupabase(request)
```

---

## 🐛 ERRORES COMUNES EN ESTE PROYECTO

| Síntoma | Causa probable | Fix |
|---------|---------------|-----|
| API devuelve `[]` sin error | RLS bloqueando | Usar `createServiceSupabase()` en vez de cliente normal |
| `router.push()` no navega | Componente client no importado correctamente | Verificar `'use client'` y `import { useRouter }` |
| Macros = 0 en recetas | Recetas importadas de CSV sin ingredientes vinculados | Ejecutar backfill |
| `descripcion_porcion` no aparece | Migración SQL no ejecutada | Ejecutar `supabase_descripcion_porcion_migration.sql` |
| Scraper devuelve 422 | URL de Instagram/TikTok (no implementado aún) | Normal — solo funciona con webs |
| CSS dark mode roto | Clases `dark:` Tailwind en componente | Mover a `app/globals.css` en sección `.dark .clase` |

---

## 📞 CÓMO REPORTAR A CARLOS

Usa este formato:

```
HECHO:
  ✅ [Qué terminaste]

PENDIENTE:
  ⏳ [Qué sigue o qué Carlos debe hacer]

BLOQUEADOR (si hay):
  🔴 [Qué impide continuar + qué necesitas de Carlos]
```

---

## 🎓 DOCUMENTOS DE REFERENCIA

| Documento | Cuándo leerlo |
|-----------|--------------|
| `ESTADO.md` | SIEMPRE al empezar — estado actual + pendientes |
| `ESTRATEGIA_MVP_COMPLETA.md` | Si necesitas entender la visión global del producto |
| `ESTADO_Y_PROXIMOS_PASOS.md` | Historial detallado de todas las sesiones anteriores |
| `salidas/28-04-2026_LECCIONES_APRENDIDAS.md` | Si tienes dudas sobre RLS, auth, o patrones del proyecto |
| `CLAUDE.md` (este proyecto) | Reglas de CSS, convenciones, restricciones de seguridad |

---

**Versión:** 2.0 (05-05-2026)
**Próxima actualización:** Al cambiar de fase o al cerrar sesión
