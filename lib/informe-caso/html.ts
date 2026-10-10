// lib/informe-caso/html.ts
// Página imprimible del informe (el coach la abre y la guarda como PDF o la imprime). Todo el contenido va escapado.
import { escapeHtml as e } from '@/lib/html/escape'
import type { InformeCaso } from './construir'

const fechaDDMMAAAA = (d: Date) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
const lista = (items: string[]) => `<ul>${items.map(x => `<li>${e(x)}</li>`).join('')}</ul>`

export function htmlInformeCaso(i: InformeCaso, fecha: Date = new Date()): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Informe del caso · ${e(i.cliente)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#1b1b1f;line-height:1.5}
  h1{font-size:22px;margin:0}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
  .meta{color:#666;font-size:13px}ul{margin:4px 0;padding-left:20px}li{margin:2px 0}
  .caja{background:#f5f5f7;border-radius:8px;padding:10px 12px;white-space:pre-wrap}
  .origen{color:#666;font-size:12px}
  @media print{body{margin:0;max-width:none}h2{break-after:avoid}.caja{break-inside:avoid}}
</style></head><body>
<h1>${e(i.cliente)}</h1>
<p class="meta">${e(i.situacion.titulo)} · ${fechaDDMMAAAA(fecha)}${i.plan ? ` · ${e(i.plan)}` : ''}</p>
<h2>Dónde está</h2>
${i.situacion.datos.length ? lista(i.situacion.datos.map(d => `${d.etiqueta}: ${d.valor}`)) : '<p>Sin datos recientes del reloj.</p>'}
<h2>Qué cambia</h2>${lista(i.cambios)}
<h2>Por qué</h2>${i.porQue.length ? `<ul>${i.porQue.map(p => `<li>${e(p.texto)} <span class="origen">(${e(p.origen)})</span></li>`).join('')}</ul>` : '<p>Mantener el plan es lo que indican sus datos.</p>'}
<h2>Lo que no sé</h2>${i.loQueNoSe.length ? lista(i.loQueNoSe) : '<p>Nada relevante: hay datos para todo lo anterior.</p>'}
<h2>Mensaje para el cliente</h2><p class="caja">${e(i.mensaje)}</p>
<h2>Guion de llamada</h2><ol>${i.guion.map(g => `<li><strong>${e(g.paso)}.</strong> ${e(g.texto)}</li>`).join('')}</ol>
<h2>Preguntas</h2>${lista(i.preguntas)}
</body></html>`
}
