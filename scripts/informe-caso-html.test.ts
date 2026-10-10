import assert from 'node:assert/strict'
import { htmlInformeCaso } from '../lib/informe-caso/html'
import { construirInformeCaso, type DatosInforme } from '../lib/informe-caso/construir'

const datos = (nombre: string): DatosInforme => ({
  nombre,
  atleta: { hayDatos: true, minutosCarreraSemana: 89, salidasSemana: 3.5, pctSuave: 36, forma: 16, fatiga: 17.3, frescura: -1.3, sesionesConRitmoPrevistas: 8, sesionesConRitmoHechas: 6, retorno: false, vdot: 45, fuerzaRegistrada: 0, fuerzaEnPlan: 3, alertasAltas: [] },
  plan: { nombre: 'Plan <b>raro</b>', semanaActual: 2, semanasTotales: 4, diasRestantes: 18 }, analisis: null, propuesta: null,
})

const html = htmlInformeCaso(construirInformeCaso(datos('Carlos "El Rápido" <script>alert(1)</script> Casanova')), new Date(2026, 9, 10))
assert.ok(html.startsWith('<!doctype html>'))
assert.ok(!html.includes('<script'), 'sin etiquetas script')
assert.ok(!html.includes('<b>raro</b>'), 'el HTML del plan va escapado')
assert.ok(html.includes('&lt;b&gt;raro&lt;/b&gt;'))
assert.ok(html.includes('&quot;El Rápido&quot;'))
for (const seccion of ['Dónde está', 'Qué cambia', 'Por qué', 'Lo que no sé', 'Mensaje para el cliente', 'Guion de llamada', 'Preguntas']) assert.ok(html.includes(seccion), seccion)
assert.ok(html.includes('@media print'))
assert.ok(html.includes('10-10-2026'), 'fecha en formato DD-MM-AAAA')
console.log('informe-caso-html.test OK')
