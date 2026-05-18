import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rate limiter en memoria simple para endpoints del portal cliente
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RL_LIMIT = 60
const RL_WINDOW_MS = 60_000

function rateLimitMiddleware(request: NextRequest): NextResponse | null {
    // Solo aplicar a rutas del portal cliente
    if (!request.nextUrl.pathname.startsWith('/api/cliente/')) {
        return null
    }

    const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown'

    const now = Date.now()
    const entry = rateLimitMap.get(ip)

    if (!entry || entry.resetAt < now) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS })
        if (rateLimitMap.size > 1000) {
            for (const [key, val] of rateLimitMap.entries()) {
                if (val.resetAt < now) rateLimitMap.delete(key)
            }
        }
        return null // continue
    }

    entry.count++

    if (entry.count > RL_LIMIT) {
        return NextResponse.json(
            { error: 'Demasiadas solicitudes. Inténtalo en un momento.' },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': RL_LIMIT.toString(),
                    'X-RateLimit-Remaining': '0',
                    'Retry-After': Math.ceil((entry.resetAt - now) / 1000).toString(),
                },
            }
        )
    }

    return null // continue
}

export async function proxy(request: NextRequest) {
    // Rate limiting antes que nada
    const rateLimitResponse = rateLimitMiddleware(request)
    if (rateLimitResponse) return rateLimitResponse
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
