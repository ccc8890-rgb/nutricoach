/**
 * GET /api/precios/alimento/[id]/productos
 *
 * Devuelve TODOS los productos de supermercado que apuntan a un mismo alimento.
 * A diferencia de la vista `mejores_precios_por_alimento` (que solo da 1 por supermercado),
 * aquí se listan todas las opciones comerciales disponibles.
 *
 * Útil para el selector de producto en el escandallo y para que el coach
 * compare precios entre distintas variantes (marca, calidad, etc.).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: alimentoId } = await params

        if (!alimentoId) {
            return NextResponse.json(
                { error: 'Falta el ID del alimento' },
                { status: 400 }
            )
        }

        // Verificar autenticación
        const supabase = createApiSupabase(_request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const srv = createServiceSupabase()

        // 1. Obtener info del alimento
        const { data: alimento } = await srv
            .from('alimentos')
            .select('id, nombre, categoria')
            .eq('id', alimentoId)
            .single()

        if (!alimento) {
            return NextResponse.json(
                { error: 'Alimento no encontrado' },
                { status: 404 }
            )
        }

        // 2. Obtener TODOS los productos que apuntan a este alimento,
        //    con info del supermercado, ordenados por supermercado y precio
        const { data: productos, error } = await srv
            .from('productos_supermercado')
            .select(`
                id,
                supermercado_id,
                alimento_id,
                precio_por_kg,
                precio_unidad,
                unidad,
                url_producto,
                nombre_original,
                marca,
                preferido,
                fecha_precio,
                supermercados!inner(
                    nombre,
                    slug,
                    color
                )
            `)
            .eq('alimento_id', alimentoId)
            .order('supermercado_id', { ascending: true })
            .order('precio_por_kg', { ascending: true })

        if (error) {
            console.error('[API /api/precios/alimento/:id/productos] Error:', error.message)
            return NextResponse.json(
                { error: 'Error al cargar productos', detalle: error.message },
                { status: 500 }
            )
        }

        // 3. Mapear respuesta plana
        const productosFlat = (productos ?? []).map((p: any) => ({
            id: p.id,
            supermercado_id: p.supermercado_id,
            supermercado_nombre: p.supermercados?.nombre || '',
            supermercado_slug: p.supermercados?.slug || '',
            supermercado_color: p.supermercados?.color || null,
            nombre_original: p.nombre_original,
            marca: p.marca,
            precio_por_kg: p.precio_por_kg,
            precio_unidad: p.precio_unidad,
            unidad: p.unidad,
            url_producto: p.url_producto,
            preferido: p.preferido,
            fecha_precio: p.fecha_precio,
        }))

        return NextResponse.json({
            alimento_id: alimento.id,
            alimento_nombre: alimento.nombre,
            alimento_categoria: alimento.categoria,
            total_productos: productosFlat.length,
            productos: productosFlat,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API /api/precios/alimento/:id/productos] Excepción:', msg)
        return NextResponse.json(
            { error: 'Error interno', detalle: msg },
            { status: 500 }
        )
    }
}
