import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PanelInformeCaso } from '../components/clientes/InformeCaso'
import { construirInformeCaso } from '../lib/informe-caso/construir'

const informe = construirInformeCaso({
  nombre: 'Carlos Casanova', plan: { nombre: 'Plan', semanaActual: 2, semanasTotales: 4, diasRestantes: 18 }, analisis: null, propuesta: null,
  atleta: { hayDatos: true, minutosCarreraSemana: 89, salidasSemana: 3.5, pctSuave: 36, forma: 16, fatiga: 17.3, frescura: -1.3, sesionesConRitmoPrevistas: 8, sesionesConRitmoHechas: 6, retorno: false, vdot: 45, fuerzaRegistrada: 0, fuerzaEnPlan: 3, alertasAltas: [] },
})
const pintar = (pestanaInicial: 'mensaje' | 'guion' | 'resumen' | 'pdf') => renderToStaticMarkup(createElement(PanelInformeCaso, { informe, clienteId: 'abc', pestanaInicial }))
const mensaje = pintar('mensaje')
for (const t of ['Mensaje', 'Guion', 'Resumen', 'PDF', 'Copiar', informe.mensaje.slice(0, 30)]) assert.ok(mensaje.includes(t), `mensaje: ${t}`)
const guion = pintar('guion')
for (const t of ['Abrir', 'Cerrar', 'Preguntas para hacerle', informe.preguntas[0]]) assert.ok(guion.includes(t), `guion: ${t}`)
const resumen = pintar('resumen')
for (const t of ['Dónde está', 'Qué cambia', 'Lo que no sé']) assert.ok(resumen.includes(t), `resumen: ${t}`)
const pdf = pintar('pdf')
assert.ok(pdf.includes('/api/clientes/abc/informe-caso?formato=html'), 'el PDF abre la página imprimible')
assert.ok(pdf.includes('target="_blank"'))
console.log('informe-caso-render.test OK')
