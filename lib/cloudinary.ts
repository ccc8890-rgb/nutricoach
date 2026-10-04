import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

interface UploadOptions {
  folder: string
  public_id?: string
  resource_type?: 'image' | 'raw' | 'video' | 'auto'
  format?: string
}

// Anchos que pide la app (ver deviceSizes/imageSizes en next.config.mjs). Deben coincidir con lib/cloudinary-loader.ts.
const ANCHOS_APP = [96, 384, 640, 1080]

// Cloudinary genera cada variante la primera vez que se pide (~0,8 s). Se piden aquí para que el cliente no la pague.
export async function calentarVariantes(url: string): Promise<void> {
  if (!url.includes('/upload/')) return
  await Promise.allSettled(ANCHOS_APP.map(w =>
    fetch(url.replace('/upload/', `/upload/f_webp,q_75,w_${w},c_limit/`), { signal: AbortSignal.timeout(5000) }).then(r => r.arrayBuffer())
  ))
}

export async function uploadToCloudinary(buffer: Buffer, options: UploadOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:        options.folder,
        public_id:     options.public_id,
        resource_type: options.resource_type ?? 'image',
        format:        options.format ?? 'webp',
        overwrite:     true,
        quality:       'auto:good',
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary: sin resultado'))
        calentarVariantes(result.secure_url).finally(() => resolve(result.secure_url))
      }
    )
    stream.end(buffer)
  })
}

export { cloudinary }
