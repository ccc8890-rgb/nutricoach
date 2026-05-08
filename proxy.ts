import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Ruta de limpieza forzada: elimina SW y cookies de Safari
    if (request.nextUrl.pathname === '/clear-sw') {
        const res = NextResponse.next()
        res.headers.set('Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"')
        return res
    }

    // Refrescar sesión si existe — esto sincroniza cookies
    // Capturamos errores silenciosamente para evitar bucles por tokens inválidos
    try {
        const { data: { user } } = await supabase.auth.getUser()

        // Solo redirigir si el usuario está realmente autenticado
        if (user && request.nextUrl.pathname === '/login') {
            const url = request.nextUrl.clone()
            url.pathname = '/'
            return NextResponse.redirect(url)
        }
    } catch {
        // Ignorar errores de auth (token inválido, etc.) para evitar bucles
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        // Excluye /api/ porque las route handlers ya se autentican internamente
        '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
