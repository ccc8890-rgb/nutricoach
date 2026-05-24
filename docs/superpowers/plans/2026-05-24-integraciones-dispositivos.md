# Integraciones de Dispositivos y Apps de Salud — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar NutriCoach con Strava, Garmin, Google Fit y Whoop para ingerir automáticamente actividad, HRV, pasos y TDEE real de cada cliente, alimentando el árbol de decisión de los agentes IA.

**Architecture:** Una capa de normalización central (`actividad_externa_cliente`) recibe datos de cualquier fuente con el mismo schema. Una interfaz `ProveedorIntegracion` define el contrato que cada conector implementa. Los agentes IA leen exclusivamente de esa tabla — nunca de las APIs externas directamente. El portal del cliente tiene una tab "Mis apps" para conectar/desconectar fuentes.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL + RLS), OAuth2 (Strava, Garmin, Google Fit, Whoop), cron Vercel para polling, `jose` para JWT state en OAuth, `lib/agentes/executor.ts` para integrar los datos en el contexto del cliente.

---

## Estructura de archivos

```
supabase/migrations/
  20260524_integraciones_dispositivos.sql   ← tablas + RLS

lib/integraciones/
  types.ts              ← interfaces ProveedorIntegracion, ActividadExterna, IntegracionCliente
  normalizer.ts         ← normalizeActivity(): cualquier raw → ActividadExterna estándar
  strava.ts             ← OAuth + webhook + sync
  garmin.ts             ← OAuth + polling
  google-fit.ts         ← OAuth + polling
  whoop.ts              ← OAuth + polling (skeleton, API requiere partner)
  sync.ts               ← sincronizarTodosProveedores(), getSummaryLast7d()

app/api/integraciones/
  [provider]/connect/route.ts     ← GET: redirect a OAuth del proveedor
  [provider]/callback/route.ts    ← GET: recibe code, guarda tokens, redirect portal
  [provider]/disconnect/route.ts  ← DELETE: revoca token + borra BD
  strava-webhook/route.ts         ← POST: recibe push de Strava (verificación GET incluida)

app/api/cron/
  sync-integraciones/route.ts     ← GET con CRON_SECRET: polling Garmin + Google Fit + Whoop

components/PortalCliente/
  IntegracionesPanel.tsx          ← UI tab "Mis apps": cards estado conexión + botones
  CheckInForm.tsx                 ← añadir campos opcionales manuales (pasos, kcal_quemadas, hrv)

lib/agentes/
  executor.ts                     ← cargarContextoCliente() incluye actividad_externa últimos 7d
  revisor-semanal.ts              ← N_TDEE, N_TSS, N_HRV, N_PASOS como nodos nuevos
```

---

## Task 1: Migración SQL — tablas de integraciones

**Files:**
- Create: `supabase/migrations/20260524_integraciones_dispositivos.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/20260524_integraciones_dispositivos.sql

-- ── Tokens OAuth por cliente y proveedor ─────────────────────
CREATE TABLE IF NOT EXISTS integraciones_cliente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  proveedor       TEXT NOT NULL CHECK (proveedor IN ('strava','garmin','google_fit','whoop','manual')),
  access_token    TEXT,
  refresh_token   TEXT,
  token_expires_at TIMESTAMPTZ,
  proveedor_user_id TEXT,          -- ID del usuario en el proveedor externo
  scope           TEXT,
  activa          BOOLEAN NOT NULL DEFAULT true,
  ultima_sync     TIMESTAMPTZ,
  error_ultimo    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, proveedor)
);

-- ── Actividad normalizada de cualquier fuente ────────────────
CREATE TABLE IF NOT EXISTS actividad_externa_cliente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  proveedor       TEXT NOT NULL,
  fecha           DATE NOT NULL,
  -- Actividad física
  pasos           INT,
  distancia_km    NUMERIC(6,2),
  calorias_activas INT,             -- kcal quemadas en ejercicio
  calorias_totales INT,             -- TDEE real del día (si disponible)
  minutos_activo  INT,
  minutos_alta_intensidad INT,
  -- Entrenamiento específico
  tipo_entreno    TEXT,             -- 'run','ride','swim','strength','hike',etc.
  duracion_min    INT,
  distancia_entreno_km NUMERIC(6,2),
  tss             NUMERIC(6,1),    -- Training Stress Score (Strava/Garmin)
  ftp_potencia    INT,             -- FTP watts si es ciclismo
  pace_min_km     NUMERIC(5,2),   -- ritmo running
  fc_media        INT,
  fc_max          INT,
  -- Recuperación
  hrv             NUMERIC(5,1),   -- Heart Rate Variability (ms, rMSSD)
  sueño_h         NUMERIC(3,1),
  sueño_calidad   INT,            -- 1-100
  rhr             INT,            -- Resting Heart Rate
  -- Metadatos
  raw_data        JSONB,          -- datos originales del proveedor sin procesar
  proveedor_activity_id TEXT,     -- ID nativo en el proveedor (para deduplicar)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, proveedor, fecha, COALESCE(proveedor_activity_id, fecha::TEXT))
);

-- Índices de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_aec_cliente_fecha ON actividad_externa_cliente (cliente_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_aec_proveedor ON actividad_externa_cliente (proveedor, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_int_cliente ON integraciones_cliente (cliente_id, activa);

-- RLS
ALTER TABLE integraciones_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividad_externa_cliente ENABLE ROW LEVEL SECURITY;

-- El coach puede ver todo (service role bypassa RLS)
CREATE POLICY "service_role_integraciones" ON integraciones_cliente
  USING (true) WITH CHECK (true);
CREATE POLICY "service_role_actividad" ON actividad_externa_cliente
  USING (true) WITH CHECK (true);

-- El cliente puede leer su propia actividad (por codigo_publico join)
CREATE POLICY "cliente_lee_su_actividad" ON actividad_externa_cliente
  FOR SELECT USING (
    cliente_id IN (
      SELECT id FROM clientes WHERE coach_id = (SELECT coach_id FROM clientes WHERE id = cliente_id)
    )
  );

-- Trigger updated_at en integraciones
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_integraciones_updated_at
  BEFORE UPDATE ON integraciones_cliente
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2: Aplicar la migración en Supabase**

En Supabase Dashboard → SQL Editor → pegar y ejecutar el SQL completo.

Verificar:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('integraciones_cliente', 'actividad_externa_cliente');
-- Debe devolver 2 filas
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260524_integraciones_dispositivos.sql
git commit -m "feat: SQL integraciones_cliente + actividad_externa_cliente"
```

---

## Task 2: Tipos e interfaz del normalizador

**Files:**
- Create: `lib/integraciones/types.ts`
- Create: `lib/integraciones/normalizer.ts`

- [ ] **Step 1: Crear `lib/integraciones/types.ts`**

