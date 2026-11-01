// lib/platos/deps-reales.ts
// Dependencias reales de «Mis platos»: Cloudinary para guardar la foto y su versión reducida para la IA.
import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadToCloudinary } from '@/lib/cloudinary'
import type { DepsCrear } from './crear'

export function depsReales(db: SupabaseClient): DepsCrear {
  return {
    db,
    subirFoto: (buffer, clienteId) => uploadToCloudinary(buffer, { folder: `nutricoach/platos/${clienteId}`, public_id: `${Date.now()}`, format: 'webp' }),
    // Siempre se envía a la IA un JPEG reducido: unifica HEIC/PNG/WebP y evita pasar del límite de tamaño de imagen
    miniaturaParaIA: async (url) => {
      const reducida = url.replace('/upload/', '/upload/c_limit,w_1280,f_jpg,q_80/')
      const res = await fetch(reducida, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error(`No se pudo descargar la foto (${res.status})`)
      return { base64: Buffer.from(await res.arrayBuffer()).toString('base64'), mediaType: 'image/jpeg' }
    },
  }
}
