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
