// lib/recetas/agente-recetario/vocabulary-guard.ts

const TERMINOS_PROHIBIDOS: Array<{ patron: RegExp; sugerencia: string }> = [
  { patron: /\btapering\b/i,         sugerencia: 'día de carga ligera' },
  { patron: /\bpre[- ]entreno\b/i,   sugerencia: 'antes del ejercicio' },
  { patron: /\bpost[- ]entreno\b/i,  sugerencia: 'después del ejercicio' },
  { patron: /\bcarga\s+cho\b/i,      sugerencia: 'jornada de energía' },
  { patron: /\bcarga\s+de\s+carbohidratos\b/i, sugerencia: 'jornada de energía' },
  { patron: /\bTDEE\b/,              sugerencia: 'gasto energético' },
  { patron: /\bmacros\b/i,           sugerencia: '' },
  { patron: /\bproteico\b/i,         sugerencia: '' },
  { patron: /\bfit\b/i,              sugerencia: '' },
  { patron: /\bhealthy\b/i,          sugerencia: '' },
  { patron: /\bsaludable\b/i,        sugerencia: 'casero' },
  { patron: /\bbol\b/i,              sugerencia: 'plato' },
  { patron: /\bbowl\b/i,             sugerencia: 'plato' },
  { patron: /\bsmoothi/i,            sugerencia: 'batido' },
  { patron: /\bacaí\b/i,             sugerencia: '' },
  { patron: /\bgranola\s+bowl\b/i,   sugerencia: 'copos con frutas' },
  { patron: /\bdorado\b/i,           sugerencia: 'tostado' },  // sentido culinario latinoamericano
  { patron: /\bRPE\b/,               sugerencia: '' },
  { patron: /\bRIR\b/,               sugerencia: '' },
  { patron: /\bHRV\b/,               sugerencia: '' },
  { patron: /\bTLS\b/,               sugerencia: '' },
  { patron: /\bkcal\b/i,             sugerencia: '' },
  { patron: /\bIG\s+bajo\b/i,        sugerencia: '' },
  { patron: /\bFODMAP/i,             sugerencia: '' },
  { patron: /\bgoitrógenos?\b/i,     sugerencia: '' },
  { patron: /\bdislipidemia\b/i,     sugerencia: '' },
  { patron: /\bhipotiroidismo\b/i,   sugerencia: '' },
  { patron: /\bresistencia\s+a\s+la\s+insulina\b/i, sugerencia: '' },
  { patron: /\bcolon\s+irritable\b/i, sugerencia: '' },
  { patron: /para\s+el?\s+rendimiento\b/i, sugerencia: '' },
  { patron: /para\s+(la\s+)?recuperación\b/i, sugerencia: '' },
]

export type VocabularyViolation = {
  campo: string
  patron: string
  sugerencia: string
}

export type VocabularyResult = {
  valido: boolean
  violaciones: VocabularyViolation[]
}

export function validarVocabulario(receta: {
  nombre: string
  descripcion: string
  instrucciones: string[]
  consejos?: string
}): VocabularyResult {
  const violaciones: VocabularyViolation[] = []

  const camposARevisar: Array<[string, string]> = [
    ['nombre', receta.nombre],
    ['descripcion', receta.descripcion],
    ['instrucciones', receta.instrucciones.join(' ')],
    ['consejos', receta.consejos ?? ''],
  ]

  for (const [campo, texto] of camposARevisar) {
    for (const { patron, sugerencia } of TERMINOS_PROHIBIDOS) {
      if (patron.test(texto)) {
        violaciones.push({ campo, patron: patron.source, sugerencia })
      }
    }
  }

  return { valido: violaciones.length === 0, violaciones }
}