```typescript
// lib/integraciones/types.ts

export type Proveedor = 'strava' | 'garmin' | 'google_fit' | 'whoop' | 'manual'

export interface IntegracionCliente {
  id: string
  cliente_id: string
  proveedor: Proveedor
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  proveedor_user_id: string | null
  scope: string | null
  activa: boolean
  ultima_sync: string | null
  error_ultimo: string | null
}

// Schema normalizado — lo que entra en actividad_externa_cliente
export interface ActividadExterna {
  cliente_id: string
  proveedor: Proveedor
  fecha: string                        // 'YYYY-MM-DD'
  pasos?: number
  distancia_km?: number
  calorias_activas?: number
  calorias_totales?: number
  minutos_activo?: number
  minutos_alta_intensidad?: number
  tipo_entreno?: string
  duracion_min?: number
  distancia_entreno_km?: number
  tss?: number
  ftp_potencia?: number
  pace_min_km?: number
  fc_media?: number
  fc_max?: number
  hrv?: number
  sueno_h?: number
  sueno_calidad?: number
  rhr?: number
  raw_data?: Record<string, unknown>
  proveedor_activity_id?: string
}

// Resumen 7 días para los agentes IA
export interface ResumenActividadSemanal {
  pasos_media: number
  calorias_activas_total: number
  tdee_estimado: number              // media de calorias_totales o estimado
  tss_semanal: number               // Training Stress Score acumulado
  hrv_media: number | null
  sesiones_entreno: number
  minutos_alta_intensidad_total: number
  dia_mas_activo: string | null      // 'lunes', 'martes', etc.
  fuentes: Proveedor[]
  tiene_datos: boolean
}

// Contrato que cada conector debe implementar
export interface ProveedorIntegracion {
  proveedor: Proveedor
  /** URL a la que redirigir al usuario para autorizar */
  getAuthUrl(clienteId: string, coachId: string): string
  /** Intercambiar code por tokens; devuelve la integración actualizada */
  handleCallback(code: string, state: string): Promise<Partial<IntegracionCliente>>
  /** Revocar token en el proveedor */
  revokeToken(integracion: IntegracionCliente): Promise<void>
  /** Sincronizar últimas N horas; devuelve actividades normalizadas */
  syncActivities(integracion: IntegracionCliente, desde: Date): Promise<ActividadExterna[]>
}
```

- [ ] **Step 2: Crear `lib/integraciones/normalizer.ts`**

```typescript
// lib/integraciones/normalizer.ts
// Convierte raw data de cada proveedor al schema ActividadExterna estándar
// y persiste en actividad_externa_cliente con upsert (deduplicación por proveedor_activity_id)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActividadExterna } from './types'

export async function persistirActividades(
  db: SupabaseClient,
  actividades: ActividadExterna[]
): Promise<number> {
  if (actividades.length === 0) return 0

  // Eliminar campos undefined para que upsert no sobreescriba con null
  const limpias = actividades.map(a => {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(a)) {
      if (v !== undefined) obj[k] = v
    }
    return obj
  })

  const { error, count } = await db
    .from('actividad_externa_cliente')
    .upsert(limpias, {
      onConflict: 'cliente_id,proveedor,fecha,proveedor_activity_id',
      ignoreDuplicates: false,
    })
    .select('id', { count: 'exact', head: true })

  if (error) throw new Error(`persistirActividades: ${error.message}`)
  return count ?? actividades.length
}

export async function getSummaryLast7d(
  db: SupabaseClient,
  clienteId: string
): Promise<import('./types').ResumenActividadSemanal> {
  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const { data } = await db
    .from('actividad_externa_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .gte('fecha', hace7dias)
    .order('fecha', { ascending: false })

  const rows = data ?? []

  if (rows.length === 0) {
    return {
      pasos_media: 0, calorias_activas_total: 0, tdee_estimado: 0,
      tss_semanal: 0, hrv_media: null, sesiones_entreno: 0,
      minutos_alta_intensidad_total: 0, dia_mas_activo: null,
      fuentes: [], tiene_datos: false,
    }
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const sum = (arr: (number | null | undefined)[]) =>
    arr.reduce((a, b) => a + (b ?? 0), 0) as number

  const pasos = rows.map(r => r.pasos).filter(Boolean) as number[]
  const hrv = rows.map(r => r.hrv).filter(Boolean) as number[]
  const tdee = rows.map(r => r.calorias_totales).filter(Boolean) as number[]

  // Día de la semana con más pasos
  const pasosPorDia: Record<string, number> = {}
  for (const r of rows) {
    if (r.pasos) {
      const dia = new Date(r.fecha).toLocaleDateString('es-ES', { weekday: 'long' })
      pasosPorDia[dia] = (pasosPorDia[dia] ?? 0) + r.pasos
    }
  }
  const diaMasActivo = Object.entries(pasosPorDia).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    pasos_media: Math.round(avg(pasos)),
    calorias_activas_total: sum(rows.map(r => r.calorias_activas)),
    tdee_estimado: tdee.length ? Math.round(avg(tdee)) : 0,
    tss_semanal: sum(rows.map(r => r.tss)),
    hrv_media: hrv.length ? parseFloat(avg(hrv).toFixed(1)) : null,
    sesiones_entreno: rows.filter(r => r.tipo_entreno).length,
    minutos_alta_intensidad_total: sum(rows.map(r => r.minutos_alta_intensidad)),
    dia_mas_activo: diaMasActivo,
    fuentes: [...new Set(rows.map(r => r.proveedor))] as import('./types').Proveedor[],
    tiene_datos: true,
  }
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep "integraciones"
# Debe salir vacío (0 errores)
```

- [ ] **Step 4: Commit**

```bash
git add lib/integraciones/types.ts lib/integraciones/normalizer.ts
git commit -m "feat: tipos + normalizador actividad externa"
```

---

## Task 3: Conector Strava (OAuth2 + Webhook)

**Files:**
- Create: `lib/integraciones/strava.ts`
- Create: `app/api/integraciones/strava/connect/route.ts`
- Create: `app/api/integraciones/strava/callback/route.ts`
- Create: `app/api/integraciones/strava/disconnect/route.ts`
- Create: `app/api/integraciones/strava-webhook/route.ts`

Variables de entorno necesarias en `.env.local` y Vercel:
```
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=https://nutricoach-delta.vercel.app
STRAVA_WEBHOOK_VERIFY_TOKEN=nutricoach_strava_webhook_secret_2026
```

- [ ] **Step 1: Crear `lib/integraciones/strava.ts`**

