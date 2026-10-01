// Las cantidades de los pasos de una receta son las de la receta ENTERA (p. ej. «1 kg de carne» para 5 raciones)
// y no coinciden con la ración del cliente: se quitan para remitir a su lista de ingredientes.
const UNIDADES = '(?:g|gr|gramos|kg|ml|cl|l|litros?|cucharadas?|cucharaditas?|cdas?|cdtas?|tazas?|vasos?|dientes?|ramas?|hojas?|pizcas?|puñados?)'
// Palabras que NO son un ingrediente: tiempos, temperaturas, medidas de utensilio, repeticiones…
const NO_CANTIDAD = '(?:minutos?|min|horas?|segundos?|grados?|cm|mm|veces|d[ií]as?|semanas?|pasos?|partes?|capas?|porciones|raciones|personas|moldes?|bolas?|tandas?|lados?)'

export function quitarCifras(texto: string): string {
  return texto
    // Rangos: «1-2 cucharadas de», «2 a 3 dientes de»
    .replace(new RegExp(`\\b\\d+(?:[.,/]\\d+)?\\s?(?:-|–|a)\\s?\\d+(?:[.,/]\\d+)?\\s?${UNIDADES}\\b\\.?\\s*(?:de\\s+|del\\s+)?`, 'gi'), '')
    // «1/2 taza de», «113 g de», «2 cucharadas de"
    .replace(new RegExp(`\\b\\d+(?:[.,/]\\d+)?\\s?${UNIDADES}\\b\\.?\\s*(?:de\\s+|del\\s+)?`, 'gi'), '')
    // «2 cebollas», «1 huevo» (cuentas de ingrediente), salvo tiempos, temperaturas y similares
    .replace(new RegExp(`\\b\\d+(?:[.,/]\\d+)?\\s+(?!${NO_CANTIDAD}\\b|°|º|%)(?=[a-záéíóúñ])`, 'gi'), '')
    // Restos: «aprox. », «aproximadamente de la mezcla», paréntesis o comas vacíos
    .replace(/\b(?:aprox\.?|aproximadamente|unos|unas)\s+(?=de\b|\)|[,.;]|$)/gi, '')
    .replace(/,\s*\)/g, ')').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim()
}
