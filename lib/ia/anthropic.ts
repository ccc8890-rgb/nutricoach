// lib/ia/anthropic.ts
// Llamada a Claude con el SDK oficial. Solo Anthropic: el resto de proveedores viven en `enrutador.ts`.
import Anthropic from '@anthropic-ai/sdk'

export interface RespuestaClaude { texto: string; uso: { entrada: number; salida: number } }

let cliente: Anthropic | null = null
const clienteAnthropic = () => (cliente ??= new Anthropic()) // lee ANTHROPIC_API_KEY; se crea al primer uso para no fallar al compilar sin clave

/**
 * Claude con razonamiento adaptativo (siempre activo en Opus 5.5), esfuerzo alto y respaldo automático ante rechazos de seguridad
 * (`fallbacks: 'default'`). Streaming porque las respuestas son largas. `signal` corta la llamada si se agota el tiempo.
 */
export async function llamarClaude(p: { modelo: string; sistema: string; usuario: string; maxTokens?: number; signal?: AbortSignal }): Promise<RespuestaClaude> {
  const stream = clienteAnthropic().beta.messages.stream(
    {
      model: p.modelo,
      max_tokens: p.maxTokens ?? 32000,
      system: p.sistema,
      messages: [{ role: 'user', content: p.usuario }],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    },
    { signal: p.signal },
  )
  const m = await stream.finalMessage()
  if (m.stop_reason === 'refusal') throw new Error(`Claude rechazó la petición (${m.stop_details?.category ?? 'sin categoría'})`)
  if (m.stop_reason === 'max_tokens') throw new Error('Claude cortó la respuesta por límite de tokens')
  const texto = m.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
  if (!texto.trim()) throw new Error('Claude devolvió una respuesta vacía')
  return { texto, uso: { entrada: m.usage.input_tokens, salida: m.usage.output_tokens } }
}
