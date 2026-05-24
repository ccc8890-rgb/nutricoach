import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'
import {
  generarInformeCasoClinico,
  obtenerInformeVigente,
  necesitaRegeneracion,
} from '@/lib/inteligencia-clinica'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const forzar = req.nextUrl.searchParams.get('regenerar') === '1'

  if (forzar) {
    const informe = await generarInformeCasoClinico(id)
    return NextResponse.json({ informe })
  }

  // Comprobar si necesita regeneración automática
  const debeReg = await necesitaRegeneracion(id)
  if (debeReg) {
    const informe = await generarInformeCasoClinico(id)
    return NextResponse.json({ informe, regenerado: true })
  }

  const informe = await obtenerInformeVigente(id)
  return NextResponse.json({ informe, regenerado: false })
}
