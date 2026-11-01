// lib/platos/crear.ts
// «Mis platos»: del archivo de foto al plato en borrador. Las dependencias externas (Cloudinary, descarga, IA) se inyectan
// para poder probar el flujo completo sin gastar ni subir nada.
import type { SupabaseClient } from '@supabase/supabase-js'
import { analizarFotoPlato } from './analizar'
import { fotoValida } from './entrada'
import type { TipoComida } from './entrada'
import { alimentosCache, cargarPlatoDeCliente, guardarLineas, reservarAnalisis, type PlatoFila } from './guardar'

export type DepsCrear = {
  db: SupabaseClient
  /** Sube la foto original y devuelve su URL pública */
  subirFoto: (buffer: Buffer, clienteId: string) => Promise<string>
  /** Descarga una versión reducida (JPEG ≤ 1280 px) de la foto ya subida para enviarla a la IA */
  miniaturaParaIA: (url: string) => Promise<{ base64: string; mediaType: 'image/jpeg' }>
  analizar?: typeof analizarFotoPlato
}

export type ResultadoCrear =
  | { estado: 'ok'; plato: PlatoFila; aviso?: string }
  | { estado: 'limite' }
  | { estado: 'foto_invalida'; motivo: string }

export async function crearPlatoDesdeFoto(
  deps: DepsCrear,
  p: { clienteId: string; buffer: Buffer; tipoMime: string; nota: string | null; tipoComida: TipoComida },
): Promise<ResultadoCrear> {
  const v = fotoValida(p.tipoMime, p.buffer.length)
  if (!v.ok) return { estado: 'foto_invalida', motivo: v.motivo }

  // El límite se reserva ANTES de llamar a la IA (y de forma atómica frente a peticiones simultáneas)
  if (!(await reservarAnalisis(deps.db, p.clienteId))) return { estado: 'limite' }

  const url = await deps.subirFoto(p.buffer, p.clienteId)
  const analizar = deps.analizar ?? analizarFotoPlato
  let analisis: Awaited<ReturnType<typeof analizarFotoPlato>>
  try {
    const mini = await deps.miniaturaParaIA(url)
    analisis = await analizar({ base64: mini.base64, mediaType: mini.mediaType, nota: p.nota })
  } catch {
    analisis = { ok: false, motivo: 'No se pudo preparar la foto' }
  }

  const { data: creado, error } = await deps.db.from('platos_cliente').insert({
    cliente_id: p.clienteId,
    nombre: analisis.ok ? analisis.valor.nombre : '',
    tipo_comida: p.tipoComida,
    nota_cliente: p.nota,
    foto_original_url: url,
    porciones: analisis.ok ? analisis.valor.porciones : 1,
    pasos: analisis.ok ? analisis.valor.pasos.join('\n') : null,
    ia_modelo: analisis.ok ? analisis.modelo : null,
  }).select('id').single()
  if (error || !creado) throw new Error('No se pudo crear el plato')

  if (analisis.ok) {
    const cache = await alimentosCache(deps.db)
    await guardarLineas(deps.db, p.clienteId, creado.id, analisis.valor.ingredientes.map(i => ({ nombre_libre: i.nombre, cantidad_gramos: i.gramos, alimento_id: null })), cache)
  }
  const plato = await cargarPlatoDeCliente(deps.db, p.clienteId, creado.id)
  if (!plato) throw new Error('No se pudo leer el plato creado')
  return analisis.ok ? { estado: 'ok', plato } : { estado: 'ok', plato, aviso: 'No pude leer el plato; añade los ingredientes a mano' }
}
