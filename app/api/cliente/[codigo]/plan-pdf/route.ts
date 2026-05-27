import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { canonicalizarItemCompra, esIngredienteBasicoNoCompra } from '@/lib/lista-compra/filtros'
import { convertirGramosACompra } from '@/lib/lista-compra/inteligente'
import { escapeHtml } from '@/lib/html/escape'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import type { Macros } from '@/types'

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
    _request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const { codigo } = await params
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
    return [...comidas].sort((a, b) => {
        const diaA = DIAS.indexOf(a.dia_semana || DIAS[0])
        const diaB = DIAS.indexOf(b.dia_semana || DIAS[0])
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
    const map = new Map<string, ComidaPdf[]>()
    for (const dia of DIAS) map.set(dia, [])
    for (const comida of comidas) {
        const dia = comida.dia_semana && DIAS.includes(comida.dia_semana) ? comida.dia_semana : DIAS[0]
        map.get(dia)?.push(comida)
    }
    return Array.from(map.entries()).filter(([, items]) => items.length > 0)
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
    const backUrl = `${p.appUrl.replace(/\/$/, '')}/cliente/${p.codigo}?tab=dieta`

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Plan de ${escapeHtml(p.nombreCliente)}</title>
  <style>
    @page { margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f5f3ef;
      color: #191714;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: center;
      padding: calc(env(safe-area-inset-top, 0px) + 10px) 12px 10px;
      background: rgba(245, 243, 239, .9);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(25, 23, 20, .08);
    }
    .toolbar a, .toolbar button {
      min-height: 40px;
      border: 1px solid rgba(25, 23, 20, .12);
      border-radius: 999px;
      background: #fff;
      color: #191714;
      padding: 0 14px;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }
    .page { max-width: 920px; margin: 0 auto; padding: 24px 18px 44px; }
    .cover {
      display: grid;
      gap: 22px;
      padding: 30px;
      border-radius: 28px;
      color: #fff;
      background:
        linear-gradient(135deg, rgba(9, 36, 34, .94), rgba(19, 89, 78, .92)),
        radial-gradient(circle at 85% 10%, rgba(244, 198, 103, .5), transparent 34%);
    }
    .brand { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .14em; color: rgba(255,255,255,.68); }
    h1 { margin: 0; font-size: clamp(32px, 8vw, 64px); line-height: .96; letter-spacing: 0; }
    .cover p { max-width: 620px; margin: 0; color: rgba(255,255,255,.78); font-size: 15px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 4px;
    }
    .summary-card {
      border-radius: 18px;
      padding: 14px;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.16);
    }
    .summary-card strong { display: block; font-size: 22px; line-height: 1; }
    .summary-card span { display: block; margin-top: 6px; font-size: 11px; color: rgba(255,255,255,.68); text-transform: uppercase; letter-spacing: .08em; }
    .day, .shopping, .training {
      margin-top: 22px;
      border-radius: 24px;
      background: #fff;
      border: 1px solid rgba(25, 23, 20, .08);
      overflow: hidden;
      page-break-inside: avoid;
    }
    .day-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 18px 20px;
      border-bottom: 1px solid rgba(25, 23, 20, .08);
      background: #fbfaf7;
    }
    .day-head h2 { margin: 0; font-size: 20px; }
    .day-head p { margin: 3px 0 0; color: #6f6860; font-size: 13px; text-align: right; }
    .meal-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 14px; }
    .meal {
      border-radius: 18px;
      border: 1px solid rgba(25, 23, 20, .08);
      padding: 14px;
      background: #fff;
      page-break-inside: avoid;
    }
    .meal-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .slot { margin: 0 0 4px; color: #857d73; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
    .meal h3 { margin: 0; font-size: 16px; line-height: 1.18; }
    .meal-kcal { flex: 0 0 auto; border-radius: 999px; background: #e9f6ef; color: #0f6a4f; padding: 6px 9px; font-size: 12px; font-weight: 800; }
    .macro-line { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 12px; color: #6f6860; font-size: 12px; font-weight: 700; }
    .ingredients { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
    .ingredients li { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: #312d28; }
    .ingredients strong { color: #191714; white-space: nowrap; }
    .shopping, .training { padding: 20px; }
    .shopping h2, .training h2 { margin: 0 0 14px; font-size: 22px; }
    .shopping-grid { columns: 2; column-gap: 28px; }
    .shop-item { break-inside: avoid; display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #eee9e2; font-size: 13px; }
    .session { padding: 12px 0; border-bottom: 1px solid #eee9e2; }
    .session:last-child { border-bottom: 0; }
    .session strong { display: block; margin-bottom: 6px; }
    .session span { display: inline-block; margin: 3px 4px 3px 0; padding: 4px 9px; border-radius: 999px; background: #f4f1ec; font-size: 12px; }
    footer { margin-top: 22px; color: #8b8378; font-size: 12px; text-align: center; }
    @media (max-width: 700px) {
      .page { padding: 14px 10px 34px; }
      .cover { padding: 24px; border-radius: 24px; }
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .day-head { display: block; }
      .day-head p { text-align: left; }
      .meal-grid { grid-template-columns: 1fr; }
      .shopping-grid { columns: 1; }
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page { max-width: none; padding: 0; }
      .cover { border-radius: 0; }
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
