import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { ESTADOS_METODO, type EstadoMetodo, type Metodo } from '@/lib/metodos/constantes'
import { filtrarMetodos, huellaMetodo, validarMetodo } from '@/lib/metodos/esquema'
import { registrarEvento } from '@/lib/metodos/db'

// Columnas de la lista: sin `estructura` (pesa) ni datos internos
const COLUMNAS_LISTA = 'id, tipo, titulo, resumen, modalidad, objetivo, nivel, material, duracion_min, autor, plataforma, url_origen, video_url, miniatura_url, confianza, estado, disponible_ia, notas_coach, tags, created_at, updated_at'

// Lista de fichas del coach con filtros y conteos por estado. Solo coach.
export async function GET(request: NextRequest) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const p = request.nextUrl.searchParams
  const estado = p.get('estado')

  const { data, error } = await auth.admin.from('metodos').select(COLUMNAS_LISTA).eq('coach_id', auth.userId).order('created_at', { ascending: false }).limit(1000)
  if (error) return NextResponse.json({ error: 'No se pudo leer la biblioteca' }, { status: 500 })
  const todas = (data ?? []) as unknown as (Omit<Metodo, 'estructura' | 'huella' | 'coach_id'>)[]

  const conteos = Object.fromEntries(ESTADOS_METODO.map(e => [e, 0])) as Record<EstadoMetodo, number>
  for (const m of todas) conteos[m.estado] += 1

  const delEstado = ESTADOS_METODO.includes(estado as EstadoMetodo) ? todas.filter(m => m.estado === estado) : todas
  const metodos = filtrarMetodos(delEstado, {
    q: p.get('q') ?? undefined,
    tipo: p.get('tipo') ?? undefined,
    modalidad: p.get('modalidad') ?? undefined,
    nivel: p.get('nivel') ?? undefined,
    confianza: p.get('confianza') ?? undefined,
    autor: p.get('autor') ?? undefined,
    soloIa: p.get('ia') === '1',
  })
  return NextResponse.json({ metodos, conteos })
}

// Crea una ficha nueva «por revisar». Solo coach. Avisa si ya existe la misma (mismo enlace y autor).
export async function POST(request: NextRequest) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const body = await request.json().catch(() => null)
  const v = validarMetodo(body, 'crear')
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const campos = v.valor
  const huella = huellaMetodo({ autor: campos.autor ?? null, url_origen: campos.url_origen ?? null, titulo: campos.titulo as string })
  const { data: existente } = await auth.admin.from('metodos').select('id').eq('coach_id', auth.userId).eq('huella', huella).maybeSingle()
  if (existente) return NextResponse.json({ error: 'Ya existe una ficha con este enlace y autor', existente_id: existente.id }, { status: 409 })

  const { data, error } = await auth.admin.from('metodos')
    .insert({ ...campos, coach_id: auth.userId, huella, estado: 'en_revision', disponible_ia: false })
    .select('*').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo crear la ficha' }, { status: 500 })
  await registrarEvento(auth.admin, data.id, 'creada')
  return NextResponse.json({ metodo: data }, { status: 201 })
}
