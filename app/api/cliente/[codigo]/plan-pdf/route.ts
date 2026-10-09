import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { canonicalizarItemCompra, esIngredienteBasicoNoCompra } from '@/lib/lista-compra/filtros'
import { convertirGramosACompra } from '@/lib/lista-compra/inteligente'
import { escapeHtml } from '@/lib/html/escape'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import { comidasDelDia, indiceDiaDesdeTexto } from '@/lib/nutricion/comidas-dia'
import type { Macros } from '@/types'
import { autorizarAccesoPlan } from '@/lib/cliente/autorizar-escritura-plan'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

interface ClienteConProfile {
    objetivo?: string | null
    profile?: { nombre?: string | null } | null
}

interface AlimentoPdf {
    id?: string | null
    nombre?: string | null
    categoria?: string | null
    calorias?: number | null
    proteinas?: number | null
    carbohidratos?: number | null
    grasas?: number | null
    fibra?: number | null
}

interface ComidaAlimentoPdf {
    cantidad_gramos: number
    alimento?: AlimentoPdf | null
}

interface ComidaPdf {
    nombre: string
    dia_semana?: string | null
    hora_sugerida?: string | null
    orden?: number | null
    receta?: { nombre?: string | null } | null
    alimentos?: ComidaAlimentoPdf[]
}

interface EjercicioPdf {
    orden?: number | null
    ejercicio?: { nombre?: string | null } | null
}

interface SesionPdf {
    nombre: string
    dia_semana?: string | null
    orden?: number | null
    ejercicios?: EjercicioPdf[]
}

interface EntrenoPdf {
    nombre: string
    descripcion?: string | null
    duracion_semanas?: number | null
    sesiones?: SesionPdf[]
}

interface ItemListaPdf {
    nombre: string
    categoria?: string | null
    cantidad: number
    cantidadCompra: string
}

interface GenerarHtmlParams {
    codigo: string
    nombreCliente: string
    objetivo: string
    planNombre: string
    planDescripcion?: string
    comidas: ComidaPdf[]
    entreno: EntrenoPdf | null
    listaCompra: ItemListaPdf[]
    appUrl: string
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const { codigo } = await params
        const auth = await autorizarAccesoPlan(_request, codigo)
        if (auth instanceof NextResponse) return auth
        const supabase = createServiceSupabase()

        const { data: plan, error: planError } = await supabase
            .from('planes_nutricion')
            .select(`
                *,
                comidas(
                    *,
                    receta:recetas(id, nombre, imagen_url),
                    alimentos:comida_alimentos(*, alimento:alimentos(*))
                )
            `)
            .eq('codigo_publico', codigo)
            .eq('activo', true)
            .single()

        if (planError || !plan) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        let clienteNombre = 'Cliente'
        let clienteObjetivo = ''
        if (plan.cliente_id) {
            const { data: c } = await supabase
                .from('clientes')
                .select('*, profile:profiles!profile_id(*)')
                .eq('id', plan.cliente_id)
                .single()
            if (c) {
                const cliente = c as ClienteConProfile
                clienteNombre = cliente.profile?.nombre || 'Cliente'
                clienteObjetivo = cliente.objetivo || ''
            }
        }

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

        const comidas = ordenarComidas(plan.comidas || [])
        const listaCompra = construirListaCompra(comidas)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nutricoach-delta.vercel.app'

