# Stripe Payments + Landing + Domain Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar Framer (12€/mes) y Harbiz (25€/mes) integrando pagos Stripe y landing en NutriCoach, apuntando casanovanutrition.com a Vercel.

**Architecture:** Landing pública en `/` con botones de Stripe Checkout. Webhook en `/api/stripe/webhook` crea cuentas nuevas (flujo A) o activa existentes (flujo C). Coach genera links de precio libre desde `/clientes`. Domain migration es manual (DNS).

**Tech Stack:** Next.js 14 App Router, Stripe SDK (stripe@latest), Supabase Admin API, Resend (ya instalado), Tailwind CSS.

---

## Archivos del proyecto

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Crear | `lib/stripe.ts` | Cliente Stripe + constantes planes |
| Crear | `app/api/stripe/checkout/route.ts` | Crea Checkout Session (flujo A público) |
| Crear | `app/api/stripe/payment-link/route.ts` | Genera link pago precio libre (flujo C coach) |
| Crear | `app/api/stripe/webhook/route.ts` | Recibe eventos Stripe, crea/activa cuentas |
| Crear | `app/pago-completado/page.tsx` | Página de éxito post-pago |
| Crear | `components/landing/LandingPage.tsx` | Landing completa con contenido de Framer |
| Crear | `components/coach/GenerarLinkPagoModal.tsx` | Modal coach para generar link precio libre |
| Crear | `supabase/migrations/20260605_stripe_columns.sql` | Columnas Stripe en tabla clientes |
| Modificar | `app/page.tsx` | Usar LandingPage en lugar del placeholder |
| Modificar | `app/clientes/page.tsx` | Añadir botón "Generar link de pago" |
| Modificar | `types/index.ts` | Añadir campos Stripe a interfaz Cliente |

---

## Task 0: Manual — Configurar Stripe (prerequisito antes de codificar)

> ⚠️ Sin esto el código no funciona. Hacerlo antes de Task 1.

- [ ] **Paso 1: Crear cuenta Stripe**
  - Ir a stripe.com → crear cuenta o acceder a la existente
  - Activar modo **Live** cuando esté listo para producción (usar Test mode durante desarrollo)

- [ ] **Paso 2: Crear 3 productos en Stripe Dashboard**
  - Products → Add product
  - Producto 1: nombre "Plan Base", precio €300.00, pago único, moneda EUR
  - Producto 2: nombre "Plan Pro", precio €500.00, pago único, moneda EUR  
  - Producto 3: nombre "Plan Ultra", precio €800.00, pago único, moneda EUR
  - *(Los precios son de referencia — Carlos los cambia cuando tenga estudio de mercado)*

- [ ] **Paso 3: Obtener API keys**
  - Stripe Dashboard → Developers → API keys
  - Copiar: `Publishable key` (pk_test_...) y `Secret key` (sk_test_...)

- [ ] **Paso 4: Registrar webhook endpoint**
  - Stripe Dashboard → Developers → Webhooks → Add endpoint
  - URL: `https://nutricoach-delta.vercel.app/api/stripe/webhook`
  - Evento a escuchar: `checkout.session.completed`
  - Copiar el `Signing secret` (whsec_...)

- [ ] **Paso 5: Añadir variables a .env.local**
  ```bash
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
  ```

- [ ] **Paso 6: Añadir las mismas variables a Vercel Production**
  ```bash
  vercel env add STRIPE_SECRET_KEY production
  vercel env add STRIPE_WEBHOOK_SECRET production
  vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
  ```

---

## Task 1: Instalar Stripe SDK + lib/stripe.ts

**Files:**
- Modify: `package.json` (via npm install)
- Create: `lib/stripe.ts`

- [ ] **Paso 1: Instalar dependencias**
  ```bash
  cd nutricoach
  npm install stripe
  ```
  Expected: stripe aparece en `dependencies` en package.json.

- [ ] **Paso 2: Crear lib/stripe.ts**
  ```typescript
  import Stripe from 'stripe'

  export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-04-10',
  })

  export const PLANES = {
    base:  { nombre: 'Plan Base',  descripcion: 'Trimestral — 3 meses', precio_eur: 300 },
    pro:   { nombre: 'Plan Pro',   descripcion: 'Semestral — 6 meses',  precio_eur: 500 },
    ultra: { nombre: 'Plan Ultra', descripcion: 'Anual — 12 meses',     precio_eur: 800 },
  } as const

  export type PlanTipo = keyof typeof PLANES
  ```

