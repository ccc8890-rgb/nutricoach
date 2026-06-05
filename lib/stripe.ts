import Stripe from 'stripe'

let _stripe: Stripe | undefined

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: '2026-05-27.dahlia' as any,
    })
  }
  return _stripe
}

// Alias para compatibilidad con imports existentes
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop: string | symbol) {
    return getStripe()[prop as keyof Stripe]
  },
})

export const PLANES = {
  base:  { nombre: 'Plan Base',  descripcion: 'Trimestral — 3 meses', precio_eur: 300 },
  pro:   { nombre: 'Plan Pro',   descripcion: 'Semestral — 6 meses',  precio_eur: 500 },
  ultra: { nombre: 'Plan Ultra', descripcion: 'Anual — 12 meses',     precio_eur: 800 },
} as const

export type PlanTipo = keyof typeof PLANES
