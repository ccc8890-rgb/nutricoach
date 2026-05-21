// ── Cliente PubMed vía NCBI E-utilities API ───────────────────────
// Reemplaza el RSS directo (erss.cgi) por la API oficial:
// 1. esearch.fcgi → buscar PMIDs por query
// 2. efetch.fcgi → obtener abstracts completos por PMIDs
//
// Documentación: https://www.ncbi.nlm.nih.gov/books/NBK25497/
// Rate limit: 10 requests/sec sin API key, 10 requests/sec CON key
// API key opcional: https://support.nlm.nih.gov/knowledgebase/article/KA-05317/

import type { PaperRaw, FuenteTipo } from './tipos'

const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

/** Sleep helper para rate limiting */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Obtiene la API key de PubMed (opcional, pero recomendada para rate limit).
 * Se configura como PUBMED_API_KEY en .env.local.
 */
function getApiKey(): string | undefined {
  return process.env.PUBMED_API_KEY || undefined
}

/**
 * Construye una URL para esearch.
 * Busca PMIDs que coinciden con el query.
 */
function buildSearchUrl(query: string, retmax: number = 15): string {
  const params = new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmax: String(retmax),
    retmode: 'json',
    sort: 'date',
  })
  const apiKey = getApiKey()
  if (apiKey) params.set('api_key', apiKey)
  return `${NCBI_BASE}/esearch.fcgi?${params.toString()}`
}

/**
 * Construye una URL para efetch.
 * Obtiene los detalles de artículos por lista de PMIDs.
 */
function buildFetchUrl(pmids: string[]): string {
  const params = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'xml',
    rettype: 'abstract',
  })
  const apiKey = getApiKey()
  if (apiKey) params.set('api_key', apiKey)
  return `${NCBI_BASE}/efetch.fcgi?${params.toString()}`
}

/**
 * Parsea el XML de efetch para extraer artículos.
 * El XML de PubMed tiene estructura:
 *
 * <PubmedArticleSet>
 *   <PubmedArticle>
 *     <MedlineCitation>
 *       <Article>
 *         <ArticleTitle>...</ArticleTitle>
 *         <Abstract><AbstractText>...</AbstractText></Abstract>
 *         <Journal><Title>...</Title></Journal>
 *       </Article>
 *     </MedlineCitation>
 *     <PubmedData><ArticleIdList><ArticleId IdType="doi">...</ArticleId></ArticleIdList></PubmedData>
 *   </PubmedArticle>
 * </PubmedArticleSet>
 */
function parsePubMedXML(xml: string, fuenteTipo: FuenteTipo): PaperRaw[] {
  // Extraer Month y Day si están disponibles para fecha precisa
  function extractPubDate(article: string): string {
    const yearMatch = article.match(/<Year>(\d{4})<\/Year>/)
    if (!yearMatch) return new Date().toISOString().split('T')[0]
    const monthMatch = article.match(/<Month>(\d{1,2})<\/Month>/)
    const dayMatch = article.match(/<Day>(\d{1,2})<\/Day>/)
    const month = monthMatch ? monthMatch[1].padStart(2, '0') : '01'
    const day = dayMatch ? dayMatch[1].padStart(2, '0') : '01'
    return `${yearMatch[1]}-${month}-${day}`
  }

  const papers: PaperRaw[] = []

  // Extraer cada bloque PubmedArticle
  const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g
  let articleMatch: RegExpExecArray | null

  while ((articleMatch = articleRegex.exec(xml)) !== null) {
    const article = articleMatch[1]

    // Título
    const titleMatch = article.match(/<ArticleTitle(?: [^>]*)?>([\s\S]*?)<\/ArticleTitle>/)
    if (!titleMatch) continue
    const titulo = cleanXML(titleMatch[1])
    if (!titulo) continue

    // Abstract
    const abstractMatch = article.match(/<AbstractText(?: [^>]*)?>([\s\S]*?)<\/AbstractText>/)
    const abstract = abstractMatch ? cleanXML(abstractMatch[1]) : ''

    if (!abstract) continue // Saltar si no tiene abstract

    // DOI
    const doiMatch = article.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/)
    const doi = doiMatch ? doiMatch[1].trim() : undefined

    // Revista
    const journalMatch = article.match(/<Journal>\s*<Title>([\s\S]*?)<\/Title>/)
    const revista = journalMatch ? cleanXML(journalMatch[1]) : undefined

    // Autores (primer autor + et al)
    const authorMatch = article.match(/<Author>\s*<LastName>([^<]+)<\/LastName>\s*<ForeName>([^<]+)<\/ForeName>/)
    const autores = authorMatch ? `${authorMatch[2]} ${authorMatch[1]} et al.` : undefined

    // PMID para enlace
    const pmidMatch = article.match(/<PMID(?:\s[^>]*)?>(\d+)<\/PMID>/)
    const pmid = pmidMatch ? pmidMatch[1] : undefined

    // Fecha de publicación
    const fecha = extractPubDate(article)

    const enlace = pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      : doi
        ? `https://doi.org/${doi}`
        : ''

    papers.push({
      titulo,
      enlace,
      abstract,
      fecha_publicacion: fecha,
      doi,
      fuente_tipo: fuenteTipo,
      revista,
      autores,
    })
  }

  return papers
}

