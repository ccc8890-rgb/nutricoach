-- ============================================================
-- NUTRICOACH - Migración: Enriquecimiento Nutricional por IA
-- ============================================================
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- 1. TABLA: alimento_categorias_ia
-- Categorías nutricionales detalladas para clasificación IA
create table if not exists public.alimento_categorias_ia (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null unique,
  descripcion text,
  grupo_alimenticio text not null,  -- proteinas, carbohidratos, grasas, lacteos, frutas, verduras, etc.
  prioridad int default 0,          -- para ordenar en UI
  created_at timestamptz default now()
);

alter table public.alimento_categorias_ia enable row level security;

create policy "Cualquier autenticado puede leer categorias_ia" on public.alimento_categorias_ia
  for select using (auth.role() = 'authenticated');

create policy "Solo coach puede gestionar categorias_ia" on public.alimento_categorias_ia
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

-- Seed: categorías nutricionales
insert into public.alimento_categorias_ia (nombre, descripcion, grupo_alimenticio, prioridad) values
  ('Carnes rojas', 'Carne de vacuno, cordero, cerdo', 'proteinas', 1),
  ('Carnes blancas', 'Pollo, pavo, conejo', 'proteinas', 2),
  ('Pescado azul', 'Salmón, atún, caballa, sardinas', 'proteinas', 3),
  ('Pescado blanco', 'Merluza, bacalao, lubina, dorada', 'proteinas', 4),
  ('Mariscos', 'Gambas, langostinos, mejillones, almejas', 'proteinas', 5),
  ('Huevos', 'Huevos y derivados', 'proteinas', 6),
  ('Legumbres', 'Garbanzos, lentejas, alubias, soja', 'proteinas', 7),
  ('Frutos secos y semillas', 'Almendras, nueces, pipas, chía', 'grasas', 8),
  ('Lácteos enteros', 'Leche entera, yogur griego, queso curado', 'lacteos', 9),
  ('Lácteos semidesnatados', 'Leche semidesnatada, yogur natural', 'lacteos', 10),
  ('Lácteos desnatados', 'Leche desnatada, queso fresco 0%', 'lacteos', 11),
  ('Arroces y pastas', 'Arroz, pasta, cuscús, quínoa', 'carbohidratos', 12),
  ('Pan y cereales', 'Pan, cereales de desayuno, avena', 'carbohidratos', 13),
  ('Patatas y tubérculos', 'Patata, boniato, yuca', 'carbohidratos', 14),
  ('Verduras de hoja verde', 'Espinacas, lechuga, rúcula', 'verduras', 15),
  ('Verduras y hortalizas', 'Tomate, pimiento, calabacín, brócoli', 'verduras', 16),
  ('Frutas frescas', 'Manzana, plátano, naranja, fresas', 'frutas', 17),
  ('Frutas deshidratadas', 'Dátiles, pasas, orejones', 'frutas', 18),
  ('Aceites y grasas', 'Aceite de oliva, mantequilla, aguacate', 'grasas', 19),
  ('Salsas y condimentos', 'Salsa de tomate, mostaza, vinagre', 'otros', 20),
  ('Bebidas', 'Agua, café, té, infusiones', 'otros', 21),
  ('Dulces y bollería', 'Galletas, bollería, chocolate', 'otros', 22),
  ('Platos preparados', 'Comida preparada, congelados', 'otros', 23),
  ('Suplementos deportivos', 'Proteína en polvo, barritas, BCAA', 'suplementos', 24),
  ('Supermercado - Sin clasificar', 'Producto de supermercado pendiente de categorizar', 'otros', 99)
on conflict (nombre) do nothing;

-- 2. TABLA: alimentos_enriquecimiento_cola
-- Cola de productos pendientes de enriquecer por IA
create table if not exists public.alimentos_enriquecimiento_cola (
  id uuid default uuid_generate_v4() primary key,
  alimento_id uuid references public.alimentos(id) on delete cascade not null,
  nombre_original text not null,
  nombre_normalizado text,
  estado text default 'pendiente' check (estado in ('pendiente', 'procesando', 'completado', 'error')),
  intentos int default 0,
  error_ia text,
  resultado_json jsonb,              -- respuesta completa de la IA
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(alimento_id)
);

alter table public.alimentos_enriquecimiento_cola enable row level security;

create policy "Cualquier autenticado puede leer cola_enriquecimiento" on public.alimentos_enriquecimiento_cola
  for select using (auth.role() = 'authenticated');

create policy "Solo coach puede gestionar cola_enriquecimiento" on public.alimentos_enriquecimiento_cola
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

create index if not exists idx_cola_enriquecimiento_estado
  on public.alimentos_enriquecimiento_cola(estado);

-- 3. FUNCIÓN: añadir_a_cola_enriquecimiento
-- Añade productos pendientes de enriquecer a la cola
create or replace function public.añadir_a_cola_enriquecimiento(
  p_alimento_id uuid default null  -- null = todos los alimentos sin macros
) returns int as $$
declare
  v_count int;
