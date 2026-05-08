import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET() {
    try {
        const supabase = await createServerSupabase()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const coachId = user.id

        // ── 1. Obtener clientes ──
        const { data: clientes } = await supabase
            .from('clientes')
            .select('id, profile:profiles!profile_id(nombre, apellidos), created_at, fecha_proxima_revision')
            .eq('coach_id', coachId)

        const clientesData = clientes ?? []

        // ── 2. Obtener dietas ──
        const { data: dietas } = await supabase
            .from('planes_nutricion')
            .select('id, cliente_id, activo, created_at, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo, kcal_objetivo')
            .eq('coach_id', coachId)
            .order('created_at', { ascending: false })

        const dietasData = dietas ?? []

        // ── 3. Obtener respuestas ──
        const { data: respuestas } = await supabase
            .from('respuestas_clientes')
            .select('id, estado, created_at')
            .eq('coach_id', coachId)

        const respuestasData = respuestas ?? []

        // ── 4. Obtener checkins (todos los clientes del coach) ──
        const clienteIds = clientesData.map(c => c.id)
        let checkinsData: any[] = []
        if (clienteIds.length > 0) {
            const { data: checkins } = await supabase
                .from('checkins')
                .select('*')
                .in('cliente_id', clienteIds)
                .order('created_at', { ascending: false })
            checkinsData = checkins ?? []
        }

        // ── 5. Obtener seguimiento_peso ──
        let pesoData: any[] = []
        if (clienteIds.length > 0) {
            const { data: peso } = await supabase
                .from('seguimiento_peso')
                .select('*')
                .in('cliente_id', clienteIds)
                .order('created_at', { ascending: false })
            pesoData = peso ?? []
        }

        // ═══════════════════════════════════════════════
        // MÉTRICAS AGREGADAS
        // ═══════════════════════════════════════════════

        // ── A. Evolución mensual de nuevos clientes (últimos 6 meses) ──
        const meses: string[] = []
        const ahora = new Date()
        for (let i = 5; i >= 0; i--) {
            const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const label = d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
            const count = clientesData.filter(c => {
                const fc = new Date(c.created_at)
                return fc.getFullYear() === d.getFullYear() && fc.getMonth() === d.getMonth()
            }).length
            meses.push(key)
        }

        const nuevosClientesPorMes = meses.map(key => {
            const [year, month] = key.split('-')
            const d = new Date(+year, +month - 1, 1)
            return {
                mes: d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
                key,
                valor: clientesData.filter(c => {
                    const fc = new Date(c.created_at)
                    return fc.getFullYear() === +year && fc.getMonth() === +month - 1
                }).length,
            }
        })

        // ── B. Estado de respuestas ──
        const estadosRespuestas = [
            { estado: 'nueva', label: 'Nuevas', color: '#3B82F6' },
            { estado: 'leida', label: 'Leídas', color: '#8B5CF6' },
            { estado: 'en_revision', label: 'En revisión', color: '#A1A1A6' },
            { estado: 'dieta_aceptada', label: 'Aceptadas', color: '#10B981' },
            { estado: 'dieta_rechazada', label: 'Rechazadas', color: '#EF4444' },
        ]
        const distribucionRespuestas = estadosRespuestas.map(er => ({
            ...er,
            valor: respuestasData.filter(r => r.estado === er.estado).length,
        }))

        // ── C. Tendencia de checkins (últimos 14 días - adherencia promedio) ──
        const ultimos14Dias: { fecha: string; label: string; adherenciaPromedio: number; energiaPromedio: number; suenoPromedio: number; total: number }[] = []
        for (let i = 13; i >= 0; i--) {
            const d = new Date(ahora)
            d.setDate(d.getDate() - i)
            d.setHours(0, 0, 0, 0)
            const finDia = new Date(d)
            finDia.setDate(finDia.getDate() + 1)

            const checkinsDelDia = checkinsData.filter(c => {
                const cc = new Date(c.created_at)
                return cc >= d && cc < finDia
            })

            const n = checkinsDelDia.length
            const adherencia = n > 0 ? checkinsDelDia.reduce((s, c) => s + (c.adherencia || 0), 0) / n : 0
            const energia = n > 0 ? checkinsDelDia.reduce((s, c) => s + (c.energia || 0), 0) / n : 0
            const sueno = n > 0 ? checkinsDelDia.reduce((s, c) => s + (c.sueno || 0), 0) / n : 0

            ultimos14Dias.push({
                fecha: d.toISOString().split('T')[0],
                label: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
                adherenciaPromedio: Math.round(adherencia * 10) / 10,
                energiaPromedio: Math.round(energia * 10) / 10,
                suenoPromedio: Math.round(sueno * 10) / 10,
                total: n,
            })
        }

        // ── D. Evolución de peso (últimos 30 días - promedio) ──
        const hace30Dias = new Date(ahora)
        hace30Dias.setDate(hace30Dias.getDate() - 30)

        const pesoReciente = pesoData.filter(p => new Date(p.created_at) >= hace30Dias)
        const pesoAgrupado: { fecha: string; label: string; pesoPromedio: number; minimo: number; maximo: number; total: number }[] = []

        // Agrupar por día
        const pesoPorDia = new Map<string, number[]>()
        pesoReciente.forEach(p => {
            const dia = new Date(p.created_at).toISOString().split('T')[0]
            if (!pesoPorDia.has(dia)) pesoPorDia.set(dia, [])
            pesoPorDia.get(dia)!.push(p.peso)
        })

        // Ordenar días
        const diasOrdenados = Array.from(pesoPorDia.keys()).sort()
        diasOrdenados.forEach(fecha => {
            const valores = pesoPorDia.get(fecha)!
            const avg = valores.reduce((s, v) => s + v, 0) / valores.length
            pesoAgrupado.push({
                fecha,
                label: new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
                pesoPromedio: Math.round(avg * 100) / 100,
                minimo: Math.round(Math.min(...valores) * 100) / 100,
                maximo: Math.round(Math.max(...valores) * 100) / 100,
                total: valores.length,
            })
        })

        // ── E. Top clientes por check-ins realizados ──
        const checkinsPorCliente = new Map<string, number>()
        checkinsData.forEach(c => {
            checkinsPorCliente.set(c.cliente_id, (checkinsPorCliente.get(c.cliente_id) || 0) + 1)
        })

        const topClientesCheckins = Array.from(checkinsPorCliente.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([clienteId, total]) => {
                const cliente = clientesData.find(c => c.id === clienteId)
                return {
                    id: clienteId,
                    nombre: (cliente as any)?.profile?.nombre || 'Sin nombre',
                    apellidos: (cliente as any)?.profile?.apellidos || '',
                    totalCheckins: total,
                }
            })

        // ── F. Clientes sin checkins en los últimos 7 días ──
        const hace7Dias = new Date(ahora)
        hace7Dias.setDate(hace7Dias.getDate() - 7)

        const clientesConCheckinReciente = new Set(
            checkinsData
                .filter(c => new Date(c.created_at) >= hace7Dias)
                .map(c => c.cliente_id)
        )

        const clientesSinActividadReciente = clientesData
            .filter(c => !clientesConCheckinReciente.has(c.id))
            .map(c => ({
                id: c.id,
                nombre: (c as any)?.profile?.nombre || 'Sin nombre',
                apellidos: (c as any)?.profile?.apellidos || '',
            }))

        // ── G. Totales rápidos ──
        const totales = {
            totalClientes: clientesData.length,
            totalDietasActivas: dietasData.filter(d => d.activo).length,
            totalDietasInactivas: dietasData.filter(d => !d.activo).length,
            clientesConDieta: new Set(dietasData.filter(d => d.cliente_id).map(d => d.cliente_id)).size,
            clientesSinDieta: clientesData.length - new Set(dietasData.filter(d => d.cliente_id).map(d => d.cliente_id)).size,
            totalCheckins: checkinsData.length,
            totalRespuestas: respuestasData.length,
            respuestasPendientes: respuestasData.filter(r => r.estado === 'nueva' || r.estado === 'dieta_rechazada').length,
        }

        // ── H. Dietas por cliente (distribución) ──
        const dietasPorCliente = new Map<string, number>()
        dietasData.forEach(d => {
            if (d.cliente_id) {
                dietasPorCliente.set(d.cliente_id, (dietasPorCliente.get(d.cliente_id) || 0) + 1)
            }
        })

        const distribucionDietas = {
            con1Dieta: 0,
            con2a3Dietas: 0,
            conMasDe3: 0,
            sinDietas: 0,
        }
        clientesData.forEach(c => {
            const count = dietasPorCliente.get(c.id) || 0
            if (count === 0) distribucionDietas.sinDietas++
            else if (count === 1) distribucionDietas.con1Dieta++
            else if (count <= 3) distribucionDietas.con2a3Dietas++
            else distribucionDietas.conMasDe3++
        })

        // ── I. Actividad diaria reciente (últimos 7 días) ──
        const actividadDiaria: { label: string; dietas: number; respuestas: number; checkins: number; total: number }[] = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date(ahora)
            d.setDate(d.getDate() - i)
            d.setHours(0, 0, 0, 0)
            const finDia = new Date(d)
            finDia.setDate(finDia.getDate() + 1)

            const dietasHoy = dietasData.filter(dt => {
                const c = new Date(dt.created_at)
                return c >= d && c < finDia
            }).length

            const respuestasHoy = respuestasData.filter(r => {
                const c = new Date(r.created_at)
                return c >= d && c < finDia
            }).length

            const checkinsHoy = checkinsData.filter(c => {
                const cc = new Date(c.created_at)
                return cc >= d && cc < finDia
            }).length

            actividadDiaria.push({
                label: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
                dietas: dietasHoy,
                respuestas: respuestasHoy,
                checkins: checkinsHoy,
                total: dietasHoy + respuestasHoy + checkinsHoy,
            })
        }

        return NextResponse.json({
            totales,
            nuevosClientesPorMes,
            distribucionRespuestas,
            tendenciaCheckins: ultimos14Dias,
            evolucionPeso: pesoAgrupado,
            topClientesCheckins,
            clientesSinActividadReciente,
            distribucionDietas,
            actividadDiaria,
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error('Error en analytics:', error)
        return NextResponse.json({ error: 'Error al cargar analytics' }, { status: 500 })
    }
}