        const html = generarHtmlPlan({
            codigo,
            nombreCliente: clienteNombre,
            objetivo: clienteObjetivo,
            planNombre: plan.nombre,
            planDescripcion: plan.descripcion,
            comidas,
            entreno: entreno as EntrenoPdf | null,
            listaCompra,
            appUrl,
        })

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `inline; filename="plan-${codigo}.html"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (err) {
        console.error('[plan-pdf] Error:', err)
        return NextResponse.json({ error: 'Error al generar plan' }, { status: 500 })
    }
}

function ordenarComidas(comidas: ComidaPdf[]) {
    // Comidas sin día (recurrentes, se repiten cada día) van primero;
    // no se anclan a "Lunes" como antes. Ver lib/nutricion/comidas-dia.ts.
    return [...comidas].sort((a, b) => {
        const diaA = indiceDiaDesdeTexto(a.dia_semana) ?? -1
        const diaB = indiceDiaDesdeTexto(b.dia_semana) ?? -1
        return (diaA - diaB) || ((a.orden ?? 0) - (b.orden ?? 0))
    })
}

function calcMacrosComida(alimentos: ComidaAlimentoPdf[]): Macros {
    return sumarMacros((alimentos ?? []).map(a =>
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

function cantidadPractica(gramos: number) {
    if (!Number.isFinite(gramos) || gramos <= 0) return 0
    if (gramos <= 5) return Math.max(1, Math.round(gramos))
    if (gramos <= 50) return Math.max(5, Math.round(gramos / 5) * 5)
    if (gramos <= 120) return Math.round(gramos / 10) * 10
    if (gramos <= 300) return Math.round(gramos / 25) * 25
    return Math.round(gramos / 50) * 50
}

function construirListaCompra(comidas: ComidaPdf[]): ItemListaPdf[] {
    const mapa = new Map<string, ItemListaPdf>()

    for (const comida of comidas) {
        for (const item of comida.alimentos ?? []) {
            const alimento = item.alimento
            if (!alimento?.id || !alimento.nombre) continue
            if (esIngredienteBasicoNoCompra(alimento.nombre)) continue

            const canonical = canonicalizarItemCompra({
                id: alimento.id,
                nombre: alimento.nombre,
                categoria: alimento.categoria,
            })
            const actual = mapa.get(canonical.key)
            const cantidad = Number(item.cantidad_gramos || 0)
            if (actual) {
                actual.cantidad += cantidad
                actual.cantidadCompra = convertirGramosACompra(actual.cantidad, actual.nombre)
            } else {
                mapa.set(canonical.key, {
                    nombre: canonical.nombre,
                    categoria: canonical.categoria,
                    cantidad,
                    cantidadCompra: convertirGramosACompra(cantidad, canonical.nombre),
                })
            }
        }
    }

    return Array.from(mapa.values()).sort((a, b) =>
        (a.categoria || 'Otros').localeCompare(b.categoria || 'Otros') || a.nombre.localeCompare(b.nombre)
    )
}

function agruparPorDia(comidas: ComidaPdf[]) {
    // Bug corregido (25-09-2026): una comida SIN dia_semana es recurrente
    // (se repite cada día), no "del lunes". Antes, todas las comidas
    // recurrentes se amontonaban en la sección "Lunes" del PDF, dejando el
    // resto de días vacíos y multiplicando por 7 el resumen "kcal/día"
    // (sumaba TODO el plan como si fuera un solo día). Misma semántica que
    // lib/nutricion/comidas-dia.ts, usada en el resto del portal cliente.
    const normalizadas = comidas.map(c => ({ ...c, orden: c.orden ?? 0 }))
    return DIAS
        .map((dia, idx) => [dia, comidasDelDia(normalizadas, idx)] as const)
        .filter(([, items]) => items.length > 0)
}

function mealTitle(comida: ComidaPdf) {
    return comida.receta?.nombre || comida.nombre
}

function generarHtmlPlan(p: GenerarHtmlParams): string {
    const totalDiaReferencia = sumarMacros(
        (agruparPorDia(p.comidas)[0]?.[1] ?? []).map(c => calcMacrosComida(c.alimentos ?? []))
    )

    const diasHtml = agruparPorDia(p.comidas).map(([dia, comidas]) => {
        const totalDia = sumarMacros(comidas.map(c => calcMacrosComida(c.alimentos ?? [])))
        const comidasHtml = comidas.map(comida => {
            const macros = calcMacrosComida(comida.alimentos ?? [])
            const ingredientes = (comida.alimentos ?? []).map(item => {
                const nombre = item.alimento?.nombre || 'Ingrediente'
                return `<li>
                    <span>${escapeHtml(nombre)}</span>
                    <strong>${cantidadPractica(Number(item.cantidad_gramos))} g</strong>
                </li>`
            }).join('')

            return `<article class="meal">
                <div class="meal-head">
                    <div>
                        <p class="slot">${escapeHtml(comida.nombre)}${comida.hora_sugerida ? ` · ${escapeHtml(comida.hora_sugerida.slice(0, 5))}` : ''}</p>
                        <h3>${escapeHtml(mealTitle(comida))}</h3>
                    </div>
                    <div class="meal-kcal">${macros.calorias.toFixed(0)} kcal</div>
                </div>
                <div class="macro-line">
                    <span>P ${macros.proteinas.toFixed(0)} g</span>
                    <span>C ${macros.carbohidratos.toFixed(0)} g</span>
                    <span>G ${macros.grasas.toFixed(0)} g</span>
                </div>
                <ul class="ingredients">${ingredientes}</ul>
            </article>`
        }).join('')

        return `<section class="day">
            <div class="day-head">
                <h2>${escapeHtml(dia)}</h2>
                <p>${totalDia.calorias.toFixed(0)} kcal · P ${totalDia.proteinas.toFixed(0)} g · C ${totalDia.carbohidratos.toFixed(0)} g · G ${totalDia.grasas.toFixed(0)} g</p>
            </div>
            <div class="meal-grid">${comidasHtml}</div>
        </section>`
    }).join('')

    const entrenoHtml = p.entreno ? generarEntrenoHtml(p.entreno) : ''
    const listaHtml = p.listaCompra.length ? generarListaHtml(p.listaCompra) : ''
    // /cliente/[codigo] es el portal público legacy: redirige a /cliente para
    // clientes autenticados pero pierde ?tab= en el camino — "Volver a la app"
    // caía siempre en Hoy en vez de Dieta. Enlace directo a la ruta real.
    const backUrl = `${p.appUrl.replace(/\/$/, '')}/cliente?tab=dieta`

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Plan de ${escapeHtml(p.nombreCliente)}</title>
  <style>
    @page { margin: 13mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #E8E5DF;
      color: #17181A;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.42;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      gap: 1px;
      align-items: center;
      justify-content: center;
      padding: max(calc(env(safe-area-inset-top, 0px) + 12px), 22px) 12px 10px;
      background: rgba(23, 24, 26, .9);
      backdrop-filter: blur(22px) saturate(.9);
      border-bottom: 1px solid #55585E;
    }
    .toolbar a, .toolbar button {
      min-height: 38px;
      border: 1px solid #55585E;
      border-radius: 2px;
      background: #242629;
      color: #F4F1EB;
      padding: 0 13px;
      font: 650 11px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: .05em;
      text-transform: uppercase;
      text-decoration: none;
      cursor: pointer;
    }
    .toolbar a:hover, .toolbar button:hover { background: #34363A; }
    .page { max-width: 860px; margin: 0 auto; padding: 22px 18px 46px; }
    .cover {
      position: relative;
      display: grid;
      gap: 26px;
      overflow: hidden;
      padding: 34px 32px 30px;
      border: 1px solid #BBB5AA;
      border-top: 4px solid #17181A;
      border-radius: 0;
      color: #17181A;
      background: #F6F3ED;
    }
    .cover::after { position: absolute; top: 0; right: 32px; width: 42px; height: 4px; background: #A4865C; content: ''; }
    .brand { font: 650 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; text-transform: uppercase; letter-spacing: .15em; color: #826B4B; }
    h1 { margin: 0; max-width: 720px; font-size: clamp(34px, 7vw, 58px); line-height: .94; letter-spacing: -.045em; }
    .cover p { max-width: 620px; margin: 0; color: #62646A; font-size: 14px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      margin-top: 4px;
      border: 1px solid #C9C4BA;
      background: #C9C4BA;
    }
    .summary-card {
      min-width: 0;
      border-radius: 0;
      padding: 13px 12px 14px;
      background: #EEEAE2;
    }
    .summary-card strong { display: block; font: 650 20px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-variant-numeric: tabular-nums; }
    .summary-card span { display: block; margin-top: 7px; color: #74767C; font: 600 9px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; text-transform: uppercase; letter-spacing: .1em; }
    .day, .shopping, .training {
      margin-top: 18px;
      border-radius: 0;
      background: #F8F6F1;
      border: 1px solid #C9C4BA;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .day-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 15px 18px;
      border-bottom: 1px solid #C9C4BA;
      background: #E9E5DD;
    }
    .day-head h2 { margin: 0; font-size: 18px; letter-spacing: -.02em; }
    .day-head p { margin: 3px 0 0; color: #6D6F74; font: 600 10px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; text-align: right; }
    .meal-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; padding: 0; background: #C9C4BA; }
    .meal {
      border: 0;
      border-radius: 0;
      padding: 15px;
      background: #F8F6F1;
      page-break-inside: avoid;
    }
    .meal-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .slot { margin: 0 0 5px; color: #826B4B; font: 650 9px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; text-transform: uppercase; letter-spacing: .1em; }
    .meal h3 { margin: 0; font-size: 15px; line-height: 1.2; letter-spacing: -.015em; }
    .meal-kcal { flex: 0 0 auto; border-left: 2px solid #A4865C; border-radius: 0; background: transparent; color: #5F503B; padding: 2px 0 2px 8px; font: 650 10px/1.2 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .macro-line { display: flex; gap: 10px; flex-wrap: wrap; margin: 11px 0 13px; color: #6D6F74; font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .ingredients { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
    .ingredients li { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: #313236; }
    .ingredients strong { color: #17181A; font: 600 10px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; }
    .shopping, .training { padding: 18px; }
    .shopping h2, .training h2 { margin: 0 0 14px; font-size: 19px; letter-spacing: -.02em; }
    .shopping-grid { columns: 2; column-gap: 28px; }
    .shop-item { break-inside: avoid; display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid #D8D3CA; font-size: 12px; }
    .shop-item strong { color: #5F503B; font: 600 10px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .session { padding: 11px 0; border-bottom: 1px solid #D8D3CA; }
    .session:last-child { border-bottom: 0; }
    .session strong { display: block; margin-bottom: 6px; }
    .session span { display: inline-block; margin: 3px 4px 3px 0; padding: 4px 7px; border: 1px solid #C9C4BA; border-radius: 2px; background: #EEEAE2; color: #52545A; font-size: 11px; }
    footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #C9C4BA; color: #74767C; font: 500 9px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; text-align: center; text-transform: uppercase; letter-spacing: .05em; }
    @media (max-width: 700px) {
      .page { padding: 12px 10px 32px; }
      .cover { padding: 25px 20px 22px; }
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .day-head { display: block; }
      .day-head p { text-align: left; }
      .meal-grid { grid-template-columns: 1fr; }
      .shopping-grid { columns: 1; }
    }
    @media print {
      body { background: #E8E5DF; }
      .toolbar { display: none; }
      .page { max-width: none; padding: 0; }
      .day, .shopping, .training { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <a href="${escapeHtml(backUrl)}">Volver a la app</a>
    <button onclick="sharePlan()">Compartir</button>
    <button onclick="window.print()">Guardar PDF</button>
  </div>

  <main class="page">
    <section class="cover">
      <div class="brand">NutriCoach · Plan personalizado</div>
      <div>
        <h1>${escapeHtml(p.nombreCliente)}</h1>
        <p>${escapeHtml(p.planNombre)}${p.objetivo ? ` · ${escapeHtml(p.objetivo)}` : ''}</p>
      </div>
      ${p.planDescripcion ? `<p>${escapeHtml(p.planDescripcion)}</p>` : ''}
      <div class="summary">
        <div class="summary-card"><strong>${totalDiaReferencia.calorias.toFixed(0)}</strong><span>kcal día</span></div>
        <div class="summary-card"><strong>${totalDiaReferencia.proteinas.toFixed(0)} g</strong><span>proteína</span></div>
        <div class="summary-card"><strong>${totalDiaReferencia.carbohidratos.toFixed(0)} g</strong><span>carbohidratos</span></div>
        <div class="summary-card"><strong>${totalDiaReferencia.grasas.toFixed(0)} g</strong><span>grasas</span></div>
      </div>
    </section>

    ${diasHtml}
    ${entrenoHtml}
    ${listaHtml}

    <footer>Documento generado desde NutriCoach. Las cantidades están redondeadas para uso práctico en cocina.</footer>
  </main>

  <script>
    async function sharePlan() {
      const data = { title: document.title, text: 'Plan nutricional', url: window.location.href };
      try {
        if (navigator.share) await navigator.share(data);
        else {
          await navigator.clipboard.writeText(window.location.href);
          alert('Enlace copiado');
        }
      } catch (error) {}
    }
  </script>
</body>
</html>`
}

