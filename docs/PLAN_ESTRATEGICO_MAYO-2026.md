# Plan estratégico NutriCoach — Mayo 2026

> Estado: app funcional en local, no desplegada. Objetivo del mes: primeros clientes reales.

---

## QUÉ ESTÁ CONSTRUIDO HOY ✅

- Recetario completo (CRUD, búsqueda, filtros, importación por URL)
- Constructor de dietas con macros en tiempo real
- Generación de planes con IA (DeepSeek)
- Portal del cliente (MiPlan, check-ins, progreso, gráficas)
- Onboarding autónomo (link de invitación → registro → vinculación coach)
- Lista de la compra semanal con comparativa de precios por supermercado
- Precios Mercadona scrapeados (~800 alimentos con precio)
- 21 plantillas de entrenamiento con progresión semanal
- Sistema de cuestionarios → IA → plan personalizado
- PWA configurada (manifest, service worker, iconos)

---

## BLOQUE 1 — Despliegue en Vercel (prioridad máxima)

**Por qué primero:** sin esto no puedes probar en iPhone ni dar acceso a clientes reales.

### Pasos (DeepSeek puede hacer la parte técnica)

**1. Subir a GitHub**
```bash
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach

# Merge worktree modulos → main primero
git merge feature/modulos --no-ff -m "merge: modulos → main (sesión 8)"

# Crear repo en GitHub (desde web o CLI)
gh repo create nutricoach --private --source=. --remote=origin --push
# o si ya existe:
git remote add origin https://github.com/[tu-usuario]/nutricoach.git
git push -u origin main
```

**2. Deploy en Vercel**
```bash
npm i -g vercel
cd /Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
vercel
# Seguir el wizard: proyecto nuevo, framework Next.js, directorio raíz "."
```

**3. Variables de entorno en Vercel**
Ir a vercel.com → proyecto → Settings → Environment Variables y añadir:
```
NEXT_PUBLIC_SUPABASE_URL        → (valor de .env.local)
NEXT_PUBLIC_SUPABASE_ANON_KEY   → (valor de .env.local)
SUPABASE_SERVICE_ROLE_KEY       → (valor de .env.local)
DEEPSEEK_API_KEY                → (valor de .env.local)
GEMINI_API_KEY                  → (valor de .env.local)
UNSPLASH_ACCESS_KEY             → (valor de .env.local, si existe)
```

**4. Probar en iPhone**
- Abrir URL de Vercel en Safari iPhone
- "Añadir a pantalla de inicio" → comprueba que instala como PWA (icono, sin barra de navegación)
- Probar flujo completo como coach: login → recetas → clientes → dietas
- Probar flujo cliente: portal → mi plan → lista de la compra → check-in

**5. Supabase — añadir URL de Vercel como dominio permitido**
En Supabase → Authentication → URL Configuration:
- Site URL: `https://[tu-app].vercel.app`
- Redirect URLs: añadir `https://[tu-app].vercel.app/**`

---

## BLOQUE 2 — Técnico inmediato (DeepSeek esta semana)

Ver `docs/PLAN_DEEPSEEK_10-05-2026.md` para comandos exactos. Resumen:

| Tarea | Esfuerzo | Impacto |
|-------|----------|---------|
| Verificar Mercadona (revisar SQL) | 5 min | Alto — confirma que precios están en BD |
| Backfill recetas (un comando) | 10 min | Medio — rellena instrucciones vacías |
| Arreglar Consum scraper | 2-4h | Alto — 2º supermercado español por cuota |
| Arreglar Carrefour scraper | 2-4h | Alto — el más grande |
| Arreglar Día, Alcampo, Eroski | 1-2h c/u | Medio |
| Aldi scraper (nuevo) | 2h | Medio |
| Flujo cuestionario → IA (probar) | 30 min | Alto — feature core |

---

## BLOQUE 3 — Producto pendiente

Estas funcionalidades faltan o están incompletas:

### 3a — PDF del plan de dieta (ya existe, mejorar)
El PDF existe pero puede mejorar:
- Añadir logo NutriCoach / logo personal
- Incluir lista de la compra del plan al final del PDF
- Sección de entrenamiento dentro del mismo PDF si el plan incluye entreno

**Archivo:** `components/diet/PlanPDF.tsx` (o similar)

### 3b — Imágenes de recetas
Las imágenes actuales son de Unsplash (genéricas) o IA (estética incorrecta).
Carlos quiere fotos de estilo casero/real.