/**
 * Limpia texto XML: decodifica HTML entities y elimina tags residuales.
 */
function cleanXML(text: string): string {
  return text
    .replace(/</g, '<')        // PRIMERO las entidades compuestas
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&/g, '&')        // & AL FINAL para no romper < > etc.
    .replace(/<[^>]+>/g, '')   // quitar HTML tags residuales
    .replace(/\s+/g, ' ')      // colapsar whitespace
    .trim()
}

/**
 * Ejecuta una búsqueda en PubMed y devuelve los resultados.
 * Internamente hace:
 * 1. esearch → obtiene PMIDs
 * 2. efetch → obtiene abstracts completos
 *
 * Con retry y backoff para rate limiting.
 */
export async function searchPubMed(
  query: string,
  fuenteTipo: FuenteTipo,
  retmax: number = 15,
  maxRetries: number = 3
): Promise<PaperRaw[]> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Paso 1: esearch — buscar PMIDs
      const searchUrl = buildSearchUrl(query, retmax)
      const searchResponse = await fetch(searchUrl, {
        headers: { 'User-Agent': 'NutriCoach/1.0 (Scientific Knowledge Ingestor)' },
        signal: AbortSignal.timeout(15_000),
      })

      if (!searchResponse.ok) {
        throw new Error(`esearch error ${searchResponse.status}: ${searchResponse.statusText}`)
      }

      const searchData: { esearchresult?: { idlist: string[]; count: string } } = await searchResponse.json()
      const pmids = searchData?.esearchresult?.idlist ?? []

      if (pmids.length === 0) {
        return [] // No hay resultados
      }

      // Rate limiting: esperar 200ms entre requests
      if (attempt > 1) await sleep(500)

      // Paso 2: efetch — obtener abstracts
      const fetchUrl = buildFetchUrl(pmids)
      const fetchResponse = await fetch(fetchUrl, {
        headers: { 'User-Agent': 'NutriCoach/1.0 (Scientific Knowledge Ingestor)' },
        signal: AbortSignal.timeout(30_000),
      })

      if (!fetchResponse.ok) {
        throw new Error(`efetch error ${fetchResponse.status}: ${fetchResponse.statusText}`)
      }

      const xml = await fetchResponse.text()
      const papers = parsePubMedXML(xml, fuenteTipo)

      console.log(`  [PubMed] ${query.slice(0, 60)}... → ${pmids.length} PMIDs, ${papers.length} papers con abstract`)
      return papers

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Error desconocido')

      // Si es rate limit (429), esperar más tiempo
      if (lastError.message.includes('429') || lastError.message.includes('Too Many Requests')) {
        const waitMs = attempt * 2000
        console.warn(`  [PubMed] Rate limit (intento ${attempt}/${maxRetries}). Esperando ${waitMs}ms...`)
        await sleep(waitMs)
        continue
      }

      // Si es 422 (URL mal formada) o 400, no reintentar
      if (lastError.message.includes('422') || lastError.message.includes('400')) {
        console.warn(`  [PubMed] Error permanente en query: ${lastError.message}`)
        return []
      }

      // Para otros errores, reintentar
      if (attempt < maxRetries) {
        const waitMs = attempt * 1000
        console.warn(`  [PubMed] Error (intento ${attempt}/${maxRetries}): ${lastError.message}. Reintentando en ${waitMs}ms...`)
        await sleep(waitMs)
      }
    }
  }

  throw lastError || new Error('Error desconocido en PubMed API')
}
