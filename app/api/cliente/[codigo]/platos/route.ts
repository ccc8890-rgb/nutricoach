import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoPlan } from '@/lib/cliente/autorizar-escritura-plan'
import { crearPlatoDesdeFoto } from '@/lib/platos/crear'
import { depsReales } from '@/lib/platos/deps-reales'
import { TIPOS_COMIDA, construirVista, type TipoComida } from '@/lib/platos/entrada'
import { vistaPublica, type EstadoPlato, type VistaPlato } from '@/lib/platos/estado'
import { cargarLineas, listarPlatosDeCliente } from '@/lib/platos/guardar'

export const maxDuration = 60

const ESTADOS: EstadoPlato[] = ['borrador', 'pendiente', 'aprobado', 'devuelto']

/**
 * Lista los platos del cliente. `?vista=recetario` devuelve solo lo que se enseña en el recetario (versión aprobada, con la marca «Mi plato»).
 * Un coach solo ve lo enviado: nunca los borradores del cliente.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const auth = await autorizarAccesoPlan(request, codigo)
  if (auth instanceof NextResponse) return auth
  const db = createServiceSupabase()
  try {
    const recetario = new URL(request.url).searchParams.get('vista') === 'recetario'
    const estados = recetario ? (['aprobado', 'pendiente'] as EstadoPlato[]) : auth.esCliente ? ESTADOS : ESTADOS.filter(e => e !== 'borrador')
    const platos = await listarPlatosDeCliente(db, auth.clienteId, estados)
    if (!recetario) return NextResponse.json({ platos })
    const salida: (VistaPlato & { id: string; foto: string | null; tipo_comida: string })[] = []
    for (const p of platos) {
      const lineas = await cargarLineas(db, p.id)
      const vista = vistaPublica({ ...construirVista(p, lineas), estado: p.estado, aprobado_snapshot: (p.aprobado_snapshot as VistaPlato | null) ?? null })
      if (vista) salida.push({ ...vista, id: p.id, foto: p.foto_limpia_url ?? p.foto_original_url, tipo_comida: p.tipo_comida })
    }
    return NextResponse.json({ platos: salida })
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar los platos' }, { status: 500 })
  }
}

/** Crea un plato en borrador a partir de una foto (multipart: `foto`, `nota?`, `tipo_comida`). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const auth = await autorizarAccesoPlan(request, codigo)
  if (auth instanceof NextResponse) return auth
  if (!auth.esCliente) return NextResponse.json({ error: 'Solo el propio cliente puede añadir platos' }, { status: 403 })

  const form = await request.formData().catch(() => null)
  const foto = form?.get('foto')
  if (!(foto instanceof File)) return NextResponse.json({ error: 'Falta la foto' }, { status: 400 })
  const tipoCrudo = String(form?.get('tipo_comida') ?? 'Comida')
  if (!(TIPOS_COMIDA as readonly string[]).includes(tipoCrudo)) return NextResponse.json({ error: 'Tipo de comida no válido' }, { status: 400 })
  const nota = String(form?.get('nota') ?? '').trim().slice(0, 500) || null

  try {
    const r = await crearPlatoDesdeFoto(depsReales(createServiceSupabase()), {
      clienteId: auth.clienteId, buffer: Buffer.from(await foto.arrayBuffer()), tipoMime: foto.type, nota, tipoComida: tipoCrudo as TipoComida,
    })
    if (r.estado === 'foto_invalida') return NextResponse.json({ error: r.motivo }, { status: 400 })
    if (r.estado === 'limite') return NextResponse.json({ error: 'Has llegado al límite de análisis de hoy. Vuelve mañana.' }, { status: 429 })
    return NextResponse.json({ plato: r.plato, aviso: r.aviso }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'No se pudo crear el plato' }, { status: 500 })
  }
}
