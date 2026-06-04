# Spec: Stripe Payments + Landing + Domain Migration
**Fecha:** 05-06-2026
**Objetivo:** Eliminar Framer (12€/mes) y Harbiz (25€/mes) consolidando pagos y landing en NutriCoach. Ahorro total: ~37€/mes.

---

## 1. Contexto

Carlos opera como dietista independiente. Actualmente:
- **Framer**: landing en casanovanutrition.com (12€/mes) — contenido capturado en `docs/landing/framer-contenido-referencia.md`
- **Harbiz**: gestión de clientes + cobro de mensualidades (25€/mes)
- **NutriCoach**: app Next.js en Vercel (gratis) con portal cliente, planes, entrenos, check-ins

La app ya tiene todo el stack funcional de Harbiz. Solo faltan los pagos y apuntar el dominio.

---

## 2. Alcance

### Incluido
1. **Stripe Payments** — cobro de suscripciones/planes con dos flujos
2. **Landing page mínima** en `/` — hero + features + precios + WhatsApp (contenido de Framer)
3. **Domain migration** — casanovanutrition.com → Vercel

### Excluido (para después)
- Rediseño visual de la landing (Carlos decidirá estilo cuando lo tenga claro)
- App nativa iOS/Android (se mantiene PWA por ahora)
- Gestión de renovaciones / cancelaciones automáticas (v2)

---

## 3. Flujos de pago

### Flujo A — Checkout público
```
Landing (/) → elige plan → Stripe Checkout (redirect)
  → cliente paga con tarjeta
  → Stripe dispara webhook checkout.session.completed
  → NutriCoach crea cuenta Supabase (auth + perfil cliente)
  → envía email "Bienvenido — accede a tu portal"
  → cliente completa onboarding → IA genera plan → Carlos aprueba
```

### Flujo C — Payment link desde dashboard
```
Coach en /clientes → "Generar link de pago"
  → introduce precio libre (ej: 180€) + descripción opcional
  → Stripe crea Payment Link (precio único, no recurrente)
  → Carlos copia y manda por WhatsApp/email
  → cliente paga → webhook → activa cuenta (si ya existe) o la crea
```

**Precio libre**: el coach introduce cualquier cifra. Los planes BASE/PRO/ULTRA son atajos con precio prerellenado, siempre editables. Permite descuentos personalizados por cliente.

---

## 4. Piezas técnicas

### 4.1 Variables de entorno (añadir a Vercel + .env.local)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 4.2 Tabla BD — columnas nuevas en `clientes`
```sql
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS plan_tipo TEXT CHECK (plan_tipo IN ('base','pro','ultra','custom'));
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS plan_precio NUMERIC(8,2);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_inicio_plan TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fecha_fin_plan TIMESTAMPTZ;
```

### 4.3 API routes

| Ruta | Método | Qué hace |
|------|---------|----------|
| `/api/stripe/checkout` | POST | Crea Stripe Checkout Session para flujo A |
| `/api/stripe/payment-link` | POST | Genera Payment Link para flujo C (auth coach) |
| `/api/stripe/webhook` | POST | Recibe eventos Stripe, activa/crea cuentas |

### 4.4 Lógica del webhook (`checkout.session.completed`)
1. Extraer `customer_email`, `amount_total`, `metadata.plan_tipo`, `metadata.cliente_id`
2. Si `metadata.cliente_id` existe → flujo C: actualizar cliente existente en tabla `clientes` (`activo=true`, guardar Stripe IDs, `plan_tipo`, `plan_precio`)
3. Si no → flujo A: crear usuario Supabase auth (Admin API) + insertar fila en tabla `clientes` + llamar `sendWelcomeEmail()` existente con link al onboarding (`/onboarding?codigo=...`)
4. Guardar `stripe_customer_id` y `stripe_subscription_id` en BD

### 4.5 UI coach — generador de payment links
Ubicación: `app/clientes/page.tsx` — botón "Generar link de pago" en toolbar.

Modal con:
- Selector plan: BASE (prerellenado con precio estándar) / PRO / ULTRA / Personalizado
- Campo precio (€) — siempre editable
- Campo descripción opcional (ej: "Plan 3 meses recomposición")
- Campo email cliente (si no está en la lista) — se pasa como `metadata.cliente_id` en el Payment Link para que el webhook lo identifique
- Botón "Generar" → copia link al portapapeles

### 4.6 Landing page mínima en `/`

La ruta `/` ya tiene lógica de redirect:
- Si coach autenticado → `/dashboard`
- Si cliente autenticado → `/cliente`
- Si no autenticado → mostrar landing

**Secciones (en orden):**
1. Hero: logo CN + tagline "MÉTODO · CONSTANCIA · EVOLUCIÓN" + CTA "Empieza ya" + WhatsApp
2. Características de la app (8 puntos de Framer)
3. Proceso 3 fases (Reprogramación → Optimización → Integración)
4. Para quién es (4 perfiles)
5. Testimonios (Maria, Dani, Matias)
6. Planes y precios — 3 cards (BASE/PRO/ULTRA) con botón de Stripe Checkout
7. FAQ (6 preguntas)
8. Footer con WhatsApp + email

**Diseño**: functional first — CSS variables y estilos actuales de NutriCoach. Sin rediseño visual por ahora.

---

## 5. Domain migration (manual, no código)

**Pasos:**
1. En Vercel → proyecto nutricoach → Settings → Domains → añadir `casanovanutrition.com`
2. Vercel muestra los registros DNS a configurar (normalmente CNAME o A record)
3. En el registrador del dominio → actualizar DNS con los valores de Vercel
4. En Framer → eliminar dominio custom (para dejar de pagar)
5. Propagación DNS: 5-60 minutos

**Resultado**: casanovanutrition.com sirve la app Next.js. Framer queda sin dominio custom → baja al plan gratis o se cancela.

---

## 6. Stripe — configuración previa (manual antes de implementar)

1. Crear cuenta en stripe.com (o usar la existente)
2. Crear 3 productos: "Plan Base", "Plan Pro", "Plan Ultra" — con precio estándar de referencia (editable después)
3. Copiar las API keys (live mode para producción, test mode para desarrollo)
4. Configurar webhook endpoint: `https://nutricoach-delta.vercel.app/api/stripe/webhook`
5. Activar evento: `checkout.session.completed`
6. Copiar webhook signing secret

---

## 7. Criterios de éxito

- [ ] Un cliente puede ir a casanovanutrition.com, elegir un plan y pagar con tarjeta
- [ ] Tras el pago, recibe un email con acceso al portal y completa el onboarding
- [ ] Carlos puede generar un link de pago con precio libre desde `/clientes`
- [ ] El webhook activa correctamente tanto cuentas nuevas (flujo A) como existentes (flujo C)
- [ ] casanovanutrition.com apunta a Vercel (Framer desvinculado)
- [ ] 0 errores TypeScript, build verde
