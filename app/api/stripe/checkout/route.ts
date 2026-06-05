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
