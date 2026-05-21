import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import {
    calcularGapMicronutrientes,
    crearTotalesMicronutrientes,
    seleccionarMicronutrientesPrioritarios,
    type TotalesMicronutrientes,
} from '@/lib/micronutrientes/gap-report'

interface AlimentoMicros {
    fibra?: number | null
    azucares?: number | null
    azucares_anyadidos?: number | null
    sodio_mg?: number | null
    calcio_mg?: number | null
    hierro_mg?: number | null
    magnesio_mg?: number | null
    potasio_mg?: number | null
    zinc_mg?: number | null
    vitamina_d_ug?: number | null
    vitamina_b12_ug?: number | null
    saturados_g?: number | null
}

interface ComidaAlimentoMicros {
    cantidad_gramos: number | null
    alimento: AlimentoMicros | null
}

function sumarCampo(
    totales: TotalesMicronutrientes,
    key: keyof TotalesMicronutrientes,
    valor100g: number | null | undefined,
    factor: number
) {
    totales[key] += (valor100g ?? 0) * factor
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    const { codigo } = await params
    const db = createServiceSupabase()

    const { data: plan } = await db
        .from('planes_nutricion')
        .select('id, nombre, cliente_id')
        .eq('codigo_publico', codigo)
        .eq('activo', true)
        .single()

    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

    let perfil: {
        sexo?: string | null
        edad?: number | null
        objetivo?: string | null
        condiciones?: string[] | null
    } | undefined

    if (plan.cliente_id) {
        const { data: cliente } = await db
            .from('clientes')
            .select('sexo, edad, objetivo, restricciones_alimentarias')
            .eq('id', plan.cliente_id)
            .single()

        if (cliente) {
            perfil = {
                sexo: cliente.sexo,
                edad: cliente.edad,
                objetivo: cliente.objetivo,
                condiciones: cliente.restricciones_alimentarias
                    ? [cliente.restricciones_alimentarias]
                    : null,
            }
        }
    }

    const { data: comidas } = await db
        .from('comidas')
        .select(`
            nombre,
            comida_alimentos(
                cantidad_gramos,
                alimento:alimentos(
                    fibra,
                    azucares,
                    azucares_anyadidos,
                    sodio_mg,
                    calcio_mg,
                    hierro_mg,
                    magnesio_mg,
                    potasio_mg,
                    zinc_mg,
                    vitamina_d_ug,
                    vitamina_b12_ug,
                    saturados_g
                )
            )
        `)
        .eq('plan_id', plan.id)

    const totales = crearTotalesMicronutrientes()

    for (const comida of comidas ?? []) {
        const alimentos = comida.comida_alimentos as unknown as ComidaAlimentoMicros[]
        for (const item of alimentos ?? []) {
            if (!item.alimento) continue
            const factor = (item.cantidad_gramos ?? 0) / 100
            sumarCampo(totales, 'fibra_g', item.alimento.fibra, factor)
            sumarCampo(totales, 'azucares_g', item.alimento.azucares, factor)
            sumarCampo(totales, 'azucares_anyadidos_g', item.alimento.azucares_anyadidos, factor)
            sumarCampo(totales, 'sodio_mg', item.alimento.sodio_mg, factor)
            sumarCampo(totales, 'calcio_mg', item.alimento.calcio_mg, factor)
            sumarCampo(totales, 'hierro_mg', item.alimento.hierro_mg, factor)
            sumarCampo(totales, 'magnesio_mg', item.alimento.magnesio_mg, factor)
            sumarCampo(totales, 'potasio_mg', item.alimento.potasio_mg, factor)
            sumarCampo(totales, 'zinc_mg', item.alimento.zinc_mg, factor)
            sumarCampo(totales, 'vitamina_d_ug', item.alimento.vitamina_d_ug, factor)
            sumarCampo(totales, 'vitamina_b12_ug', item.alimento.vitamina_b12_ug, factor)
            sumarCampo(totales, 'saturados_g', item.alimento.saturados_g, factor)
        }
    }

    const gaps = calcularGapMicronutrientes(totales, perfil)
    const prioritarios = seleccionarMicronutrientesPrioritarios(gaps)
    const ok = gaps.filter(gap => gap.estado === 'ok').length

    return NextResponse.json({
        plan_id: plan.id,
        plan_nombre: plan.nombre,
        totales,
        nutrientes: gaps,
        prioritarios,
        perfil_aplicado: perfil ?? null,
        resumen: {
            ok,
            revisar: gaps.length - ok,
            score: Math.round((ok / gaps.length) * 100),
        },
    })
}
