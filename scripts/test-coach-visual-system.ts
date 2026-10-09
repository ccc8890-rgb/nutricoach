import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  CoachPage,
  IconButton,
  Metric,
  PageHeader,
  SectionHeader,
  StatusBadge,
  Surface,
} from '../components/ui/CoachPrimitives'

const markup = renderToStaticMarkup(createElement(
  CoachPage,
  null,
  createElement(PageHeader, {
    eyebrow: 'Clientes',
    title: 'Visión general',
    description: 'Seguimiento del equipo',
    actions: createElement('button', null, 'Crear'),
  }),
  createElement(SectionHeader, { title: 'Actividad', description: 'Últimos siete días' }),
  createElement(Surface, { level: 'raised' }, createElement(Metric, { label: 'Adherencia', value: '87', unit: '%', trend: '+4%' })),
  createElement(StatusBadge, { tone: 'success' }, 'Activo'),
  createElement(IconButton, { label: 'Abrir filtros' }, createElement('span', { 'aria-hidden': true }, 'F')),
))

assert.match(markup, /<main[^>]+coach-page/, 'CoachPage debe renderizar un landmark main')
assert.match(markup, /<h1[^>]*>Visión general<\/h1>/, 'PageHeader debe exponer un h1')
assert.match(markup, /aria-label="Abrir filtros"/, 'IconButton debe tener nombre accesible')
assert.match(markup, /coach-surface--raised/, 'Surface debe expresar el nivel visual')
assert.match(markup, /coach-status--success/, 'StatusBadge debe expresar el tono semántico')
assert.match(markup, /font-data/, 'Metric debe usar cifras tabulares')

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
for (const contract of [
  '.coach-page',
  '.coach-page-header',
  '.coach-surface',
  '.coach-metric',
  '.coach-status',
  ':focus-visible',
  'font-variant-numeric: tabular-nums',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert.ok(css.includes(contract), `Falta el contrato CSS ${contract}`)
}

console.log('coach visual system: 8 contracts PASS')