begin
  if p_alimento_id is not null then
    insert into public.alimentos_enriquecimiento_cola
      (alimento_id, nombre_original, nombre_normalizado)
    select id, nombre, nombre
    from public.alimentos
    where id = p_alimento_id
      and (calorias = 0 or calorias is null)
      and not exists (select 1 from public.alimentos_enriquecimiento_cola where alimento_id = id)
    on conflict (alimento_id) do nothing;
    get diagnostics v_count = row_count;
  else
    insert into public.alimentos_enriquecimiento_cola
      (alimento_id, nombre_original, nombre_normalizado)
    select id, nombre, nombre
    from public.alimentos
    where (calorias = 0 or calorias is null)
      and not exists (select 1 from public.alimentos_enriquecimiento_cola where alimento_id = id)
    on conflict (alimento_id) do nothing;
    get diagnostics v_count = row_count;
  end if;

  return v_count;
end;
$$ language plpgsql security definer;

-- 4. FUNCIÓN: actualizar_alimento_con_ia
-- Actualiza un alimento con los datos devueltos por la IA
create or replace function public.actualizar_alimento_con_ia(
  p_alimento_id uuid,
  p_categoria_ia text,
  p_calorias numeric,
  p_proteinas numeric,
  p_carbohidratos numeric,
  p_grasas numeric,
  p_fibra numeric default null,
  p_unidad_medida text default '100g',
  p_resultado_json jsonb default null
) returns boolean as $$
begin
  -- Actualizar el alimento
  update public.alimentos set
    categoria = coalesce(p_categoria_ia, categoria),
    calorias = p_calorias,
    proteinas = p_proteinas,
    carbohidratos = p_carbohidratos,
    grasas = p_grasas,
    fibra = coalesce(p_fibra, fibra),
    updated_at = now()
  where id = p_alimento_id;

  -- Marcar la cola como completada
  update public.alimentos_enriquecimiento_cola set
    estado = 'completado',
    resultado_json = p_resultado_json,
    updated_at = now()
  where alimento_id = p_alimento_id;

  return true;
end;
$$ language plpgsql security definer;

-- 5. TABLA: escandallo_recetas
-- Costes calculados por receta según supermercado
create table if not exists public.escandallo_recetas (
  id uuid default uuid_generate_v4() primary key,
  receta_id uuid references public.recetas(id) on delete cascade,
  supermercado_id uuid references public.supermercados(id) on delete cascade,
  coste_total numeric(10,4) not null,
  coste_por_porcion numeric(10,4),
  desglose_json jsonb,               -- { ingrediente: nombre, cantidad: g, precio_kg: X, coste: Y }
  fecha_calculo date not null default current_date,
  created_at timestamptz default now(),
  unique(receta_id, supermercado_id, fecha_calculo)
);

alter table public.escandallo_recetas enable row level security;

create policy "Cualquier autenticado puede leer escandallo" on public.escandallo_recetas
  for select using (auth.role() = 'authenticated');

create policy "Solo coach puede gestionar escandallo" on public.escandallo_recetas
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

create index if not exists idx_escandallo_receta
  on public.escandallo_recetas(receta_id);

create index if not exists idx_escandallo_fecha
  on public.escandallo_recetas(fecha_calculo desc);

-- 6. VISTA: alimentos_pendientes_enriquecer
-- Alimentos sin macros o con macros = 0 que necesitan IA
create or replace view public.alimentos_pendientes_enriquecer as
select
  a.id,
  a.nombre,
  a.categoria,
  a.calorias,
  a.proteinas,
  a.carbohidratos,
  a.grasas,
  coalesce(e.estado, 'pendiente') as estado_enriquecimiento,
  e.error_ia,
  e.updated_at as ultimo_intento,
  (select count(*) from public.productos_supermercado ps where ps.alimento_id = a.id) as num_precios,
  (select string_agg(s.nombre, ', ') from public.productos_supermercado ps
   join public.supermercados s on s.id = ps.supermercado_id
   where ps.alimento_id = a.id) as supermercados
from public.alimentos a
left join public.alimentos_enriquecimiento_cola e on e.alimento_id = a.id
where a.calorias = 0 or a.calorias is null
   or a.proteinas = 0 or a.proteinas is null
   or a.carbohidratos = 0 or a.carbohidratos is null
   or a.grasas = 0 or a.grasas is null
order by a.nombre;

-- 7. VISTA: escandallo_cliente
-- Coste total semanal por cliente
create or replace view public.escandallo_cliente as
select
  c.id as cliente_id,
  p.nombre || coalesce(' ' || p.apellidos, '') as cliente_nombre,
  pn.id as plan_id,
  pn.nombre as plan_nombre,
  er.supermercado_id,
  s.nombre as supermercado_nombre,
  er.coste_total as coste_semanal,
  er.coste_por_porcion,
  (er.coste_total * 4.33) as coste_mensual_estimado,
  (er.coste_total * 52) as coste_anual_estimado,
  er.fecha_calculo
from public.clientes c
join public.profiles p on p.id = c.profile_id
join public.planes_nutricion pn on pn.cliente_id = c.id
join public.escandallo_recetas er on er.receta_id in (
  select ri.receta_id from public.receta_ingredientes ri
  join public.comida_alimentos ca on ca.alimento_id = ri.alimento_id
  join public.comidas cm on cm.id = ca.comida_id
  where cm.plan_id = pn.id
)
join public.supermercados s on s.id = er.supermercado_id
where pn.activo = true;
