import { NextRequest, NextResponse } from 'next/server'

interface OFFProduct {
  product_name: string
  nutriments: {
    'energy-kcal_100g'?: number
    'energy-kcal'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
    fiber_100g?: number
    sugars_100g?: number
  }
  image_front_small_url?: string
  brands?: string
  quantity?: string
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.length < 2) return NextResponse.json([])

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&lc=es&cc=es&fields=product_name,nutriments,image_front_small_url,brands,quantity&page_size=15`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return NextResponse.json([])

    const json = await res.json()
    const products: OFFProduct[] = json.products ?? []

    const normalizado = products
      .filter(p => {
        const n = p.nutriments
        return (
          p.product_name?.trim() &&
          (n['energy-kcal_100g'] != null || n['energy-kcal'] != null) &&
          n.proteins_100g != null &&
          n.carbohydrates_100g != null &&
          n.fat_100g != null
        )
      })
      .map(p => ({
        nombre: [p.product_name, p.brands].filter(Boolean).join(' — '),
        calorias: p.nutriments['energy-kcal_100g'] ?? p.nutriments['energy-kcal'] ?? 0,
        proteinas: p.nutriments.proteins_100g ?? 0,
        carbohidratos: p.nutriments.carbohydrates_100g ?? 0,
        grasas: p.nutriments.fat_100g ?? 0,
        fibra: p.nutriments.fiber_100g ?? 0,
        azucares: p.nutriments.sugars_100g ?? 0,
        categoria: 'Supermercado',
        imagen: p.image_front_small_url ?? null,
        _fuente: 'off' as const,
      }))

    return NextResponse.json(normalizado.slice(0, 12))
  } catch {
    return NextResponse.json([])
  }
}
