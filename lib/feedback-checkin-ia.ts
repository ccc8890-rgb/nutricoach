// lib/feedback-checkin-ia.ts
// Gemini 2.5 Flash: feedback post-checkin — tarea diaria simple
// Baratísimo ($0.075/M tokens), rápido, calidad suficiente para mensajes cortos

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash'

interface DatosCheckin {
    nombre: string
    peso?: number | null
    adherencia?: number | null  // 1-10
    energia?: number | null     // 1-10
    sueno?: number | null       // 1-10
    objetivo?: string | null
}

export async function generarFeedbackCheckinIA(datos: DatosCheckin): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return null

    const partes = []
    if (datos.peso != null) partes.push(`peso: ${datos.peso} kg`)
    if (datos.adherencia != null) partes.push(`adherencia al plan: ${datos.adherencia}/10`)
    if (datos.energia != null) partes.push(`energía: ${datos.energia}/10`)
    if (datos.sueno != null) partes.push(`sueño: ${datos.sueno}/10`)
    if (datos.objetivo != null) partes.push(`objetivo: ${datos.objetivo}`)

    const prompt = `Eres el coach nutricional personal de ${datos.nombre}. Responde en español, tono cálido y motivador. Máximo 3 frases cortas. Sin emojis en exceso (máximo 1). Sin saludos como "¡Hola!" — ir directo al feedback.

Datos del check-in: ${partes.join(', ')}.

Escribe el feedback breve y personalizado.`

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 9000)

        const res = await fetch(
            `${GEMINI_API}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
                }),
                signal: controller.signal,
            }
        )
        clearTimeout(timeout)

        if (!res.ok) return null
        const json = await res.json()
        return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
    } catch {
        return null
    }
}