**Opción A:** Scraper de fotos desde las URLs de origen de cada receta (ya hay script `scripts/scrapear-imagenes-recetas.mjs`)
```bash
cd nutricoach
node scripts/scrapear-imagenes-recetas.mjs --reset
# Revisar salidas/revision-imagenes/revision.html → aprobar → subir
```

**Opción B:** Subir fotos manualmente desde el editor de recetas.

### 3c — Email de bienvenida al cliente
Cuando un cliente se registra vía invitación, actualmente no recibe email.
Implementar con Resend (gratuito hasta 3.000 emails/mes):
```bash
npm install resend
```
- Crear cuenta en resend.com
- Añadir `RESEND_API_KEY` a .env.local y Vercel
- Enviar email en `app/api/registro-invitacion/route.ts` después del INSERT

### 3d — Notificaciones push (futuro, no urgente)
Para recordar check-ins semanales. Requiere Web Push API + service worker.
Dejar para después del primer cliente real.

### 3e — Macro de "al gusto" en recetas
Algunos ingredientes scraped tienen cantidad=null (sal, especias "al gusto").
El sistema ya les asigna 5g por defecto. Verificar que los macros salen razonables.

---

## BLOQUE 4 — Datos y contenido

### 4a — Completar el 22% de alimentos sin macros
801/1026 alimentos tienen macros. Los 225 restantes tienen calorias=0.
Muchos son legítimamente 0 (sal, vinagre, agua). Los que no → enriquecer con IA:

```bash
node scripts/enriquecer-alimentos.mjs --limite=50
```

Ejecutar en varias pasadas hasta completar los que realmente faltan.

### 4b — Más recetas
Actualmente ~98 recetas en Supabase. Objetivo: 200+.
- Importar via URL desde recetasdecocina.elmundo.es, directoalpaladar.com, recetasgratis.net
- El scraper ya funciona (con el fix de esta sesión)
- En `/recetas/nueva` → pegar URL → auto-crear

### 4c — Añadir alimentos BEDCA que faltan
La BD tiene 77 alimentos BEDCA de los ~1000 disponibles.
El CSV completo de BEDCA está en `scripts/` (o buscar en bedca.net).
Importar más alimentos base para mejorar el matching de recetas.

---

## BLOQUE 5 — Primeros clientes reales

### Semana 1 post-Vercel: Carlos como cliente beta
1. Crear cuenta cliente con tu propio email secundario
2. Rellenar cuestionario como si fueras cliente nuevo
3. Generar plan con IA
4. Probar portal desde iPhone como cliente
5. Anotar todo lo que no funciona o es confuso

### Semana 2: 1-2 clientes reales
- Elegir clientes existentes de Harbiz que estés atendiendo
- Migrar su información a NutriCoach manualmente
- Darles acceso vía link de invitación
- Seguimiento durante 1 semana → feedback

### Métricas a monitorear
- ¿El cliente entiende el portal sin explicación?
- ¿La lista de la compra es útil? ¿La usan?
- ¿El PDF es presentable para mandar por WhatsApp?
- ¿Los macros del plan generado por IA son razonables?

---

## PRIORIDADES ABSOLUTAS (orden de ejecución)

```
1. [ ] Vercel deploy (hoy/mañana) → URL real → prueba iPhone
2. [ ] Verificar Mercadona precios en BD (SQL rápido)
3. [ ] Backfill recetas (un comando)
4. [ ] Flujo cuestionario → IA → probar end-to-end
5. [ ] Scrapers Consum + Carrefour (más datos de precios)
6. [ ] Email de bienvenida a clientes (Resend, gratuito)
7. [ ] 1 cliente beta real
```

---

## Arquitectura de costes actuales (mensual)

| Servicio | Coste | Límite gratuito |
|----------|-------|-----------------|
| Vercel | 0€ | Hobby plan (suficiente para beta) |
| Supabase | 0€ | Free tier (500MB, 50.000 MAU) |
| DeepSeek API | ~$0.5-2/mes | Según uso de generación de dietas |
| Gemini API | 0€ | AI Studio free tier |
| Unsplash | 0€ | 50 req/hora |
| Resend | 0€ | 3.000 emails/mes |
| **Total** | **~1-2€/mes** | Para los primeros 10-20 clientes |

---

## Lo que esto sustituye

Harbiz → 22,50€/mes por funcionalidad limitada.
NutriCoach a escala de 10 clientes → ~1-2€/mes con más control y features propias.
Break-even: desde el primer cliente activo.
