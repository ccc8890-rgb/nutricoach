import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import type { Macros } from '@/types'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const { codigo } = await params
        const supabase = createServiceSupabase()

        // 1. Buscar plan por código público
        const { data: plan, error: planError } = await supabase
            .from('planes_nutricion')
            .select('*, comidas(*, alimentos:comida_alimentos(*, alimento:alimentos(*)))')
            .eq('codigo_publico', codigo)
            .eq('activo', true)
            .single()

        if (planError || !plan) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        // 2. Cliente
        let clienteNombre = 'Cliente'
        let clienteObjetivo = ''
        if (plan.cliente_id) {
            const { data: c } = await supabase
                .from('clientes')
                .select('*, profile:profiles!profile_id(*)')
                .eq('id', plan.cliente_id)
                .single()
            if (c) {
                clienteNombre = (c as any).profile?.nombre || 'Cliente'
                clienteObjetivo = (c as any).objetivo || ''
            }
        }

        // 3. Entreno activo
        let entreno = null
        if (plan.cliente_id) {
            const { data: e } = await supabase
                .from('planes_entrenamiento')
                .select('*, sesiones:sesiones_entrenamiento(*, ejercicios:sesion_ejercicios(*, ejercicio:ejercicios(*)))')
                .eq('cliente_id', plan.cliente_id)
                .eq('activo', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            entreno = e
        }

        // 4. Lista de compra
        let listaCompra: { nombre: string; categoria?: string; cantidad?: number; unidad?: string }[] = []
        const lunes = getLunesActual()
        const { data: listaData } = await supabase
            .from('vista_lista_compra_semanal')
            .select('*')
            .eq('plan_id', plan.id)
            .eq('semana_inicio', lunes)

        if (listaData) {
            const vistos = new Set<string>()
            for (const item of listaData as any[]) {
                if (!vistos.has(item.alimento_nombre)) {
                    vistos.add(item.alimento_nombre)
                    listaCompra.push({
                        nombre: item.alimento_nombre,
                        categoria: item.categoria,
                        cantidad: item.cantidad_total,
                        unidad: 'g',
                    })
                }
            }
        }

        // 5. Generar HTML
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nutricoach-delta.vercel.app'
        const html = generarHtmlPlan({
            nombreCliente: clienteNombre,
            objetivo: clienteObjetivo,
            planNombre: plan.nombre,
            planDescripcion: plan.descripcion,
            comidas: plan.comidas || [],
            entreno,
            listaCompra,
            appUrl,
        })

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `inline; filename="plan-nutricional-${codigo}.html"`,
            },
        })
    } catch (err) {
        console.error('[plan-pdf] Error:', err)
        return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 })
    }
}

function getLunesActual(): string {
    const hoy = new Date()
    const dia = hoy.getDay()
    const diff = dia === 0 ? -6 : 1 - dia
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() + diff)
    return lunes.toISOString().split('T')[0]
}

function calcMacrosComida(alimentos: any[]): Macros {
    return sumarMacros((alimentos ?? []).map((a: any) =>
        calcularMacrosPorCantidad(
            a.alimento?.calorias ?? 0,
            a.alimento?.proteinas ?? 0,
            a.alimento?.carbohidratos ?? 0,
            a.alimento?.grasas ?? 0,
            a.alimento?.fibra ?? 0,
            a.cantidad_gramos
        )
    ))
}

interface GenerarHtmlParams {
    nombreCliente: string
    objetivo: string
    planNombre: string
    planDescripcion?: string
    comidas: any[]
    entreno: any
    listaCompra: { nombre: string; categoria?: string; cantidad?: number; unidad?: string }[]
    appUrl: string
}

