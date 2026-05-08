import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación primero (usando server client con cookies)
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { nombre, calorias, proteinas, carbohidratos, grasas, fibra, azucares, categoria } = body

    // Evitar duplicados por nombre (case-insensitive, trimmed)
    const nombreNormalizado = nombre.trim()
    const { data: existente } = await supabaseAdmin
      .from('alimentos')
      .select('id')
      .eq('nombre', nombreNormalizado)
      .maybeSingle()

    if (existente) return NextResponse.json({ id: existente.id, duplicado: true })

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
