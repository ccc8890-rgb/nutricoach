// lib/feedback-checkin-ia.ts
// Genera un mensaje corto de feedback personalizado tras un check-in

interface DatosCheckin {
    nombre: string        // nombre del cliente
    peso?: number | null
    adherencia?: number | null  // 1-10
    energia?: number | null     // 1-10
    sueno?: number | null       // 1-10
    objetivo?: string | null    // objetivo del cliente (perder_grasa, ganar_musculo, etc.)
}

export async function generarFeedbackCheckinIA(datos: DatosCheckin): Promise<string | null> {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return null

    const partes = []
    if (datos.peso) partes.push(`peso: ${datos.peso} kg`)
    if (datos.adherencia) partes.push(`adherencia al plan: ${datos.adherencia}/10`)
    if (datos.energia) partes.push(`energía: ${datos.energia}/10`)
    if (datos.sueno) partes.push(`sueño: ${datos.sueno}/10`)
    if (datos.objetivo) partes.push(`objetivo: ${datos.objetivo}`)

    const resumenCheckin = partes.join(', ')

    const payload = {
        model: 'deepseek-chat',
        temperature: 0.7,
        max_tokens: 120,
        messages: [
            {
                role: 'system',
                content: `Eres el coach nutricional personal de ${datos.nombre}. Responde siempre en español, con tono cálido y motivador. Máximo 3 frases cortas. Sin emojis en exceso (máximo 1). Sin saludos como "¡Hola!" — ir directo al feedback.`,
            },
            {
                role: 'user',
                content: `Datos del check-in de esta semana: ${resumenCheckin}. Dame un feedback breve y personalizado.`,
            },
        ],
    }

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 9000) // 9s timeout

        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!res.ok) return null
        const json = await res.json()
        return json.choices?.[0]?.message?.content?.trim() ?? null
    } catch {
        return null // timeout o error de red → silencioso
    }
}
