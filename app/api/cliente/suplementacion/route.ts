import { NextRequest, NextResponse } from 'next/server'
import { getFichaSuplemento } from '@/lib/nutricion/suplementos'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

type FilaSuplementacion = {
  id: string
  suplemento_id: string
  ambito: 'sesion' | 'diaria' | 'carrera'
  dosis: string | null
  timing: string | null
  notas: string | null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const admin = createServiceSupabase()
    const { data: cliente, error: clienteError } = await admin
      .from('clientes')
      .select('id')
      .eq('profile_id', user.id)
      .single()

    if (clienteError || !cliente) {
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }

    const { data, error } = await admin
      .from('suplementacion_cliente')
      .select('id,suplemento_id,ambito,dosis,timing,notas')
      .eq('cliente_id', cliente.id)
      .eq('estado', 'aprobada')
      .order('decidido_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }

    const items = ((data ?? []) as FilaSuplementacion[]).flatMap(fila => {
      const ficha = getFichaSuplemento(fila.suplemento_id)
      if (!ficha) return []

      return [{
        id: fila.id,
        nombre: ficha.nombre,
        ambito: fila.ambito,
        dosis: fila.dosis ?? '',
        timing: fila.timing ?? '',
        notas: fila.notas ?? '',
        precauciones: ficha.precauciones,
        fuentes: ficha.fuentes,
        evidencia: ficha.evidencia,
      }]
    })

    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
