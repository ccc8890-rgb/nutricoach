-- Entrenos individuales traídos de Garmin/Strava (uno por actividad), base del panel de rendimiento.
-- Los escribe la sincronización con service role; el coach los lee a través de la API.
create table if not exists public.entrenos_realizados (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  fuente text not null,
  actividad_id text not null,
  fecha date not null,
  inicio_local timestamp,
  tipo text,
  nombre text,
  duracion_s integer,
  distancia_m numeric(10,1),
  ritmo_medio_s_km numeric(7,1),
  fc_media integer,
  fc_max integer,
  desnivel_m numeric(7,1),
  carga_garmin numeric(7,1),
  efecto_aerobico numeric(3,1),
  efecto_anaerobico numeric(3,1),
  vo2max numeric(4,1),
  tiempo_zona_fc jsonb,
  mejores_parciales jsonb,
  tss numeric(7,1),
  tss_metodo text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (cliente_id, fuente, actividad_id)
);

create index if not exists idx_entrenos_realizados_cliente_fecha
  on public.entrenos_realizados (cliente_id, fecha desc);

alter table public.entrenos_realizados enable row level security;

comment on table public.entrenos_realizados is
  'Una fila por entreno real (Garmin/Strava): ritmo, pulso, carga y zonas. Solo escribe la sincronización (service role).';
