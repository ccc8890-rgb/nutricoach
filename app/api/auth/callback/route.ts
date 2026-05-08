import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * POST /api/auth/callback
 *
 * Toma el access_token y refresh_token de la sesión actual del cliente
 * y los establece como cookies en el navegador usando NextResponse.
 *
 * IMPORTANTE: NO usar createServerSupabase() aquí porque usa next/headers
 * que es read-only en Route Handlers. En su lugar, usamos createServerClient
 * directamente con NextResponse para escribir cookies correctamente.
 *
 * Antes: usaba createServerSupabase() → cookies.set() era ignorado
 * Ahora: usa NextResponse.cookies.set() → escribe las cookies reales
 */
export async function POST(request: Request) {
    try {
        const { access_token, refresh_token } = await request.json()

        if (!access_token || !refresh_token) {
            return NextResponse.json({ error: 'Faltan tokens' }, { status: 400 })
        }

        // Crear respuesta vacía que modificaremos con cookies
        const response = NextResponse.json({ success: true })

        // Crear cliente Supabase usando NextResponse para cookies
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return [] // No necesitamos leer cookies aquí
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            response.cookies.set(name, value, {
                                ...options,
                                sameSite: 'lax',
                                secure: false, // false en dev (http), true en prod
                                path: '/',
                            })
                        })
                    },
                },
            }
        )

        // Establecer la sesión con los tokens — esto invoca setAll arriba
        const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
        })

        if (error) {
            console.error('Error al establecer sesión:', error.message)
            return NextResponse.json({ error: error.message }, { status: 401 })
        }

        return response
    } catch (error) {
        console.error('Error en auth/callback:', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