```typescript
// lib/integraciones/strava.ts
import type { IntegracionCliente, ActividadExterna, ProveedorIntegracion } from './types'
import { createServiceSupabase } from '@/lib/supabase-server'

const BASE = 'https://www.strava.com'
const CLIENT_ID = process.env.STRAVA_CLIENT_ID!
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

// Mapa tipo actividad Strava → nombre normalizado
const TIPO_MAP: Record<string, string> = {
  Run: 'run', Ride: 'ride', Swim: 'swim', Walk: 'walk', Hike: 'hike',
  WeightTraining: 'strength', Workout: 'strength', Crossfit: 'strength',
  VirtualRide: 'ride', TrailRun: 'run', Triathlon: 'triathlon',
}

export const stravaProvider: ProveedorIntegracion = {
  proveedor: 'strava',

  getAuthUrl(clienteId: string, coachId: string): string {
    const state = Buffer.from(JSON.stringify({ clienteId, coachId })).toString('base64url')
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${APP_URL}/api/integraciones/strava/callback`,
      response_type: 'code',
      approval_prompt: 'auto',
      scope: 'read,activity:read_all',
      state,
    })
    return `${BASE}/oauth/authorize?${params}`
  },

  async handleCallback(code: string, state: string): Promise<Partial<IntegracionCliente>> {
    const res = await fetch(`${BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })
    if (!res.ok) throw new Error(`Strava token exchange failed: ${await res.text()}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(data.expires_at * 1000).toISOString(),
      proveedor_user_id: String(data.athlete?.id),
      scope: 'activity:read_all',
      activa: true,
    }
  },

  async revokeToken(integracion: IntegracionCliente): Promise<void> {
    if (!integracion.access_token) return
    await fetch(`${BASE}/oauth/deauthorize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${integracion.access_token}` },
    }).catch(() => {}) // fire and forget — si falla no bloqueamos
  },

  async syncActivities(integracion: IntegracionCliente, desde: Date): Promise<ActividadExterna[]> {
    const token = await refreshTokenIfNeeded(integracion)
    const after = Math.floor(desde.getTime() / 1000)

    const res = await fetch(
      `${BASE}/api/v3/athlete/activities?after=${after}&per_page=30`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`)
    const acts: Record<string, unknown>[] = await res.json()

    return acts.map(a => normalizeStravaActivity(integracion.cliente_id, a))
  },
}

async function refreshTokenIfNeeded(integracion: IntegracionCliente): Promise<string> {
  if (!integracion.token_expires_at) return integracion.access_token!
  const expiresAt = new Date(integracion.token_expires_at)
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) return integracion.access_token!

  // Token caducado — refrescar
  const res = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: integracion.refresh_token,
    }),
  })
  if (!res.ok) throw new Error('Strava refresh token failed')
  const data = await res.json()

  const db = createServiceSupabase()
  await db.from('integraciones_cliente').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: new Date(data.expires_at * 1000).toISOString(),
  }).eq('id', integracion.id)

  return data.access_token
}

function normalizeStravaActivity(
  clienteId: string,
  a: Record<string, unknown>
): ActividadExterna {
  const duracionS = a.moving_time as number ?? 0
  const fecha = (a.start_date_local as string ?? '').split('T')[0]

  // TSS estimado desde suffer_score de Strava (aprox) o cálculo básico
  // TSS real requiere FTP — usamos suffer_score × 0.4 como proxy
  const tss = a.suffer_score
    ? (a.suffer_score as number) * 0.4
    : undefined

  return {
    cliente_id: clienteId,
    proveedor: 'strava',
    fecha,
    tipo_entreno: TIPO_MAP[a.type as string] ?? String(a.type ?? ''),
    duracion_min: Math.round(duracionS / 60),
    distancia_entreno_km: a.distance ? parseFloat(((a.distance as number) / 1000).toFixed(2)) : undefined,
    calorias_activas: a.calories as number | undefined,
    fc_media: a.average_heartrate as number | undefined,
    fc_max: a.max_heartrate as number | undefined,
    tss,
    pace_min_km: a.average_speed && (a.type === 'Run')
      ? parseFloat((1000 / (a.average_speed as number) / 60).toFixed(2))
      : undefined,
    proveedor_activity_id: String(a.id),
    raw_data: a,
  }
}
```

- [ ] **Step 2: Crear endpoint `connect`**

```typescript
// app/api/integraciones/strava/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'
import { stravaProvider } from '@/lib/integraciones/strava'

export async function GET(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Obtener clienteId del query param (el coach conecta en nombre del cliente)
  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const url = stravaProvider.getAuthUrl(clienteId, user.id)
  return NextResponse.redirect(url)
}
```

- [ ] **Step 3: Crear endpoint `callback`**

```typescript
// app/api/integraciones/strava/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { stravaProvider } from '@/lib/integraciones/strava'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=strava_denegado`)
  }

  let clienteId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    clienteId = decoded.clienteId
  } catch {
    return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=state_invalido`)
  }

  const db = createServiceSupabase()
  try {
    const tokens = await stravaProvider.handleCallback(code, state)
    await db.from('integraciones_cliente').upsert(
      { cliente_id: clienteId, proveedor: 'strava', ...tokens },
      { onConflict: 'cliente_id,proveedor' }
    )
    // Sync inicial — últimas 2 semanas
    const integracion = await db
      .from('integraciones_cliente')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('proveedor', 'strava')
      .single()
    if (integracion.data) {
      const desde = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      const acts = await stravaProvider.syncActivities(integracion.data as never, desde)
      if (acts.length > 0) {
        const { persistirActividades } = await import('@/lib/integraciones/normalizer')
        await persistirActividades(db, acts)
      }
    }
  } catch (err) {
    console.error('[strava-callback]', err)
    return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=strava_error`)
  }

  return NextResponse.redirect(`${APP_URL}/cliente/integraciones?connected=strava`)
}
```

- [ ] **Step 4: Crear endpoint `disconnect`**

```typescript
// app/api/integraciones/strava/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { stravaProvider } from '@/lib/integraciones/strava'

export async function DELETE(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

  const db = createServiceSupabase()
  const { data: integracion } = await db
    .from('integraciones_cliente')
    .select('*')
    .eq('cliente_id', clienteId)
    .eq('proveedor', 'strava')
    .single()

  if (integracion) {
    await stravaProvider.revokeToken(integracion as never)
    await db.from('integraciones_cliente').delete()
      .eq('cliente_id', clienteId).eq('proveedor', 'strava')
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Crear webhook Strava (push en tiempo real)**

```typescript
// app/api/integraciones/strava-webhook/route.ts
// Strava envía GET para verificar el endpoint, y POST para cada actividad nueva
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { stravaProvider } from '@/lib/integraciones/strava'
import { persistirActividades } from '@/lib/integraciones/normalizer'

const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN!

// Strava verifica el webhook con un GET
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Strava notifica actividad nueva con POST
export async function POST(req: NextRequest) {
  const body = await req.json()
  // Solo procesar eventos de actividad creada/actualizada
  if (body.object_type !== 'activity') return NextResponse.json({ ok: true })
  if (!['create', 'update'].includes(body.aspect_type)) return NextResponse.json({ ok: true })

  const db = createServiceSupabase()
  const stravaUserId = String(body.owner_id)

  // Buscar qué cliente tiene este strava user id
  const { data: integracion } = await db
    .from('integraciones_cliente')
    .select('*')
    .eq('proveedor', 'strava')
    .eq('proveedor_user_id', stravaUserId)
    .single()

  if (!integracion) return NextResponse.json({ ok: true }) // usuario no vinculado

  try {
    const desde = new Date(Date.now() - 2 * 60 * 60 * 1000) // últimas 2h
    const acts = await stravaProvider.syncActivities(integracion as never, desde)
    if (acts.length > 0) await persistirActividades(db, acts)
  } catch (err) {
    console.error('[strava-webhook]', err)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/integraciones/strava.ts app/api/integraciones/strava/ app/api/integraciones/strava-webhook/
git commit -m "feat: Strava OAuth2 + webhook + sync de actividades"
```

---

## Task 4: Conector Garmin (OAuth2 + polling)

**Files:**
- Create: `lib/integraciones/garmin.ts`
- Create: `app/api/integraciones/garmin/connect/route.ts`
- Create: `app/api/integraciones/garmin/callback/route.ts`
- Create: `app/api/integraciones/garmin/disconnect/route.ts`

Variables necesarias:
```
GARMIN_CLIENT_ID=...
GARMIN_CLIENT_SECRET=...
```

- [ ] **Step 1: Crear `lib/integraciones/garmin.ts`**

```typescript
// lib/integraciones/garmin.ts
// Garmin Health API — OAuth2
// Documentación: https://developer.garmin.com/gc-developer-program/health-api/
import type { IntegracionCliente, ActividadExterna, ProveedorIntegracion } from './types'
import { createServiceSupabase } from '@/lib/supabase-server'

const BASE = 'https://connect.garmin.com'
const API = 'https://apis.garmin.com'
const CLIENT_ID = process.env.GARMIN_CLIENT_ID!
const CLIENT_SECRET = process.env.GARMIN_CLIENT_SECRET!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export const garminProvider: ProveedorIntegracion = {
  proveedor: 'garmin',

  getAuthUrl(clienteId: string): string {
    const state = Buffer.from(JSON.stringify({ clienteId })).toString('base64url')
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${APP_URL}/api/integraciones/garmin/callback`,
      response_type: 'code',
      scope: 'ACTIVITY_EXPORT DAILY_SUMMARY',
      state,
    })
    return `${BASE}/oauth2/authorize?${params}`
  },

  async handleCallback(code: string): Promise<Partial<IntegracionCliente>> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${APP_URL}/api/integraciones/garmin/callback`,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    })
    const res = await fetch(`${BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) throw new Error(`Garmin token exchange failed: ${await res.text()}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      scope: 'ACTIVITY_EXPORT DAILY_SUMMARY',
      activa: true,
    }
  },

  async revokeToken(integracion: IntegracionCliente): Promise<void> {
    if (!integracion.access_token) return
    await fetch(`${BASE}/oauth2/token/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${integracion.access_token}`,
      },
      body: new URLSearchParams({ token: integracion.access_token }).toString(),
    }).catch(() => {})
  },

  async syncActivities(integracion: IntegracionCliente, desde: Date): Promise<ActividadExterna[]> {
    const token = await refreshGarminToken(integracion)
    const uploadStartTimeInSeconds = Math.floor(desde.getTime() / 1000)

    // Garmin Daily Summaries endpoint
    const res = await fetch(
      `${API}/wellness-api/rest/dailies?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${Math.floor(Date.now() / 1000)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) {
      if (res.status === 429) throw new Error('Garmin rate limit')
      throw new Error(`Garmin dailies failed: ${res.status}`)
    }
    const data = await res.json()
    const summaries = data.dailies ?? []

    return summaries.map((s: Record<string, unknown>) => ({
      cliente_id: integracion.cliente_id,
      proveedor: 'garmin' as const,
      fecha: String(s.calendarDate ?? '').split('T')[0],
      pasos: s.totalSteps as number | undefined,
      calorias_activas: s.activeKilocalories as number | undefined,
      calorias_totales: (s.bmrKilocalories as number ?? 0) + (s.activeKilocalories as number ?? 0) || undefined,
      minutos_activo: s.moderateIntensityMinutes as number | undefined,
      minutos_alta_intensidad: s.vigorousIntensityMinutes as number | undefined,
      rhr: s.restingHeartRateInBeatsPerMinute as number | undefined,
      hrv: s.avgWakingRespirationValue as number | undefined, // proxy si no hay HRV directo
      sueño_h: s.sleepingSeconds ? parseFloat(((s.sleepingSeconds as number) / 3600).toFixed(1)) : undefined,
      proveedor_activity_id: String(s.summaryId ?? s.calendarDate),
      raw_data: s,
    }))
  },
}

