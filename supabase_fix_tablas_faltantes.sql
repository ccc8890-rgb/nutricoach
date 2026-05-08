-- ============================================================
-- NUTRICOACH - Tablas faltantes (ejecutar en SQL Editor)
-- ============================================================
-- Las tablas básicas (profiles, clientes, alimentos, etc.) ya existen.
-- Este script crea las 8 tablas nuevas + índices que faltan.
-- ============================================================

-- 1. PLANTILLAS_DIETAS
create table if not exists public.plantillas_dietas (
  id uuid default uuid_generate_v4() primary key,
  coach_id uuid references public.profiles(id) on delete cascade not null,
  nombre text not null,
  descripcion text,
  tipo text default 'normal' check (tipo in ('normal', 'carga', 'suplementos')),
  kcal_objetivo numeric(7,2),
  proteinas_objetivo numeric(6,2),
  carbohidratos_objetivo numeric(6,2),
  grasas_objetivo numeric(6,2),
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.plantillas_dietas enable row level security;

drop policy if exists "Coach can manage plantillas_dietas" on public.plantillas_dietas;
create policy "Coach can manage plantillas_dietas" on public.plantillas_dietas
  for all using (coach_id = auth.uid());

-- 2. CHECKINS
create table if not exists public.checkins (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  fecha date not null default current_date,
  peso numeric(5,2),
  adherencia integer check (adherencia between 1 and 10),
  energia integer check (energia between 1 and 10),
  sueno integer check (sueno between 1 and 10),
  notas text,
  sugerencia_ia text,
  created_at timestamptz default now()
);

alter table public.checkins enable row level security;

drop policy if exists "Coach can manage checkins" on public.checkins;
create policy "Coach can manage checkins" on public.checkins
  for all using (
    exists (select 1 from public.clientes c where c.id = cliente_id and c.coach_id = auth.uid())
  );

drop policy if exists "Cliente can manage own checkins" on public.checkins;
create policy "Cliente can manage own checkins" on public.checkins
  for all using (
    exists (select 1 from public.clientes c where c.id = cliente_id and c.profile_id = auth.uid())
  );

drop policy if exists "Anyone with codigo can insert checkins" on public.checkins;
create policy "Anyone with codigo can insert checkins" on public.checkins
  for insert with check (true);

-- 3. NOTAS_COACH
create table if not exists public.notas_coach (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  coach_id uuid references public.profiles(id),
  mensaje text not null,
  created_at timestamptz default now()
);

alter table public.notas_coach enable row level security;

drop policy if exists "Coach can manage notas_coach" on public.notas_coach;
create policy "Coach can manage notas_coach" on public.notas_coach
  for all using (
    exists (select 1 from public.clientes c where c.id = cliente_id and c.coach_id = auth.uid())
  );

drop policy if exists "Cliente can view own notas_coach" on public.notas_coach;
create policy "Cliente can view own notas_coach" on public.notas_coach
  for select using (
    exists (select 1 from public.clientes c where c.id = cliente_id and c.profile_id = auth.uid())
  );

drop policy if exists "Anyone with codigo can view notas_coach" on public.notas_coach;
create policy "Anyone with codigo can view notas_coach" on public.notas_coach
  for select using (true);

-- 4. REGISTROS_IA
create table if not exists public.registros_ia (
  id uuid default uuid_generate_v4() primary key,
  coach_id uuid references public.profiles(id) on delete cascade not null,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  tipo text not null check (tipo in ('dieta', 'informe_semanal', 'ajuste_macros', 'recomendacion')),
  prompt text not null,
  respuesta_json jsonb not null,
  modelo text default 'deepseek-v3',
  tokens_usados integer,
  plan_id uuid references public.planes_nutricion(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.registros_ia enable row level security;

drop policy if exists "Coach can manage registros_ia" on public.registros_ia;
create policy "Coach can manage registros_ia" on public.registros_ia
  for all using (coach_id = auth.uid());

-- 5. PROTOCOLOS_COMPETICION
create table if not exists public.protocolos_competicion (
  id uuid default uuid_generate_v4() primary key,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  coach_id uuid references public.profiles(id) on delete cascade not null,
  nombre text not null,
  deporte text,
  fecha_competicion date,
  peso_inicial numeric(5,2),
  peso_objetivo numeric(5,2),
  carga_dias_previos integer default 3,
  carga_carbs_kg numeric(5,2) default 8,
  carga_proteinas_kg numeric(5,2) default 1.6,
  carga_grasas_kg numeric(5,2) default 0.6,
  carga_inicio date,
  geles_marca text,
  geles_carbs_por_gel numeric(5,2) default 25,
  geles_cada_minutos integer default 30,
  electrolitos_marca text,
  electrolitos_cada_minutos integer default 60,
  cafeina_mg integer,
  hidratacion_ml_cada_15min integer default 150,
  notas_previa text,
  notas_durante text,
  notas_post text,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.protocolos_competicion enable row level security;

drop policy if exists "Coach can manage protocolos_competicion" on public.protocolos_competicion;
create policy "Coach can manage protocolos_competicion" on public.protocolos_competicion
  for all using (coach_id = auth.uid());

drop policy if exists "Cliente can view own protocolos" on public.protocolos_competicion;
create policy "Cliente can view own protocolos" on public.protocolos_competicion
  for select using (
    exists (select 1 from public.clientes where id = cliente_id and profile_id = auth.uid())
  );

-- 6. PLANTILLAS_ENTRENAMIENTO
create table if not exists public.plantillas_entrenamiento (
  id uuid default uuid_generate_v4() primary key,
  coach_id uuid references public.profiles(id) on delete cascade not null,
  nombre text not null,
  descripcion text,
  tipo text check (tipo in ('gimnasio', 'cardio', 'mixto')),
  duracion_semanas integer default 4,
  nivel text check (nivel in ('principiante', 'intermedio', 'avanzado')),
  objetivo text check (objetivo in ('hipertrofia', 'fuerza', 'perdida_grasa', 'cardio', 'tonificacion', 'rendimiento')),
  dias_por_semana integer,
  activo boolean default true,
  progresion jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.plantillas_entrenamiento enable row level security;

drop policy if exists "Coach can manage plantillas_entrenamiento" on public.plantillas_entrenamiento;
create policy "Coach can manage plantillas_entrenamiento" on public.plantillas_entrenamiento
  for all using (coach_id = auth.uid());

-- 7. PLANTILLA_SESIONES
create table if not exists public.plantilla_sesiones (
  id uuid default uuid_generate_v4() primary key,
  plantilla_id uuid references public.plantillas_entrenamiento(id) on delete cascade not null,
  nombre text not null,
  dia_semana text,
  orden integer default 0,
  notas text,
  created_at timestamptz default now()
);

alter table public.plantilla_sesiones enable row level security;

drop policy if exists "Coach can manage plantilla_sesiones" on public.plantilla_sesiones;
create policy "Coach can manage plantilla_sesiones" on public.plantilla_sesiones
  for all using (
    exists (select 1 from public.plantillas_entrenamiento where id = plantilla_id and coach_id = auth.uid())
  );

-- 8. PLANTILLA_SESION_EJERCICIOS
create table if not exists public.plantilla_sesion_ejercicios (
  id uuid default uuid_generate_v4() primary key,
  sesion_id uuid references public.plantilla_sesiones(id) on delete cascade not null,
  ejercicio_id uuid references public.ejercicios(id) on delete restrict,
  series integer,
  repeticiones text,
  descanso_segundos integer,
  peso_sugerido text,
  rpe text,
  notas text,
  orden integer default 0,
  created_at timestamptz default now()
);

alter table public.plantilla_sesion_ejercicios enable row level security;

drop policy if exists "Coach can manage plantilla_sesion_ejercicios" on public.plantilla_sesion_ejercicios;
create policy "Coach can manage plantilla_sesion_ejercicios" on public.plantilla_sesion_ejercicios
  for all using (
    exists (
      select 1 from public.plantilla_sesiones ps
      join public.plantillas_entrenamiento pe on pe.id = ps.plantilla_id
      where ps.id = sesion_id and pe.coach_id = auth.uid()
    )
  );

-- ============================================================
-- ALTER TABLAS EXISTENTES
-- ============================================================
alter table public.planes_nutricion
  add column if not exists codigo_publico text unique;

alter table public.planes_nutricion
  add column if not exists generado_por_ia boolean default false;

alter table public.clientes
  add column if not exists fecha_proxima_revision date;

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_clientes_coach on public.clientes(coach_id);
create index if not exists idx_planes_nutricion_cliente on public.planes_nutricion(cliente_id);
create index if not exists idx_planes_entrenamiento_cliente on public.planes_entrenamiento(cliente_id);
create index if not exists idx_alimentos_nombre on public.alimentos(nombre);
create index if not exists idx_comidas_plan on public.comidas(plan_id);
create index if not exists idx_sesiones_plan on public.sesiones_entrenamiento(plan_id);
create index if not exists idx_cuestionarios_codigo on public.cuestionarios(codigo_publico);
create index if not exists idx_respuestas_cuestionario on public.respuestas_clientes(cuestionario_id);
create index if not exists idx_respuestas_estado on public.respuestas_clientes(estado);
create index if not exists idx_checkins_cliente on public.checkins(cliente_id);
create index if not exists idx_notas_coach_cliente on public.notas_coach(cliente_id);
create index if not exists idx_registros_ia_cliente on public.registros_ia(cliente_id);
create index if not exists idx_registros_ia_coach on public.registros_ia(coach_id);
create index if not exists idx_registros_ia_tipo on public.registros_ia(tipo);
create index if not exists idx_protocolos_cliente on public.protocolos_competicion(cliente_id);
create index if not exists idx_protocolos_coach on public.protocolos_competicion(coach_id);
create index if not exists idx_plantilla_sesiones_plantilla on public.plantilla_sesiones(plantilla_id);
create index if not exists idx_plantilla_sesion_ejercicios_sesion on public.plantilla_sesion_ejercicios(sesion_id);
