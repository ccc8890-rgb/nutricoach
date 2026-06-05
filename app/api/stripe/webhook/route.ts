import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createServiceSupabase } from '@/lib/supabase-server'
import { sendWelcomeEmail } from '@/lib/emails/welcome'

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

  // Flujo C: activate existing client
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

  // Flujo A: create new account
  if (!email) return

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

  await db.from('profiles').upsert({
    id: userId,
    email,
    nombre: nombreMeta,
    role: 'cliente',
  })

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

  await sendWelcomeEmail({
    to: email,
    nombre: nombreMeta,
    appUrl: inviteUrl,
  })
}
