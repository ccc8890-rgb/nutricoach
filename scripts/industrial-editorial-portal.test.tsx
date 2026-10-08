import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TLSPanel } from '../components/PortalCliente/TLSGauge'
import CalendarioMesEntreno from '../components/training/CalendarioMesEntreno'
import {
  EditorialMasthead,
  HoyEditorial,
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
assert.match(dock, /cliente-bottom-index">01</)
assert.match(dock, /cliente-bottom-index">02</)
assert.match(dock, /cliente-bottom-icon/)

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

const emptyProgress = renderToStaticMarkup(<ProgressInstrument label="Sin objetivo" value={0} max={0} />)
assert.match(emptyProgress, /aria-valuemax="1"/)

const hoy = renderToStaticMarkup(
  <HoyEditorial
    firstName="Carlos"
    dateLabel="jueves, 8 de octubre"
    calories={2187}
    meals={5}
    weeklySessions={4}
    weight={65.2}
    macros={[
      { label: 'Proteína', value: 142, target: 150, unit: 'g' },
      { label: 'Carbohidratos', value: 278, target: 300, unit: 'g' },
      { label: 'Grasas', value: 67, target: 70, unit: 'g' },
    ]}
    trainingName="Fuerza inferior"
    hasPlan
    onNavigate={noop}
  />,
)
assert.match(hoy, /01 \/ TODAY/)
assert.match(hoy, /Carlos/)
assert.match(hoy, /2187/)
assert.match(hoy, /Secuencia del día/)
assert.match(hoy, /Fuerza inferior/)

const tls = renderToStaticMarkup(
  <TLSPanel
    data={{
      tls_semana_actual: 0,
      num_sesiones: 0,
      tls_promedio_4sem: 0,
      umbral: 80,
      porcentaje_umbral: 0,
      semaforo: 'bajo',
      sesiones_recientes: [],
    }}
    onRegistrar={noop}
  />,
)
assert.match(tls, /03 \/ LOAD/)
assert.match(tls, /Carga semanal/)
assert.match(tls, /aria-valuenow="0"/)
assert.match(tls, /Registrar sesión/)
assert.doesNotMatch(tls, /#ECFDF5|rounded-full/)

const calendar = renderToStaticMarkup(<CalendarioMesEntreno />)
assert.match(calendar, /training-calendar/)
assert.match(calendar, /training-calendar__period/)
assert.doesNotMatch(calendar, /rgba\(99,102,241/)

const dietSource = readFileSync(new URL('../components/PortalCliente/MiPlan.tsx', import.meta.url), 'utf8')
assert.match(dietSource, /diet-notebook/)
assert.match(dietSource, /diet-notebook__summary/)
assert.match(dietSource, /diet-notebook__meals/)

const settingsSource = readFileSync(new URL('../components/PortalCliente/AjustesTabs.tsx', import.meta.url), 'utf8')
assert.match(settingsSource, /settings-console/)
assert.match(settingsSource, /settings-console__section/)
assert.match(settingsSource, /settings-console__theme/)

console.log('industrial-editorial-portal: 10 contratos renderizados correctamente')
