/**
 * API route: /api/precios/escandallo
 * Cálculo de escandallo (costes por cliente/plan/supermercado)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { calcularCostePlan } from '@/lib/precios-supermercado'

export async function GET(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { searchParams } = new URL(request.url)
        const clienteId = searchParams.get('cliente_id')
        const supermercadoId = searchParams.get('supermercado_id')

        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const serviceRole = createServiceSupabase()

        // Si viene cliente_id, calcular escandallo para ese cliente
        if (clienteId) {
            // Obtener el plan activo del cliente
            const { data: plan } = await serviceRole
                .from('planes_nutricion')
                .select('*')
                .eq('cliente_id', clienteId)
                .eq('activo', true)
                .single()

            if (!plan) {
                return NextResponse.json({ error: 'Cliente no encontrado o sin plan activo' }, { status: 404 })
            }

            // Obtener comidas del plan
            const { data: comidas } = await serviceRole
                .from('comidas')
                .select('*, comida_alimentos(*, alimentos(*))')
                .eq('plan_id', plan.id)

            if (!comidas || comidas.length === 0) {
                return NextResponse.json({ error: 'El plan no tiene comidas' }, { status: 404 })
            }

            // Construir estructura para calcularCostePlan (solo 2 args: comidas, supermercadoId)
            const comidasData = comidas.map((c: any) => ({
                nombre: c.nombre,
                alimentos: (c.comida_alimentos || []).map((ca: any) => ({
                    alimento: {
                        id: ca.alimento_id,
                        nombre: ca.alimentos?.nombre || '',
                        categoria: ca.alimentos?.categoria || null,
                    },
                    cantidad_gramos: ca.cantidad_gramos,
                })),
            }))

            const resultado = await calcularCostePlan(comidasData, supermercadoId || null)

            return NextResponse.json({
                cliente_id: clienteId,
                plan_id: plan.id,
                plan_nombre: plan.nombre,
                ...resultado,
            })
        }

        // Si no viene cliente_id, listar todos los clientes con escandallo
        // ⚠️ clientes no tiene nombre/apellidos directamente; están en profiles
        const { data: clientes } = await serviceRole
            .from('clientes')
            .select('id, profile_id, planes_nutricion!inner(id, nombre, activo)')

        if (!clientes || clientes.length === 0) {
            return NextResponse.json({ clientes: [] })
        }

        // Obtener profiles para los nombres
        const profileIds = clientes.map(c => c.profile_id).filter(Boolean)
        const { data: perfiles } = await serviceRole
            .from('profiles')
            .select('id, nombre, apellidos')
            .in('id', profileIds)
        const mapaPerfiles = new Map(perfiles?.map(p => [p.id, p]) ?? [])

        const escandallos = []
        for (const cliente of clientes) {
            const planActivo = cliente.planes_nutricion?.find((p: any) => p.activo)
            if (!planActivo) continue

            // Obtener comidas del plan
            const { data: comidas } = await serviceRole
                .from('comidas')
                .select('*, comida_alimentos(*, alimentos(*))')
                .eq('plan_id', planActivo.id)

            if (!comidas || comidas.length === 0) continue

            const comidasData = comidas.map((c: any) => ({
                nombre: c.nombre,
                alimentos: (c.comida_alimentos || []).map((ca: any) => ({
                    alimento: {
                        id: ca.alimento_id,
                        nombre: ca.alimentos?.nombre || '',
                        categoria: ca.alimentos?.categoria || null,
                    },
                    cantidad_gramos: ca.cantidad_gramos,
                })),
            }))

            const resultado = await calcularCostePlan(comidasData, supermercadoId || null)
            const perfil = mapaPerfiles.get(cliente.profile_id)

            escandallos.push({
                cliente_id: cliente.id,
                cliente_nombre: perfil ? `${perfil.nombre} ${perfil.apellidos || ''}`.trim() : 'Cliente',
                plan_id: planActivo.id,
                plan_nombre: planActivo.nombre,
                ...resultado,
            })
        }

        return NextResponse.json({ clientes: escandallos })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Escandallo] Error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
