/**
 * media-utils.ts — Utilidades para extraer imágenes y vídeos
 * de Instagram, TikTok y otras fuentes del recetario.
 *
 * Instagram oEmbed API → miniatura REAL del post (gratis, sin API key)
 * TikTok oEmbed API → miniatura REAL del video
 * YouTube oEmbed API → miniatura REAL del video
 *
 * USO:
 *   import { extractMediaFromUrl } from '@/lib/media-utils'
 *   const media = await extractMediaFromUrl('https://www.instagram.com/p/XXXX/')
 *   // → { imagen_url: 'https://...', video_url: 'https://...' }
 */

interface MediaResult {
    imagen_url: string | null
    video_url: string | null
    titulo: string | null
    autor: string | null
}

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'directoalpaladar' | 'unknown'

function detectPlatform(url: string): Platform {
    const u = url.toLowerCase()
    if (u.includes('instagram.com')) return 'instagram'
    if (u.includes('tiktok.com')) return 'tiktok'
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
    if (u.includes('directoalpaladar.com')) return 'directoalpaladar'
    return 'unknown'
}

/**
 * Extrae imagen y video de Instagram mediante oEmbed (gratuito, sin auth).
 * Instagram oEmbed devuelve: thumbnail_url, author_name, title
 */
async function extractInstagram(url: string): Promise<MediaResult> {
    try {
        const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&format=json`
        const res = await fetch(oembedUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) throw new Error(`Instagram oEmbed ${res.status}`)
        const data = await res.json()
        return {
            imagen_url: data.thumbnail_url || null,
            video_url: url, // El propio post de Instagram (puede ser video o carrusel)
            titulo: data.title || null,
            autor: data.author_name || null,
        }
    } catch (err) {
        console.warn(`  ⚠️ Instagram oEmbed falló para ${url}:`, (err as Error).message)
        // Fallback: extraer ID del post y usar la URL directa como imagen
        return { imagen_url: null, video_url: url, titulo: null, autor: null }
    }
}

/**
 * Extrae imagen y video de TikTok mediante oEmbed.
 * TikTok oEmbed devuelve: thumbnail_url, author_name, title
 */
async function extractTikTok(url: string): Promise<MediaResult> {
    try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}&format=json`
        const res = await fetch(oembedUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) throw new Error(`TikTok oEmbed ${res.status}`)
        const data = await res.json()
        return {
            imagen_url: data.thumbnail_url || null,
            video_url: url, // URL directa al video de TikTok
            titulo: data.title || null,
            autor: data.author_name || null,
        }
    } catch (err) {
        console.warn(`  ⚠️ TikTok oEmbed falló para ${url}:`, (err as Error).message)
        return { imagen_url: null, video_url: url, titulo: null, autor: null }
    }
}

/**
 * Extrae imagen y video de YouTube mediante oEmbed.
 * Devuelve: thumbnail_url, author_name, title, video_url (el embed)
 */
async function extractYouTube(url: string): Promise<MediaResult> {
    try {
        // YouTube oEmbed
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
        const res = await fetch(oembedUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) throw new Error(`YouTube oEmbed ${res.status}`)
        const data = await res.json()
        // Extraer ID del video para construir embed URL
        let videoId: string | null = null
        try {
            const u = new URL(url)
            if (u.hostname.includes('youtu.be')) {
                videoId = u.pathname.slice(1).split('?')[0]
            } else {
                videoId = u.searchParams.get('v')
            }
        } catch { /* ignore */ }

        return {
            imagen_url: data.thumbnail_url || null,
            video_url: videoId ? `https://www.youtube.com/embed/${videoId}` : url,
            titulo: data.title || null,
            autor: data.author_name || null,
        }
    } catch (err) {
        console.warn(`  ⚠️ YouTube oEmbed falló para ${url}:`, (err as Error).message)
        return { imagen_url: null, video_url: url, titulo: null, autor: null }
    }
}

/**
 * Punto de entrada principal: detecta la plataforma y extrae los medios.
 */
export async function extractMediaFromUrl(url: string): Promise<MediaResult> {
    if (!url) return { imagen_url: null, video_url: null, titulo: null, autor: null }

    const platform = detectPlatform(url)
    console.log(`  📱 Detectado: ${platform} → ${url.substring(0, 60)}`)

    switch (platform) {
        case 'instagram':
            return extractInstagram(url)
        case 'tiktok':
            return extractTikTok(url)
        case 'youtube':
            return extractYouTube(url)
        case 'directoalpaladar':
            // Directo al Paladar no tiene oembed conocido, devolvemos null
            return { imagen_url: null, video_url: null, titulo: null, autor: null }
        default:
            return { imagen_url: null, video_url: null, titulo: null, autor: null }
    }
}

/**
 * Genera un prompt de imagen para Replicate/Flux basado en los datos de una receta.
 * El prompt está diseñado para crear fotos realistas tipo Instagram/comida casera.
 */