- [ ] **Paso 3: Verificar TypeScript**
  ```bash
  npx tsc --noEmit --pretty false 2>&1 | head -20
  ```
  Expected: 0 errores relacionados con stripe.

- [ ] **Paso 4: Commit**
  ```bash
  git add package.json package-lock.json lib/stripe.ts
  git commit -m "feat: instalar stripe SDK + constantes de planes"
  ```

---

## Task 2: SQL migration — columnas Stripe en clientes

**Files:**
- Create: `supabase/migrations/20260605_stripe_columns.sql`

- [ ] **Paso 1: Crear migration**
  ```sql
  -- supabase/migrations/20260605_stripe_columns.sql
  ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS plan_tipo                TEXT CHECK (plan_tipo IN ('base','pro','ultra','custom')),
    ADD COLUMN IF NOT EXISTS plan_precio              NUMERIC(8,2),
    ADD COLUMN IF NOT EXISTS fecha_inicio_plan        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pagado_via_stripe        BOOLEAN DEFAULT false;
  ```
  *(Nota: `tipo_membresia`, `fecha_inicio_membresia`, `fecha_fin_membresia` ya existen desde sesión 46 — no duplicar)*

- [ ] **Paso 2: Aplicar en Supabase**
  - Supabase Dashboard → SQL Editor → pegar el contenido del archivo → Run

- [ ] **Paso 3: Actualizar interfaz Cliente en types/index.ts**
  Buscar `export interface Cliente {` (línea 14) y añadir al final del bloque, antes del cierre `}`:
  ```typescript
  // Stripe
  stripe_customer_id?: string
  stripe_payment_intent_id?: string
  plan_tipo?: 'base' | 'pro' | 'ultra' | 'custom'
  plan_precio?: number
  fecha_inicio_plan?: string
  pagado_via_stripe?: boolean
  ```

- [ ] **Paso 4: Commit**
  ```bash
  git add supabase/migrations/20260605_stripe_columns.sql types/index.ts
  git commit -m "feat: columnas Stripe en tabla clientes + tipos TS"
  ```

---

## Task 3: Webhook handler

**Files:**
- Create: `app/api/stripe/webhook/route.ts`

Este es el núcleo. Recibe `checkout.session.completed` de Stripe y:
- Si `metadata.cliente_id` → activa cliente existente (flujo C)
- Si no → crea cuenta nueva vía Supabase Admin API (flujo A)

- [ ] **Paso 1: Crear directorio y archivo**
  ```bash
  mkdir -p app/api/stripe/webhook
  ```

