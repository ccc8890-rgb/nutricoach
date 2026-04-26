-- ============================================================
-- SCHEMA: Recetas
-- Ejecutar en Supabase SQL Editor (modo Run)
-- ============================================================

-- TABLA: recetas
create table if not exists public.recetas (
  id uuid default uuid_generate_v4() primary key,
  coach_id uuid references public.profiles(id) on delete cascade,

  -- Datos básicos
  nombre text not null,
  descripcion text,
  instrucciones text,
  consejos text,

  -- Clasificación
  categoria text,          -- Desayuno | Comida | Cena | Merienda | Snack | Postre
  tipo_coccion text,       -- Horno | Sartén | Microondas | No Bake | Freidora de Aire | Vapor | Olla
  dificultad text,         -- Fácil | Medio | Difícil
  intolerancias text[],    -- Sin Gluten | Sin Lactosa | Vegano | Vegetariano | ...

  -- Tiempos y porciones
  porciones int default 1,
  tiempo_prep_min int,
  tiempo_coccion_min int,

  -- Macros por porción (calculados automáticamente de ingredientes)
  kcal numeric(7,2),
  proteinas numeric(6,2),
  carbohidratos numeric(6,2),
  grasas numeric(6,2),
  fibra numeric(6,2),

  -- Imagen
  imagen_url text,

  -- Trazabilidad / importación futura
  fuente text default 'manual',   -- manual | url | notion | import
  url_origen text,
  notion_id text,                 -- ID de página Notion si viene de allí

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TABLA: receta_ingredientes
create table if not exists public.receta_ingredientes (
  id uuid default uuid_generate_v4() primary key,
  receta_id uuid references public.recetas(id) on delete cascade,
  alimento_id uuid references public.alimentos(id),
  nombre_libre text,       -- fallback si el alimento no está en la BD
  cantidad_gramos numeric(7,2) not null,
  orden int default 0,
  created_at timestamptz default now()
);

-- ÍNDICES
create index if not exists recetas_coach_id_idx on public.recetas(coach_id);
create index if not exists receta_ingredientes_receta_id_idx on public.receta_ingredientes(receta_id);

-- RLS
alter table public.recetas enable row level security;
alter table public.receta_ingredientes enable row level security;

-- Coach puede ver y gestionar sus recetas
create policy "Coach puede gestionar recetas" on public.recetas
  for all using (coach_id = auth.uid());

-- Coach puede ver y gestionar ingredientes de sus recetas
create policy "Coach puede gestionar ingredientes de receta" on public.receta_ingredientes
  for all using (
    exists (select 1 from public.recetas where id = receta_id and coach_id = auth.uid())
  );

-- Cliente puede ver recetas de su coach
create policy "Cliente puede ver recetas de su coach" on public.recetas
  for select using (
    exists (
      select 1 from public.clientes c
      where c.profile_id = auth.uid() and c.coach_id = coach_id
    )
  );

create policy "Cliente puede ver ingredientes de recetas de su coach" on public.receta_ingredientes
  for select using (
    exists (
      select 1 from public.recetas r
      join public.clientes c on c.coach_id = r.coach_id
      where r.id = receta_id and c.profile_id = auth.uid()
    )
  );

-- ============================================================
-- STORAGE: bucket para imágenes de recetas
-- ============================================================
insert into storage.buckets (id, name, public)
values ('recetas', 'recetas', true)
on conflict (id) do nothing;

create policy "Coach puede subir imágenes de recetas" on storage.objects
  for insert with check (bucket_id = 'recetas' and auth.role() = 'authenticated');

create policy "Imágenes de recetas son públicas" on storage.objects
  for select using (bucket_id = 'recetas');

create policy "Coach puede borrar sus imágenes" on storage.objects
  for delete using (bucket_id = 'recetas' and auth.uid()::text = (storage.foldername(name))[1]);
