import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

export const PLANES = {
  base:  { nombre: 'Plan Base',  descripcion: 'Trimestral — 3 meses', precio_eur: 300 },
  pro:   { nombre: 'Plan Pro',   descripcion: 'Semestral — 6 meses',  precio_eur: 500 },
  ultra: { nombre: 'Plan Ultra', descripcion: 'Anual — 12 meses',     precio_eur: 800 },
} as const

export type PlanTipo = keyof typeof PLANES
