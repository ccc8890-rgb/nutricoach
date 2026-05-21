// ── Parser RSS nativo (sin dependencias externas) ─────────────────
// PubMed RSS es un XML bien formado con estructura conocida:
//
// <rss version="2.0">
//   <channel>
//     <item>
//       <title>...</title>
//       <link>...</link>
//       <description>...</description>
//       <dc:identifier>DOI: 10.xxxx/xxxx</dc:identifier>
//       <pubDate>...</pubDate>
//       <source>...</source>
//       <author>...</author>
//     </item>
//   </channel>
// </rss>

import type { PaperRaw, FuenteTipo } from './tipos'

/**
 * Extrae el contenido entre dos tags XML.
 * Ejemplo: extractTag('<title>Hola</title>', 'title') → 'Hola'
 */
function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}

/**
 * Extrae TODAS las ocurrencias de un tag XML.
 * Ejemplo: extractAllTags('<item>...</item><item>...</item>', 'item')
 */
function extractAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const items: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1].trim())
  }
  return items
}

/**
 * Normaliza texto HTML escapado dentro de RSS.
 * Ej: "&" → "&", "<" → "<", ">" → ">"
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
}

/**
 * Limpia el abstract eliminando etiquetas HTML internas
 * que a veces vienen en <description> de PubMed.
 */
function cleanAbstract(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')   // quitar HTML tags
    .replace(/\s+/g, ' ')       // colapsar whitespace
    .trim()
}

/**
 * Parsea un feed RSS de PubMed y devuelve artículos raw.
 */
export function parsePubMedRSS(xml: string, fuenteTipo: FuenteTipo): PaperRaw[] {
  const items = extractAllTags(xml, 'item')
  const papers: PaperRaw[] = []

  for (const item of items) {
    const title = extractTag(item, 'title')
    const link = extractTag(item, 'link')
    const description = extractTag(item, 'description')
    const pubDate = extractTag(item, 'pubDate')
    const dcIdentifier = extractTag(item, 'dc:identifier') ?? extractTag(item, 'identifier')
    const source = extractTag(item, 'source')
    const author = extractTag(item, 'author') ?? extractTag(item, 'dc:creator')

    if (!title || !link) continue

    // Extraer DOI del dc:identifier (formato: "DOI: 10.xxxx/xxxx")
    let doi: string | undefined
    if (dcIdentifier) {
      const doiMatch = dcIdentifier.match(/DOI:\s*(10\.[\d]+\/[\S]+)/i)
      if (doiMatch) doi = doiMatch[1].replace(/[.,;:]+$/, '')
    }

    // Limpiar abstract
    const abstract = description ? cleanAbstract(decodeHtmlEntities(description)) : ''
    if (!abstract) continue // Saltar items sin abstract

    papers.push({
      titulo: decodeHtmlEntities(title).replace(/<[^>]+>/g, '').trim(),
      enlace: link.trim(),
      abstract,
      fecha_publicacion: pubDate?.trim() ?? new Date().toISOString(),
      doi,
      fuente_tipo: fuenteTipo,
      revista: source ? decodeHtmlEntities(source).trim() : undefined,
      autores: author ? decodeHtmlEntities(author).trim() : undefined,
    })
  }

  return papers
}

/**
 * Fetch a un feed RSS y parsea los resultados.
 */
export async function fetchRSS(url: string, fuenteTipo: FuenteTipo): Promise<PaperRaw[]> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'NutriCoach/1.0 (Scientific Knowledge Ingestor)',
      Accept: 'application/rss+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(15_000), // 15s timeout
  })

  if (!response.ok) {
    throw new Error(`RSS fetch error ${response.status}: ${response.statusText} para URL: ${url}`)
  }

  const xml = await response.text()

  if (!xml.includes('<item>')) {
    // PubMed devuelve XML aunque no haya resultados, pero sin <item>
    return []
  }

  return parsePubMedRSS(xml, fuenteTipo)
}