function generarEntrenoHtml(entreno: EntrenoPdf) {
    const sesionesHtml = (entreno.sesiones ?? [])
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
        .map(sesion => {
            const ejercicios = (sesion.ejercicios ?? [])
                .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                .map(ej => `<span>${escapeHtml(ej.ejercicio?.nombre || 'Ejercicio')}</span>`)
                .join('')
            return `<div class="session">
                <strong>${escapeHtml(sesion.nombre)}${sesion.dia_semana ? ` · ${escapeHtml(sesion.dia_semana)}` : ''}</strong>
                <div>${ejercicios}</div>
            </div>`
        })
        .join('')

    return `<section class="training">
        <h2>Entrenamiento</h2>
        <p>${escapeHtml(entreno.nombre)}${entreno.duracion_semanas ? ` · ${entreno.duracion_semanas} semanas` : ''}</p>
        ${entreno.descripcion ? `<p>${escapeHtml(entreno.descripcion)}</p>` : ''}
        ${sesionesHtml}
    </section>`
}

function generarListaHtml(items: ItemListaPdf[]) {
    const rows = items.map(item =>
        `<div class="shop-item">
            <span>${escapeHtml(item.nombre)}</span>
            <strong>${escapeHtml(item.cantidadCompra)}</strong>
        </div>`
    ).join('')

    return `<section class="shopping">
        <h2>Lista de la compra</h2>
        <div class="shopping-grid">${rows}</div>
    </section>`
}
