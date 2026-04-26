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
- Rutas dinámicas: `/dietas/[id]`, `/clientes/[id]` funcionan correctamente

**Archivos críticos:**
- `app/page.tsx` — auth check + redirection
- `app/dietas/nueva/page.tsx` — creación de dietas (useSearchParams + dynamic rendering)
- `lib/supabase.ts` — cliente configurado
- `.env.local` — variables de Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)

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