- [ ] **Paso 2: Crear app/api/stripe/webhook/route.ts**
  ```typescript
  import { NextResponse } from 'next/server'
  import Stripe from 'stripe'
  import { stripe } from '@/lib/stripe'
  import { createServiceSupabase } from '@/lib/supabase-server'
  import { sendWelcomeEmail } from '@/lib/emails/welcome'

  // Next.js App Router: leer body como texto para verificar firma Stripe
  export const dynamic = 'force-dynamic'

  export async function POST(request: Request) {
    const body = await request.text()
    const sig = request.headers.get('stripe-signature')

    if (!sig) {
      return NextResponse.json({ error: 'Sin firma Stripe' }, { status: 400 })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      await handleCheckoutCompleted(session)
    }

    return NextResponse.json({ received: true })
  }

  async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const db = createServiceSupabase()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nutricoach-delta.vercel.app'

    const email = session.customer_details?.email ?? session.customer_email
    const clienteId = session.metadata?.cliente_id
    const planTipo = (session.metadata?.plan_tipo ?? 'custom') as 'base' | 'pro' | 'ultra' | 'custom'
    const precio = (session.amount_total ?? 0) / 100
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

    // ── Flujo C: activar cliente existente ──────────────────────────────
    if (clienteId) {
      await db.from('clientes').update({
        activo: true,
        stripe_customer_id: stripeCustomerId,
        stripe_payment_intent_id: paymentIntentId,
        plan_tipo: planTipo,
        plan_precio: precio,
        fecha_inicio_plan: new Date().toISOString(),
        pagado_via_stripe: true,
      }).eq('id', clienteId)
      return
    }

    // ── Flujo A: crear cuenta nueva ──────────────────────────────────────
    if (!email) return

    // Generar invite link (sin enviar email de Supabase — lo enviamos nosotros)
    const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${appUrl}/onboarding` },
    })

    if (linkError || !linkData) {
      console.error('[webhook] Error generando invite link:', linkError)
      return
    }

    const userId = linkData.user.id
    const inviteUrl = linkData.properties.action_link
    const nombreMeta = session.metadata?.nombre ?? email.split('@')[0]

    // Crear profile
    await db.from('profiles').upsert({
      id: userId,
      email,
      nombre: nombreMeta,
      role: 'cliente',
    })

    // Crear cliente
    await db.from('clientes').insert({
      profile_id: userId,
      coach_id: process.env.NUTRICOACH_COACH_ID!,
      activo: true,
      onboarding_completado: false,
      stripe_customer_id: stripeCustomerId,
      stripe_payment_intent_id: paymentIntentId,
      plan_tipo: planTipo,
      plan_precio: precio,
      fecha_inicio_plan: new Date().toISOString(),
      pagado_via_stripe: true,
    })

    // Email de bienvenida con el invite link como URL de acceso
    await sendWelcomeEmail({
      to: email,
      nombre: nombreMeta,
      appUrl: inviteUrl,
    })
  }
  ```

- [ ] **Paso 3: Verificar TypeScript**
  ```bash
  npx tsc --noEmit --pretty false 2>&1 | head -20
  ```
  Expected: 0 errores.

- [ ] **Paso 4: Commit**
  ```bash
  git add app/api/stripe/webhook/route.ts
  git commit -m "feat: webhook Stripe — crea cuentas (flujo A) y activa existentes (flujo C)"
  ```

---

## Task 4: Checkout Session API (flujo A público)

**Files:**
- Create: `app/api/stripe/checkout/route.ts`

- [ ] **Paso 1: Crear directorio y archivo**
  ```bash
  mkdir -p app/api/stripe/checkout
  ```

- [ ] **Paso 2: Crear app/api/stripe/checkout/route.ts**
  ```typescript
  import { NextResponse } from 'next/server'
  import { stripe, PLANES, PlanTipo } from '@/lib/stripe'

  export async function POST(request: Request) {
    const { plan_tipo, email } = await request.json() as {
      plan_tipo: string
      email?: string
    }

    const plan = PLANES[plan_tipo as PlanTipo]
    if (!plan) {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email || undefined,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: plan.nombre,
            description: plan.descripcion,
          },
          unit_amount: plan.precio_eur * 100,
        },
        quantity: 1,
      }],
      metadata: { plan_tipo },
      success_url: `${appUrl}/pago-completado?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/#precios`,
    })

    return NextResponse.json({ url: session.url })
  }
  ```

- [ ] **Paso 3: Crear página de éxito app/pago-completado/page.tsx**
  ```typescript
  export default function PagoCompletado() {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(160deg, #F7F7F9 0%, #EDEDF0 100%)' }}>
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text)' }}>
            ¡Pago completado!
          </h1>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
            Recibirás un email en los próximos minutos con el enlace de acceso a tu portal personalizado.
            Si no lo ves, revisa la carpeta de spam.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            ¿Dudas? Escríbenos a{' '}
            <a href="mailto:ccc8890@gmail.com" className="underline">ccc8890@gmail.com</a>
          </p>
        </div>
      </div>
    )
  }
  ```

- [ ] **Paso 4: Verificar TypeScript**
  ```bash
  npx tsc --noEmit --pretty false 2>&1 | head -20
  ```

- [ ] **Paso 5: Commit**
  ```bash
  git add app/api/stripe/checkout/route.ts app/pago-completado/page.tsx
  git commit -m "feat: API checkout Stripe (flujo A) + página pago completado"
  ```

---

## Task 5: Payment Link API (flujo C — coach)

**Files:**
- Create: `app/api/stripe/payment-link/route.ts`

- [ ] **Paso 1: Crear directorio y archivo**
  ```bash
  mkdir -p app/api/stripe/payment-link
  ```

- [ ] **Paso 2: Crear app/api/stripe/payment-link/route.ts**
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { createApiSupabase } from '@/lib/supabase-server'
  import { stripe } from '@/lib/stripe'

  export async function POST(request: NextRequest) {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { cliente_id, precio_eur, descripcion, email_cliente } = await request.json() as {
      cliente_id?: string
      precio_eur: number
      descripcion?: string
      email_cliente?: string
    }

    if (!precio_eur || precio_eur <= 0) {
      return NextResponse.json({ error: 'Precio inválido' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email_cliente || undefined,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: descripcion || 'Plan Casanova Nutrition',
          },
          unit_amount: Math.round(precio_eur * 100),
        },
        quantity: 1,
      }],
      metadata: {
        cliente_id: cliente_id ?? '',
        plan_tipo: 'custom',
      },
      success_url: `${appUrl}/pago-completado?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/clientes`,
    })

    return NextResponse.json({ url: session.url })
  }
  ```