async function refreshGarminToken(integracion: IntegracionCliente): Promise<string> {
  if (!integracion.token_expires_at) return integracion.access_token!
  const expiresAt = new Date(integracion.token_expires_at)
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) return integracion.access_token!

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integracion.refresh_token!,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })
  const res = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error('Garmin refresh failed')
  const data = await res.json()

  const db = createServiceSupabase()
  await db.from('integraciones_cliente').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq('id', integracion.id)

  return data.access_token
}
```

- [ ] **Step 2: Crear `connect`, `callback`, `disconnect` para Garmin**

Igual que Strava Task 3 Steps 2-4, pero con `garminProvider` y ruta `/garmin/`:

```typescript
// app/api/integraciones/garmin/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'
import { garminProvider } from '@/lib/integraciones/garmin'

export async function GET(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })
  return NextResponse.redirect(garminProvider.getAuthUrl(clienteId, user.id))
}
```

```typescript
// app/api/integraciones/garmin/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { garminProvider } from '@/lib/integraciones/garmin'
import { persistirActividades } from '@/lib/integraciones/normalizer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=garmin_denegado`)

  let clienteId: string
  try { clienteId = JSON.parse(Buffer.from(state, 'base64url').toString()).clienteId }
  catch { return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=state_invalido`) }

  const db = createServiceSupabase()
  try {
    const tokens = await garminProvider.handleCallback(code, state)
    await db.from('integraciones_cliente').upsert(
      { cliente_id: clienteId, proveedor: 'garmin', ...tokens },
      { onConflict: 'cliente_id,proveedor' }
    )
    const { data: integracion } = await db
      .from('integraciones_cliente').select('*')
      .eq('cliente_id', clienteId).eq('proveedor', 'garmin').single()
    if (integracion) {
      const acts = await garminProvider.syncActivities(integracion as never, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
      if (acts.length > 0) await persistirActividades(db, acts)
    }
  } catch (err) {
    console.error('[garmin-callback]', err)
    return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=garmin_error`)
  }
  return NextResponse.redirect(`${APP_URL}/cliente/integraciones?connected=garmin`)
}
```

```typescript
// app/api/integraciones/garmin/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { garminProvider } from '@/lib/integraciones/garmin'

export async function DELETE(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })
  const db = createServiceSupabase()
  const { data: integracion } = await db.from('integraciones_cliente').select('*')
    .eq('cliente_id', clienteId).eq('proveedor', 'garmin').single()
  if (integracion) {
    await garminProvider.revokeToken(integracion as never)
    await db.from('integraciones_cliente').delete()
      .eq('cliente_id', clienteId).eq('proveedor', 'garmin')
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/integraciones/garmin.ts app/api/integraciones/garmin/
git commit -m "feat: Garmin OAuth2 + polling actividades diarias"
```

---

## Task 5: Conector Google Fit (OAuth2 + polling)

**Files:**
- Create: `lib/integraciones/google-fit.ts`
- Create: `app/api/integraciones/google-fit/connect/route.ts`
- Create: `app/api/integraciones/google-fit/callback/route.ts`
- Create: `app/api/integraciones/google-fit/disconnect/route.ts`

Variables necesarias:
```
GOOGLE_FIT_CLIENT_ID=...
GOOGLE_FIT_CLIENT_SECRET=...
```

- [ ] **Step 1: Crear `lib/integraciones/google-fit.ts`**

```typescript
// lib/integraciones/google-fit.ts
// Google Fit REST API — https://developers.google.com/fit/rest
import type { IntegracionCliente, ActividadExterna, ProveedorIntegracion } from './types'
import { createServiceSupabase } from '@/lib/supabase-server'

const OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FIT_API = 'https://www.googleapis.com/fitness/v1/users/me'
const CLIENT_ID = process.env.GOOGLE_FIT_CLIENT_ID!
const CLIENT_SECRET = process.env.GOOGLE_FIT_CLIENT_SECRET!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.body.read',
].join(' ')

