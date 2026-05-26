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
