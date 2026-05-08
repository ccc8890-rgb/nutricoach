import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type TipoRegistroIA = 'dieta' | 'informe_semanal' | 'ajuste_macros' | 'recomendacion'

interface LogIAParams {
    coachId: string
    clienteId: string
    tipo: TipoRegistroIA
    prompt: string
    respuestaJson: Record<string, unknown>
    planId?: string
    tokensUsados?: number
}

/** Lazy Supabase admin client — solo se crea cuando se usa */
let _supabaseAdmin: SupabaseClient | null = null
function getAdminClient(): SupabaseClient {
    if (!_supabaseAdmin) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !key) {
            throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para ia-logger')
        }
        _supabaseAdmin = createClient(url, key)
    }
    return _supabaseAdmin
}

/**
 * Registra una interacción con DeepSeek en la tabla `registros_ia`.
 * Úsalo en todos los endpoints de IA para tener un historial completo.
 * Usa service role para evitar dependencia de cookies de sesión.
 */
export async function registrarInteraccionIA(params: LogIAParams): Promise<string | null> {
    try {
        const supabaseAdmin = getAdminClient()
        const { data, error } = await supabaseAdmin
            .from('registros_ia')
            .insert({
                coach_id: params.coachId,
                cliente_id: params.clienteId,
                tipo: params.tipo,
                prompt: params.prompt,
                respuesta_json: params.respuestaJson,
                plan_id: params.planId ?? null,
                tokens_usados: params.tokensUsados ?? null,
            })
            .select('id')
            .single()

        if (error) {
            console.error('[ia-logger] Error al registrar:', error)
            return null
        }

        return data?.id ?? null
    } catch (err) {
        console.error('[ia-logger] Error:', err)
        return null
    }
}

/**
 * Obtiene el historial completo de interacciones IA para un cliente.
 */
export async function obtenerHistorialIA(clienteId: string) {
    try {
        const supabaseAdmin = getAdminClient()
        const { data, error } = await supabaseAdmin
            .from('registros_ia')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('[ia-logger] Error al obtener historial:', error)
            return []
        }

        return data ?? []
    } catch (err) {
        console.error('[ia-logger] Error:', err)
        return []
    }
}