const MAPA_ESTILOS_TS: Record<string, {
    angulo: string; vajilla: string; fondo: string; detalle: string; vibra: string; extras: string;
}> = {
    'Postre': {
        angulo: 'ángulo cenital ligeramente inclinado, 45 grados',
        vajilla: 'en plato de postre blanco de cerámica artesanal con borde dorado fino',
        fondo: 'madera oscura vintage, textura de mármol blanco suave',
        detalle: 'textura cremosa visible, brillo sutil, capas y cobertura perfecta',
        vibra: 'acogedor, artesanal, postrería fina casera',
        extras: 'servilleta de tela arrugada al lado, tenedor de postre plateado',
    },
    'Dulce': {
        angulo: 'plano cenital con ligera profundidad',
        vajilla: 'en bandeja de mármol blanco o fuente de cerámica',
        fondo: 'superficie de mármol blanco con textura, luz difusa',
        detalle: 'migas finas, textura dorada, brillo de glaseado, capas visibles al corte',
        vibra: 'pastelería artesanal de revista, dulce cuidado',
        extras: 'granos de café o flores pequeñas al lado para decoración natural',
    },
    'Desayuno': {
        angulo: 'plano cenital, flat lay natural',
        vajilla: 'en cuenco de cerámica blanca rugosa y plato llano',
        fondo: 'mesa de madera clara, luz natural de mañana entrando por la ventana',
        detalle: 'texturas de avena, fruta fresca, chorrito de miel, vapor sutil',
        vibra: 'mañana tranquila, desayuno saludable, hygge escandinavo',
        extras: 'una taza de café al lado, un par de arándanos sueltos',
    },
    'Comida': {
        angulo: 'ángulo de 45 grados, clásico de blog de cocina',
        vajilla: 'en plato llano de cerámica artesanal de color crudo',
        fondo: 'mesa de madera rústica, luz natural lateral desde ventana',
        detalle: 'vapor sutil, ingredientes enteros alrededor, salsa brillante, hierbas frescas espolvoreadas',
        vibra: 'cocina casera española de revista, apetitoso, auténtico',
        extras: 'servilleta de tela doblada, cubiertos de acero inoxidable',
    },
    'Cena': {
        angulo: 'ángulo de 45 grados, composición elegante',
        vajilla: 'en plato hondo de cerámica oscura o pizarra',
        fondo: 'mesa oscura iluminada con luz cálida, ambiente íntimo',
        detalle: 'salsa con brillo, vapor tenue, texturas ricas, contraste de colores',
        vibra: 'cena elegante en casa, restaurante en tu hogar',
        extras: 'copa de vino tinto al fondo, vela pequeña, mantel de lino',
    },
    'Snack': {
        angulo: 'plano cenital con composición en diagonal',
        vajilla: 'en tabla de madera pequeña o bol de cerámica',
        fondo: 'tabla de cortar de madera, luz natural',
        detalle: 'textura crujiente visible, chips, trozos, dips cremosos',
        vibra: 'snack saludable, pausa a media mañana',
        extras: 'algunos ingredientes sueltos alrededor, servilleta de papel',
    },
    'Merienda': {
        angulo: 'plano cenital, composición de merienda completa',
        vajilla: 'plato pequeño de cerámica blanca',
        fondo: 'mesa de cocina con luz de tarde, cálida',
        detalle: 'textura horneada, fruta fresca cortada, chocolate fundido',
        vibra: 'merienda casera de la abuela, acogedor',
        extras: 'vaso de leche o té, trozo de fruta adicional',
    },
}

export function generarPromptImagen(receta: {
    nombre: string
    descripcion?: string | null
    categoria?: string | null
    ingredientes?: { nombre: string; gramos: number }[]
}): string {
    const nombreLimpio = receta.nombre
        .replace(/\([^)]*\)/g, '')
        .replace(/TEST/gi, '')
        .trim()

    const categoria = receta.categoria || 'Comida'
    const ingredientesStr = (receta.ingredientes || [])
        .slice(0, 6)
        .map(i => i.nombre)
        .join(', ')

    const estilo = MAPA_ESTILOS_TS[categoria] || MAPA_ESTILOS_TS['Comida']

    const prompt = [
        `photorealistic professional food photography of "${nombreLimpio}" served ${estilo.vajilla},`,
        `shot at ${estilo.angulo},`,
        `on ${estilo.fondo}.`,
        `${estilo.detalle}.`,
        `Key ingredients visible: ${ingredientesStr || 'ingredientes frescos de la receta'}.`,
        `${estilo.extras}.`,
        `Mood: ${estilo.vibra}.`,
        `Lighting: soft natural window light from the side, slight warm tone,`,
        `cinematic depth of field, sharp focus on the main dish, creamy bokeh background.`,
        `Style: professional cookbook editorial photography, Jamie Oliver / Ottolenghi aesthetic,`,
        `shot on Hasselblad medium format, 80mm lens, f/2.8, natural color grading.`,
        `No text, no watermarks, no artificial-looking elements, no studio lighting, no flash.`,
        `The food must look incredibly appetizing and real, as if a professional food photographer took it in a real kitchen.`,
        `Ultra realistic, 8K, hyper-detailed textures, moisture and sheen on fresh ingredients.`,
    ].join(' ')

    return prompt.trim()
}
