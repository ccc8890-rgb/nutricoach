import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Cliente Supabase para el navegador (Client Components).
 * Usa createBrowserClient de @supabase/ssr para que la sesión se almacene
 * en COOKIES en lugar de localStorage.
 *
 * Esto permite que:
 *  - El cliente y el servidor compartan la misma sesión (mismas cookies)
 *  - El Server Component (page.tsx) pueda leer la sesión sin depender del callback
 *  - Safari no tenga problemas de persistencia de sesión
 *
 * Antes usaba createClient de @supabase/supabase-js que guardaba en localStorage
 * → la sesión del cliente NO era visible para el servidor y viceversa.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    // Configuración de cookies compatible con Safari
    cookieOptions: {
        sameSite: 'lax',      // Necesario para que las cookies se envíen en navegación
        secure: false,         // false en dev (http), true en producción (https)
        path: '/',
    },
})
