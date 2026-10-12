import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { MARCAS, rmDesdeCincoReps, validarMarcas } from '@/lib/entrenos/marcas'

async function clienteDeLaSesion(request: NextRequest) {
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return null
  const admin = createServiceSupabase()
  const { data } = await admin.from('clientes').select('id').eq('profile_id', user.id).maybeSingle()
  return data ? { admin, clienteId: data.id as string } : null
}

/** «Mis marcas» del propio atleta. */
export async function GET(request: NextRequest) {
  const c = await clienteDeLaSesion(request)
  if (!c) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { data } = await c.admin.from('perfil_entreno_cliente').select('marcas').eq('cliente_id', c.clienteId).maybeSingle()
  return NextResponse.json({ existe: !!data, marcas: (data?.marcas as Record<string, number> | null) ?? {} })
}

export async function PUT(request: NextRequest) {
  const c = await clienteDeLaSesion(request)
  if (!c) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await request.json().catch(() => null) as { marcas?: unknown } | null
  const v = validarMarcas(body?.marcas)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const { data: perfil } = await c.admin.from('perfil_entreno_cliente').select('marcas').eq('cliente_id', c.clienteId).maybeSingle()
  if (!perfil) return NextResponse.json({ error: 'Tu coach aún no ha creado tu perfil de atleta' }, { status: 404 })

  const marcas: Record<string, number> = { ...((perfil.marcas as Record<string, number> | null) ?? {}) }
  const cambios: Record<string, unknown> = {}
  for (const m of MARCAS) {
    if (!(m.clave in v.marcas)) continue
    const valor = v.marcas[m.clave]
    if (valor === null) delete marcas[m.clave]; else marcas[m.clave] = valor
    // El motor ya lee las RM del perfil: se rellenan con la estimación desde el 5RM (las dominadas van tal cual).
    if (m.rm) cambios[m.rm] = valor === null ? null : m.clave === 'dominadas_max' ? valor : rmDesdeCincoReps(valor)
  }
  const { error } = await c.admin.from('perfil_entreno_cliente').update({ marcas, ...cambios }).eq('cliente_id', c.clienteId)
  if (error) return NextResponse.json({ error: 'No se pudieron guardar las marcas' }, { status: 500 })
  return NextResponse.json({ ok: true, marcas })
}
