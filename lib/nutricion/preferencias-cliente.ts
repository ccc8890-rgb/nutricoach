// Preferencias del cliente que usa el planificador para no romper con su vida y aprender de lo que cambia:
//  - platos habituales del cuestionario inicial (dieta_habitual_cliente): lo que ya come y cómo
//  - recetas que descartó al cambiarlas por otra (receta_interacciones_cliente.tipo = 'swap_rechazada')
//  - alimentos que evita (perfil de gusto)
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlatoHabitualCliente } from '@/lib/dieta-habitual'
import { obtenerPerfilCliente } from '@/lib/agentes/perfil-gusto'

export type PreferenciasCliente = {
  habituales: PlatoHabitualCliente[]
  rechazos: Map<string, number> // receta_id → veces que la cambió por otra
  evitar: string[] // alimentos o ingredientes que no quiere (sin tildes)
}

export const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const GENERICAS = new Set(['con', 'sin', 'para', 'del', 'las', 'los', 'una', 'uno', 'por', 'plato', 'comida', 'natural', 'casero', 'cena', 'desayuno', 'merienda', 'algo', 'poco', 'suelo', 'normalmente'])
const palabras = (t: string) => sinTildes(t).split(/[^a-zñ]+/).filter(w => w.length >= 4 && !GENERICAS.has(w)).map(raiz)
// Raíz muy simple para que «tostadas» y «tostada» o «huevos» y «huevo» coincidan
function raiz(w: string) { return w.replace(/(es|s)$/, '') }

const MOMENTO: Record<string, string> = { 'Desayuno': 'desayuno', 'Media mañana': 'media_manana', 'Comida': 'comida', 'Merienda': 'merienda', 'Cena': 'cena' }
const delMomento = (h: PlatoHabitualCliente, franja: string) => h.momento === 'general' || h.momento === MOMENTO[franja]

export async function cargarPreferencias(db: SupabaseClient, clienteId: string): Promise<PreferenciasCliente> {
  const [{ data: hab }, { data: rech }, perfil] = await Promise.all([
    db.from('dieta_habitual_cliente').select('*').eq('cliente_id', clienteId),
    db.from('receta_interacciones_cliente').select('receta_id').eq('cliente_id', clienteId).eq('tipo', 'swap_rechazada').limit(500),
    obtenerPerfilCliente(clienteId).catch(() => null),
  ])
  const rechazos = new Map<string, number>()
  for (const r of (rech ?? []) as { receta_id: string }[]) rechazos.set(r.receta_id, (rechazos.get(r.receta_id) ?? 0) + 1)
  const evitar = [...(perfil?.ingredientes_evitar ?? []), ...(perfil?.aversiones_blandas ?? [])].map(sinTildes).filter(x => x.length >= 3)
  return { habituales: (hab ?? []) as PlatoHabitualCliente[], rechazos, evitar }
}

// 0..1: cuánto se parece una receta (nombre + ingredientes) a lo que el cliente ya come en esa franja
export function afinidadHabitual(textoReceta: string, franja: string, habituales: PlatoHabitualCliente[]): number {
  const palabrasReceta = new Set(palabras(textoReceta))
  let mejor = 0
  for (const h of habituales.filter(x => delMomento(x, franja))) {
    const claves = new Set([...palabras(h.plato_normalizado), ...h.ingredientes_clave.flatMap(palabras)])
    if (claves.size === 0) continue
    const coinciden = [...claves].filter(k => palabrasReceta.has(k)).length
    const a = coinciden >= 2 || (coinciden === 1 && claves.size === 1) ? 1 : coinciden === 1 ? 0.5 : 0
    mejor = Math.max(mejor, a * (h.modificable === 'sustituible' ? 0.5 : 1))
  }
  return mejor
}

// ¿Un complemento (fruta, yogur…) está entre lo que el cliente suele comer en esa franja?
export const esHabitualComplemento = (nombre: string, franja: string, habituales: PlatoHabitualCliente[]) =>
  afinidadHabitual(nombre, franja, habituales.filter(h => h.importancia_adherencia !== 'baja')) > 0

export const lleva = (texto: string, evitar: string[]) => { const t = sinTildes(texto); return evitar.some(e => t.includes(e)) }

// Comidas al día que el cliente dijo hacer en el cuestionario (desayuno, media mañana…); hace falta que cite al menos 3
const SLOT_DE_MOMENTO: Record<string, string> = { desayuno: 'Desayuno', media_manana: 'Media mañana', comida: 'Comida', merienda: 'Merienda', cena: 'Cena' }
export function franjasDeHabitual(habituales: PlatoHabitualCliente[]): string[] {
  const f = new Set(habituales.map(h => SLOT_DE_MOMENTO[h.momento]).filter(Boolean))
  return f.size >= 3 ? [...f] : []
}
