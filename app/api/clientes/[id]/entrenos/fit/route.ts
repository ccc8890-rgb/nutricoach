import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { leerUmbrales } from '@/lib/rendimiento/garmin-entrenos'
import { ErrorFit, leerActividadFit, mapearActividadFit } from '@/lib/rendimiento/fit-actividad'
import { deporteDe } from '@/lib/rendimiento/deportes'

/** Vercel limita el cuerpo de la petición a 4,5 MB; un .fit de varias horas pesa unos cientos de KB. */
const MAX_BYTES = 4 * 1024 * 1024
/** Dos entrenos del mismo deporte que empiezan con menos de esto de diferencia se consideran el mismo. */
const MARGEN_DUPLICADO_MS = 15 * 60 * 1000

/** Sube un archivo .fit (p. ej. del iGPSPORT) y lo guarda como entreno del cliente. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params

  const authClient = createApiSupabase(request)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = createServiceSupabase()
  const autorizacion = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!autorizacion.ok) return NextResponse.json({ error: autorizacion.mensaje }, { status: autorizacion.status })

  let archivo: File | null = null
  try {
    const form = await request.formData()
    const f = form.get('archivo')
    archivo = f instanceof File ? f : null
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo enviado.' }, { status: 400 })
  }
  if (!archivo) return NextResponse.json({ error: 'Falta el archivo .fit.' }, { status: 400 })
  if (!archivo.name.toLowerCase().endsWith('.fit')) return NextResponse.json({ error: 'El archivo debe ser un .fit.' }, { status: 400 })
  if (archivo.size > MAX_BYTES) return NextResponse.json({ error: 'El archivo pesa más de 4 MB.' }, { status: 413 })

  let actividad
  try {
    actividad = leerActividadFit(Buffer.from(await archivo.arrayBuffer()))
  } catch (e) {
    const mensaje = e instanceof ErrorFit ? e.message : 'No se pudo leer el archivo .fit.'
    return NextResponse.json({ error: mensaje }, { status: 422 })
  }

  const [umbrales, { data: perfil }] = await Promise.all([
    leerUmbrales(db, clienteId),
    db.from('perfil_entreno_cliente').select('ftp_watts').eq('cliente_id', clienteId).maybeSingle(),
  ])
  if (!umbrales.fcMax && actividad.fc_max) umbrales.fcMax = actividad.fc_max
  const ftp = typeof perfil?.ftp_watts === 'number' && perfil.ftp_watts > 0 ? perfil.ftp_watts : null

  const nombre = archivo.name.replace(/\.fit$/i, '').slice(0, 80)
  const fila = mapearActividadFit(actividad, clienteId, umbrales, ftp, nombre)

  // ¿Ya está ese entreno (p. ej. el mismo día desde Garmin o subido antes)?
  const { data: delDia } = await db
    .from('entrenos_realizados')
    .select('id,fuente,tipo,inicio_local,nombre')
    .eq('cliente_id', clienteId)
    .eq('fecha', fila.fecha)
  const inicioMs = new Date(`${fila.inicio_local}Z`).getTime()
  const repetido = (delDia ?? []).find(e =>
    deporteDe(e.tipo) === deporteDe(fila.tipo) && e.inicio_local && Math.abs(new Date(`${e.inicio_local}Z`).getTime() - inicioMs) < MARGEN_DUPLICADO_MS)
  if (repetido && repetido.fuente !== 'fit_manual') {
    return NextResponse.json({ error: `Ya hay un entreno de ese deporte a esa hora (${repetido.nombre ?? repetido.fuente}). No se ha duplicado.` }, { status: 409 })
  }

  const { error } = await db.from('entrenos_realizados').upsert(fila, { onConflict: 'cliente_id,fuente,actividad_id' })
  if (error) return NextResponse.json({ error: 'No se pudo guardar el entreno.' }, { status: 500 })

  return NextResponse.json({
    ok: true,
    entreno: {
      fecha: fila.fecha,
      tipo: fila.tipo,
      duracion_min: Math.round(actividad.duracion_s / 60),
      km: fila.distancia_m ? Math.round(fila.distancia_m / 100) / 10 : null,
      potencia_media: actividad.potencia_media,
      potencia_normalizada: actividad.potencia_normalizada,
      tss: fila.tss,
      tss_metodo: fila.tss_metodo,
      sin_ftp: actividad.potencia_normalizada !== null && ftp === null,
    },
  })
}
