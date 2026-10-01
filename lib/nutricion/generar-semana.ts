// Selección pura de recetas para una semana: sin repetir, franjas escasas primero y variedad de proteína.
// Las candidatas llegan ya filtradas y ordenadas por el motor (restricciones, verificadas, encaje de macros).

export type CandidataSemana = { id: string; nombre: string }
export type Hueco = { dia: string; franja: string }
export type Asignacion = Hueco & { receta_id: string; repetida: boolean }

const PROTEINAS = ['pollo', 'pavo', 'ternera', 'cerdo', 'salmon', 'atun', 'merluza', 'bacalao', 'gamba', 'langostino', 'huevo', 'tofu', 'garbanzo', 'lenteja', 'skyr', 'yogur', 'queso']
// Cuántas candidatas de cabecera se miran para encontrar otra proteína sin sacrificar demasiado el encaje de macros
const VENTANA_VARIEDAD = 8

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function claveProteina(nombre: string): string | null {
  const n = sinTildes(nombre)
  return PROTEINAS.find(p => n.includes(p)) ?? null
}

export function repartirSemanaSinRepetir(
  candidatasPorFranja: Record<string, CandidataSemana[]>,
  huecos: Hueco[],
): { asignaciones: Asignacion[]; sinCubrir: Hueco[] } {
  const usos = new Map<string, number>()
  const ultimaClave = new Map<string, string | null>()
  const clavesFranja = new Map<string, Map<string, number>>()
  const resultado = new Map<Hueco, Asignacion>()
  const sinCubrir: Hueco[] = []

  const escasez = (franja: string) => candidatasPorFranja[franja]?.length ?? 0
  // Sort estable: dentro de una franja se mantiene el orden de días de la entrada
  const orden = [...huecos].sort((a, b) => escasez(a.franja) - escasez(b.franja))

  for (const hueco of orden) {
    const lista = candidatasPorFranja[hueco.franja] ?? []
    if (lista.length === 0) { sinCubrir.push(hueco); continue }

    const libres = lista.filter(c => !usos.has(c.id))
    let elegida: CandidataSemana
    let repetida = false
    if (libres.length > 0) {
      const previa = ultimaClave.get(hueco.franja) ?? null
      const conteo = clavesFranja.get(hueco.franja) ?? new Map<string, number>()
      const distinta = libres.slice(0, VENTANA_VARIEDAD).find(c => {
        const k = claveProteina(c.nombre)
        return k == null || (k !== previa && (conteo.get(k) ?? 0) < 2)
      })
      elegida = distinta ?? libres[0]
    } else {
      // Catálogo agotado para esta semana: la menos usada, y a igualdad la mejor ordenada
      elegida = lista.reduce((mejor, c) => ((usos.get(c.id) ?? 0) < (usos.get(mejor.id) ?? 0) ? c : mejor), lista[0])
      repetida = true
    }

    usos.set(elegida.id, (usos.get(elegida.id) ?? 0) + 1)
    const k = claveProteina(elegida.nombre)
    ultimaClave.set(hueco.franja, k)
    if (k) {
      const m = clavesFranja.get(hueco.franja) ?? new Map<string, number>()
      m.set(k, (m.get(k) ?? 0) + 1)
      clavesFranja.set(hueco.franja, m)
    }
    resultado.set(hueco, { ...hueco, receta_id: elegida.id, repetida })
  }

  // Salida en el orden original de los huecos
  return { asignaciones: huecos.flatMap(h => (resultado.has(h) ? [resultado.get(h)!] : [])), sinCubrir }
}