- [ ] **Paso 3: Verificar TypeScript**
  ```bash
  npx tsc --noEmit --pretty false 2>&1 | head -20
  ```

- [ ] **Paso 4: Commit**
  ```bash
  git add app/api/stripe/payment-link/route.ts
  git commit -m "feat: API payment link precio libre (flujo C coach)"
  ```

---

## Task 6: Modal GenerarLinkPago (UI coach)

**Files:**
- Create: `components/coach/GenerarLinkPagoModal.tsx`

- [ ] **Paso 1: Crear directorio y archivo**
  ```bash
  mkdir -p components/coach
  ```

- [ ] **Paso 2: Crear components/coach/GenerarLinkPagoModal.tsx**
  ```typescript
  'use client'
  import { useState } from 'react'
  import { PLANES, PlanTipo } from '@/lib/stripe'

  interface Props {
    open: boolean
    onClose: () => void
    /** Si se pasa, el link se vincula a ese cliente */
    clienteId?: string
    clienteEmail?: string
    clienteNombre?: string
  }

  export default function GenerarLinkPagoModal({ open, onClose, clienteId, clienteEmail, clienteNombre }: Props) {
    const [precio, setPrecio] = useState('')
    const [descripcion, setDescripcion] = useState('')
    const [email, setEmail] = useState(clienteEmail ?? '')
    const [loading, setLoading] = useState(false)
    const [linkGenerado, setLinkGenerado] = useState('')
    const [copiado, setCopiado] = useState(false)

    if (!open) return null

    function aplicarPlan(plan: PlanTipo) {
      setPrecio(String(PLANES[plan].precio_eur))
      setDescripcion(PLANES[plan].nombre + ' — ' + PLANES[plan].descripcion)
    }

    async function generar() {
      const precioNum = parseFloat(precio)
      if (!precioNum || precioNum <= 0) return alert('Introduce un precio válido')
      setLoading(true)
      try {
        const res = await fetch('/api/stripe/payment-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cliente_id: clienteId,
            precio_eur: precioNum,
            descripcion: descripcion || undefined,
            email_cliente: email || undefined,
          }),
        })
        const data = await res.json()
        if (data.url) setLinkGenerado(data.url)
        else alert('Error generando el link')
      } finally {
        setLoading(false)
      }
    }

    async function copiar() {
      await navigator.clipboard.writeText(linkGenerado)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4"
          style={{ background: 'var(--surface)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Generar link de pago
            </h2>
            <button onClick={onClose} className="text-xl" style={{ color: 'var(--text-secondary)' }}>×</button>
          </div>

          {clienteNombre && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Para: <strong>{clienteNombre}</strong>
            </p>
          )}

          {/* Atajos de plan */}
          <div>
            <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Atajos de plan
            </p>
            <div className="flex gap-2">
              {(Object.keys(PLANES) as PlanTipo[]).map(p => (
                <button key={p} onClick={() => aplicarPlan(p)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg)' }}>
                  {PLANES[p].nombre}<br />
                  <span className="font-bold">{PLANES[p].precio_eur}€</span>
                </button>
              ))}
            </div>
          </div>

          {/* Precio libre */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              Precio (€)
            </label>
            <input type="number" value={precio} onChange={e => setPrecio(e.target.value)}
              placeholder="Ej: 180" min="1"
              className="input w-full" autoComplete="off" />
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              Descripción (opcional)
            </label>
            <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Ej: Plan personalizado 3 meses"
              className="input w-full" autoComplete="off" />
          </div>

          {/* Email si no hay cliente */}
          {!clienteId && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                Email del cliente (opcional)
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="input w-full" autoComplete="off" />
            </div>
          )}

          {/* Link generado */}
          {linkGenerado ? (
            <div className="space-y-2">
              <input readOnly value={linkGenerado}
                className="input w-full text-xs" style={{ color: 'var(--text-secondary)' }} />
              <button onClick={copiar}
                className="btn-primary w-full">
                {copiado ? '✓ Copiado' : 'Copiar link'}
              </button>
            </div>
          ) : (
            <button onClick={generar} disabled={loading || !precio}
              className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Generando…' : 'Generar link'}
            </button>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Paso 3: Verificar TypeScript**
  ```bash
  npx tsc --noEmit --pretty false 2>&1 | head -20
  ```

- [ ] **Paso 4: Commit**
  ```bash
  git add components/coach/GenerarLinkPagoModal.tsx
  git commit -m "feat: modal GenerarLinkPago con precio libre y atajos de plan"
  ```

---

## Task 7: Botón en /clientes

**Files:**
- Modify: `app/clientes/page.tsx`

- [ ] **Paso 1: Localizar dónde está el toolbar de /clientes**
  ```bash
  grep -n "ClientesToolbar\|toolbar\|Generar\|btn-primary" app/clientes/page.tsx | head -15
  ```

- [ ] **Paso 2: Añadir import y estado del modal**
  En `app/clientes/page.tsx`, añadir al bloque de imports:
  ```typescript
  import GenerarLinkPagoModal from '@/components/coach/GenerarLinkPagoModal'
  ```
  
  En el componente, añadir estado:
  ```typescript
  const [modalLinkOpen, setModalLinkOpen] = useState(false)
  ```

- [ ] **Paso 3: Añadir botón en la toolbar, junto a los filtros existentes**
  Buscar el botón más prominente de la toolbar (probablemente cerca del buscador) y añadir:
  ```tsx
  <button
    onClick={() => setModalLinkOpen(true)}
    className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2 whitespace-nowrap">
    <span>＋</span> Generar link de pago
  </button>
  ```

- [ ] **Paso 4: Añadir el modal al final del JSX (antes del cierre del return)**
  ```tsx
  <GenerarLinkPagoModal
    open={modalLinkOpen}
    onClose={() => setModalLinkOpen(false)}
  />
  ```

- [ ] **Paso 5: Verificar TypeScript y build**
  ```bash
  npx tsc --noEmit --pretty false 2>&1 | head -20
  ```

- [ ] **Paso 6: Commit**
  ```bash
  git add app/clientes/page.tsx
  git commit -m "feat: botón generar link de pago en /clientes"
  ```

---

## Task 8: Landing page

**Files:**
- Create: `components/landing/LandingPage.tsx`
- Modify: `app/page.tsx`

El contenido viene de `docs/landing/framer-contenido-referencia.md`.
El diseño usa las CSS variables actuales de la app (var(--text), var(--surface), var(--bg), etc).

- [ ] **Paso 1: Crear directorio**
  ```bash
  mkdir -p components/landing
  ```

- [ ] **Paso 2: Crear components/landing/LandingPage.tsx**
  ```typescript
  'use client'
  import { useState } from 'react'

  const PLANES_LANDING = [
    {
      id: 'base' as const,
      nombre: 'Plan Base',
      periodo: 'Trimestral',
      precio: 300,
      features: [
        'Nutrición diseñada para tu estilo de vida',
        'Acceso a la app exclusiva',
        'Libro de recetas premium',
        'Chat directo',
        'Seguimiento y ajustes periódicos',
        'Entrenamiento estructurado',
      ],
    },
    {
      id: 'pro' as const,
      nombre: 'Plan Pro',
      periodo: 'Semestral',
      precio: 500,
      destacado: true,
      features: [
        'Todo lo del Plan Base',
        'Seguimiento más frecuente',
        'Ajustes dinámicos por fase',
        'Archivo premium de recursos',
        'Acompañamiento prioritario',
      ],
    },
    {
      id: 'ultra' as const,
      nombre: 'Plan Ultra',
      periodo: 'Anual',
      precio: 800,
      features: [
        'Todo lo del Plan Pro',
        'Plan detallado año completo',
        'Acceso total a todos los módulos',
        'Soporte 7 días / semana',
        'Revisiones ilimitadas',
      ],
    },
  ]

  const FAQ = [
    {
      q: '¿Cómo funciona el servicio online?',
      a: 'Tras el pago recibirás acceso a tu portal personal. Allí completarás tu perfil y recibirás tu plan en 48-72 horas.',
    },
    {
      q: '¿Es adecuado para mí aunque no haga deporte habitualmente?',
      a: 'Sí. El plan se adapta completamente a tu nivel, disponibilidad y objetivos. No necesitas experiencia previa.',
    },
    {
      q: '¿Cuándo es el mejor momento para empezar?',
      a: 'Ahora. No existe el "momento perfecto". El método está diseñado para adaptarse a tu vida, no al revés.',
    },
    {
      q: '¿Qué pasa si me desmotivo?',
      a: 'Estarás acompañado en todo el proceso. El chat directo permite resolver dudas y ajustar el plan cuando lo necesites.',
    },
    {
      q: '¿Puedo seguirlo con una agenda muy exigente?',
      a: 'Es uno de los pilares del método. Se diseña específicamente para encajar con tus horarios y compromisos.',
    },
    {
      q: '¿Cuánto tarda en llegar mi plan?',
      a: 'Entre 48 y 72 horas tras completar tu perfil en la app.',
    },
  ]

  export default function LandingPage() {
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
    const [faqAbierto, setFaqAbierto] = useState<number | null>(null)

    async function handleComprar(planId: 'base' | 'pro' | 'ultra') {
      setLoadingPlan(planId)
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_tipo: planId }),
        })
        const { url, error } = await res.json()
        if (url) window.location.href = url
        else alert(error || 'Error al iniciar el pago')
      } finally {
        setLoadingPlan(null)
      }
    }

    return (
      <div style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-xl font-bold mb-6"
            style={{ background: 'linear-gradient(135deg,#2C2C2E,#3A3A3C)', color: '#fff', boxShadow: '0 4px 16px rgba(44,44,46,0.2)' }}>
            CN
          </div>
          <div className="flex gap-3 mb-4 text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--text-secondary)' }}>
            <span>MÉTODO</span><span>·</span><span>CONSTANCIA</span><span>·</span><span>EVOLUCIÓN</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 max-w-xl leading-tight">
            Nutrición personalizada que transforma
          </h1>
          <p className="text-lg mb-8 max-w-md" style={{ color: 'var(--text-secondary)' }}>
            Un método basado en ciencia y acompañamiento real. Sin restricciones extremas, con resultados duraderos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="#precios"
              className="inline-flex items-center justify-center px-8 py-3 rounded-xl font-semibold text-sm"
              style={{ background: 'linear-gradient(135deg,#2C2C2E,#3A3A3C)', color: '#fff', boxShadow: '0 2px 8px rgba(44,44,46,0.25)' }}>
              Empieza ya
            </a>
            <a href={`https://wa.me/34697456148`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-3 rounded-xl font-semibold text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
              💬 Escríbeme
            </a>
          </div>
        </section>

        {/* ── PROCESO ────────────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-2">Nuestro proceso</h2>
          <p className="text-center mb-12" style={{ color: 'var(--text-secondary)' }}>Tres fases diseñadas para una transformación sostenible</p>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { num: '01', titulo: 'Reprogramación Corporal', desc: 'Aplicación de sobrecarga progresiva y ajustes nutricionales para mejorar densidad muscular y redefinir composición corporal.' },
              { num: '02', titulo: 'Optimización Metabólica', desc: 'Creación de entorno hormonal favorable mediante ajustes estratégicos para reducción de grasa y preservación muscular.' },
              { num: '03', titulo: 'Integración y Plenitud', desc: 'Educación nutricional y programación sostenible para mantener equilibrio metabólico duradero.' },
            ].map(f => (
              <div key={f.num} className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="text-3xl font-bold mb-3" style={{ color: 'var(--text-secondary)', opacity: 0.4 }}>{f.num}</div>
                <h3 className="font-semibold mb-2">{f.titulo}</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── APP FEATURES ───────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-2">App exclusiva</h2>
          <p className="text-center mb-12" style={{ color: 'var(--text-secondary)' }}>Todo lo que necesitas en un solo lugar</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Dieta y entrenamiento integrados',
              'Plan de nutrición personalizado',
              'Entrenamientos con videos explicativos',
              'Chat directo integrado',
              'Seguimiento continuo y métricas',
              'Ajustes dinámicos por fase',
              'Archivo premium de recursos',
              'Acompañamiento prioritario',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span style={{ color: '#22c55e' }}>✓</span>
                <span className="text-sm">{f}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── PARA QUIÉN ES ──────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">¿Para quién es?</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Buscas una forma física sólida y duradera, no soluciones temporales',
              'Tienes una agenda exigente pero estás comprometido con tu salud',
              'Has probado antes sin conseguir resultados duraderos',
              'Quieres flexibilidad social sin sacrificar tu progreso',
            ].map((t, i) => (
              <div key={i} className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm">{t}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── TESTIMONIOS ────────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">Resultados reales</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { nombre: 'Maria', texto: 'Conseguí mi objetivo de perder 12kg en 12 semanas y estuve acompañada en todo el proceso.' },
              { nombre: 'Dani',  texto: 'Me siento con más energía y seguro de mí mismo. Afronto mi emprendimiento con otro mindset.' },
              { nombre: 'Matias', texto: 'Nunca había sentido un plan tan adaptado a mí. Preciso, claro y transformador.' },
            ].map(t => (
              <div key={t.nombre} className="p-6 rounded-2xl flex flex-col gap-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>"{t.texto}"</p>
                <p className="font-semibold text-sm">{t.nombre}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── PRECIOS ────────────────────────────────────────────────────── */}
        <section id="precios" className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-2">Planes</h2>
          <p className="text-center mb-12" style={{ color: 'var(--text-secondary)' }}>Elige el que mejor se adapta a ti</p>
          <div className="grid sm:grid-cols-3 gap-6">
            {PLANES_LANDING.map(plan => (
              <div key={plan.id}
                className="p-6 rounded-2xl flex flex-col gap-4 relative"
                style={{
                  background: plan.destacado ? 'linear-gradient(135deg,#2C2C2E,#3A3A3C)' : 'var(--surface)',
                  border: plan.destacado ? 'none' : '1px solid var(--border)',
                  color: plan.destacado ? '#fff' : 'var(--text)',
                }}>
                {plan.destacado && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-yellow-400 text-yellow-900">
                    MÁS POPULAR
                  </span>
                )}
                <div>
                  <div className="font-bold text-lg">{plan.nombre}</div>
                  <div className="text-sm opacity-70">{plan.periodo}</div>
                </div>
                <div className="text-3xl font-bold">{plan.precio}€</div>
                <ul className="space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span style={{ color: plan.destacado ? '#86efac' : '#22c55e' }}>✓</span>
                      <span style={{ opacity: plan.destacado ? 0.9 : 1 }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleComprar(plan.id)}
                  disabled={loadingPlan === plan.id}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                  style={plan.destacado
                    ? { background: '#fff', color: '#2C2C2E' }
                    : { background: 'linear-gradient(135deg,#2C2C2E,#3A3A3C)', color: '#fff' }
                  }>
                  {loadingPlan === plan.id ? 'Redirigiendo…' : 'Empezar ahora'}
                </button>
              </div>
            ))}
          </div>
          <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            ¿Tienes dudas antes de elegir?{' '}
            <a href={`https://wa.me/34697456148`} target="_blank" rel="noopener noreferrer"
              className="underline font-medium">
              Agenda una llamada
            </a>
          </p>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section className="max-w-2xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-center mb-12">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border)' }}>
                <button
                  className="w-full text-left px-5 py-4 flex items-center justify-between font-medium text-sm"
                  style={{ background: 'var(--surface)' }}
                  onClick={() => setFaqAbierto(faqAbierto === i ? null : i)}>
                  {item.q}
                  <span style={{ color: 'var(--text-secondary)' }}>{faqAbierto === i ? '−' : '+'}</span>
                </button>
                {faqAbierto === i && (
                  <div className="px-5 py-3 text-sm" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <footer className="text-center px-6 py-10 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold mb-1">Casanova Nutrition</div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Nutrición personalizada basada en ciencia
          </p>
          <div className="flex gap-4 justify-center text-sm">
            <a href={`https://wa.me/34697456148`} target="_blank" rel="noopener noreferrer"
              className="underline" style={{ color: 'var(--text-secondary)' }}>WhatsApp</a>
            <a href="mailto:ccc8890@gmail.com"
              className="underline" style={{ color: 'var(--text-secondary)' }}>Email</a>
          </div>
        </footer>

      </div>
    )
  }
  ```

- [ ] **Paso 3: Actualizar app/page.tsx para usar LandingPage**
  Reemplazar el bloque `// Sin sesión → landing estática aesthetic` y el `return (...)`:
  ```typescript
  import Link from 'next/link'
  import { redirect } from 'next/navigation'
  import { createServerSupabase } from '@/lib/supabase-server'
  import LandingPage from '@/components/landing/LandingPage'

  export default async function HomePage() {
    let user = null
    let role = null

    try {
      const supabase = await createServerSupabase()
      const { data: { user: u } } = await supabase.auth.getUser()
      user = u
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        role = profile?.role
      }
    } catch { /* Sin sesión → mostrar landing */ }

    if (user && role === 'coach') redirect('/dashboard')
    if (user && role === 'cliente') redirect('/cliente')

    return <LandingPage />
  }
  ```

