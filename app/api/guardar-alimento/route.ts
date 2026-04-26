import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, calorias, proteinas, carbohidratos, grasas, fibra, azucares, categoria } = body

    // Evitar duplicados por nombre exacto
    const { data: existente } = await supabaseAdmin
      .from('alimentos')
      .select('id')
      .eq('nombre', nombre)
      .single()

    if (existente) return NextResponse.json({ id: existente.id })

    const { data, error } = await supabaseAdmin.from('alimentos').insert({
      nombre,
      categoria: categoria ?? 'Supermercado',
      calorias,
      proteinas,
      carbohidratos,
      grasas,
      fibra: fibra ?? 0,
      azucares: azucares ?? 0,
      custom: false,
    }).select('id').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}
