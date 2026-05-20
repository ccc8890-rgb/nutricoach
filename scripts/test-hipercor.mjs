import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
puppeteer.use(StealthPlugin())

const wait = (ms) => new Promise(r => setTimeout(r, ms))

async function test() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })

  // Try ECI homepage first, see if products load with Interaction
  console.log('=== ECI - Homepage first ===')
  await page.goto('https://www.elcorteingles.es/supermercado/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { })
  await wait(10000)

  console.log('Title:', await page.title())
  console.log('URL:', page.url())

  // Check for product cards
  const hasCards = await page.evaluate(() => {
    const cards = document.querySelectorAll('.food-product-preview-responsive')
    return cards.length
  })
  console.log('food-product-preview-responsive on homepage:', hasCards)

  // Try finding category links and clicking one
  const catLinks = await page.evaluate(() => {
    const links = []
    document.querySelectorAll('a[href*="/supermercado/carniceria"], a[href*="carniceria"]').forEach(a => {
      links.push({ text: a.textContent?.trim(), href: a.href })
    })
    return links
  })
  console.log('Carniceria links:', catLinks.length ? catLinks : '(none)')

  // Try clicking first category link
  if (catLinks.length > 0) {
    await page.goto(catLinks[0].href, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { })
    await wait(8000)
    console.log('After click - URL:', page.url())
    console.log('After click - Title:', await page.title())

    const cardsAfter = await page.evaluate(() => {
      return document.querySelectorAll('.food-product-preview-responsive').length
    })
    console.log('Cards after navigation:', cardsAfter)
  }

  // Also try hipercor.es directly for carniceria to compare
  console.log('\n=== HIPERCOR - Carnicería (comparison) ===')
  await page.goto('https://www.hipercor.es/supermercado/carniceria/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { })
  await wait(8000)
  console.log('Title:', await page.title())
  console.log('URL:', page.url())

  // Scroll
  for (const pct of [0.3, 0.6, 1.0]) {
    await page.evaluate((p) => window.scrollTo(0, document.body.scrollHeight * p), pct)
    await wait(1500)
  }

  const cardsCompare = await page.evaluate(() => {
    return document.querySelectorAll('.food-product-preview-responsive').length
  })
  console.log('Cards on Hipercor:', cardsCompare)

  // Extract a few to verify
  const products = await page.evaluate(() => {
    const items = []
    const containers = document.querySelectorAll('.food-product-preview-responsive')
    containers.forEach(container => {
      const nameEl = container.querySelector('.food-product-preview-responsive__description')
      const priceFooter = container.querySelector('.food-product-preview-responsive__footer__price')
      const imgEl = container.querySelector('.food-product-preview-responsive__image img')
      const linkEl = container.querySelector('.food-product-preview-responsive__link')

      const name = nameEl?.textContent?.trim() || ''

      // Price
      const priceEl = priceFooter?.querySelector('.food-prices__price')
      const priceText = priceEl?.textContent?.trim() || ''
      const priceMatch = priceText.match(/([\d.,]+)/)
      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0

      // Unit price (€/kg)
      const unitEl = priceFooter?.querySelector('.food-prices__measurement-unit')
      const unitText = unitEl?.textContent?.trim() || ''
      const kgMatch = unitText.match(/([\d.,]+)\s*€\s*\/\s*(kg|unidad|l|g|100\s*g)/i)
      const priceKg = kgMatch ? parseFloat(kgMatch[1].replace(',', '.')) : null

      if (name && price > 0) {
        items.push({
          name,
          price,
          priceKg,
          image: imgEl?.src || '',
          url: linkEl?.href || '',
        })
      }
    })
    return items
  })
  console.log(`Hipercor products: ${products.length}`)
  if (products.length > 0) {
    console.log('First 3:')
    products.slice(0, 3).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} | ${p.price}€ | kg:${p.priceKg}`)
    })
  }

  await browser.close()
}

test()
