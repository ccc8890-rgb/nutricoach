// lib/platos/foto-limpia.ts
// «Mis platos»: retoque opcional de la foto (quitar desorden, luz natural, recorte cuadrado) con el modelo de imágenes de OpenAI.
// La foto original SIEMPRE se conserva; si no hay clave, saldo o el servicio falla, devuelve null y el plato funciona igual.

export function promptFotoLimpia(): string {
  return [
    'This is a home photo of a plated dish. Edit it into a clean, appealing photo of the same dish: remove clutter, hands, packaging, text and anything that is not part of the plated food,',
    'and improve the lighting to natural window light. Keep the same dish, the same container and the same arrangement of the food, with the same ingredients and colours.',
    'Do not add any new food, garnish, props or decoration, and do not change what the dish is. Where something is removed, fill in naturally with the surrounding plate and surface.',
    'Candid home-photo look, realistic, square image.',
  ].join(' ')
}

export async function limpiarFotoPlato(
  foto: { buffer: Buffer; mediaType: string },
  opciones: { env?: Record<string, string | undefined>; fetchFn?: typeof fetch } = {},
): Promise<Buffer | null> {
  const env = opciones.env ?? process.env
  if (!env.OPENAI_API_KEY) return null
  const fetchFn = opciones.fetchFn ?? fetch
  try {
    const form = new FormData()
    form.append('model', 'gpt-image-1.5')
    form.append('prompt', promptFotoLimpia())
    form.append('size', '1024x1024')
    form.append('quality', 'medium')
    form.append('output_format', 'jpeg')
    form.append('image', new Blob([new Uint8Array(foto.buffer)], { type: foto.mediaType }), 'plato.jpg')
    const res = await fetchFn('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form, signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) return null
    const b64 = (await res.json())?.data?.[0]?.b64_json
    return typeof b64 === 'string' && b64 ? Buffer.from(b64, 'base64') : null
  } catch {
    return null
  }
}
