import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { type NextRequest } from 'next/server'

/**
 * Crea un cliente Supabase para Server Components y Server Actions.
 * Usa `next/headers` para acceder a las cookies de la petición entrante.
 */
export async function createServerSupabase() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // ignore - can happen in middlewares
                    }
                },
            },
        }
    )
}

/**
 * Cliente Supabase con service_role_key para bypass de RLS.
 * Útil para lecturas de catálogo público (alimentos, ejercicios)
 * desde API routes, evitando dependencia de cookies de sesión.
 *
 * USO:
 *   import { createServiceSupabase } from '@/lib/supabase-server'
 *   const supabase = createServiceSupabase()
 *   const { data } = await supabase.from('alimentos').select('*')
 */
export function createServiceSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    )
}

/**
 * Crea un cliente Supabase para API Route Handlers.
 * Extrae las cookies directamente del objeto `NextRequest`, evitando
 * la dependencia de `next/headers` que puede fallar en ciertos contextos.
 *
 * USO:
 *   export async function GET(request: NextRequest) {
 *       const supabase = createApiSupabase(request)
 *       ...
 *   }
 */
export function createApiSupabase(request: NextRequest) {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                },
            },
        }
    )
}
