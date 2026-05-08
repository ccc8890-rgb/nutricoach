-- ============================================================
-- NUTRICOACH - Esquema de base de datos Supabase
-- Ejecutar en: Supabase > SQL Editor > New Query
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLA: profiles (extiende auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null check (role in ('coach', 'cliente')),
  nombre text not null,
  apellidos text,
  email text,
  telefono text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Coach can view all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Trigger para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, nombre, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'cliente'),
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TABLA: clientes (datos adicionales del cliente)
-- ============================================================
create table public.clientes (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade,
  coach_id uuid references public.profiles(id) on delete set null,
  objetivo text check (objetivo in ('perder_grasa', 'ganar_musculo', 'recomposicion', 'mantenimiento', 'rendimiento')),
  nivel text check (nivel in ('principiante', 'intermedio', 'avanzado')),
  peso_inicial numeric(5,2),
  altura numeric(5,2),
  edad integer,
  sexo text check (sexo in ('hombre', 'mujer', 'otro')),
  restricciones_alimentarias text,
  notas text,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.clientes enable row level security;

create policy "Coach can manage clients" on public.clientes
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

create policy "Cliente can view own data" on public.clientes
  for select using (profile_id = auth.uid());

-- ============================================================
-- TABLA: alimentos (base de datos nutricional)
-- ============================================================
create table public.alimentos (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  categoria text,
  calorias numeric(7,2) not null,   -- kcal por 100g
  proteinas numeric(6,2) not null,  -- g por 100g
  carbohidratos numeric(6,2) not null, -- g por 100g
  grasas numeric(6,2) not null,     -- g por 100g
  fibra numeric(6,2) default 0,     -- g por 100g
  azucares numeric(6,2) default 0,  -- g por 100g
  custom boolean default false,     -- si fue añadido por el coach
  coach_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.alimentos enable row level security;

create policy "Anyone authenticated can read alimentos" on public.alimentos
  for select using (auth.role() = 'authenticated');

create policy "Coach can create custom alimentos" on public.alimentos
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
    and custom = true
  );

create policy "Coach can update own custom alimentos" on public.alimentos
  for update using (coach_id = auth.uid() and custom = true);

-- ============================================================
-- TABLA: planes_nutricion
-- ============================================================
create table public.planes_nutricion (
  id uuid default uuid_generate_v4() primary key,
  coach_id uuid references public.profiles(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  nombre text not null,
  descripcion text,
  kcal_objetivo numeric(7,2),
  proteinas_objetivo numeric(6,2),
  carbohidratos_objetivo numeric(6,2),
  grasas_objetivo numeric(6,2),
  activo boolean default true,
  generado_por_ia boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.planes_nutricion enable row level security;

create policy "Coach can manage diet plans" on public.planes_nutricion
  for all using (coach_id = auth.uid());

create policy "Cliente can view own diet plans" on public.planes_nutricion
  for select using (
    exists (select 1 from public.clientes where id = cliente_id and profile_id = auth.uid())
  );

-- ============================================================
-- TABLA: comidas (meals dentro de un plan)
-- ============================================================
create table public.comidas (
  id uuid default uuid_generate_v4() primary key,
  plan_id uuid references public.planes_nutricion(id) on delete cascade,
  nombre text not null,  -- Desayuno, Almuerzo, Comida, Merienda, Cena, Snack
  orden integer default 0,
  hora_sugerida time,
  created_at timestamptz default now()
);

alter table public.comidas enable row level security;

create policy "Coach can manage comidas" on public.comidas
  for all using (
    exists (select 1 from public.planes_nutricion where id = plan_id and coach_id = auth.uid())
  );

create policy "Cliente can view own comidas" on public.comidas
  for select using (
    exists (
      select 1 from public.planes_nutricion pn
      join public.clientes c on c.id = pn.cliente_id
      where pn.id = plan_id and c.profile_id = auth.uid()
    )
  );

-- ============================================================
-- TABLA: comida_alimentos (alimentos dentro de una comida)
-- ============================================================
create table public.comida_alimentos (
  id uuid default uuid_generate_v4() primary key,
  comida_id uuid references public.comidas(id) on delete cascade,
  alimento_id uuid references public.alimentos(id) on delete restrict,
  cantidad_gramos numeric(7,2) not null,
  created_at timestamptz default now()
);

alter table public.comida_alimentos enable row level security;

create policy "Coach can manage comida_alimentos" on public.comida_alimentos
  for all using (
    exists (
      select 1 from public.comidas com
      join public.planes_nutricion pn on pn.id = com.plan_id
      where com.id = comida_id and pn.coach_id = auth.uid()
    )
  );

create policy "Cliente can view own comida_alimentos" on public.comida_alimentos
  for select using (
    exists (
      select 1 from public.comidas com
      join public.planes_nutricion pn on pn.id = com.plan_id
      join public.clientes c on c.id = pn.cliente_id
      where com.id = comida_id and c.profile_id = auth.uid()
    )
  );

-- ============================================================
-- TABLA: ejercicios (base de datos de ejercicios)
-- ============================================================
create table public.ejercicios (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  grupo_muscular text,
  tipo text check (tipo in ('fuerza', 'cardio', 'flexibilidad', 'funcional')),
  descripcion text,
  video_url text,
  custom boolean default false,
  coach_id uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.ejercicios enable row level security;

create policy "Anyone authenticated can read ejercicios" on public.ejercicios
  for select using (auth.role() = 'authenticated');

create policy "Coach can create custom ejercicios" on public.ejercicios
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
    and custom = true
  );

-- ============================================================
-- TABLA: planes_entrenamiento
-- ============================================================
create table public.planes_entrenamiento (
  id uuid default uuid_generate_v4() primary key,
  coach_id uuid references public.profiles(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  nombre text not null,
  descripcion text,
  duracion_semanas integer,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.planes_entrenamiento enable row level security;

create policy "Coach can manage training plans" on public.planes_entrenamiento
  for all using (coach_id = auth.uid());

create policy "Cliente can view own training plans" on public.planes_entrenamiento
  for select using (
    exists (select 1 from public.clientes where id = cliente_id and profile_id = auth.uid())
  );

-- ============================================================
-- TABLA: sesiones_entrenamiento (días dentro del plan)
-- ============================================================
create table public.sesiones_entrenamiento (
  id uuid default uuid_generate_v4() primary key,
  plan_id uuid references public.planes_entrenamiento(id) on delete cascade,
  nombre text not null,  -- "Día 1 - Pecho y Tríceps"
  dia_semana text,       -- Lunes, Martes...
  orden integer default 0,
  notas text,
  created_at timestamptz default now()
);

alter table public.sesiones_entrenamiento enable row level security;

create policy "Coach can manage sesiones" on public.sesiones_entrenamiento
  for all using (
    exists (select 1 from public.planes_entrenamiento where id = plan_id and coach_id = auth.uid())
  );

create policy "Cliente can view own sesiones" on public.sesiones_entrenamiento
  for select using (
    exists (
      select 1 from public.planes_entrenamiento pe
      join public.clientes c on c.id = pe.cliente_id
      where pe.id = plan_id and c.profile_id = auth.uid()
    )
  );

-- ============================================================
-- TABLA: sesion_ejercicios
-- ============================================================
create table public.sesion_ejercicios (
  id uuid default uuid_generate_v4() primary key,
  sesion_id uuid references public.sesiones_entrenamiento(id) on delete cascade,
  ejercicio_id uuid references public.ejercicios(id) on delete restrict,
  series integer,
  repeticiones text,   -- "8-12" o "15" o "Al fallo"
  descanso_segundos integer,
  peso_sugerido text,
  notas text,
  orden integer default 0,
  created_at timestamptz default now()
);

alter table public.sesion_ejercicios enable row level security;

create policy "Coach can manage sesion_ejercicios" on public.sesion_ejercicios
  for all using (
    exists (
      select 1 from public.sesiones_entrenamiento se
      join public.planes_entrenamiento pe on pe.id = se.plan_id
      where se.id = sesion_id and pe.coach_id = auth.uid()
    )
  );

create policy "Cliente can view own sesion_ejercicios" on public.sesion_ejercicios
  for select using (
    exists (
      select 1 from public.sesiones_entrenamiento se
      join public.planes_entrenamiento pe on pe.id = se.plan_id
      join public.clientes c on c.id = pe.cliente_id
      where se.id = sesion_id and c.profile_id = auth.uid()
    )
  );

-- ============================================================
-- TABLA: seguimiento_peso (progreso del cliente)
-- ============================================================
create table public.seguimiento_peso (
  id uuid default uuid_generate_v4() primary key,
  cliente_id uuid references public.clientes(id) on delete cascade,
  fecha date not null default current_date,
  peso numeric(5,2),
  notas text,
  created_at timestamptz default now()
);

alter table public.seguimiento_peso enable row level security;

create policy "Coach can manage seguimiento" on public.seguimiento_peso
  for all using (
    exists (
      select 1 from public.clientes c
      join public.profiles p on p.id = auth.uid()
      where c.id = cliente_id and (c.profile_id = auth.uid() or p.role = 'coach')
    )
  );

-- ============================================================
-- TABLA: recetas (base de datos de recetas del coach)
-- ============================================================
create table public.recetas (
  id uuid default uuid_generate_v4() primary key,
  coach_id uuid references public.profiles(id) on delete cascade,
  nombre text not null,
  categoria text check (categoria in ('Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena', 'Snack', 'Postre', 'Batch')),
  tipo_plato text,
  kcal_por_porcion numeric(7,2),
  proteinas_por_porcion numeric(6,2),
  carbohidratos_por_porcion numeric(6,2),
  grasas_por_porcion numeric(6,2),
  ingredientes text,
  intolerancias text,
  pasos text,
  url text,
  activa boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.recetas enable row level security;

create policy "Coach can manage own recetas" on public.recetas
  for all using (coach_id = auth.uid());

create policy "Anyone can read recetas" on public.recetas
  for select using (true);

-- ============================================================
-- TABLA: plantillas_dietas (plantillas de dieta predefinidas)
-- ============================================================
create table public.plantillas_dietas (
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

create policy "Coach can manage plantillas_dietas" on public.plantillas_dietas
  for all using (coach_id = auth.uid());

-- ============================================================
-- TABLA: cuestionarios (diseñados por el coach)
-- ============================================================
create table public.cuestionarios (
  id uuid default uuid_generate_v4() primary key,
  coach_id uuid references public.profiles(id) on delete cascade not null,
  titulo text not null,
  descripcion text,
  preguntas jsonb not null default '[]'::jsonb,
  activo boolean default true,
  codigo_publico text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.cuestionarios enable row level security;

create policy "Coach can manage cuestionarios" on public.cuestionarios
  for all using (coach_id = auth.uid());

create policy "Anyone can read active cuestionarios by codigo" on public.cuestionarios
  for select using (activo = true);

-- ============================================================
-- TABLA: respuestas_clientes (respuestas de clientes a cuestionarios)
-- ============================================================
create table public.respuestas_clientes (
  id uuid default uuid_generate_v4() primary key,
  cuestionario_id uuid references public.cuestionarios(id) on delete cascade not null,
  coach_id uuid references public.profiles(id) on delete cascade not null,
  respuestas jsonb not null default '{}'::jsonb,
  estado text not null default 'nueva' check (estado in ('nueva', 'procesando', 'dieta_lista', 'dieta_aprobada', 'dieta_rechazada')),
  nombre_cliente text,
  email_cliente text,
  plan_id uuid references public.planes_nutricion(id) on delete set null,
  codigo_publico text,
  leida boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.respuestas_clientes enable row level security;

create policy "Coach can manage respuestas_clientes" on public.respuestas_clientes
  for all using (coach_id = auth.uid());

create policy "Anyone can insert respuestas_clientes" on public.respuestas_clientes
  for insert with check (true);

-- ============================================================
-- MODIFICACIÓN: añadir codigo_publico a planes_nutricion
-- ============================================================
alter table public.planes_nutricion
  add column if not exists codigo_publico text unique;

-- ============================================================
-- MODIFICACIÓN: añadir generado_por_ia a planes_nutricion
-- ============================================================
alter table public.planes_nutricion
  add column if not exists generado_por_ia boolean default false;

-- ============================================================
-- MODIFICACIÓN: añadir fecha_proxima_revision a clientes
-- ============================================================
alter table public.clientes
  add column if not exists fecha_proxima_revision date;

-- ============================================================
-- TABLA: plantillas_entrenamiento (plantillas predefinidas)
-- ============================================================
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

create policy "Coach can manage plantillas_entrenamiento" on public.plantillas_entrenamiento
  for all using (coach_id = auth.uid());

-- ============================================================
-- TABLA: plantilla_sesiones (sesiones dentro de plantilla)
-- ============================================================
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

create policy "Coach can manage plantilla_sesiones" on public.plantilla_sesiones
  for all using (
    exists (select 1 from public.plantillas_entrenamiento where id = plantilla_id and coach_id = auth.uid())
  );

-- ============================================================
-- TABLA: plantilla_sesion_ejercicios
-- ============================================================
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

create policy "Coach can manage plantilla_sesion_ejercicios" on public.plantilla_sesion_ejercicios
  for all using (
    exists (
      select 1 from public.plantilla_sesiones ps
      join public.plantillas_entrenamiento pe on pe.id = ps.plantilla_id
      where ps.id = sesion_id and pe.coach_id = auth.uid()
    )
  );

-- ============================================================
-- INDEXES para performance
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
create index if not exists idx_plantilla_sesiones_plantilla on public.plantilla_sesiones(plantilla_id);
create index if not exists idx_plantilla_sesion_ejercicios_sesion on public.plantilla_sesion_ejercicios(sesion_id);

-- ============================================================
-- TABLA: checkins (check-ins semanales del cliente)
-- ============================================================
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

create policy "Coach can manage checkins" on public.checkins
  for all using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.coach_id = auth.uid()
    )
  );

create policy "Cliente can manage own checkins" on public.checkins
  for all using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.profile_id = auth.uid()
    )
  );

create policy "Anyone with codigo can insert checkins" on public.checkins
  for insert with check (true);

create index if not exists idx_checkins_cliente on public.checkins(cliente_id);

-- ============================================================
-- TABLA: notas_coach (notas del coach visibles para el cliente)
-- ============================================================
create table if not exists public.notas_coach (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  coach_id uuid references public.profiles(id),
  mensaje text not null,
  created_at timestamptz default now()
);

alter table public.notas_coach enable row level security;

create policy "Coach can manage notas_coach" on public.notas_coach
  for all using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.coach_id = auth.uid()
    )
  );

create policy "Cliente can view own notas_coach" on public.notas_coach
  for select using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.profile_id = auth.uid()
    )
  );

create policy "Anyone with codigo can view notas_coach" on public.notas_coach
  for select using (true);

create index if not exists idx_notas_coach_cliente on public.notas_coach(cliente_id);

-- ============================================================
-- TABLA: registros_ia (historial de conversaciones con DeepSeek)
-- ============================================================
create table public.registros_ia (
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

create policy "Coach can manage registros_ia" on public.registros_ia
  for all using (coach_id = auth.uid());

create index if not exists idx_registros_ia_cliente on public.registros_ia(cliente_id);
create index if not exists idx_registros_ia_coach on public.registros_ia(coach_id);
create index if not exists idx_registros_ia_tipo on public.registros_ia(tipo);

-- ============================================================
-- TABLA: protocolos_competicion (carga + suplementación)
-- ============================================================
create table public.protocolos_competicion (
  id uuid default uuid_generate_v4() primary key,
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  coach_id uuid references public.profiles(id) on delete cascade not null,
  nombre text not null,
  deporte text,
  fecha_competicion date,
  peso_inicial numeric(5,2),
  peso_objetivo numeric(5,2),
  -- Fase de carga: 3 fases clásicas
  carga_dias_previos integer default 3,
  carga_carbs_kg numeric(5,2) default 8,      -- g/kg/día en carga
  carga_proteinas_kg numeric(5,2) default 1.6,
  carga_grasas_kg numeric(5,2) default 0.6,
  carga_inicio date,                            -- cuándo empieza la carga
  -- Suplementación durante carrera
  geles_marca text,
  geles_carbs_por_gel numeric(5,2) default 25, -- g carbohidratos por gel
  geles_cada_minutos integer default 30,        -- cada cuántos minutos tomar gel
  electrolitos_marca text,
  electrolitos_cada_minutos integer default 60,
  cafeina_mg integer,                           -- mg cafeína opcional
  hidratacion_ml_cada_15min integer default 150,
  -- Notas
  notas_previa text,
  notas_durante text,
  notas_post text,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.protocolos_competicion enable row level security;

create policy "Coach can manage protocolos_competicion" on public.protocolos_competicion
  for all using (coach_id = auth.uid());

create policy "Cliente can view own protocolos" on public.protocolos_competicion
  for select using (
    exists (select 1 from public.clientes where id = cliente_id and profile_id = auth.uid())
  );

create index if not exists idx_protocolos_cliente on public.protocolos_competicion(cliente_id);
create index if not exists idx_protocolos_coach on public.protocolos_competicion(coach_id);
