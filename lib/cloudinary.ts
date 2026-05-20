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
        resolve(result.secure_url)
      }
    )
    stream.end(buffer)
  })
}

export { cloudinary }