- [ ] **Paso 4: Verificar TypeScript y build completo**
  ```bash
  npx tsc --noEmit --pretty false 2>&1 | head -20
  npm run build 2>&1 | tail -20
  ```
  Expected: 0 errores TS, build verde.

- [ ] **Paso 5: Commit**
  ```bash
  git add components/landing/LandingPage.tsx app/page.tsx
  git commit -m "feat: landing page completa con planes Stripe y contenido de Framer"
  ```

---

## Task 9: Variables de entorno + deploy

- [ ] **Paso 1: Verificar que las vars de Stripe están en Vercel**
  ```bash
  vercel env ls
  ```
  Deben aparecer: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

- [ ] **Paso 2: Deploy a producción**
  ```bash
  git push origin main
  ```
  Vercel desplegará automáticamente.

- [ ] **Paso 3: Registrar webhook en Stripe con URL de producción**
  Si durante el desarrollo se usó localhost, actualizar en Stripe Dashboard → Webhooks:
  - URL: `https://casanovanutrition.com/api/stripe/webhook` (tras migrar el dominio)
  - Evento: `checkout.session.completed`

- [ ] **Paso 4: Probar flujo completo en modo Test**
  - Ir a `casanovanutrition.com` (o la URL de preview de Vercel)
  - Click "Empezar ahora" en Plan Base
  - En Stripe Checkout: usar tarjeta de prueba `4242 4242 4242 4242`, exp. cualquiera, CVV 123
  - Verificar que llega el webhook (Stripe Dashboard → Webhooks → logs)
  - Verificar que se creó un usuario en Supabase → Authentication → Users

