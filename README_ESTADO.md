# NutriCoach — Estado Actual (26-04-2026)

## ✅ Funcionando

**App web:**
- Acceso: `http://localhost:3001` (puerto 3001, no 3000)
- Auth: check login → redirection según rol (coach → dashboard, cliente → cliente, no logueado → login)
- Spinner de carga mientras se valida
- Supabase conectado y operativo

**Estructura base:**
- Next.js 14 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Rutas dinámicas: `/dietas/[id]`, `/clientes/[id]`, `/entrenos/[id]` funcionan correctamente
- Rutas de cuestionarios: `/cuestionarios`, `/cuestionario/[codigo]`, `/respuestas`

**Archivos críticos:**
- `app/page.tsx` — auth check + redirection
- `app/dietas/nueva/page.tsx` — creación de dietas (useSearchParams + dynamic rendering)
- `app/entrenos/nueva/page.tsx` — creación de planes de entreno con selector de plantillas
- `lib/supabase.ts` — cliente configurado
- `.env.local` — variables de Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)

**Plantillas de entrenamiento (NUEVO — 26/04/2026):**
- 21 plantillas de entrenamiento con ejercicios poblados en Supabase:
  - Gimnasio: Full Body 3d, PPL 6d, Torso/Pierna 4d, Upper/Lower 4d, Weider 5d
  - Cardio: HIIT 3d, Cardio Estado Estable
  - HYROX: Beginner, Intermediate, Advanced
  - Running: 5K, 10K, Medio Maratón, Maratón
  - Ciclismo: Base, FTP Intervals, Endurance
  - Triatlón: Sprint, Olímpico, 70.3, Ironman
- **Tablas de progresión semanal** (campo `progresion` JSONB): cada plantilla incluye semana a semana los ajustes de series, reps e intensidad
- **RPE/RIR** por ejercicio: cada ejercicio dentro de una sesión incluye su rango de esfuerzo percibido
- **Notas de individualización**: las descripciones incluyen sección `🎯` con guías para personalizar según el atleta
- **Selector UI**: componente `PlantillaEntrenoSelector.tsx` que muestra progresión, RPE y notas de individualización
- API seed: `app/api/plantillas-entreno/seed/route.ts` — inserta todas las plantillas con progresión y RPE
- Base de ejercicios: 200+ ejercicios en `seed_ejercicios.sql` con citas bibliográficas

**Sistema de cuestionarios:**
- `components/CuestionarioCreador.tsx` — crear cuestionarios dinámicos
- `components/FormularioCliente.tsx` — formulario anónimo para clientes
- `components/RespuestasClientes.tsx` — dashboard de respuestas
- API endpoints: POST/GET `/api/cuestionarios`, POST `/api/respuestas`, PUT `/api/respuestas/[id]/estado`
- Integración DeepSeek V3 para generación de dietas por IA

---

## ⏳ Pendiente

### Hoy a la tarde:
1. **PLAN_ESTETICO.md** — Carlos completa con sus decisiones visuales
   - Ubicación: `nutricoach/PLAN_ESTETICO.md`
   - Formato: checklist + descripción de referentes

2. **Funcionalidades de Harbiz** — Carlos documenta qué le gusta
   - Cómo: descripción de features (formato libre o como ejemplos en `PLAN_ESTETICO.md`)

### Después:
3. **Design system** — Claude revisa y crea
   - Colores, tipografía, componentes en Tailwind

4. **Implementación** — DeepSeek aplica cambios
   - UI updates basada en plan estético
   - Features prioritarias

5. **Testing** — Ver en localhost:3001 y ajustar

---

## 🚀 Cómo empezar en próxima sesión

```bash
# En terminal (si no está corriendo):
cd ~/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
npm run dev

# Navega a http://localhost:3001 en navegador
```

Si ves el spinner y la redirección funciona → todo OK.

---

## 📁 Archivos importantes

| Archivo | Propósito |
|---------|-----------|
| `package.json` | Dependencias y scripts |
| `.env.local` | Variables de Supabase (NO commitear) |
| `app/` | Páginas y layout |
| `lib/supabase.ts` | Cliente de Supabase |
| `supabase_schema.sql` | Schema completo de BD (incluye tablas de entrenamiento) |
| `seed_plantillas_entrenamiento.sql` | Seed de 21 plantillas con progresión y RPE |
| `seed_ejercicios.sql` | 200+ ejercicios con referencias bibliográficas |
| `components/training/PlantillaEntrenoSelector.tsx` | Selector de plantillas con UI de progresión |
| `types/index.ts` | Tipos TypeScript (incluye ProgresionPlantilla y RPE) |
| `PLAN_ESTETICO.md` | Plan de dirección visual (COMPLETAR) |
| `README_ESTADO.md` | Este archivo |

---

## 🐛 Si algo no funciona

1. Verifica que port 3000 no esté ocupado: `lsof -i :3000`
2. Mata proceso si es necesario: `kill -9 PID`
3. `npm run dev` nuevamente
4. Limpia caché: `rm -rf .next` + reinicia

---

## 💾 Sistema de delegación

- **Código/archivos/scripts:** DeepSeek V3 (automáticamente, sin pedir permiso)
- **Contenido/copies/markdown:** Gemini 2.5 Flash
- **Decisiones/estrategia:** Claude (tú y yo)
- **Aider:** ⏸ PAUSADO INDEFINIDAMENTE

Esto está documentado en memoria — Claude lo cumple sin que tengas que recordar.

---

## 📝 Próxima acción

1. Completa `PLAN_ESTETICO.md` a la tarde
2. Documenta funcionalidades de Harbiz que quieres
3. Devuélvelo a Claude
4. Claude coordina la implementación

¡Listo!
