export type SlotComida = 'Desayuno' | 'Media mañana' | 'Comida' | 'Merienda' | 'Cena'

const TIPOS_PERMITIDOS_POR_SLOT: Record<SlotComida, string[]> = {
  'Desayuno': ['Desayuno'],
  'Media mañana': ['Desayuno', 'Merienda', 'Snack', 'Postre'],
  'Comida': ['Comida'],
  'Merienda': ['Desayuno', 'Merienda', 'Snack', 'Postre'],
  'Cena': ['Comida', 'Cena'],
}

export function inferirSlotComida(nombre?: string | null): SlotComida | null {
  const n = (nombre ?? '').toLowerCase()
  if (n.includes('desayuno')) return 'Desayuno'
  if (n.includes('media mañana') || n.includes('media manana') || n.includes('almuerzo')) return 'Media mañana'
  if (n.includes('comida')) return 'Comida'
  if (n.includes('merienda') || n.includes('snack')) return 'Merienda'
  if (n.includes('cena')) return 'Cena'
  return null
}

export function tipoPlatoCompatibleConSlot(slot: SlotComida | null, tipoPlato?: string | null): boolean {
  if (!slot || !tipoPlato) return true
  return TIPOS_PERMITIDOS_POR_SLOT[slot].includes(tipoPlato)
}

export function tiposPermitidosPorSlot(slot: SlotComida | null): string[] {
  return slot ? TIPOS_PERMITIDOS_POR_SLOT[slot] : []
}