---

## Task 10: Domain migration (manual, sin código)

- [ ] **Paso 1: Añadir dominio en Vercel**
  ```
  Vercel Dashboard → proyecto nutricoach → Settings → Domains
  → Add domain: casanovanutrition.com
  → Vercel mostrará los registros DNS a configurar (CNAME o A record)
  ```

- [ ] **Paso 2: Actualizar DNS en el registrador del dominio**
  - Acceder al panel de tu registrador (donde compraste casanovanutrition.com)
  - Actualizar los registros DNS con los valores que indica Vercel
  - Propagación: 5-60 minutos (puede tardar hasta 24h en casos extremos)

- [ ] **Paso 3: Verificar en Vercel**
  - Cuando aparezca ✓ verde en Vercel → dominio activo

- [ ] **Paso 4: Desconectar dominio de Framer**
  - Framer Dashboard → proyecto → Settings → Custom Domain → Remove
  - Framer pasa al plan gratuito sin dominio custom → cancelas o mantienes gratis

- [ ] **Paso 5: Actualizar NEXT_PUBLIC_APP_URL en Vercel**
  ```bash
  vercel env rm NEXT_PUBLIC_APP_URL production
  vercel env add NEXT_PUBLIC_APP_URL production
  # Valor: https://casanovanutrition.com
  ```
  Redeploy:
  ```bash
  git commit --allow-empty -m "chore: trigger redeploy tras actualizar APP_URL" && git push
  ```

---

## Self-review

### Spec coverage
- ✅ Flujo A (checkout público + auto-registro): Tasks 4 + 3
- ✅ Flujo C (payment link precio libre + activar existente): Tasks 5 + 3 + 6 + 7
- ✅ Precio libre editable: Task 6 (atajos + campo editable)
- ✅ Landing page: Task 8
- ✅ Domain migration: Task 10
- ✅ SQL migration: Task 2
- ✅ Variables de entorno: Task 0 + 9

### Consistencia de tipos
- `PlanTipo` definido en `lib/stripe.ts` y usado en `checkout/route.ts`, `GenerarLinkPagoModal.tsx`
- `Cliente` interface actualizada en Task 2 con los mismos campos que el SQL
- `stripe_customer_id`, `stripe_payment_intent_id` — nombres consistentes en SQL, TS y webhook

### Sin placeholders
- Todos los pasos tienen código concreto
- Las constantes de planes (precios) son editables en `lib/stripe.ts` → un solo punto de cambio
