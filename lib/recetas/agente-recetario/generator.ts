// lib/recetas/agente-recetario/generator.ts
import type { RecetaCandidata, RecetaCoverageGap } from './types'
import { AGENTE_RECETARIO_DEFAULTS } from './types'
import { PLANTILLAS_RECETARIO_PRO } from './templates'
import { filtrarEsqueletos } from '../esqueletos/index'
import type { Esqueleto, IngredienteEsqueleto } from '../esqueletos/types'

// Contexto de preferencias del cliente para personalizar esqueletos
export type PreferenciasCliente = {
  alimentos_favoritos:    string[]
  alimentos_rechazados:   string[]
  intolerancias:          string[]
  patologias:             string[]
  tecnicas_preferidas:    string[]
  dieta_habitual:         string | null
}

// ── Selección basada en esqueletos nuevos ─────────────────────────

export function seleccionarEsqueleto(
  gap: RecetaCoverageGap,
  preferencias?: PreferenciasCliente,
): Esqueleto | null {
  const patologias = preferencias?.patologias ?? []
  const fodmapsMaximo = patologias.includes('colon_irritable') ? 'bajos' as const : undefined

  const compatibles = filtrarEsqueletos({
    objetivo:      gap.objetivo,
    momento:       gap.momento,
    tipoPlato:     gap.tipoPlato,
    deporte:       gap.deporte,
    patologias,
    fodmapsMaximo,
  })

  if (!compatibles.length) return null

  // Priorizar esqueletos con patologias_compatibles específicas si el cliente las tiene
  if (patologias.length) {
    const especifico = compatibles.find(e =>
      patologias.some(p => e.metadatos.patologias_compatibles.includes(p))
    )
    if (especifico) return especifico
  }

  return compatibles[0]
}

export function aplicarSustituciones(
  esqueleto: Esqueleto,
  preferencias: PreferenciasCliente,
): IngredienteEsqueleto[] {
  return esqueleto.ingredientes.map((ing) => {
    if (ing.esFijo) return ing

    // Si el alimento está rechazado, buscar sustitución en el mismo rol
    const rechazado = preferencias.alimentos_rechazados.some(r =>
      ing.nombre.toLowerCase().includes(r.toLowerCase())
    )

    if (!rechazado) return ing

    const sustituciones = esqueleto.sustituciones[ing.rol] ?? []
    const alternativa = sustituciones.find(s =>
      !preferencias.alimentos_rechazados.some(r =>
        s.toLowerCase().includes(r.toLowerCase())
      ) &&
      !preferencias.intolerancias.some(int =>
        s.toLowerCase().includes(int.toLowerCase())
      )
    )

    if (!alternativa) return ing
    return { ...ing, nombre: alternativa }
  })
}

export function construirBriefingPersonalizado(
  esqueleto: Esqueleto,
  ingredientesAdaptados: IngredienteEsqueleto[],
  preferencias: PreferenciasCliente,
): string {
  const ings = ingredientesAdaptados
    .map(i => `- ${i.gramos}g de ${i.nombre}`)
    .join('\n')

  const tecnica = preferencias.tecnicas_preferidas.length
    ? preferencias.tecnicas_preferidas[0]
    : esqueleto.tecnica

  const contextoPref = [
    preferencias.dieta_habitual ? `Estilo de dieta habitual del cliente: ${preferencias.dieta_habitual}` : '',
    preferencias.alimentos_favoritos.length ? `Alimentos favoritos: ${preferencias.alimentos_favoritos.join(', ')}` : '',
    preferencias.tecnicas_preferidas.length ? `Técnica de cocina preferida: ${preferencias.tecnicas_preferidas[0]}` : '',
  ].filter(Boolean).join('\n')

  return `Eres un chef mediterráneo español experto en nutrición deportiva.
Crea una receta atractiva en castellano de España con estos ingredientes.

TÉCNICA: ${tecnica}
TIPO DE PLATO: ${esqueleto.tipoPlato}
INGREDIENTES:
${ings}
${contextoPref ? `\nCONTEXTO DEL CLIENTE:\n${contextoPref}` : ''}

REGLAS — si las incumples la receta es rechazada:
- NUNCA en nombre/descripción/instrucciones: tapering, pre-entreno, post-entreno, carga cho, TDEE, macros, proteico, fit, healthy, saludable (adjetivo), bowl, dorado (culinario), FODMAP, colon irritable, dislipidemia, hipotiroidismo, resistencia insulina
- Nombre: receta casera mediterránea española. Ej: "Arroz meloso con pollo y calabacín", "Merluza al vapor con patata"
- Instrucciones con intención culinaria: textura, punto de cocción, montaje

Responde SOLO con este JSON:
{"nombre":"...","descripcion":"...","instrucciones":["...","...","...","..."],"consejos":"..."}`
}

// ── Selector legacy (compatible con agente-recetario-pro.ts) ──────

export function generarCandidatasDesdeHueco(
  gap: RecetaCoverageGap,
  options: { cantidad?: number; preferencias?: PreferenciasCliente } = {},
): Omit<RecetaCandidata, 'nombre' | 'descripcion' | 'instrucciones'>[] {
  const cantidad = Math.min(
    options.cantidad ?? 3,
    AGENTE_RECETARIO_DEFAULTS.maxCandidatesPerRun,
  )

  const compatibles = PLANTILLAS_RECETARIO_PRO.filter((template) =>
    template.objetivos.includes(gap.objetivo)
    && (!gap.momento || template.momentos.includes(gap.momento))
    && (!gap.tipoPlato || template.tipoPlato.toLowerCase() === gap.tipoPlato.toLowerCase())
  )

  return compatibles
    .slice(0, cantidad)
    .map((template) =>
      template.factory({
        objetivo: gap.objetivo,
        deporte: gap.deporte,
        momento: gap.momento,
      })
    )
}