function generarHtmlPlan(p: GenerarHtmlParams): string {
    const totalDia = sumarMacros(
        (p.comidas ?? []).map((c: any) => calcMacrosComida(c.alimentos ?? []))
    )

    const comidasHtml = (p.comidas ?? []).map((comida: any, ci: number) => {
        const alimentos = comida.alimentos ?? []
        const macros = calcMacrosComida(alimentos)
        const itemsHtml = alimentos.map((af: any) => {
            const m = calcularMacrosPorCantidad(
                af.alimento?.calorias ?? 0,
                af.alimento?.proteinas ?? 0,
                af.alimento?.carbohidratos ?? 0,
                af.alimento?.grasas ?? 0,
                af.alimento?.fibra ?? 0,
                af.cantidad_gramos
            )
            return `<tr>
        <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb;">${af.alimento?.nombre || '—'}</td>
        <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${af.cantidad_gramos}g</td>
        <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${m.calorias.toFixed(0)}</td>
        <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${m.proteinas.toFixed(1)}g</td>
        <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${m.carbohidratos.toFixed(1)}g</td>
        <td style="padding:6px 12px; border-bottom:1px solid #e5e7eb; text-align:center;">${m.grasas.toFixed(1)}g</td>
      </tr>`
        }).join('')

        return `<div style="margin-bottom:24px; page-break-inside:avoid;">
      <div style="background:linear-gradient(135deg,#22c55e,#16a34a); padding:12px 16px; border-radius:8px 8px 0 0; display:flex; justify-content:space-between; align-items:center;">
        <h3 style="color:white; margin:0; font-size:16px;">${ci + 1}. ${comida.nombre}</h3>
        <span style="color:#dcfce7; font-size:13px;">${macros.calorias.toFixed(0)} kcal${comida.hora_sugerida ? ` · ${comida.hora_sugerida.slice(0, 5)}` : ''}</span>
      </div>
      <table style="width:100%; border-collapse:collapse; background:white; border:1px solid #e5e7eb; border-radius:0 0 8px 8px; font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px; text-align:left; font-weight:600; color:#374151; border-bottom:2px solid #e5e7eb;">Alimento</th>
            <th style="padding:8px 12px; text-align:center; font-weight:600; color:#374151; border-bottom:2px solid #e5e7eb;">Cant.</th>
            <th style="padding:8px 12px; text-align:center; font-weight:600; color:#374151; border-bottom:2px solid #e5e7eb;">Kcal</th>
            <th style="padding:8px 12px; text-align:center; font-weight:600; color:#374151; border-bottom:2px solid #e5e7eb;">Prot.</th>
            <th style="padding:8px 12px; text-align:center; font-weight:600; color:#374151; border-bottom:2px solid #e5e7eb;">CH</th>
            <th style="padding:8px 12px; text-align:center; font-weight:600; color:#374151; border-bottom:2px solid #e5e7eb;">Gras.</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr style="background:#f0fdf4;">
            <td colspan="2" style="padding:8px 12px; font-weight:600; color:#16a34a;">Total comida</td>
            <td style="padding:8px 12px; text-align:center; font-weight:600; color:#16a34a;">${macros.calorias.toFixed(0)}</td>
            <td style="padding:8px 12px; text-align:center; font-weight:600; color:#16a34a;">${macros.proteinas.toFixed(1)}g</td>
            <td style="padding:8px 12px; text-align:center; font-weight:600; color:#16a34a;">${macros.carbohidratos.toFixed(1)}g</td>
            <td style="padding:8px 12px; text-align:center; font-weight:600; color:#16a34a;">${macros.grasas.toFixed(1)}g</td>
          </tr>
        </tfoot>
      </table>
    </div>`
    }).join('')

    // Entreno
    let entrenoHtml = ''
    if (p.entreno) {
        const sesionesHtml = (p.entreno.sesiones ?? []).map((sesion: any) => {
            const ejHtml = (sesion.ejercicios ?? [])
                .sort((a: any, b: any) => a.orden - b.orden)
                .map((ej: any) =>
                    `<span style="display:inline-block; background:#f3f4f6; padding:3px 10px; border-radius:12px; font-size:12px; margin:2px; color:#374151;">${ej.ejercicio?.nombre || 'Ejercicio'}</span>`
                ).join('')
            return `<div style="margin-bottom:12px; padding:12px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
        <p style="margin:0 0 4px 0; font-weight:600; font-size:14px;">${sesion.nombre}</p>
        ${sesion.dia_semana ? `<p style="margin:0 0 8px 0; font-size:12px; color:#6b7280;">${sesion.dia_semana}</p>` : ''}
        <div>${ejHtml}</div>
      </div>`
        }).join('')
        entrenoHtml = `<section style="margin-bottom:24px; page-break-inside:avoid;">
      <h2 style="font-size:18px; color:#0d9488; margin:0 0 12px 0; padding-bottom:8px; border-bottom:2px solid #0d9488;">🏋️ Plan de entrenamiento: ${p.entreno.nombre}</h2>
      ${p.entreno.descripcion ? `<p style="color:#6b7280; font-size:14px; margin-bottom:12px;">${p.entreno.descripcion}</p>` : ''}
      ${p.entreno.duracion_semanas ? `<p style="font-size:13px; color:#6b7280; margin-bottom:12px;">Duración: ${p.entreno.duracion_semanas} semanas</p>` : ''}
      ${sesionesHtml}
    </section>`
    }

    // Lista de compra
    let listaHtml = ''
    if (p.listaCompra.length > 0) {
        const items = p.listaCompra.map(item =>
            `<li style="padding:6px 0; border-bottom:1px solid #f3f4f6; display:flex; justify-content:space-between; font-size:14px;">
        <span>${item.nombre}</span>
        ${item.cantidad ? `<span style="color:#6b7280;">${item.cantidad.toFixed(0)}${item.unidad || 'g'}</span>` : ''}
      </li>`
        ).join('')
        listaHtml = `<section style="margin-bottom:24px; page-break-inside:avoid;">
      <h2 style="font-size:18px; color:#059669; margin:0 0 12px 0; padding-bottom:8px; border-bottom:2px solid #059669;">🛒 Lista de la compra</h2>
      <ul style="list-style:none; padding:0; margin:0;">${items}</ul>
    </section>`
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plan Nutricional - ${p.nombreCliente}</title>
  <style>
    @page { margin: 20mm 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      color: #1f2937;
      background: #f3f4f6;
      line-height: 1.5;
    }
    .page { max-width: 800px; margin: 0 auto; padding: 24px; }
    @media print {
      body { background: white; }
      .page { padding: 0; max-width: none; }
      .no-print { display: none !important; }
      section { page-break-inside: avoid; }
    }
    .header {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      padding: 32px 24px;
      border-radius: 12px;
      margin-bottom: 24px;
      text-align: center;
    }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 15px; }
    .macro-summary {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      border: 1px solid #e5e7eb;
      text-align: center;
    }
    .macro-summary .kcal { font-size: 36px; font-weight: 700; color: #16a34a; }
    .macro-summary .kcal-label { font-size: 14px; color: #6b7280; }
    .macro-grid { display: flex; justify-content: center; gap: 24px; margin-top: 12px; }
    .macro-item { text-align: center; }
    .macro-item .value { font-size: 18px; font-weight: 700; }
    .macro-item .label { font-size: 12px; color: #6b7280; }
    @media print {
      .header { border-radius: 0; }
    }
    .btn-print {
      display: block;
      width: 100%;
      padding: 14px;
      background: #22c55e;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 24px;
    }
    .btn-print:hover { background: #16a34a; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>🏋️ NutriCoach</h1>
      <p>Plan nutricional personalizado para <strong>${p.nombreCliente}</strong></p>
      ${p.objetivo ? `<p>Objetivo: ${p.objetivo}</p>` : ''}
    </div>

    <div class="macro-summary">
      <div class="kcal">${totalDia.calorias.toFixed(0)} <span class="kcal-label">kcal/día</span></div>
      <div class="macro-grid">
        <div class="macro-item">
          <div class="value" style="color:#ef4444;">${totalDia.proteinas.toFixed(0)}g</div>
          <div class="label">Proteínas</div>
        </div>
        <div class="macro-item">
          <div class="value" style="color:#f59e0b;">${totalDia.carbohidratos.toFixed(0)}g</div>
          <div class="label">Carbohidratos</div>
        </div>
        <div class="macro-item">
          <div class="value" style="color:#7c3aed;">${totalDia.grasas.toFixed(0)}g</div>
          <div class="label">Grasas</div>
        </div>
      </div>
    </div>

    <h2 style="font-size:18px; color:#16a34a; margin:0 0 12px 0; padding-bottom:8px; border-bottom:2px solid #16a34a;">🍽️ Plan de comidas</h2>
    ${p.planDescripcion ? `<p style="color:#6b7280; font-size:14px; margin-bottom:16px;">${p.planDescripcion}</p>` : ''}
    ${comidasHtml}

    ${entrenoHtml}
    ${listaHtml}

    <div style="text-align:center; padding:24px 0 0 0; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; margin-top:24px;">
      Generado por <a href="${p.appUrl}" style="color:#22c55e; text-decoration:none;">NutriCoach</a>
    </div>

    <button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  </div>
</body>
</html>`
}
