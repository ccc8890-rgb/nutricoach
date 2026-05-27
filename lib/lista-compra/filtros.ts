export function normalizarNombreCompra(value: string | null | undefined) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

export function esIngredienteBasicoNoCompra(nombre: string | null | undefined) {
    const text = normalizarNombreCompra(nombre)
    if (!text) return false

    const aguasBasicas = new Set([
        'agua',
        'agua fria',
        'agua caliente',
        'agua templada',
        'agua mineral',
        'agua con gas',
        'agua sin gas',
        'hielo',
        'cubitos de hielo',
    ])

    if (aguasBasicas.has(text)) return true

    return /^sal(?:\s+(?:fina|gruesa|marina|yodada|rosa|del himalaya|en escamas))?$/.test(text)
}

type AlimentoCompraBase = {
    id: string
    nombre: string
    categoria?: string | null
}

export function canonicalizarItemCompra(alimento: AlimentoCompraBase) {
    const nombre = normalizarNombreCompra(alimento.nombre)

    if (/\b(huevo|huevos)\b/.test(nombre)) {
        return {
            key: 'canon:huevos',
            nombre: 'Huevos',
            categoria: 'Huevos',
        }
    }

    if (
        /\bajo\b/.test(nombre)
        && !/\b(polvo|granulado|negro|tierno|ajete|aceite|salsa|crema|pasta)\b/.test(nombre)
    ) {
        return {
            key: 'canon:ajo',
            nombre: 'Ajo',
            categoria: alimento.categoria ?? 'Verduras',
        }
    }

    return {
        key: alimento.id,
        nombre: alimento.nombre,
        categoria: alimento.categoria ?? 'Otros',
    }
}