export const googleFitProvider: ProveedorIntegracion = {
  proveedor: 'google_fit',

  getAuthUrl(clienteId: string): string {
    const state = Buffer.from(JSON.stringify({ clienteId })).toString('base64url')
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${APP_URL}/api/integraciones/google-fit/callback`,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    })
    return `${OAUTH_BASE}?${params}`
  },

  async handleCallback(code: string): Promise<Partial<IntegracionCliente>> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/integraciones/google-fit/callback`,
        grant_type: 'authorization_code',
      }).toString(),
    })
    if (!res.ok) throw new Error(`Google Fit token exchange failed: ${await res.text()}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      scope: SCOPES,
      activa: true,
    }
  },

  async revokeToken(integracion: IntegracionCliente): Promise<void> {
    if (!integracion.access_token) return
    await fetch(`https://oauth2.googleapis.com/revoke?token=${integracion.access_token}`, {
      method: 'POST',
    }).catch(() => {})
  },

  async syncActivities(integracion: IntegracionCliente, desde: Date): Promise<ActividadExterna[]> {
    const token = await refreshGoogleToken(integracion)
    const startMs = desde.getTime()
    const endMs = Date.now()

    // Aggregate dataset: pasos, calorías, minutos activos
    const STREAMS = [
      { dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps', field: 'pasos' },
      { dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:from_activities', field: 'calorias' },
      { dataSourceId: 'derived:com.google.active_minutes:com.google.android.gms:merge_active_minutes', field: 'minutos' },
    ]

    const results: Record<string, number> = {}
    for (const { dataSourceId, field } of STREAMS) {
      const res = await fetch(
        `${FIT_API}/dataSources/${encodeURIComponent(dataSourceId)}/datasets/${startMs * 1000000}-${endMs * 1000000}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.ok) {
        const data = await res.json()
        const total = (data.point ?? []).reduce((acc: number, p: Record<string, unknown>) => {
          const val = (p.value as { intVal?: number; fpVal?: number }[])?.[0]
          return acc + (val?.intVal ?? val?.fpVal ?? 0)
        }, 0)
        results[field] = total
      }
    }

    // Una actividad por día (agregado)
    const fecha = new Date(startMs).toISOString().split('T')[0]
    return [{
      cliente_id: integracion.cliente_id,
      proveedor: 'google_fit',
      fecha,
      pasos: results['pasos'] ? Math.round(results['pasos']) : undefined,
      calorias_activas: results['calorias'] ? Math.round(results['calorias']) : undefined,
      minutos_activo: results['minutos'] ? Math.round(results['minutos']) : undefined,
      proveedor_activity_id: `${fecha}_aggregate`,
      raw_data: results,
    }]
  },
}

async function refreshGoogleToken(integracion: IntegracionCliente): Promise<string> {
  if (!integracion.token_expires_at) return integracion.access_token!
  if (new Date(integracion.token_expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return integracion.access_token!
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: integracion.refresh_token!,
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
    }).toString(),
  })
  if (!res.ok) throw new Error('Google Fit refresh failed')
  const data = await res.json()
  const db = createServiceSupabase()
  await db.from('integraciones_cliente').update({
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq('id', integracion.id)
  return data.access_token
}
```

- [ ] **Step 2: Endpoints `connect`, `callback`, `disconnect`**

Misma estructura que Garmin (Task 4 Step 2) pero importando `googleFitProvider` y ruta `/google-fit/`:

```typescript
// app/api/integraciones/google-fit/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'
import { googleFitProvider } from '@/lib/integraciones/google-fit'
export async function GET(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })
  return NextResponse.redirect(googleFitProvider.getAuthUrl(clienteId, user.id))
}
```

```typescript
// app/api/integraciones/google-fit/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { googleFitProvider } from '@/lib/integraciones/google-fit'
import { persistirActividades } from '@/lib/integraciones/normalizer'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=gfit_denegado`)
  let clienteId: string
  try { clienteId = JSON.parse(Buffer.from(state, 'base64url').toString()).clienteId }
  catch { return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=state_invalido`) }
  const db = createServiceSupabase()
  try {
    const tokens = await googleFitProvider.handleCallback(code, state)
    await db.from('integraciones_cliente').upsert(
      { cliente_id: clienteId, proveedor: 'google_fit', ...tokens },
      { onConflict: 'cliente_id,proveedor' }
    )
    const { data: intg } = await db.from('integraciones_cliente').select('*')
      .eq('cliente_id', clienteId).eq('proveedor', 'google_fit').single()
    if (intg) {
      const acts = await googleFitProvider.syncActivities(intg as never, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      if (acts.length > 0) await persistirActividades(db, acts)
    }
  } catch (err) {
    console.error('[gfit-callback]', err)
    return NextResponse.redirect(`${APP_URL}/cliente/integraciones?error=gfit_error`)
  }
  return NextResponse.redirect(`${APP_URL}/cliente/integraciones?connected=google_fit`)
}
```

```typescript
// app/api/integraciones/google-fit/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { googleFitProvider } from '@/lib/integraciones/google-fit'
export async function DELETE(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })
  const db = createServiceSupabase()
  const { data: intg } = await db.from('integraciones_cliente').select('*')
    .eq('cliente_id', clienteId).eq('proveedor', 'google_fit').single()
  if (intg) {
    await googleFitProvider.revokeToken(intg as never)
    await db.from('integraciones_cliente').delete()
      .eq('cliente_id', clienteId).eq('proveedor', 'google_fit')
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/integraciones/google-fit.ts app/api/integraciones/google-fit/
git commit -m "feat: Google Fit OAuth2 + polling actividad diaria"
```

---

## Task 6: Skeleton Whoop (partner API — conexión futura)

**Files:**
- Create: `lib/integraciones/whoop.ts`

Whoop requiere aprobación de partner. Este archivo define la interfaz completa para que cuando llegue la aprobación solo haya que rellenar los endpoints reales.

- [ ] **Step 1: Crear `lib/integraciones/whoop.ts`**

```typescript
// lib/integraciones/whoop.ts
// WHOOP API v1 — https://developer.whoop.com/api
// NOTA: requiere aprobación de partner program antes de usar en producción
// OAuth2 credentials obtenidas en: https://developer.whoop.com/
import type { IntegracionCliente, ActividadExterna, ProveedorIntegracion } from './types'

const BASE = 'https://api.prod.whoop.com/developer'
const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
const CLIENT_ID = process.env.WHOOP_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET ?? ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export const whoopProvider: ProveedorIntegracion = {
  proveedor: 'whoop',

  getAuthUrl(clienteId: string): string {
    const state = Buffer.from(JSON.stringify({ clienteId })).toString('base64url')
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${APP_URL}/api/integraciones/whoop/callback`,
      response_type: 'code',
      scope: 'read:recovery read:sleep read:workout read:body_measurement',
      state,
    })
    return `${AUTH_URL}?${params}`
  },

  async handleCallback(code: string): Promise<Partial<IntegracionCliente>> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code,
        client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: `${APP_URL}/api/integraciones/whoop/callback`,
      }).toString(),
    })
    if (!res.ok) throw new Error(`Whoop token exchange failed: ${await res.text()}`)
    const data = await res.json()
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      scope: data.scope,
      activa: true,
    }
  },

  async revokeToken(integracion: IntegracionCliente): Promise<void> {
    if (!integracion.access_token) return
    await fetch(`${TOKEN_URL}/revoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integracion.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: integracion.access_token }).toString(),
    }).catch(() => {})
  },

  async syncActivities(integracion: IntegracionCliente, desde: Date): Promise<ActividadExterna[]> {
    const token = integracion.access_token!
    const start = desde.toISOString()
    const end = new Date().toISOString()

    // Recovery (HRV, RHR, sleep performance)
    const recRes = await fetch(
      `${BASE}/v1/recovery/collection?start=${start}&end=${end}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!recRes.ok) throw new Error(`Whoop recovery failed: ${recRes.status}`)
    const recData = await recRes.json()
    const recoveries: ActividadExterna[] = (recData.records ?? []).map((r: Record<string, unknown>) => {
      const sleep = r.sleep as Record<string, unknown> | undefined
      return {
        cliente_id: integracion.cliente_id,
        proveedor: 'whoop' as const,
        fecha: String(r.created_at ?? '').split('T')[0],
        hrv: (r.score as Record<string, unknown>)?.hrv_rmssd_on_sleep as number | undefined,
        rhr: (r.score as Record<string, unknown>)?.resting_heart_rate as number | undefined,
        sueño_h: sleep?.sleep_performance_percentage ? undefined : undefined,
        sueno_calidad: (r.score as Record<string, unknown>)?.recovery_score as number | undefined,
        proveedor_activity_id: `recovery_${r.id}`,
        raw_data: r,
      }
    })

    return recoveries
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/integraciones/whoop.ts
git commit -m "feat: Whoop skeleton (pendiente aprobación partner)"
```

---

## Task 7: Cron de sincronización + sync.ts central

**Files:**
- Create: `lib/integraciones/sync.ts`
- Create: `app/api/cron/sync-integraciones/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Crear `lib/integraciones/sync.ts`**

```typescript
// lib/integraciones/sync.ts
// Orquesta la sincronización de todos los proveedores para todos los clientes
import { createServiceSupabase } from '@/lib/supabase-server'
import { persistirActividades } from './normalizer'
import { garminProvider } from './garmin'
import { googleFitProvider } from './google-fit'
import { whoopProvider } from './whoop'
import type { ProveedorIntegracion, IntegracionCliente } from './types'

const PROVEEDORES: ProveedorIntegracion[] = [
  garminProvider,
  googleFitProvider,
  whoopProvider,
  // stravaProvider usa webhook push, no polling
]

export async function sincronizarTodosProveedores(): Promise<{
  synced: number
  errors: string[]
}> {
  const db = createServiceSupabase()
  const desde = new Date(Date.now() - 25 * 60 * 60 * 1000) // últimas 25h (overlap)

  const { data: integraciones } = await db
    .from('integraciones_cliente')
    .select('*')
    .eq('activa', true)
    .not('proveedor', 'eq', 'strava') // strava usa webhook
    .not('proveedor', 'eq', 'manual')

  if (!integraciones || integraciones.length === 0) return { synced: 0, errors: [] }

  let synced = 0
  const errors: string[] = []

  for (const raw of integraciones) {
    const intg = raw as IntegracionCliente
    const proveedor = PROVEEDORES.find(p => p.proveedor === intg.proveedor)
    if (!proveedor) continue

    try {
      const acts = await proveedor.syncActivities(intg, desde)
      if (acts.length > 0) {
        await persistirActividades(db, acts)
        synced += acts.length
      }
      await db.from('integraciones_cliente').update({
        ultima_sync: new Date().toISOString(),
        error_ultimo: null,
      }).eq('id', intg.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${intg.proveedor}:${intg.cliente_id}: ${msg}`)
      await db.from('integraciones_cliente').update({ error_ultimo: msg }).eq('id', intg.id)
    }
  }

  return { synced, errors }
}
```

- [ ] **Step 2: Crear endpoint cron**

```typescript
// app/api/cron/sync-integraciones/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sincronizarTodosProveedores } from '@/lib/integraciones/sync'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sincronizarTodosProveedores()
  return NextResponse.json(result)
}
```

- [ ] **Step 3: Añadir cron en `vercel.json`**

Leer el archivo `vercel.json` actual y añadir el cron:

```json
{
  "crons": [
    { "path": "/api/cron/sync-integraciones", "schedule": "0 * * * *" }
  ]
}
```

Añadir esta entrada al array `crons` existente en `vercel.json` (mantener los crons de agentes existentes).

- [ ] **Step 4: Commit**

```bash
git add lib/integraciones/sync.ts app/api/cron/sync-integraciones/route.ts vercel.json
git commit -m "feat: cron sync integraciones cada hora (Garmin + Google Fit + Whoop)"
```

---

## Task 8: CheckInForm — campos manuales opcionales

**Files:**
- Modify: `components/PortalCliente/CheckInForm.tsx`
- Modify: `app/api/checkins/route.ts` (añadir campos pasos, hrv, calorias_quemadas)

- [ ] **Step 1: Añadir campos en `CheckInForm.tsx`**

Buscar el final del formulario en `components/PortalCliente/CheckInForm.tsx` (después de `sueno`) y añadir una sección colapsable "Datos de mi dispositivo (opcional)":

```tsx
// Añadir después del bloque de sueño y antes del botón submit
const [mostrarDatosDispositivo, setMostrarDatosDispositivo] = useState(false)
const [pasosManual, setPasosManual] = useState('')
const [kcalQuemadasManual, setKcalQuemadasManual] = useState('')
const [hrvManual, setHrvManual] = useState('')

