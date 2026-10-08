import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  EditorialMasthead,
  IndustrialTabs,
  LiquidDock,
  MetricRail,
  ProgressInstrument,
  TechnicalReadout,
  TechnicalRow,
  TimelineSequence,
} from '../components/PortalCliente/editorial'

const noop = () => undefined

const tabs = renderToStaticMarkup(
  <IndustrialTabs
    ariaLabel="Vista del plan"
    activeKey="hoy"
    items={[
      { key: 'hoy', label: 'Hoy' },
      { key: 'semana', label: 'Semana' },
    ]}
    onChange={noop}
  />,
)
assert.match(tabs, /role="tablist"/)
assert.match(tabs, /role="tab"/)
assert.match(tabs, /aria-selected="true"/)
assert.match(tabs, /aria-selected="false"/)

const dock = renderToStaticMarkup(
  <LiquidDock
    activeKey="hoy"
    items={[
      { key: 'hoy', label: 'Hoy', icon: () => <span>H</span> },
      { key: 'dieta', label: 'Dieta', icon: () => <span>D</span> },
    ]}
    onChange={noop}
    reduceMotion
  />,
)
assert.match(dock, /aria-label="Navegación principal"/)
assert.match(dock, /aria-current="page"/)
assert.match(dock, />Hoy</)

const primitives = renderToStaticMarkup(
  <>
    <EditorialMasthead index="01" eyebrow="Plan diario" title="Cumplir lo básico" aside="2200 kcal" />
    <MetricRail>
      <TechnicalReadout label="Proteína" value="148" unit="g" />
    </MetricRail>
    <ProgressInstrument label="Adherencia" value={72} max={100} unit="%" />
    <TimelineSequence
      items={[{ id: 'meal', index: '01', label: '08:00', title: 'Desayuno', meta: '560 kcal' }]}
    />
    <TechnicalRow index="02" label="Sentadilla" meta="4 × 6" />
  </>,
)
assert.match(primitives, /Cumplir lo básico/)
assert.match(primitives, /148/)
assert.match(primitives, /aria-valuenow="72"/)
assert.match(primitives, /08:00/)
assert.match(primitives, /Sentadilla/)

console.log('industrial-editorial-portal: 5 contratos renderizados correctamente')
