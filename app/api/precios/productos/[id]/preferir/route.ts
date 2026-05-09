/**
 * POST /api/precios/productos/[id]/preferir
 *
 * Marca un producto de supermercado como "preferido" para su alimento.
 * Desmarca automáticamente cualquier otro producto del mismo alimento
 * en el mismo supermercado.
 *
 * Body (opcional): { supermercado_id?: string, alimento_id?: string }
 * Si no se proporcionan, se obtienen del propio producto.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: productoId } = await params

        if (!productoId) {
            return NextResponse.json(
                { error: 'Falta el ID del producto' },
                { status: 400 }
            )
        }

        // Verificar autenticación
        const authSupabase = createApiSupabase(request)
        const { data: { user } } = await authSupabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // Verificar que es coach
        const { data: profile } = await authSupabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'coach') {
            return NextResponse.json(
                { error: 'Solo el coach puede marcar productos preferidos' },
                { status: 403 }
            )
        }

        const srv = createServiceSupabase()

        // 1. Obtener datos del producto (alimento_id y supermercado_id)
        const { data: producto } = await srv
            .from('productos_supermercado')
            .select('id, alimento_id, supermercado_id')
            .eq('id', productoId)
            .single()

        if (!producto) {
            return NextResponse.json(
                { error: 'Producto no encontrado' },
                { status: 404 }
            )
        }

        // 2. Desmarcar todos los preferidos de este alimento en este supermercado
        const { error: unmarkError } = await srv
            .from('productos_supermercado')
            .update({ preferido: false })
            .eq('alimento_id', producto.alimento_id)
            .eq('supermercado_id', producto.supermercado_id)

        if (unmarkError) {
            console.error('[API Preferir] Error al desmarcar previos:', unmarkError.message)
            return NextResponse.json(
                { error: 'Error al desmarcar preferidos anteriores', detalle: unmarkError.message },
                { status: 500 }
            )
        }

        // 3. Marcar el producto seleccionado como preferido
        const { error: markError } = await srv
            .from('productos_supermercado')
            .update({ preferido: true })
            .eq('id', productoId)

        if (markError) {
            console.error('[API Preferir] Error al marcar preferido:', markError.message)
            return NextResponse.json(
                { error: 'Error al marcar como preferido', detalle: markError.message },
                { status: 500 }
            )
        }

        // 4. Devolver el estado actualizado
        return NextResponse.json({
            success: true,
            producto_id: productoId,
            alimento_id: producto.alimento_id,
            supermercado_id: producto.supermercado_id,
            preferido: true,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Preferir] Excepción:', msg)
        return NextResponse.json(
            { error: 'Error interno', detalle: msg },
            { status: 500 }
        )
    }
}