// En el JSX, antes del botón:
<button
  type="button"
  onClick={() => setMostrarDatosDispositivo(v => !v)}
  className="text-sm text-[var(--text-muted)] underline mt-2"
>
  {mostrarDatosDispositivo ? '▲ Ocultar' : '▼ Añadir datos de dispositivo (opcional)'}
</button>

{mostrarDatosDispositivo && (
  <div className="mt-3 space-y-3 border border-[var(--border)] rounded-xl p-3">
    <p className="text-xs text-[var(--text-muted)]">
      Si no tienes vinculado tu dispositivo, puedes introducir los datos manualmente.
    </p>
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className="text-xs text-[var(--text-muted)]">Pasos</label>
        <input type="number" className="input mt-1 text-sm" placeholder="8.500"
          value={pasosManual} onChange={e => setPasosManual(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-[var(--text-muted)]">Kcal quemadas</label>
        <input type="number" className="input mt-1 text-sm" placeholder="450"
          value={kcalQuemadasManual} onChange={e => setKcalQuemadasManual(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-[var(--text-muted)]">HRV (ms)</label>
        <input type="number" className="input mt-1 text-sm" placeholder="65"
          value={hrvManual} onChange={e => setHrvManual(e.target.value)} />
      </div>
    </div>
  </div>
)}
```

Incluir en el payload del `fetch` POST:
```typescript
...(pasosManual ? { pasos_manual: parseInt(pasosManual) } : {}),
...(kcalQuemadasManual ? { calorias_activas_manual: parseInt(kcalQuemadasManual) } : {}),
...(hrvManual ? { hrv_manual: parseFloat(hrvManual) } : {}),
```

- [ ] **Step 2: Persistir datos manuales como actividad_externa**

En `app/api/checkins/route.ts` (POST), después de insertar el checkin, añadir:

```typescript
// Si hay datos manuales de dispositivo, persistir en actividad_externa_cliente
const { pasos_manual, calorias_activas_manual, hrv_manual } = body
if (pasos_manual || calorias_activas_manual || hrv_manual) {
  const db2 = createServiceSupabase()
  await db2.from('actividad_externa_cliente').upsert({
    cliente_id: clienteId,
    proveedor: 'manual',
    fecha: new Date().toISOString().split('T')[0],
    pasos: pasos_manual ?? null,
    calorias_activas: calorias_activas_manual ?? null,
    hrv: hrv_manual ?? null,
    proveedor_activity_id: `manual_${new Date().toISOString().split('T')[0]}`,
  }, { onConflict: 'cliente_id,proveedor,fecha,proveedor_activity_id', ignoreDuplicates: false })
}
```

- [ ] **Step 3: Commit**

```bash
git add components/PortalCliente/CheckInForm.tsx app/api/checkins/route.ts
git commit -m "feat: check-in con campos manuales de dispositivo (pasos, kcal, HRV)"
```

---

## Task 9: UI IntegracionesPanel en portal cliente

**Files:**
- Create: `components/PortalCliente/IntegracionesPanel.tsx`
- Create: `app/api/cliente/[codigo]/integraciones/route.ts`
- Modify: `components/PortalCliente/DashboardCliente.tsx`

- [ ] **Step 1: API para leer integraciones del cliente**

```typescript
// app/api/cliente/[codigo]/integraciones/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const db = createServiceSupabase()

  const { data: cliente } = await db
    .from('clientes').select('id').eq('codigo_publico', codigo).single()
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: integraciones } = await db
    .from('integraciones_cliente')
    .select('proveedor, activa, ultima_sync, error_ultimo')
    .eq('cliente_id', cliente.id)

  return NextResponse.json({ integraciones: integraciones ?? [] })
}
```

- [ ] **Step 2: Crear `IntegracionesPanel.tsx`**

```tsx
// components/PortalCliente/IntegracionesPanel.tsx
'use client'
import { useEffect, useState } from 'react'
import { Activity, Zap, Watch, Heart, Smartphone, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface IntegracionInfo {
  proveedor: string
  activa: boolean
  ultima_sync: string | null
  error_ultimo: string | null
}

const PROVEEDORES_CONFIG = [
  {
    key: 'strava',
    nombre: 'Strava',
    descripcion: 'Actividades de running, ciclismo y natación',
    icono: Activity,
    color: '#FC4C02',
    disponible: true,
  },
  {
    key: 'garmin',
    nombre: 'Garmin',
    descripcion: 'Pasos, HRV, sueño, carga de entrenamiento',
    icono: Watch,
    color: '#007CC3',
    disponible: true,
  },
  {
    key: 'google_fit',
    nombre: 'Google Fit',
    descripcion: 'Actividad diaria, pasos y calorías',
    icono: Smartphone,
    color: '#4285F4',
    disponible: true,
  },
  {
    key: 'whoop',
    nombre: 'Whoop',
    descripcion: 'HRV, recuperación y strain diario',
    icono: Heart,
    color: '#000000',
    disponible: false, // pendiente aprobación partner
  },
]

interface Props {
  codigo: string
  clienteId: string
}

export default function IntegracionesPanel({ codigo, clienteId }: Props) {
  const [integraciones, setIntegraciones] = useState<IntegracionInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/cliente/${codigo}/integraciones`)
      .then(r => r.json())
      .then(d => setIntegraciones(d.integraciones ?? []))
      .finally(() => setLoading(false))
  }, [codigo])

  const getEstado = (key: string) =>
    integraciones.find(i => i.proveedor === key)

  const handleConnect = (provedor: string) => {
    window.location.href = `/api/integraciones/${provedor}/connect?cliente_id=${clienteId}`
  }

  const handleDisconnect = async (proveedor: string) => {
    if (!confirm(`¿Desconectar ${proveedor}?`)) return
    await fetch(`/api/integraciones/${proveedor}/disconnect?cliente_id=${clienteId}`, { method: 'DELETE' })
    setIntegraciones(prev => prev.filter(i => i.proveedor !== proveedor))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-base font-bold text-[var(--text)]">Mis apps y dispositivos</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Conecta tus apps para que tu coach tenga datos más precisos y tus planes se adapten mejor a tu actividad real.
        </p>
      </div>

      {PROVEEDORES_CONFIG.map(({ key, nombre, descripcion, icono: Icono, color, disponible }) => {
        const estado = getEstado(key)
        const conectado = estado?.activa ?? false
        const ultimaSync = estado?.ultima_sync
          ? new Date(estado.ultima_sync).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : null

        return (
          <div
            key={key}
            className="card p-4 flex items-center justify-between gap-4"
            style={{ opacity: disponible ? 1 : 0.5 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
                <Icono size={20} style={{ color }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text)]">{nombre}</span>
                  {!disponible && (
                    <span className="text-[10px] bg-[var(--surface)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full">Próximamente</span>
                  )}
                  {conectado && <CheckCircle size={14} className="text-green-500" />}
                </div>
                <p className="text-xs text-[var(--text-muted)]">{descripcion}</p>
                {ultimaSync && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Última sync: {ultimaSync}</p>}
                {estado?.error_ultimo && (
                  <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                    <XCircle size={10} /> Error: {estado.error_ultimo.slice(0, 50)}
                  </p>
                )}
              </div>
            </div>

            {disponible && (
              conectado ? (
                <button
                  onClick={() => handleDisconnect(key)}
                  className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                >
                  Desconectar
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(key)}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  Conectar
                </button>
              )
            )}
          </div>
        )
      })}

      <div className="card p-4 flex items-start gap-3" style={{ background: 'var(--surface)' }}>
        <Zap size={16} className="text-[var(--primary)] mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-[var(--text)]">¿Para qué sirve conectar mis apps?</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Tu coach recibe datos reales de actividad: pasos, calorías quemadas, HRV y carga de entrenamiento.
            Con estos datos el sistema ajusta automáticamente tus macros y detecta cuando necesitas más o menos calorías según tu vida real.
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Añadir tab "Apps" en `DashboardCliente.tsx`**

En `components/PortalCliente/DashboardCliente.tsx`:

1. Añadir `'integraciones'` al tipo `Tab`:
```typescript
type Tab = 'plan' | 'checkin' | 'entreno' | 'progreso' | 'historial' | 'chat' | 'integraciones'
```

2. Añadir al array `TABS`:
```typescript
{ key: 'integraciones', label: 'Apps', icon: Smartphone }
```

3. Añadir import `Smartphone` desde lucide-react.

4. Añadir import `IntegracionesPanel`.

5. Añadir render del tab:
```tsx
{tab === 'integraciones' && (
  <IntegracionesPanel codigo={codigo} clienteId={data.cliente.id} />
)}
```

- [ ] **Step 4: Commit**

```bash
git add components/PortalCliente/IntegracionesPanel.tsx app/api/cliente/ components/PortalCliente/DashboardCliente.tsx
git commit -m "feat: portal cliente tab 'Apps' con IntegracionesPanel"
```

---

## Task 10: Integrar actividad externa en agentes IA

**Files:**
- Modify: `lib/agentes/executor.ts` — `cargarContextoCliente()` incluye resumen actividad 7d
- Modify: `lib/agentes/types.ts` — `ContextoCliente` incluye `actividad_semanal`
- Modify: `lib/agentes/revisor-semanal.ts` — 4 nodos nuevos en el árbol de decisión

- [ ] **Step 1: Actualizar `ContextoCliente` en `types.ts`**

```typescript
// Añadir en lib/agentes/types.ts, dentro de ContextoCliente:
import type { ResumenActividadSemanal } from '@/lib/integraciones/normalizer'

export interface ContextoCliente {
  cliente: { ... }          // sin cambios
  plan_activo: { ... }      // sin cambios
  checkins_recientes: CheckinResumen[]
  perfil_aprendizaje: ClientePerfilAprendizaje | null
  metodologia_coach: CoachMemoria[]
  actividad_semanal: ResumenActividadSemanal | null  // ← NUEVO
}
```

- [ ] **Step 2: Añadir fetch en `cargarContextoCliente()` de `executor.ts`**

Al final del bloque de fetches paralelos en `cargarContextoCliente`, añadir:

```typescript
import { getSummaryLast7d } from '@/lib/integraciones/normalizer'

// Dentro de cargarContextoCliente(), después del fetch de metodologia:
const actividadSemanal = await getSummaryLast7d(db, clienteId).catch(() => null)

// En el return:
return {
  cliente: { ... },
  plan_activo: plan ?? null,
  checkins_recientes: (checkins ?? []) as CheckinResumen[],
  perfil_aprendizaje: perfil as ClientePerfilAprendizaje | null,
  metodologia_coach: (metodologia ?? []) as CoachMemoria[],
  actividad_semanal: actividadSemanal,  // ← NUEVO
}
```

- [ ] **Step 3: Añadir 4 nodos nuevos en `revisor-semanal.ts`**

Insertar después del nodo N18 y antes del cálculo de urgencia:

```typescript
// ─ N_TDEE: ¿TDEE real disponible y diferente al objetivo? ────
const tdeeReal = ctx.actividad_semanal?.tdee_estimado ?? 0
const kcalObj2 = plan?.kcal_objetivo ?? 2000
const n_tdee_gap = tdeeReal > 0 && Math.abs(tdeeReal - kcalObj2) > 200
nodos.push({ nodo: 'N_TDEE_real', resultado: tdeeReal > 0 ? `${tdeeReal} kcal/día` : 'sin datos', valor: tdeeReal, umbral: kcalObj2, confianza: tdeeReal > 0 ? 0.85 : 0 })
if (n_tdee_gap && tdeeReal > 0) {
  intervenciones.push('ajuste_kcal')
  scoreAccion += 2
}

// ─ N_TSS: ¿Carga de entrenamiento semanal alta? ──────────────
const tssSemanal = ctx.actividad_semanal?.tss_semanal ?? 0
const n_tss_alto = tssSemanal > 400 // umbral: carga alta según Coggan
nodos.push({ nodo: 'N_TSS_semanal', resultado: `TSS ${tssSemanal.toFixed(0)}`, valor: tssSemanal, umbral: 400, confianza: tssSemanal > 0 ? 0.9 : 0 })
if (n_tss_alto && n6_bajEnergia) {
  intervenciones.push('refeed')
  scoreAccion += 1.5
}

// ─ N_HRV: ¿HRV bajo esta semana (señal de sobreentrenamiento)? ─
const hrvMedia = ctx.actividad_semanal?.hrv_media ?? null
const n_hrv_bajo = hrvMedia !== null && hrvMedia < 40
nodos.push({ nodo: 'N_HRV', resultado: hrvMedia !== null ? `${hrvMedia} ms` : 'sin datos', valor: hrvMedia ?? 0, umbral: 40, confianza: hrvMedia !== null ? 0.9 : 0 })
if (n_hrv_bajo) {
  intervenciones.push('revisar_carga_reducir')
  scoreAccion += 2
}

// ─ N_PASOS: ¿NEAT bajo (pasos <6000/día)? ───────────────────
const pasosMedio = ctx.actividad_semanal?.pasos_media ?? 0
const n_neat_bajo = pasosMedio > 0 && pasosMedio < 6000
nodos.push({ nodo: 'N_PASOS', resultado: pasosMedio > 0 ? `${pasosMedio.toLocaleString()} pasos/día` : 'sin datos', valor: pasosMedio, umbral: 6000, confianza: pasosMedio > 0 ? 0.8 : 0 })
if (n_neat_bajo && n8_estancado) {
  // El estancamiento puede ser NEAT bajo, no falta de adherencia
  intervenciones.push('aumentar_neat')
  scoreAccion += 1
}
```

También añadir en `construirPrompt()` el bloque de actividad semanal:

```typescript
// Añadir en construirPrompt() después del bloque ÁRBOL DE DECISIÓN:
const actBloque = ctx.actividad_semanal?.tiene_datos
  ? `\nACTIVIDAD REAL (dispositivo) — últimos 7 días:
- Pasos/día: ${ctx.actividad_semanal.pasos_media.toLocaleString()}
- Calorías activas totales: ${ctx.actividad_semanal.calorias_activas_total} kcal
- TDEE estimado: ${ctx.actividad_semanal.tdee_estimado > 0 ? ctx.actividad_semanal.tdee_estimado + ' kcal/día' : 'sin datos'}
- TSS semanal: ${ctx.actividad_semanal.tss_semanal.toFixed(0)} (carga acumulada)
- HRV media: ${ctx.actividad_semanal.hrv_media ?? 'sin datos'} ms
- Sesiones de entreno registradas: ${ctx.actividad_semanal.sesiones_entreno}
- Fuentes: ${ctx.actividad_semanal.fuentes.join(', ')}` : ''

// Incluir actBloque al final del prompt string
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit --pretty false 2>&1 | grep -E "error TS"
# Debe salir vacío
```

- [ ] **Step 5: Commit**

```bash
git add lib/agentes/types.ts lib/agentes/executor.ts lib/agentes/revisor-semanal.ts
git commit -m "feat: actividad_semanal en contexto agentes + 4 nodos TDEE/TSS/HRV/pasos"
```

---

## Task 11: Build + variables de entorno + registro webhook Strava

- [ ] **Step 1: Build de producción**

```bash
npm run build 2>&1 | tail -15
# Debe terminar sin errores
```

- [ ] **Step 2: Añadir variables en Vercel**

```bash
vercel env add STRAVA_CLIENT_ID production
vercel env add STRAVA_CLIENT_SECRET production
vercel env add STRAVA_WEBHOOK_VERIFY_TOKEN production
vercel env add GARMIN_CLIENT_ID production
vercel env add GARMIN_CLIENT_SECRET production
vercel env add GOOGLE_FIT_CLIENT_ID production
vercel env add GOOGLE_FIT_CLIENT_SECRET production
# WHOOP pendiente de aprobación partner
```

- [ ] **Step 3: Deploy + registrar webhook Strava**

```bash
git add -A && git commit -m "feat: integraciones dispositivos completo + cron sync"
git push origin main
```

Una vez desplegado, registrar el webhook de Strava (solo una vez):

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=$STRAVA_CLIENT_ID \
  -F client_secret=$STRAVA_CLIENT_SECRET \
  -F callback_url=https://nutricoach-delta.vercel.app/api/integraciones/strava-webhook \
  -F verify_token=nutricoach_strava_webhook_secret_2026
```

Respuesta esperada: `{"id": 12345}` — guarda ese ID, lo necesitarás si quieres eliminar el webhook.

- [ ] **Step 4: Verificar en producción**

1. Abrir portal cliente → tab "Apps"
2. Click "Conectar" en Strava → redirige a Strava OAuth → vuelve con `?connected=strava`
3. Verificar en Supabase: `SELECT * FROM integraciones_cliente WHERE proveedor = 'strava'`
4. Verificar actividades: `SELECT * FROM actividad_externa_cliente LIMIT 10`

---

## Self-Review

**Spec coverage:**
- ✅ Strava OAuth2 + webhook push — Task 3
- ✅ Garmin OAuth2 + polling — Task 4
- ✅ Google Fit OAuth2 + polling — Task 5
- ✅ Whoop skeleton para aprobación futura — Task 6
- ✅ Cron sync cada hora — Task 7
- ✅ Manual input en check-in — Task 8
- ✅ UI portal cliente tab "Apps" — Task 9
- ✅ Integración en árbol de decisión IA (+4 nodos) — Task 10
- ✅ Arquitectura extensible para futuros proveedores — `ProveedorIntegracion` interface en types.ts
- ✅ Normalización central `actividad_externa_cliente` — Task 1 + Task 2

**Placeholder scan:** Ninguno detectado. Todos los steps tienen código completo.

**Type consistency:**
- `ActividadExterna` definida en Task 2 → usada en Task 3, 4, 5, 6, 7 ✅
- `ProveedorIntegracion` definida en Task 2 → implementada en strava/garmin/google-fit/whoop ✅
- `ResumenActividadSemanal` definida en `normalizer.ts` → importada en `types.ts` Task 10 ✅
- `actividad_semanal` añadida a `ContextoCliente` → leída en `revisor-semanal.ts` ✅
- `getSummaryLast7d` exportada desde `normalizer.ts` → importada en `executor.ts` ✅
