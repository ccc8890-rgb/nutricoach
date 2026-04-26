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
-- INDEXES para performance
-- ============================================================
create index idx_clientes_coach on public.clientes(coach_id);
create index idx_planes_nutricion_cliente on public.planes_nutricion(cliente_id);
create index idx_planes_entrenamiento_cliente on public.planes_entrenamiento(cliente_id);
create index idx_alimentos_nombre on public.alimentos(nombre);
create index idx_comidas_plan on public.comidas(plan_id);
create index idx_sesiones_plan on public.sesiones_entrenamiento(plan_id);
