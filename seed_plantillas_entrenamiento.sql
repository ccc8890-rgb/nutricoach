-- ============================================================
-- SEED: Tablas de Plantillas de Entrenamiento
-- Ejecutar en: Supabase > SQL Editor > New Query
-- ============================================================
-- INSTRUCCIONES:
-- 1. Abre Supabase > SQL Editor
-- 2. Obtén tu coach_id: SELECT id FROM profiles WHERE role = 'coach';
-- 3. Reemplaza 'REEMPLAZAR_CON_TU_COACH_ID' con el UUID
-- 4. Ejecuta TODO el script (tablas + datos)
-- ============================================================

-- ============================================================
-- TABLA: plantillas_entrenamiento (cabecera de plantilla)
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
-- TABLA: plantilla_sesiones (sesiones/días dentro de la plantilla)
-- ============================================================
create table if not exists public.plantilla_sesiones (
  id uuid default uuid_generate_v4() primary key,
  plantilla_id uuid references public.plantillas_entrenamiento(id) on delete cascade not null,
  nombre text not null,  -- "Día 1 - Pecho y Tríceps"
  dia_semana text,       -- Lunes, Martes...
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
-- TABLA: plantilla_sesion_ejercicios (ejercicios dentro de una sesión)
-- ============================================================
create table if not exists public.plantilla_sesion_ejercicios (
  id uuid default uuid_generate_v4() primary key,
  sesion_id uuid references public.plantilla_sesiones(id) on delete cascade not null,
  ejercicio_id uuid references public.ejercicios(id) on delete restrict,
  series integer,
  repeticiones text,     -- "8-12" o "15" o "Al fallo"
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
-- INDEXES
-- ============================================================
create index if not exists idx_plantilla_sesiones_plantilla on public.plantilla_sesiones(plantilla_id);
create index if not exists idx_plantilla_sesion_ejercicios_sesion on public.plantilla_sesion_ejercicios(sesion_id);

-- ============================================================
-- ══════════════════════════════════════════════════════════
-- SEED DATA — 7 PLANTILLAS DE ENTRENAMIENTO
-- ══════════════════════════════════════════════════════════
-- ============================================================
-- Las plantillas usan subconsultas para referenciar ejercicios
-- por nombre. Asegúrate de haber ejecutado seed_ejercicios.sql
-- ANTES que este script.
-- ============================================================

do $$
declare
  v_coach_id uuid := 'REEMPLAZAR_CON_TU_COACH_ID';

  -- IDs de plantillas
  v_fullbody_id uuid;
  v_ppl_id uuid;
  v_torso_pierna_id uuid;
  v_upper_lower_id uuid;
  v_weider_id uuid;
  v_hiit_id uuid;
  v_steady_id uuid;
begin

-- ============================================================
-- 1. FULL BODY 3 DÍAS (Principiante)
-- ============================================================
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Full Body 3 días', 'Rutina de cuerpo completo 3 días/semana ideal para principiantes. Trabaja todos los grupos musculares en cada sesión con ejercicios compuestos. Descanso 48h entre sesiones.', 'gimnasio', 8, 'principiante', 'tonificacion', 3)
returning id into v_fullbody_id;

-- Full Body A
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_fullbody_id, 'Full Body A', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 3, '10-12', 90, 0 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Press banca plano' union all
select s.id, e.id, 3, '10-12', 90, 2 from s, ejercicios e where e.nombre = 'Remo con barra' union all
select s.id, e.id, 3, '10-12', 60, 3 from s, ejercicios e where e.nombre = 'Elevaciones laterales' union all
select s.id, e.id, 3, '12-15', 60, 4 from s, ejercicios e where e.nombre = 'Curl con mancuernas' union all
select s.id, e.id, 3, '12-15', 60, 5 from s, ejercicios e where e.nombre = 'Extensión en polea alta' union all
select s.id, e.id, 3, '15', 45, 6 from s, ejercicios e where e.nombre = 'Plancha';

-- Full Body B
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_fullbody_id, 'Full Body B', 'Miércoles', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 3, '10-12', 90, 0 from s, ejercicios e where e.nombre = 'Peso muerto rumano' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Press inclinado con mancuernas' union all
select s.id, e.id, 3, '10-12', 90, 2 from s, ejercicios e where e.nombre = 'Jalón al pecho en polea' union all
select s.id, e.id, 3, '10-12', 60, 3 from s, ejercicios e where e.nombre = 'Press militar con barra' union all
select s.id, e.id, 3, '12-15', 60, 4 from s, ejercicios e where e.nombre = 'Curl martillo' union all
select s.id, e.id, 3, '12-15', 60, 5 from s, ejercicios e where e.nombre = 'Patada de tríceps' union all
select s.id, e.id, 3, '15', 45, 6 from s, ejercicios e where e.nombre = 'Crunch abdominal';

-- Full Body C
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_fullbody_id, 'Full Body C', 'Viernes', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 3, '8-12', 90, 0 from s, ejercicios e where e.nombre = 'Sentadilla búlgara' union all
select s.id, e.id, 3, '8-12', 90, 1 from s, ejercicios e where e.nombre = 'Press banca inclinado' union all
select s.id, e.id, 3, '8-12', 90, 2 from s, ejercicios e where e.nombre = 'Remo en polea baja' union all
select s.id, e.id, 3, '10-12', 60, 3 from s, ejercicios e where e.nombre = 'Pájaro o elevaciones posteriores' union all
select s.id, e.id, 3, '12-15', 60, 4 from s, ejercicios e where e.nombre = 'Curl concentrado' union all
select s.id, e.id, 3, '12-15', 60, 5 from s, ejercicios e where e.nombre = 'Press francés' union all
select s.id, e.id, 3, '12', 45, 6 from s, ejercicios e where e.nombre = 'Elevación de piernas tumbado';

-- ============================================================
-- 2. PUSH/PULL/LEGS 6 DÍAS (Intermedio/Avanzado)
-- ============================================================
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Push/Pull/Legs 6 días', 'Rutina PPL clásica 6 días/semana. Push: Pecho, Hombros, Tríceps. Pull: Espalda, Bíceps. Piernas: Cuádriceps, Isquios, Glúteos, Gemelos. Alta frecuencia para máximo estímulo de hipertrofia.', 'gimnasio', 12, 'avanzado', 'hipertrofia', 6)
returning id into v_ppl_id;

-- Push A
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_ppl_id, 'Push A', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '6-10', 120, 0 from s, ejercicios e where e.nombre = 'Press banca plano' union all
select s.id, e.id, 4, '8-12', 90, 1 from s, ejercicios e where e.nombre = 'Press inclinado con mancuernas' union all
select s.id, e.id, 3, '10-12', 60, 2 from s, ejercicios e where e.nombre = 'Aperturas con mancuernas' union all
select s.id, e.id, 4, '8-12', 90, 3 from s, ejercicios e where e.nombre = 'Press militar con barra' union all
select s.id, e.id, 3, '12-15', 45, 4 from s, ejercicios e where e.nombre = 'Elevaciones laterales' union all
select s.id, e.id, 3, '12-15', 45, 5 from s, ejercicios e where e.nombre = 'Extensión en polea alta' union all
select s.id, e.id, 3, '10-12', 45, 6 from s, ejercicios e where e.nombre = 'Fondos en banco';

-- Pull A
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_ppl_id, 'Pull A', 'Martes', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '6-10', 120, 0 from s, ejercicios e where e.nombre = 'Peso muerto' union all
select s.id, e.id, 4, '8-12', 90, 1 from s, ejercicios e where e.nombre = 'Dominadas' union all
select s.id, e.id, 3, '10-12', 90, 2 from s, ejercicios e where e.nombre = 'Remo con barra' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Face pull en polea' union all
select s.id, e.id, 3, '10-12', 60, 4 from s, ejercicios e where e.nombre = 'Curl con barra' union all
select s.id, e.id, 3, '12-15', 45, 5 from s, ejercicios e where e.nombre = 'Curl martillo';

-- Legs A
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_ppl_id, 'Legs A', 'Miércoles', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '6-10', 150, 0 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Prensa de piernas' union all
select s.id, e.id, 3, '10-12', 90, 2 from s, ejercicios e where e.nombre = 'Curl femoral tumbado' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Extensión de cuádriceps' union all
select s.id, e.id, 4, '10-15', 60, 4 from s, ejercicios e where e.nombre = 'Gemelos de pie' union all
select s.id, e.id, 3, '12', 60, 5 from s, ejercicios e where e.nombre = 'Hip thrust';

-- Push B
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_ppl_id, 'Push B', 'Jueves', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '8-12', 90, 0 from s, ejercicios e where e.nombre = 'Press banca declinado' union all
select s.id, e.id, 4, '8-12', 90, 1 from s, ejercicios e where e.nombre = 'Press con mancuernas' union all
select s.id, e.id, 3, '10-12', 60, 2 from s, ejercicios e where e.nombre = 'Crossover en polea' union all
select s.id, e.id, 4, '8-12', 90, 3 from s, ejercicios e where e.nombre = 'Press con mancuernas (hombros)' union all
select s.id, e.id, 3, '12-15', 45, 4 from s, ejercicios e where e.nombre = 'Elevaciones frontales' union all
select s.id, e.id, 3, '12-15', 45, 5 from s, ejercicios e where e.nombre = 'Extensión con mancuerna sobre la cabeza';

-- Pull B
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_ppl_id, 'Pull B', 'Viernes', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '8-12', 90, 0 from s, ejercicios e where e.nombre = 'Jalón al pecho en polea' union all
select s.id, e.id, 3, '8-12', 90, 1 from s, ejercicios e where e.nombre = 'Remo con mancuerna' union all
select s.id, e.id, 3, '10-12', 90, 2 from s, ejercicios e where e.nombre = 'Peso muerto rumano' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Pájaro o elevaciones posteriores' union all
select s.id, e.id, 3, '10-12', 60, 4 from s, ejercicios e where e.nombre = 'Curl en polea baja' union all
select s.id, e.id, 3, '12-15', 45, 5 from s, ejercicios e where e.nombre = 'Curl concentrado';

-- Legs B
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_ppl_id, 'Legs B', 'Sábado', 5) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '8-12', 120, 0 from s, ejercicios e where e.nombre = 'Sentadilla frontal' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Zancadas con mancuernas' union all
select s.id, e.id, 3, '10-12', 90, 2 from s, ejercicios e where e.nombre = 'Curl femoral sentado' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Peso muerto sumo' union all
select s.id, e.id, 4, '10-15', 60, 4 from s, ejercicios e where e.nombre = 'Gemelos sentado';

-- ============================================================
-- 3. TORSO/PIERNA 4 DÍAS (Intermedio)
-- ============================================================
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Torso/Pierna 4 días', 'Rutina torso-pierna 4 días/semana. Los días de torso trabajan pecho, espalda y hombros. Los días de pierna trabajan piernas completas. Ideal para intermedios que buscan volumen equilibrado.', 'gimnasio', 8, 'intermedio', 'hipertrofia', 4)
returning id into v_torso_pierna_id;

-- Torso A
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_torso_pierna_id, 'Torso A', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '6-10', 120, 0 from s, ejercicios e where e.nombre = 'Press banca plano' union all
select s.id, e.id, 3, '8-12', 90, 1 from s, ejercicios e where e.nombre = 'Press inclinado con mancuernas' union all
select s.id, e.id, 4, '8-12', 90, 2 from s, ejercicios e where e.nombre = 'Dominadas' union all
select s.id, e.id, 3, '10-12', 90, 3 from s, ejercicios e where e.nombre = 'Remo en polea baja' union all
select s.id, e.id, 3, '10-12', 60, 4 from s, ejercicios e where e.nombre = 'Press militar con barra' union all
select s.id, e.id, 3, '12-15', 45, 5 from s, ejercicios e where e.nombre = 'Elevaciones laterales';

-- Pierna A
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_torso_pierna_id, 'Pierna A', 'Martes', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '6-10', 150, 0 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Peso muerto rumano' union all
select s.id, e.id, 3, '12-15', 60, 2 from s, ejercicios e where e.nombre = 'Extensión de cuádriceps' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Curl femoral tumbado' union all
select s.id, e.id, 4, '10-15', 60, 4 from s, ejercicios e where e.nombre = 'Gemelos de pie';

-- Torso B
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_torso_pierna_id, 'Torso B', 'Jueves', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '8-12', 90, 0 from s, ejercicios e where e.nombre = 'Press banca inclinado' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Aperturas con mancuernas' union all
select s.id, e.id, 3, '8-12', 90, 2 from s, ejercicios e where e.nombre = 'Remo con barra' union all
select s.id, e.id, 3, '10-12', 90, 3 from s, ejercicios e where e.nombre = 'Jalón al pecho en polea' union all
select s.id, e.id, 3, '10-12', 60, 4 from s, ejercicios e where e.nombre = 'Press con mancuernas (hombros)' union all
select s.id, e.id, 3, '12-15', 45, 5 from s, ejercicios e where e.nombre = 'Face pull en polea';

-- Pierna B
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_torso_pierna_id, 'Pierna B', 'Viernes', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '8-12', 120, 0 from s, ejercicios e where e.nombre = 'Prensa de piernas' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Zancadas con barra' union all
select s.id, e.id, 3, '10-12', 90, 2 from s, ejercicios e where e.nombre = 'Curl femoral sentado' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Hip thrust' union all
select s.id, e.id, 4, '10-15', 60, 4 from s, ejercicios e where e.nombre = 'Gemelos sentado';

-- ============================================================
-- 4. UPPER/LOWER 4 DÍAS (Intermedio)
-- ============================================================
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Upper/Lower 4 días', 'División superior/inferior 4 días/semana. Upper: pecho, espalda, hombros, brazos. Lower: piernas completas. Excelente equilibrio entre frecuencia y recuperación.', 'gimnasio', 8, 'intermedio', 'hipertrofia', 4)
returning id into v_upper_lower_id;

-- Upper A
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_upper_lower_id, 'Upper A', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '6-10', 120, 0 from s, ejercicios e where e.nombre = 'Press banca plano' union all
select s.id, e.id, 4, '8-12', 90, 1 from s, ejercicios e where e.nombre = 'Dominadas' union all
select s.id, e.id, 3, '8-12', 90, 2 from s, ejercicios e where e.nombre = 'Press militar con barra' union all
select s.id, e.id, 3, '10-12', 60, 3 from s, ejercicios e where e.nombre = 'Remo con barra' union all
select s.id, e.id, 3, '10-12', 60, 4 from s, ejercicios e where e.nombre = 'Curl con barra' union all
select s.id, e.id, 3, '10-12', 60, 5 from s, ejercicios e where e.nombre = 'Extensión en polea alta';

-- Lower A
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_upper_lower_id, 'Lower A', 'Martes', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '6-10', 150, 0 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Peso muerto rumano' union all
select s.id, e.id, 3, '12-15', 60, 2 from s, ejercicios e where e.nombre = 'Extensión de cuádriceps' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Curl femoral tumbado' union all
select s.id, e.id, 4, '10-15', 60, 4 from s, ejercicios e where e.nombre = 'Gemelos de pie' union all
select s.id, e.id, 3, '15', 45, 5 from s, ejercicios e where e.nombre = 'Plancha';

-- Upper B
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_upper_lower_id, 'Upper B', 'Jueves', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '8-12', 90, 0 from s, ejercicios e where e.nombre = 'Press inclinado con mancuernas' union all
select s.id, e.id, 3, '8-12', 90, 1 from s, ejercicios e where e.nombre = 'Remo en polea baja' union all
select s.id, e.id, 3, '10-12', 60, 2 from s, ejercicios e where e.nombre = 'Elevaciones laterales' union all
select s.id, e.id, 3, '10-12', 90, 3 from s, ejercicios e where e.nombre = 'Jalón al pecho en polea' union all
select s.id, e.id, 3, '12-15', 60, 4 from s, ejercicios e where e.nombre = 'Curl martillo' union all
select s.id, e.id, 3, '12-15', 60, 5 from s, ejercicios e where e.nombre = 'Press francés';

-- Lower B
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_upper_lower_id, 'Lower B', 'Viernes', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '8-12', 120, 0 from s, ejercicios e where e.nombre = 'Peso muerto' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Sentadilla búlgara' union all
select s.id, e.id, 3, '12-15', 60, 2 from s, ejercicios e where e.nombre = 'Curl femoral sentado' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Hip thrust' union all
select s.id, e.id, 4, '10-15', 60, 4 from s, ejercicios e where e.nombre = 'Gemelos sentado' union all
select s.id, e.id, 3, '12', 45, 5 from s, ejercicios e where e.nombre = 'Elevación de piernas tumbado';

-- ============================================================
-- 5. WEIDER 5 DÍAS (Avanzado)
-- ============================================================
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Weider 5 días', 'Rutina Weider clásica: un grupo muscular grande por día + uno pequeño. Máximo volumen y aislamiento. Diseñada para avanzados que pueden manejar alto volumen semanal.', 'gimnasio', 12, 'avanzado', 'hipertrofia', 5)
returning id into v_weider_id;

-- Día 1: Pecho + Tríceps
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_weider_id, 'Pecho + Tríceps', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '6-10', 120, 0 from s, ejercicios e where e.nombre = 'Press banca plano' union all
select s.id, e.id, 4, '8-12', 90, 1 from s, ejercicios e where e.nombre = 'Press inclinado con mancuernas' union all
select s.id, e.id, 3, '10-12', 60, 2 from s, ejercicios e where e.nombre = 'Aperturas con mancuernas' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Crossover en polea' union all
select s.id, e.id, 4, '8-12', 60, 4 from s, ejercicios e where e.nombre = 'Press francés' union all
select s.id, e.id, 3, '12-15', 45, 5 from s, ejercicios e where e.nombre = 'Extensión en polea alta' union all
select s.id, e.id, 3, '10-12', 45, 6 from s, ejercicios e where e.nombre = 'Patada de tríceps';

-- Día 2: Espalda + Bíceps
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_weider_id, 'Espalda + Bíceps', 'Martes', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '6-10', 120, 0 from s, ejercicios e where e.nombre = 'Peso muerto' union all
select s.id, e.id, 4, '8-12', 90, 1 from s, ejercicios e where e.nombre = 'Dominadas' union all
select s.id, e.id, 3, '10-12', 90, 2 from s, ejercicios e where e.nombre = 'Remo con barra' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Jalón al pecho en polea' union all
select s.id, e.id, 4, '8-12', 60, 4 from s, ejercicios e where e.nombre = 'Curl con barra' union all
select s.id, e.id, 3, '12-15', 45, 5 from s, ejercicios e where e.nombre = 'Curl martillo' union all
select s.id, e.id, 3, '12-15', 45, 6 from s, ejercicios e where e.nombre = 'Curl concentrado';

-- Día 3: Piernas
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_weider_id, 'Piernas', 'Miércoles', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '6-10', 150, 0 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Prensa de piernas' union all
select s.id, e.id, 3, '10-12', 90, 2 from s, ejercicios e where e.nombre = 'Peso muerto rumano' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Extensión de cuádriceps' union all
select s.id, e.id, 3, '12-15', 60, 4 from s, ejercicios e where e.nombre = 'Curl femoral tumbado' union all
select s.id, e.id, 4, '10-15', 60, 5 from s, ejercicios e where e.nombre = 'Gemelos de pie' union all
select s.id, e.id, 3, '10-12', 60, 6 from s, ejercicios e where e.nombre = 'Hip thrust';

-- Día 4: Hombros + Trapecios
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_weider_id, 'Hombros', 'Jueves', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '8-12', 90, 0 from s, ejercicios e where e.nombre = 'Press militar con barra' union all
select s.id, e.id, 4, '12-15', 45, 1 from s, ejercicios e where e.nombre = 'Elevaciones laterales' union all
select s.id, e.id, 3, '12-15', 45, 2 from s, ejercicios e where e.nombre = 'Elevaciones frontales' union all
select s.id, e.id, 3, '12-15', 45, 3 from s, ejercicios e where e.nombre = 'Pájaro o elevaciones posteriores' union all
select s.id, e.id, 3, '12-15', 45, 4 from s, ejercicios e where e.nombre = 'Face pull en polea';

-- Día 5: Brazos
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_weider_id, 'Brazos', 'Viernes', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 3, '8-12', 60, 0 from s, ejercicios e where e.nombre = 'Curl con barra' union all
select s.id, e.id, 3, '10-12', 60, 1 from s, ejercicios e where e.nombre = 'Curl inclinado con mancuernas' union all
select s.id, e.id, 3, '12-15', 45, 2 from s, ejercicios e where e.nombre = 'Curl martillo' union all
select s.id, e.id, 3, '8-12', 60, 3 from s, ejercicios e where e.nombre = 'Press francés' union all
select s.id, e.id, 3, '10-12', 60, 4 from s, ejercicios e where e.nombre = 'Extensión en polea alta' union all
select s.id, e.id, 3, '12-15', 45, 5 from s, ejercicios e where e.nombre = 'Fondos en banco';

-- NOTA: Curl inclinado con mancuernas no está en seed_ejercicios.sql.
-- Se inserta bajo demanda como ejercicio custom más adelante o se reemplaza.
-- Por ahora usamos un ejercicio que sí existe:
update public.plantilla_sesion_ejercicios
set ejercicio_id = (select id from ejercicios where nombre = 'Curl con mancuernas')
where ejercicio_id in (select id from ejercicios where nombre = 'Curl inclinado con mancuernas');

-- Si no existe, insertarlo
insert into public.ejercicios (nombre, grupo_muscular, tipo, descripcion)
select 'Curl inclinado con mancuernas', 'Bíceps', 'fuerza', 'Tumbado en banco inclinado, curl de bíceps con mancuernas para estiramiento máximo.'
where not exists (select 1 from ejercicios where nombre = 'Curl inclinado con mancuernas');

-- ============================================================
-- 6. HIIT 3 DÍAS (Cardio — Pérdida de grasa)
-- ============================================================
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'HIIT 3 días', 'Entrenamiento intervalado de alta intensidad 3 días/semana. Máxima quema calórica en mínimo tiempo. Ideal para pérdida de grasa combinado con déficit calórico. Sesiones de 20-30 minutos.', 'cardio', 6, 'intermedio', 'perdida_grasa', 3)
returning id into v_hiit_id;

-- HIIT Cinta
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hiit_id, 'HIIT Cinta', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '10x30s sprint / 30s trote', 0, 0 from s, ejercicios e where e.nombre = 'HIIT en cinta' union all
select s.id, e.id, 3, '15', 30, 1 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '12', 30, 2 from s, ejercicios e where e.nombre = 'Mountain climbers';

-- HIIT Full Body
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hiit_id, 'HIIT Full Body', 'Miércoles', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 3, '12', 45, 0 from s, ejercicios e where e.nombre = 'Burpees' union all
select s.id, e.id, 3, '15', 45, 1 from s, ejercicios e where e.nombre = 'Battle ropes' union all
select s.id, e.id, 3, '12', 45, 2 from s, ejercicios e where e.nombre = 'Mountain climbers';

-- HIIT Bicicleta
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hiit_id, 'HIIT Bicicleta', 'Viernes', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '8x40s sprint / 20s recuperación', 0, 0 from s, ejercicios e where e.nombre = 'Bicicleta estática' union all
select s.id, e.id, 3, '15', 30, 1 from s, ejercicios e where e.nombre = 'Saltar la comba';

-- ============================================================
-- 7. CARDIO ESTADO ESTABLE 3 DÍAS (Cardio — Salud general)
-- ============================================================
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Cardio Estado Estable 3 días', 'Cardio LISS (Low Intensity Steady State) 3 días/semana. Ideal para salud cardiovascular, recuperación activa y gasto calórico adicional sin impacto articular. Intensidad: 60-70% FC máxima.', 'cardio', 0, 'principiante', 'cardio', 3)
returning id into v_steady_id;

-- Cardio Cinta
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_steady_id, 'Cardio Cinta', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '30 min ritmo constante 5-7 km/h', 0, 0 from s, ejercicios e where e.nombre = 'Carrera continua';

-- Cardio Bicicleta
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_steady_id, 'Cardio Bicicleta', 'Miércoles', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '40 min ritmo constante 70-90 rpm', 0, 0 from s, ejercicios e where e.nombre = 'Bicicleta estática';

-- Cardio Elíptica + Remo
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_steady_id, 'Cardio Elíptica + Remo', 'Viernes', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '25 min ritmo constante', 0, 0 from s, ejercicios e where e.nombre = 'Elíptica' union all
select s.id, e.id, 1, '15 min ritmo constante 500m/2:30', 0, 1 from s, ejercicios e where e.nombre = 'Remo ergómetro';

-- ══════════════════════════════════════════════════════════════
-- PROGRESIÓN SEMANAL Y RPE — Plantillas de Gimnasio
-- ══════════════════════════════════════════════════════════════

-- 1. Full Body 3 días — Progresión 8 semanas
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Adaptación anatómica", "descripcion": "Familiarización con patrones de movimiento. Series: 3, Reps: 12-15, Descanso: 90s. RPE 5-6/10", "ajustes": ["Usar cargas ligeras (50-60% 1RM)", "Enfocar en técnica y rango completo", "Si hay dolor articular, reducir rango de movimiento"]},
  {"semana": 2, "titulo": "Construcción base", "descripcion": "Incremento ligero de carga manteniendo técnica. Series: 3, Reps: 10-12, Descanso: 90s. RPE 6-7/10", "ajustes": ["Aumentar carga 2-5kg si RPE < 6", "Ejercicios unilaterales para equilibrar fuerza", "Añadir 1 serie extra en ejercicios compuestos si hay energía"]},
  {"semana": 3, "titulo": "Sobrecarga progresiva", "descripcion": "Aumento de carga manteniendo rango de repeticiones. Series: 3-4, Reps: 10-12, Descanso: 90s. RPE 7/10", "ajustes": ["Incrementar carga 2.5-5kg en compuestos", "La última serie de cada ejercicio debe ser al fallo técnico", "Si no se completan reps, reducir carga en 10%"]},
  {"semana": 4, "titulo": "Volumen + intensidad", "descripcion": "Semana de carga alta antes de descarga. Series: 4, Reps: 8-10, Descanso: 90-120s. RPE 8/10", "ajustes": ["Añadir 1 serie más por ejercicio", "Reducir descanso a 60s en accesorios", "Registrar RPE post-sesión para ajustar semana 5"]},
  {"semana": 5, "titulo": "Descarga activa", "descripcion": "Reducción de volumen al 60% para recuperación y supercompensación. Series: 2-3, Reps: 10-12, Carga: 60-70%, RPE 4-5/10", "ajustes": ["Mantener técnica pero con cargas ligeras", "Añadir 2 ejercicios de movilidad específica", "Si hay fatiga acumulada, reducir a 2 sesiones esta semana"]},
  {"semana": 6, "titulo": "Bloque de fuerza", "descripcion": "Menos reps, más carga. Series: 4-5, Reps: 6-8, Descanso: 120-150s. RPE 8-9/10", "ajustes": ["Cargas > 75% 1RM en compuestos", "Los accesorios pueden ser 8-12 reps", "No llegar al fallo concéntrico en compuestos"]},
  {"semana": 7, "titulo": "Bloque de hipertrofia", "descripcion": "Alto volumen con técnica controlada. Series: 4, Reps: 10-12, Descanso: 60-90s. RPE 8/10", "ajustes": ["Técnicas de intensidad: drop set última serie", "Tempo controlado (2-0-2-0)", "Añadir series de 15 reps en accesorios"]},
  {"semana": 8, "titulo": "Test de fuerza + PR", "descripcion": "Semana de testeo de máximos. Series: 3-5 progresivas hasta RM, Reps: 1-5, Descanso: 3-5 min. RPE 10/10 en test", "ajustes": ["RM en press banca, sentadilla y peso muerto", "Registrar todos los resultados", "Última sesión: deload completo"]}
]', descripcion = 'Rutina de cuerpo completo 3 días/semana ideal para principiantes. Trabaja todos los grupos musculares en cada sesión con ejercicios compuestos. Descanso 48h entre sesiones. 🎯 INDIVIDUALIZACIÓN: Si el cliente tiene >15% grasa corporal, priorizar déficit calórico y añadir 20 min cardio post-sesión. Si es mujer, ajustar cargas al ciclo menstrual (semana 1-2 folicular: más intensidad, semana 3-4 lútea: más volumen, menos carga absoluta). Si hay dolor lumbar crónico, evitar peso muerto y sustituir por hip thrust o curl femoral tumbado.'
where id = v_fullbody_id;

-- 2. PPL 6 días — Progresión 12 semanas
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Adaptación PPL", "descripcion": "Establecer técnica en todos los patrones. Series: 3, Reps: 10-12, Descanso: 90-120s. RPE 5-6/10", "ajustes": ["Priorizar rango completo sobre carga", "Dominadas asistidas con banda si no completa 8 reps", "Si fatiga acumulada, saltarse 1 sesión/semana"]},
  {"semana": 2, "titulo": "Aclimatación al volumen", "descripcion": "Incremento gradual. Series: 3-4, Reps: 8-12, Descanso: 90s. RPE 6-7/10", "ajustes": ["Añadir 1 serie en compuestos", "Reducir descanso a 60s en accesorios", "Si dolor en hombro en press, ajustar agarre o usar mancuernas"]},
  {"semana": 3, "titulo": "Sobrecarga ligera", "descripcion": "Primer incremento real de carga. Series: 4, Reps: 8-10, Descanso: 90-120s. RPE 7/10", "ajustes": ["+2.5-5kg en compuestos si RPE < 7", "Sustituir dominadas por jalón si molestias en codo", "Registrar RPE de cada sesión"]},
  {"semana": 4, "titulo": "Volumen alto", "descripcion": "Máximo volumen del microciclo 1. Series: 4-5, Reps: 8-10, Descanso: 90s. RPE 8/10", "ajustes": ["Última serie al fallo técnico", "Si RPE > 9 en compuestos, reducir 5% carga", "Añadir series de aislamiento al final"]},
  {"semana": 5, "titulo": "Semana de descarga", "descripcion": "60% volumen, 50% intensidad. Series: 2-3, Reps: 10-12, RPE 4-5/10", "ajustes": ["Mantener frecuencia, reducir carga", "Enfocar en técnica y conexión mente-músculo", "Añadir sesión extra de cardio ligero"]},
  {"semana": 6, "titulo": "Bloque fuerza-potencia", "descripcion": "Menos reps, más carga. Series: 5, Reps: 4-6, Descanso: 150-180s. RPE 8-9/10", "ajustes": ["Cargas > 80% 1RM en compuestos", "Movimientos explosivos en primera serie", "No al fallo en la fase excéntrica"]},
  {"semana": 7, "titulo": "Hipertrofia intensa", "descripcion": "Volumen moderado-alto con RIR 0-1. Series: 4-5, Reps: 8-12, Descanso: 60-90s. RPE 8-9/10", "ajustes": ["Rest-pause en última serie de compuestos", "Técnicas de intensidad: myo-reps en accesorios", "Reducir 10% carga en bíceps/tríceps si molestias en codo"]},
  {"semana": 8, "titulo": "Pico de volumen", "descripcion": "Máximo volumen semanal. Series: 5, Reps: 10-12, Descanso: 60-90s. RPE 9/10", "ajustes": ["Gestionar fatiga del SNC: si insomnio o falta de apetito, reducir 1 sesión", "Suplementar con creatina y carbohidratos intra-entreno", "Últimas 2 series de cada compuesto al fallo"]},
  {"semana": 9, "titulo": "Descarga activa", "descripcion": "50% volumen, mantener frecuencia. Series: 2-3, Reps: 10-12, RPE 3-4/10", "ajustes": ["Semana de movilidad y corrección técnica", "Evaluar progreso: comparar cargas con semana 1", "Ajustar próximas cargas basado en RPE registrado"]},
  {"semana": 10, "titulo": "Mesociclo de fuerza máxima", "descripcion": "Series: 4, Reps: 3-5, Descanso: 180s. RPE 9/10 — excepto test RM", "ajustes": ["Semana 10: subir a 85% 1RM", "Semana 11: test de RM en banca, sentadilla, peso muerto", "Cinturón de levantamiento en sentadilla y peso muerto"]},
  {"semana": 11, "titulo": "Test de RM", "descripcion": "Evaluación de fuerza máxima. RPE máximo en test", "ajustes": ["Calentamiento específico progresivo", "Spotter obligatorio en press banca", "Registrar RM actualizados para programar próximo ciclo"]},
  {"semana": 12, "titulo": "Transición", "descripcion": "Semana ligera de transición al próximo programa. Series: 2-3, RPE 5/10", "ajustes": ["Evaluar logros y ajustar objetivos", "Planificar próximo ciclo basado en resultados", "Desconexión mental: 1 semana con otro deporte"]}
]', descripcion = 'Rutina PPL clásica 6 días/semana. Push: Pecho, Hombros, Tríceps. Pull: Espalda, Bíceps. Piernas: Cuádriceps, Isquios, Glúteos, Gemelos. Alta frecuencia para máximo estímulo de hipertrofia. 🎯 INDIVIDUALIZACIÓN: Clientes con tendencia a sobreentrenamiento: reducir a 4 días/semana (PPL + descanso + Push + Pull + Pierna + descanso). Si el objetivo es fuerza: cambiar rango de reps a 3-5 en compuestos y añadir días de fuerza máxima. Si hay lesión de manguito rotador: evitar press militar tras press banca (demasiado estrés en hombro), espaciar 48h entre Push y días de hombro. Para mujeres avanzadas: ajustar volumen en semana pre-menstrual (reducir 20% carga, mantener series).'
where id = v_ppl_id;

-- 3. Torso/Pierna 4 días — Progresión 8 semanas
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Base técnica", "descripcion": "Series: 3, Reps: 10-12, Descanso: 90s. RPE 5-6/10", "ajustes": ["Enfasis en técnica de sentadilla y press banca", "Si molestias en hombro al press inclinado, usar ángulo 30° no 45°", "Si no hay dominadas, usar jalón al pecho con agarre supino"]},
  {"semana": 2, "titulo": "Aclimatación", "descripcion": "Series: 3-4, Reps: 8-12, Descanso: 90s. RPE 6-7/10", "ajustes": ["Añadir 1 serie en ejercicios compuestos", "Controlar que el remo no provoque dolor lumbar", "Si fatiga, priorizar torso sobre pierna"]},
  {"semana": 3, "titulo": "Sobrecarga", "descripcion": "Series: 4, Reps: 8-10, Descanso: 90-120s. RPE 7-8/10", "ajustes": ["Incrementar 2.5kg en press banca y sentadilla si RPE < 7", "Añadir series de aislamiento para puntos débiles", "Si dolor de rodilla en sentadilla, probar stance más ancho"]},
  {"semana": 4, "titulo": "Volumen máximo", "descripcion": "Series: 4-5, Reps: 8-10, Descanso: 90s. RPE 8-9/10", "ajustes": ["Última serie al fallo técnico", "Si RPE > 9, reducir carga 5% la siguiente sesión", "Registrar todas las cargas"]},
  {"semana": 5, "titulo": "Descarga", "descripcion": "Series: 2-3, Reps: 10-12, 50% carga. RPE 4-5/10", "ajustes": ["Movilidad articular antes de cada sesión", "Evaluar asimetrías en fuerza", "Si hay dolor persistente, consultar fisioterapeuta"]},
  {"semana": 6, "titulo": "Fuerza", "descripcion": "Series: 4-5, Reps: 5-8, Descanso: 120-150s. RPE 8/10", "ajustes": ["Cargas > 75% 1RM", "Menos accesorios, más énfasis en compuestos", "Si meseta en press banca, añadir press de pausa (3s en pecho)"]},
  {"semana": 7, "titulo": "Hipertrofia", "descripcion": "Series: 4, Reps: 10-12, Descanso: 60-90s. RPE 8/10", "ajustes": ["Drop sets en últimos ejercicios de cada grupo", "Tempo 3-0-2-0 en fase excéntrica", "Añadir 2 ejercicios de core al final de pierna"]},
  {"semana": 8, "titulo": "Testeo", "descripcion": "Series: 3-5, Reps: 1-5, RPE máximo en test. Evaluación completa", "ajustes": ["Test de RM en press banca y sentadilla", "Fotos de progreso y medidas corporales", "Reevaluar objetivos para próximo ciclo"]}
]', descripcion = 'Rutina torso-pierna 4 días/semana. Los días de torso trabajan pecho, espalda y hombros. Los días de pierna trabajan piernas completas. Ideal para intermedios que buscan volumen equilibrado. 🎯 INDIVIDUALIZACIÓN: Si el cliente tiene el pecho dominante sobre la espalda (hombros redondeados), añadir 2 series extra de remo y face pulls, reducir press inclinado. Si hay desequilibrio entre cuádriceps e isquiotibiales (ratio < 0.6 en curl femoral/sentadilla), añadir RDL y curl femoral al inicio del día de pierna, antes de sentadilla. Para clientes con hipertensión, evitar press por encima de la cabeza y sustituir press militar por press inclinado.'
where id = v_torsopierna_id;

-- 4. Upper/Lower 4 días — Progresión 8 semanas
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Establecer bases", "descripcion": "Series: 3, Reps: 10-12, Descanso: 90s. RPE 5-6/10", "ajustes": ["Evaluar movilidad de hombro y cadera", "Ajustar stance de sentadilla según anatomía", "Si dolor en hombro al press, probar agarre más cerrado"]},
  {"semana": 2, "titulo": "Progresión ligera", "descripcion": "Series: 3-4, Reps: 8-12, Descanso: 90s. RPE 6-7/10", "ajustes": ["+2.5kg si RPE < 6 en últimos ejercicios", "Controlar que peso muerto no fatigue SNC excesivamente", "Añadir ejercicios unilaterales si hay asimetrías"]},
  {"semana": 3, "titulo": "Carga moderada", "descripcion": "Series: 4, Reps: 8-10, Descanso: 90-120s. RPE 7/10", "ajustes": ["Priorizar recuperación (sueño + proteínas)", "Si RPE salta a 9, bajar carga 10%", "Evaluar dolor de rodilla en zancadas"]},
  {"semana": 4, "titulo": "Volumen alto", "descripcion": "Series: 4-5, Reps: 8-10, Descanso: 60-90s. RPE 8/10", "ajustes": ["Últimas series al fallo", "Reducir descanso a 60s en accesorios", "Añadir ejercicios de core al final de cada sesión"]},
  {"semana": 5, "titulo": "Descarga", "descripcion": "Series: 2-3, Reps: 10-12, 50% carga. RPE 4/10", "ajustes": ["Movilidad y flexibilidad intensiva", "Revisar técnica de levantamientos olímpicos si aplica", "Medir recuperación: HRV o calidad de sueño"]},
  {"semana": 6, "titulo": "Fuerza máxima", "descripcion": "Series: 5, Reps: 5, Descanso: 180s. RPE 8-9/10", "ajustes": ["Cargas 80-85% 1RM en compuestos", "Cinturón en sentadilla y peso muerto", "No combinar con déficit calórico agresivo"]},
  {"semana": 7, "titulo": "Hipertrofia", "descripcion": "Series: 4, Reps: 10-12, Descanso: 60s. RPE 8-9/10", "ajustes": ["Técnicas avanzadas: rest-pause, drop sets", "Mantener proteína alta (>2g/kg)", "Si fatiga acumulada, reducir 1 sesión"]},
  {"semana": 8, "titulo": "Evaluación + PR", "descripcion": "Series progresivas hasta RM. RPE máximo", "ajustes": ["Intentar PR en sentadilla o peso muerto si fatiga baja", "Medir composición corporal", "Planificar próximo ciclo con datos actualizados"]}
]', descripcion = 'División superior/inferior 4 días/semana. Upper: pecho, espalda, hombros, brazos. Lower: piernas completas. Excelente equilibrio entre frecuencia y recuperación. 🎯 INDIVIDUALIZACIÓN: Para clientes con trabajo físicamente demandante, intercambiar días para que Lower caiga en fin de semana. Si el cliente está en déficit calórico agresivo (>500kcal), reducir volumen a 3 series por ejercicio y eliminar series de fallo. Si hay dolor de muñeca, usar barras con agarre neutro o mancuernas. Para clientas con diástasis abdominal, evitar crunch y plancha frontal, sustituir por Pallof press y dead bug.'
where id = v_upperlower_id;

-- 5. Weider 5 días — Progresión 12 semanas
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Adaptación por grupo", "descripcion": "Series: 3-4, Reps: 10-12, Descanso: 90s. RPE 5-6/10. Familiarización con el volumen por grupo muscular", "ajustes": ["No exceder 20 series totales por sesión", "Probar diferentes ángulos de press para encontrar el más cómodo", "Si fatiga post-sesión excesiva, reducir 1 ejercicio por grupo"]},
  {"semana": 2, "titulo": "Aclimatación al volumen", "descripcion": "Series: 4, Reps: 8-12, Descanso: 60-90s. RPE 6-7/10", "ajustes": ["Añadir 1 serie en ejercicios principales", "Si dolor en codo en curl francés, usar polea baja o mancuerna", "Rotar ángulos en press banca (plano/inclinado)"]},
  {"semana": 3, "titulo": "Sobrecarga", "descripcion": "Series: 4, Reps: 8-10, Descanso: 90-120s. RPE 7-8/10", "ajustes": ["Incrementar carga en compuestos si RPE < 7", "Añadir drop set en último ejercicio de grupo grande", "Controlar que el volumen de bíceps/tríceps no interfiera con recuperación"]},
  {"semana": 4, "titulo": "Volumen máximo", "descripcion": "Series: 5, Reps: 8-10, Descanso: 60-90s. RPE 8-9/10", "ajustes": ["Últimas 2 series al fallo técnico", "Si recuperación insuficiente, reducir accesorios a 2 ejercicios por grupo pequeño", "Añadir series de estiramiento entre series para mejorar rango"]},
  {"semana": 5, "titulo": "Descarga", "descripcion": "Series: 2-3, Reps: 10-12, 50% carga. RPE 4/10", "ajustes": ["Movilidad articular completa cada día", "Revisar técnica con video", "Evaluar si algún grupo está rezagado"]},
  {"semana": 6, "titulo": "Fuerza por grupo", "descripcion": "Series: 4-5, Reps: 5-8, Descanso: 120-150s. RPE 8/10", "ajustes": ["Priorizar carga sobre volumen", "Compuestos al inicio de cada sesión", "Si meseta, cambiar orden de ejercicios"]},
  {"semana": 7, "titulo": "Hipertrofia intensa", "descripcion": "Series: 5, Reps: 10-12, Descanso: 60s. RPE 9/10", "ajustes": ["RIR 0-1 en todas las series", "Técnicas: rest-pause, myo-reps, drop sets", "Aumentar ingesta calórica para soportar volumen"]},
  {"semana": 8, "titulo": "Pico de volumen", "descripcion": "Series: 5, Reps: 12-15, Descanso: 45-60s. RPE 9-10/10", "ajustes": ["Volumen máximo: 25-30 series totales por sesión", "Gestionar fatiga del SNC: si insomnio o irritabilidad, reducir", "Última semana antes de descarga larga"]},
  {"semana": 9, "titulo": "Descarga activa", "descripcion": "Series: 2, Reps: 10-12, 40% carga. RPE 3-4/10", "ajustes": ["Semana de recuperación completa", "Fisioterapia preventiva y masaje deportivo", "Evaluar logros y planificar próximos 3 meses"]},
  {"semana": 10, "titulo": "Mesociclo de fuerza", "descripcion": "Series: 5, Reps: 3-5, Descanso: 180s. RPE 9/10", "ajustes": ["Cargas 85-90% 1RM en compuestos", "No al fallo en fase excéntrica (proteger SNC)", "Cinturón y vendas en sentadilla pesada"]},
  {"semana": 11, "titulo": "Pico de fuerza", "descripcion": "Series: 3-5 progresivas, Reps: 1-3, RPE máximo", "ajustes": ["Test de RM por grupo: banca, peso muerto, sentadilla, press militar", "Entre tests: 5 min descanso mínimo", "Registrar todos los RM actualizados"]},
  {"semana": 12, "titulo": "Transición + planificación", "descripcion": "Series: 2-3 ligeras, RPE 5/10", "ajustes": ["Semana de descarga completa", "Analizar progreso: fotos, medidas, RM", "Diseñar próximo ciclo basado en resultados"]}
]', descripcion = 'Rutina Weider clásica: un grupo muscular grande por día + uno pequeño. Máximo volumen y aislamiento. Diseñada para avanzados que pueden manejar alto volumen semanal. 🎯 INDIVIDUALIZACIÓN: Si el cliente tiene tendencia a sobrecargar el SNC (insomnio, fatiga crónica, falta de libido), reducir a 4 días combinando hombros con piernas o brazos con pecho. Para clientes con escoliosis, ajustar remo con barra por remo unilateral con mancuerna para compensar asimetrías. Si hay pinzamiento de hombro: evitar press militar y elevaciones laterales con peso, usar poleas o bandas elásticas. Para clientes con diabetes tipo 2, programar sesiones post-comida para evitar hipoglucemia y monitorizar respuesta glucémica.'
where id = v_weider_id;

-- 6. HIIT 3 días — Progresión 6 semanas
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Introducción al HIIT", "descripcion": "Relación trabajo:descanso 1:3. 6-8 intervalos. Intensidad: 80-85% FC máx. RPE 6-7/10", "ajustes": ["Empezar con 6 intervalos, añadir 1 cada sesión", "Si hay mareos o nauseas, alargar descanso", "No hacer HIIT si el cliente no ha dormido bien"]},
  {"semana": 2, "titulo": "Progresión", "descripcion": "Relación 1:2. 8-10 intervalos. Intensidad: 85-90% FC máx. RPE 7-8/10", "ajustes": ["Aumentar tiempo de trabajo 5s cada sesión", "Si dolor articular, reducir impacto (elíptica en vez de cinta)", "Hidratación intra-entreno obligatoria"]},
  {"semana": 3, "titulo": "Intensidad", "descripcion": "Relación 1:1.5. 10 intervalos. Intensidad: 90% FC máx. RPE 8-9/10", "ajustes": ["Reducir descanso a 30s si tolera bien", "Añadir ejercicios compuestos entre intervalos", "Si RPE > 9, reducir intensidad 5% la próxima sesión"]},
  {"semana": 4, "titulo": "Volumen HIIT", "descripcion": "Relación 1:1. 12 intervalos. Intensidad: 90-95% FC máx. RPE 9/10", "ajustes": ["Máximo volumen de HIIT: no superar 12 intervalos", "Alternar máquinas (bici, remo, cinta) para variedad", "Si fatiga extrema, añadir día de descanso extra"]},
  {"semana": 5, "titulo": "Pico de intensidad", "descripcion": "Relación 1:1. 10 intervalos pero más intensos (95-100%). RPE 9-10/10", "ajustes": ["Sprints máximos, descanso activo (trote suave)", "No recomendado para principiantes o hipertensos", "Medir FC post-ejercicio: debe recuperar 20ppm en 1 minuto"]},
  {"semana": 6, "titulo": "Test de capacidad anaeróbica", "descripcion": "Wingate test o 12 min HIIT máximo. RPE 10/10 al final", "ajustes": ["Test de 30s Wingate en bici o 12 min carrera alternando 30s sprint / 30s trote", "Registrar distancia o potencia media", "Comparar con semana 1 para medir progreso"]}
]', descripcion = 'Entrenamiento intervalado de alta intensidad 3 días/semana. Máxima quema calórica en mínimo tiempo. Ideal para pérdida de grasa combinado con déficit calórico. Sesiones de 20-30 minutos. 🎯 INDIVIDUALIZACIÓN: Contraindicado en clientes con hipertensión no controlada, problemas cardíacos o lesiones articulares agudas. Para estos casos, usar LISS (cardio estado estable) como alternativa. Si el cliente tiene asma inducida por ejercicio, usar intervalos 1:3 con recuperación completa y broncodilatador 15 min antes. Para clientes con sobrepeso (IMC > 30), priorizar bicicleta o elíptica sobre carrera para reducir impacto articular. Si el cliente tiene baja condición física, empezar con 4 intervalos y 1:4 ratio.'
where id = v_hiit_id;

-- 7. Cardio Estado Estable — Sin progresión (mantenimiento)
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Base aeróbica", "descripcion": "30-40 min al 60-65% FC máx. RPE 4-5/10. 3 sesiones/semana", "ajustes": ["Usar FC o escala de Borg (11-13)", "Si no puede mantener conversación, reducir intensidad", "Priorizar bicicleta si hay dolor de rodilla al correr"]},
  {"semana": 2, "titulo": "Incremento volumen", "descripcion": "35-45 min al 60-65% FC máx. RPE 4-5/10", "ajustes": ["Añadir 5 min por sesión", "Probar diferentes modos (elíptica, remo, natación)", "Mantener respiración nasal durante toda la sesión"]},
  {"semana": 3, "titulo": "Duración", "descripcion": "40-50 min al 60-70% FC máx. RPE 5-6/10", "ajustes": ["Añadir 1 sesión extra opcional", "Controlar que la FC no supere el 70%", "Si fatiga muscular, reducir a 40 min"]},
  {"semana": 4, "titulo": "Intensidad suave", "descripcion": "40-50 min al 65-70% FC máx. RPE 5-6/10", "ajustes": ["Últimos 5 min a 70% FC máx como progresión", "Evaluar si el cliente necesita HIIT o sigue con LISS", "Registrar distancia o tiempo para tracking de progreso"]}
]', descripcion = 'Cardio LISS (Low Intensity Steady State) 3 días/semana. Ideal para salud cardiovascular, recuperación activa y gasto calórico adicional sin impacto articular. Intensidad: 60-70% FC máxima. 🎯 INDIVIDUALIZACIÓN: Para clientes en déficit calórico severo (>700kcal), reducir a 2 sesiones/semana para preservar masa muscular. Para clientes con hipotiroidismo, el cardio LISS excesivo puede empeorar los síntomas — limitar a 3 sesiones de 30 min. Si el cliente tiene insuficiencia venosa periférica, priorizar bicicleta o natación para mejorar retorno venoso. Para clientes mayores de 60 años, mantener 65% FC máx y añadir 10 min de equilibrio post-cardio.'
where id = v_steady_id;

-- ============================================================
-- ══════════════════════════════════════════════════════════
-- SEED DATA — PLANTILLAS DEPORTIVAS (HYROX, Running, Ciclismo, Triatlón)
-- Basadas en bibliografía actual (2020-2025)
-- ══════════════════════════════════════════════════════════
-- ============================================================
-- REFERENCIAS:
-- • Contreras (2023) — HYROX Training Methodology
-- • Daniels (2014) — Daniels' Running Formula
-- • Fitzgerald (2021) — 80/20 Running
-- • Friel (2021) — Triathlete's Training Bible
-- • Coggan & Allen (2023) — Training and Racing with a Power Meter
-- ============================================================

do $$
declare
  v_coach_id uuid := 'REEMPLAZAR_CON_TU_COACH_ID';

  -- IDs de plantillas deportivas
  v_hyrox_beginner_id uuid;
  v_hyrox_intermediate_id uuid;
  v_hyrox_advanced_id uuid;
  v_run_5k_id uuid;
  v_run_10k_id uuid;
  v_run_half_id uuid;
  v_run_marathon_id uuid;
  v_cycle_base_id uuid;
  v_cycle_intervals_id uuid;
  v_cycle_endurance_id uuid;
  v_tri_sprint_id uuid;
  v_tri_olympic_id uuid;
  v_tri_half_id uuid;
  v_tri_full_id uuid;
begin

-- ══════════════════════════════════════════════════════════════
-- 8. HYROX — PRINCIPIANTE (8 semanas)
-- Basado en Contreras (2023) HYROX Training Methodology
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'HYROX Principiante 8 semanas', 'Programa de introducción al HYROX para principiantes. Combina preparación cardiovascular con las 8 estaciones de HYROX. Sesiones de 45-60 min. Progresión gradual de volumen e intensidad. Basado en Contreras (2023).', 'mixto', 8, 'principiante', 'rendimiento', 4)
returning id into v_hyrox_beginner_id;

-- Día 1: Resistencia + Sled push
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_beginner_id, 'Resistencia + Empuje', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '2km carrera suave + 4x100m progresivos', 60, 0 from s, ejercicios e where e.nombre = 'Carrera continua' union all
select s.id, e.id, 4, '20m ida y vuelta (carga ligera)', 90, 1 from s, ejercicios e where e.nombre = 'Sled push velocidad' union all
select s.id, e.id, 3, '10 repes (lastre moderado)', 90, 2 from s, ejercicios e where e.nombre = 'Sled pull velocidad' union all
select s.id, e.id, 3, '12-15', 60, 3 from s, ejercicios e where e.nombre = 'Mountain climbers';

-- Día 2: Remo + SkiErg
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_beginner_id, 'Remo y Esquí', 'Martes', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '500m ritmo constante', 60, 0 from s, ejercicios e where e.nombre = 'Remo ergómetro sprint' union all
select s.id, e.id, 1, '500m ritmo constante', 60, 1 from s, ejercicios e where e.nombre = 'SkiErg' union all
select s.id, e.id, 3, '500m / 500m alternados x3', 90, 2 from s, ejercicios e where e.nombre = 'Remo ergómetro endurance' union all
select s.id, e.id, 3, '30s on / 30s off x6', 30, 3 from s, ejercicios e where e.nombre = 'SkiErg sprint';

-- Día 3: Descanso o recuperación activa

-- Día 4: Wall Balls + Burpees
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_beginner_id, 'Wall Balls + Burpees', 'Jueves', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '10 repes (balón 6kg)', 45, 0 from s, ejercicios e where e.nombre = 'Wall balls hyrox' union all
select s.id, e.id, 3, '8 repes', 60, 1 from s, ejercicios e where e.nombre = 'Burpee broad jumps' union all
select s.id, e.id, 3, '12-15', 45, 2 from s, ejercicios e where e.nombre = 'Kettlebell swing' union all
select s.id, e.id, 3, '30m', 60, 3 from s, ejercicios e where e.nombre = 'Sandbag lunges';

-- Día 5: Farmer's Carry + Transiciones
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_beginner_id, 'Carga y Transiciones', 'Viernes', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '30m ida y vuelta (16-20kg)', 60, 0 from s, ejercicios e where e.nombre = 'Farmer''s carry velocidad' union all
select s.id, e.id, 1, '8x100m sprints con 1 estación entre medias', 60, 1 from s, ejercicios e where e.nombre = 'HYROX transición simulación' union all
select s.id, e.id, 3, '15', 45, 2 from s, ejercicios e where e.nombre = 'Plancha' union all
select s.id, e.id, 3, '30m', 60, 3 from s, ejercicios e where e.nombre = 'Sandbag walking lunges';

-- ══════════════════════════════════════════════════════════════
-- 9. HYROX — INTERMEDIO (8 semanas)
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'HYROX Intermedio 8 semanas', 'Programa HYROX para intermedios con experiencia en fitness funcional. Simulación completa de estaciones HYROX a ritmo creciente. Sesiones de 60-75 min. Incluye trabajo de transiciones y ritmo de competición.', 'mixto', 8, 'intermedio', 'rendimiento', 5)
returning id into v_hyrox_intermediate_id;

-- Día 1: Resistencia + Sled (pesado)
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_intermediate_id, 'Resistencia + Sled Pesado', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '3km carrera progresiva', 90, 0 from s, ejercicios e where e.nombre = 'Progression run' union all
select s.id, e.id, 4, '25m ida y vuelta (carga pesada)', 120, 1 from s, ejercicios e where e.nombre = 'Sled push pesado' union all
select s.id, e.id, 4, '25m ida y vuelta (carga pesada)', 120, 2 from s, ejercicios e where e.nombre = 'Sled pull pesado' union all
select s.id, e.id, 3, '12', 60, 3 from s, ejercicios e where e.nombre = 'Saltar la comba';

-- Día 2: Remo + SkiErg + Burpees
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_intermediate_id, 'Remo + Esquí + Burpees', 'Martes', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '1000m a ritmo', 90, 0 from s, ejercicios e where e.nombre = 'Remo ergómetro endurance' union all
select s.id, e.id, 1, '1000m a ritmo', 90, 1 from s, ejercicios e where e.nombre = 'SkiErg endurance' union all
select s.id, e.id, 4, '10 repes', 60, 2 from s, ejercicios e where e.nombre = 'Burpee broad jumps ritmo' union all
select s.id, e.id, 3, '12', 60, 3 from s, ejercicios e where e.nombre = 'Kettlebell snatch' union all
select s.id, e.id, 1, '500m a ritmo + 500m sprint', 120, 4 from s, ejercicios e where e.nombre = 'Pista de esquí ergómetro';

-- Día 3: Recuperación activa

-- Día 4: Wall Balls + Farmer's Carry
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_intermediate_id, 'Wall Balls + Carga Pesada', 'Jueves', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '15 repes (balón 6-9kg)', 45, 0 from s, ejercicios e where e.nombre = 'Wall balls a ritmo' union all
select s.id, e.id, 4, '40m ida y vuelta (24-32kg)', 90, 1 from s, ejercicios e where e.nombre = 'Farmer''s carry pesado' union all
select s.id, e.id, 3, '10 repes (sandbag 20-30kg)', 60, 2 from s, ejercicios e where e.nombre = 'Sandbag walking lunges' union all
select s.id, e.id, 3, '12', 60, 3 from s, ejercicios e where e.nombre = 'Thrusters';

-- Día 5: Simulación HYROX completa
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_intermediate_id, 'Simulación HYROX', 'Viernes', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '1km + SkiErg 500m + Sled push/pull 25m + 1km', 120, 0 from s, ejercicios e where e.nombre = 'Carrera + SkiErg combinado' union all
select s.id, e.id, 1, 'Simulación: 1km + Wall balls 20 + 1km', 120, 1 from s, ejercicios e where e.nombre = 'HYROX transición simulación';

-- Día 6: HIIT cross-training
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_intermediate_id, 'HIIT Cross-training', 'Sábado', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 3, '15 (cada ejercicio)', 30, 0 from s, ejercicios e where e.nombre = 'Burpees con salto vertical' union all
select s.id, e.id, 3, '12', 30, 1 from s, ejercicios e where e.nombre = 'Box jumps' union all
select s.id, e.id, 3, '30s on / 30s off', 30, 2 from s, ejercicios e where e.nombre = 'Battle ropes' union all
select s.id, e.id, 3, '12', 30, 3 from s, ejercicios e where e.nombre = 'Kettlebell clean and press';

-- ══════════════════════════════════════════════════════════════
-- 10. HYROX — AVANZADO (8 semanas)
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'HYROX Avanzado 8 semanas', 'Programa HYROX de competición para avanzados. Sesiones de 75-90 min. Simulación completa de carrera HYROX (8km + 8 estaciones). Trabajo específico de ritmo de competición, transiciones y estaciones al fallo. Basado en metodología de Contreras (2023).', 'mixto', 8, 'avanzado', 'rendimiento', 6)
returning id into v_hyrox_advanced_id;

-- Día 1: Sled específico + carrera
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_advanced_id, 'Sled Específico + Carrera', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '3x1km a ritmo 5K con 90s recup', 90, 0 from s, ejercicios e where e.nombre = 'Intervalos 1km' union all
select s.id, e.id, 5, '25m push + 25m pull (carga competición)', 90, 1 from s, ejercicios e where e.nombre = 'Sled push pesado' union all
select s.id, e.id, 5, '25m (carga competición)', 90, 2 from s, ejercicios e where e.nombre = 'Sled pull pesado' union all
select s.id, e.id, 1, '1km a ritmo competición post-sled', 120, 3 from s, ejercicios e where e.nombre = 'Carrera a ritmo de 5K';

-- Día 2: SkiErg + Remo máximo
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_advanced_id, 'SkiErg + Remo Máximo', 'Martes', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '1000m a tope + 500m recovery x3', 180, 0 from s, ejercicios e where e.nombre = 'Remo ergómetro sprint' union all
select s.id, e.id, 1, '1000m a tope + 500m recovery x3', 180, 1 from s, ejercicios e where e.nombre = 'SkiErg sprint' union all
select s.id, e.id, 1, '2km ritmo umbral', 120, 2 from s, ejercicios e where e.nombre = 'Remo ergómetro endurance' union all
select s.id, e.id, 1, '2km ritmo umbral', 120, 3 from s, ejercicios e where e.nombre = 'SkiErg endurance';

-- Día 3: Burpee broad jumps + Wall balls
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_advanced_id, 'Burpees + Wall Balls', 'Miércoles', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 5, '15 repes a ritmo competición', 45, 0 from s, ejercicios e where e.nombre = 'Burpee broad jumps ritmo' union all
select s.id, e.id, 5, '20 repes (balón 9kg)', 45, 1 from s, ejercicios e where e.nombre = 'Wall balls a ritmo' union all
select s.id, e.id, 4, '12 (sandbag 30kg)', 60, 2 from s, ejercicios e where e.nombre = 'Sandbag walking lunges' union all
select s.id, e.id, 4, '10', 60, 3 from s, ejercicios e where e.nombre = 'Burpees con flexión';

-- Día 4: Farmer's carry pesado + Transiciones
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_advanced_id, 'Farmer Pesado + Transiciones', 'Jueves', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 5, '40m ida y vuelta (32-48kg)', 90, 0 from s, ejercicios e where e.nombre = 'Farmer''s carry pesado' union all
select s.id, e.id, 1, 'Simulación completa: 1km + 8 estaciones a ritmo competición', 180, 1 from s, ejercicios e where e.nombre = 'HYROX transición simulación' union all
select s.id, e.id, 3, '15', 60, 2 from s, ejercicios e where e.nombre = 'Thrusters';

-- Día 5: Carrera de ritmo + Sled velocidad
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_advanced_id, 'Carrera Ritmo + Sled Velocidad', 'Viernes', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '5km a ritmo de competición', 120, 0 from s, ejercicios e where e.nombre = 'Carrera a ritmo de 10K' union all
select s.id, e.id, 6, '15m sprint ida/vuelta (carga ligera)', 60, 1 from s, ejercicios e where e.nombre = 'Sled push velocidad' union all
select s.id, e.id, 4, '12', 45, 2 from s, ejercicios e where e.nombre = 'Broad jumps' union all
select s.id, e.id, 3, '30s on / 30s off', 30, 3 from s, ejercicios e where e.nombre = 'Saltar la comba';

-- Día 6: HYROX half simulación
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_hyrox_advanced_id, 'HYROX Half Simulación', 'Sábado', 5) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '4km + 4 estaciones HYROX a ritmo de competición (mitad de carrera)', 180, 0 from s, ejercicios e where e.nombre = 'Carrera + SkiErg combinado' union all
select s.id, e.id, 1, 'Estaciones restantes + 4km final', 180, 1 from s, ejercicios e where e.nombre = 'HYROX transición simulación';

-- ══════════════════════════════════════════════════════════════
-- 11. RUNNING — 5K (8 semanas)
-- Basado en Daniels (2014) Formula y Fitzgerald (2021) 80/20 Running
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Running 5K 8 semanas', 'Programa de entrenamiento para 5K basado en Daniels'' Running Formula. Combina carreras fáciles (80% volumen), trabajo de umbral, intervalos VO2max y cuestas. Incluye 3-4 días de carrera + 2 días de fuerza complementaria. Apto para corredores que ya completan 5K.', 'cardio', 8, 'intermedio', 'rendimiento', 4)
returning id into v_run_5k_id;

-- Día 1: Intervalos 400m
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_5k_id, 'Intervalos 400m', 'Martes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '10 min trote suave', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 8, '400m a ritmo 5K con 90s recup trote', 90, 1 from s, ejercicios e where e.nombre = 'Intervalos 400m' union all
select s.id, e.id, 1, '10 min trote suave', 0, 2 from s, ejercicios e where e.nombre = 'Vuelta a la calma' union all
select s.id, e.id, 4, '80m técnica de carrera', 60, 3 from s, ejercicios e where e.nombre = 'Strides';

-- Día 2: Carrera tempo
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_5k_id, 'Carrera Tempo', 'Jueves', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 1, '20 min a ritmo tempo (10K-semi)', 0, 1 from s, ejercicios e where e.nombre = 'Carrera tempo' union all
select s.id, e.id, 1, '10 min trote', 0, 2 from s, ejercicios e where e.nombre = 'Vuelta a la calma' union all
select s.id, e.id, 4, '80m', 60, 3 from s, ejercicios e where e.nombre = 'Strides';

-- Día 3: Carrera fácil + fuerza
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_5k_id, 'Carrera Fácil + Fuerza', 'Sábado', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '30-40 min zona 2', 0, 0 from s, ejercicios e where e.nombre = 'Carrera continua' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '12', 60, 2 from s, ejercicios e where e.nombre = 'Peso muerto rumano' union all
select s.id, e.id, 3, '12', 60, 3 from s, ejercicios e where e.nombre = 'Gemelos de pie' union all
select s.id, e.id, 3, '15', 45, 4 from s, ejercicios e where e.nombre = 'Plancha';

-- Día 4: Carrera larga
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_5k_id, 'Carrera Larga', 'Domingo', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '45-60 min zona 2', 0, 0 from s, ejercicios e where e.nombre = 'Carrera larga' union all
select s.id, e.id, 1, '10 min trote suave', 0, 1 from s, ejercicios e where e.nombre = 'Vuelta a la calma' union all
select s.id, e.id, 1, 'Rutina de estiramientos post-carrera', 0, 2 from s, ejercicios e where e.nombre = 'Estiramiento global';

-- ══════════════════════════════════════════════════════════════
-- 12. RUNNING — 10K (10 semanas)
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Running 10K 10 semanas', 'Programa de 10K con base en Daniels (2014) y 80/20 Running. Mayor volumen semanal que 5K. Incluye intervalos 800m-1.600m, tempo runs, fartlek y carrera larga progresiva. 4-5 días de carrera con trabajo de fuerza.', 'cardio', 10, 'intermedio', 'rendimiento', 5)
returning id into v_run_10k_id;

-- Día 1: Intervalos 800m-1km
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_10k_id, 'Intervalos 800m-1km', 'Martes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 5, '800m a ritmo 5K-10K con 2 min recup', 120, 1 from s, ejercicios e where e.nombre = 'Intervalos 800m' union all
select s.id, e.id, 1, '10 min trote', 0, 2 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 2: Carrera tempo + cuestas
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_10k_id, 'Tempo + Cuestas', 'Miércoles', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 1, '25 min a ritmo tempo (10K-semi)', 0, 1 from s, ejercicios e where e.nombre = 'Carrera tempo' union all
select s.id, e.id, 6, '150m cuesta arriba a tope, trote bajada recup', 90, 2 from s, ejercicios e where e.nombre = 'Cuestas cortas' union all
select s.id, e.id, 1, '10 min trote', 0, 3 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 3: Carrera fácil
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_10k_id, 'Carrera Fácil', 'Jueves', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '40-50 min zona 2', 0, 0 from s, ejercicios e where e.nombre = 'Carrera continua' union all
select s.id, e.id, 4, '80m técnica', 60, 1 from s, ejercicios e where e.nombre = 'Strides';

-- Día 4: Fartlek
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_10k_id, 'Fartlek', 'Viernes', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 1, '30 min fartlek: 2min rápido + 1min lento', 0, 1 from s, ejercicios e where e.nombre = 'Fartlek' union all
select s.id, e.id, 1, '10 min trote', 0, 2 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 5: Carrera larga progresiva
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_10k_id, 'Carrera Larga Progresiva', 'Domingo', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '60-90 min: 30 min zona2 + 30 min tempo + final ritmo 10K', 0, 0 from s, ejercicios e where e.nombre = 'Carrera larga con ritmo' union all
select s.id, e.id, 1, '10 min trote', 0, 1 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- ══════════════════════════════════════════════════════════════
-- 13. RUNNING — MEDIA MARATÓN (12 semanas)
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Running Media Maratón 12 semanas', 'Programa completo para media maratón (21.1K). Basado en Daniels (2014) y Fitzgerald (2021). Mayor volumen semanal (40-60km). Incluye trabajo de umbral, intervalos largos, tempo runs y carrera larga progresiva hasta 18km.', 'cardio', 12, 'avanzado', 'rendimiento', 5)
returning id into v_run_half_id;

-- Día 1: Umbral + intervalos 1.600m
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_half_id, 'Umbral + Intervalos 1600m', 'Martes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 4, '1600m a ritmo 10K con 3 min recup', 180, 1 from s, ejercicios e where e.nombre = 'Intervalos 1.600m' union all
select s.id, e.id, 1, '10 min trote', 0, 2 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 2: Carrera tempo
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_half_id, 'Carrera Tempo', 'Miércoles', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 1, '30-40 min a ritmo tempo (semi-maratón)', 0, 1 from s, ejercicios e where e.nombre = 'Carrera tempo' union all
select s.id, e.id, 1, '10 min trote', 0, 2 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 3: Carrera fácil
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_half_id, 'Carrera Fácil', 'Jueves', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '45-60 min zona 2', 0, 0 from s, ejercicios e where e.nombre = 'Carrera continua' union all
select s.id, e.id, 4, '80m', 60, 1 from s, ejercicios e where e.nombre = 'Strides';

-- Día 4: Fartlek progresivo + cuestas
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_half_id, 'Fartlek + Cuestas', 'Viernes', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 1, '30-40 min fartlek progresivo', 0, 1 from s, ejercicios e where e.nombre = 'Fartlek progresivo' union all
select s.id, e.id, 4, '300m cuesta (ritmo 10K) con trote bajada', 120, 2 from s, ejercicios e where e.nombre = 'Cuestas largas' union all
select s.id, e.id, 1, '10 min trote', 0, 3 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 5: Carrera larga
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_half_id, 'Carrera Larga', 'Domingo', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '75-120 min zona 2 (progresar hasta 18km)', 0, 0 from s, ejercicios e where e.nombre = 'Carrera larga' union all
select s.id, e.id, 1, 'Últimos 20-30 min a ritmo de media maratón', 0, 1 from s, ejercicios e where e.nombre = 'Carrera larga con ritmo' union all
select s.id, e.id, 1, '10 min trote + estiramientos', 0, 2 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- ══════════════════════════════════════════════════════════════
-- 14. RUNNING — MARATÓN (16 semanas)
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Running Maratón 16 semanas', 'Programa completo de maratón (42.2K). Basado en Daniels (2014) y 80/20 Running. Alto volumen semanal (50-80km). Incluye intervalos 1.200m-1.600m, tempo runs, progresiones y carrera larga hasta 32km. Estrategia nutricional y de avituallamiento.', 'cardio', 16, 'avanzado', 'rendimiento', 5)
returning id into v_run_marathon_id;

-- Día 1: Intervalos 1.200m-1.600m
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_marathon_id, 'Intervalos Largos', 'Martes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15-20 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 5, '1200m a ritmo 10K con 3 min recup', 180, 1 from s, ejercicios e where e.nombre = 'Intervalos 1.200m' union all
select s.id, e.id, 1, '10 min trote', 0, 2 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 2: Tempo + cuestas largas
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_marathon_id, 'Tempo + Cuestas Largas', 'Miércoles', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 1, '40 min a ritmo tempo (semi-maratón)', 0, 1 from s, ejercicios e where e.nombre = 'Carrera umbral' union all
select s.id, e.id, 5, '600m cuesta (ritmo 10K) con trote bajada', 120, 2 from s, ejercicios e where e.nombre = 'Cuestas largas' union all
select s.id, e.id, 1, '10 min trote', 0, 3 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 3: Carrera fácil
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_marathon_id, 'Carrera Fácil', 'Jueves', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '40-60 min zona 2', 0, 0 from s, ejercicios e where e.nombre = 'Carrera continua' union all
select s.id, e.id, 5, '80m técnica', 60, 1 from s, ejercicios e where e.nombre = 'Strides';

-- Día 4: Progression run
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_marathon_id, 'Progression Run', 'Viernes', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '60-75 min: empezar zona 2, terminar ritmo maratón', 0, 0 from s, ejercicios e where e.nombre = 'Progression run' union all
select s.id, e.id, 1, '10 min trote', 0, 1 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 5: Carrera larga (clave del programa)
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_run_marathon_id, 'Carrera Larga Clave', 'Domingo', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '2h-3h progresivo: zona2 hasta 25km, luego ritmo maratón últimos 5-7km', 0, 0 from s, ejercicios e where e.nombre = 'Carrera larga con ritmo' union all
select s.id, e.id, 1, '15 min trote + estiramientos completos', 0, 1 from s, ejercicios e where e.nombre = 'Estiramiento global';

-- ══════════════════════════════════════════════════════════════
-- 15. CICLISMO — BASE (8 semanas)
-- Basado en Coggan & Allen (2023), Carmichael (2021)
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Ciclismo Base 8 semanas', 'Programa de base aeróbica para ciclistas. Construcción de volumen con trabajo zona 2, sweet spot y técnica de pedaleo. Ideal para ciclistas de carretera, MTB o gravel. 4-5 días de rodillo + 2 días de fuerza complementaria. Basado en Coggan & Allen (2023).', 'cardio', 8, 'intermedio', 'rendimiento', 4)
returning id into v_cycle_base_id;

-- Día 1: Rodillo base
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_base_id, 'Rodillo Base Z2', 'Martes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '60-90 min zona 2, 85-95 rpm', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo base' union all
select s.id, e.id, 1, '5 min cadencia drills (110-130 rpm) al final', 0, 1 from s, ejercicios e where e.nombre = 'Cadencia drills';

-- Día 2: Sweet spot
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_base_id, 'Sweet Spot', 'Miércoles', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min rodillo suave', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo recuperación' union all
select s.id, e.id, 3, '10 min a 88-93% FTP con 5 min recup', 300, 1 from s, ejercicios e where e.nombre = 'Sweet spot training' union all
select s.id, e.id, 1, '10 min rodillo suave', 0, 2 from s, ejercicios e where e.nombre = 'Rodillo recuperación';

-- Día 3: Fuerza gimnasio
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_base_id, 'Fuerza Gimnasio', 'Jueves', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '8-10', 120, 0 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Peso muerto rumano' union all
select s.id, e.id, 3, '12', 60, 2 from s, ejercicios e where e.nombre = 'Gemelos de pie' union all
select s.id, e.id, 3, '12', 60, 3 from s, ejercicios e where e.nombre = 'Caminata del granjero' union all
select s.id, e.id, 3, '15', 60, 4 from s, ejercicios e where e.nombre = 'Plancha';

-- Día 4: Rodillo tempo + técnica
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_base_id, 'Tempo + Técnica', 'Viernes', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min rodillo suave', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo recuperación' union all
select s.id, e.id, 1, '30 min a ritmo tempo (zona 3)', 0, 1 from s, ejercicios e where e.nombre = 'Rodillo tempo' union all
select s.id, e.id, 1, '10 min pedaleo una pierna (5 min cada pierna)', 0, 2 from s, ejercicios e where e.nombre = 'Pedaleo a una pierna' union all
select s.id, e.id, 1, '10 min rodillo suave', 0, 3 from s, ejercicios e where e.nombre = 'Rodillo recuperación';

-- ══════════════════════════════════════════════════════════════
-- 16. CICLISMO — INTERVALOS (8 semanas)
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Ciclismo Intervalos FTP 8 semanas', 'Programa centrado en elevar el FTP mediante trabajo de intervalos. Basado en Coggan (2023). Incluye sobre-under, intervalos VO2max, tempo y contrarreloj. 5 días de rodillo + fuerza específica. Ideal para ciclistas que quieren mejorar su potencia.', 'cardio', 8, 'avanzado', 'rendimiento', 5)
returning id into v_cycle_intervals_id;

-- Día 1: Sobre-under FTP
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_intervals_id, 'Sobre-Under FTP', 'Martes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '20 min rodillo suave', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo recuperación' union all
select s.id, e.id, 3, '8 min: 3 min 105% FTP + 2 min 95% FTP + 3 min 105% FTP, 4 min recup entre series', 240, 1 from s, ejercicios e where e.nombre = 'Intervalos sobre-under' union all
select s.id, e.id, 1, '15 min rodillo suave', 0, 2 from s, ejercicios e where e.nombre = 'Rodillo recuperación';

-- Día 2: VO2max
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_intervals_id, 'VO2max', 'Miércoles', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '20 min rodillo suave', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo recuperación' union all
select s.id, e.id, 5, '4 min 110-120% FTP con 3 min recup entre series', 180, 1 from s, ejercicios e where e.nombre = 'Intervalos cortos (VO2max)' union all
select s.id, e.id, 1, '15 min rodillo suave', 0, 2 from s, ejercicios e where e.nombre = 'Rodillo recuperación';

-- Día 3: Recuperación activa
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_intervals_id, 'Recuperación Activa', 'Jueves', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '40 min rodillo suave zona 1-2', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo recuperación' union all
select s.id, e.id, 1, 'Rutina completa de movilidad', 0, 1 from s, ejercicios e where e.nombre = 'Mobility warm-up';

-- Día 4: Tempo + fuerza
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_intervals_id, 'Tempo + Fuerza', 'Viernes', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '60 min: 20 min suave + 30 min tempo zona 3 + 10 min suave', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo tempo' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '10-12', 90, 2 from s, ejercicios e where e.nombre = 'Peso muerto rumano' union all
select s.id, e.id, 3, '12', 60, 3 from s, ejercicios e where e.nombre = 'Gemelos de pie';

-- Día 5: Contrarreloj simulación
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_intervals_id, 'Contrarreloj', 'Sábado', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '20 min rodillo suave + drills de cadencia', 0, 0 from s, ejercicios e where e.nombre = 'Cadencia drills' union all
select s.id, e.id, 1, '20 min a 100% FTP (simulación contrarreloj)', 0, 1 from s, ejercicios e where e.nombre = 'Contrarreloj simulación' union all
select s.id, e.id, 1, '15 min rodillo suave', 0, 2 from s, ejercicios e where e.nombre = 'Rodillo recuperación';

-- ══════════════════════════════════════════════════════════════
-- 17. CICLISMO — RESISTENCIA / GRAN FONDO (10 semanas)
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Ciclismo Resistencia 10 semanas', 'Programa de larga distancia para ciclistas de fondo, gran fondo o cicloturistas. Construcción de volumen aeróbico hasta 5-6h. Incluye trabajo de fuerza-resistencia, sweet spot y nutrición en ruta. Basado en Carmichael (2021).', 'cardio', 10, 'avanzado', 'rendimiento', 4)
returning id into v_cycle_endurance_id;

-- Día 1: Fuerza-resistencia
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_endurance_id, 'Fuerza-Resistencia', 'Martes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '20 min rodillo suave', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo recuperación' union all
select s.id, e.id, 4, '8 min a baja cadencia (50-60 rpm) zona 3-4, con 4 min recup', 240, 1 from s, ejercicios e where e.nombre = 'Fuerza-resistencia' union all
select s.id, e.id, 1, '15 min rodillo suave', 0, 2 from s, ejercicios e where e.nombre = 'Rodillo recuperación';

-- Día 2: Sweet spot largo
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_endurance_id, 'Sweet Spot Largo', 'Miércoles', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '20 min rodillo suave', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo recuperación' union all
select s.id, e.id, 3, '12-15 min 90% FTP con 5 min recup', 300, 1 from s, ejercicios e where e.nombre = 'Sweet spot training' union all
select s.id, e.id, 1, '15 min rodillo suave', 0, 2 from s, ejercicios e where e.nombre = 'Rodillo recuperación';

-- Día 3: Fuerza gimnasio + core
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_endurance_id, 'Fuerza + Core', 'Jueves', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '8-10', 120, 0 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '10', 90, 1 from s, ejercicios e where e.nombre = 'Peso muerto' union all
select s.id, e.id, 3, '12', 60, 2 from s, ejercicios e where e.nombre = 'Caminata del granjero' union all
select s.id, e.id, 3, '15', 45, 3 from s, ejercicios e where e.nombre = 'Plancha lateral' union all
select s.id, e.id, 3, '12', 45, 4 from s, ejercicios e where e.nombre = 'Pallof press';

-- Día 4: Rodillo base largo
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_cycle_endurance_id, 'Rodillo Base Largo', 'Sábado', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '2-3h zona 2 a 85-95 rpm constante', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo base' union all
select s.id, e.id, 1, 'Últimos 20 min a ritmo tempo (zona 3)', 0, 1 from s, ejercicios e where e.nombre = 'Rodillo tempo';

-- ══════════════════════════════════════════════════════════════
-- 18. TRIATLÓN — SPRINT (8 semanas)
-- Basado en Friel (2021) Triathlete's Training Bible
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Triatlón Sprint 8 semanas', 'Programa de iniciación al triatlón distancia Sprint (750m natación + 20km bici + 5km carrera). Basado en Friel (2021). Incluye 3 sesiones de natación, 2 de bici, 2 de carrera y 1 brick (bici+carrera). Ideal para debutantes o para bajar marcas personales.', 'mixto', 8, 'intermedio', 'rendimiento', 6)
returning id into v_tri_sprint_id;

-- Día 1: Natación técnica
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_sprint_id, 'Natación Técnica', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '200m calentamiento + drills técnica', 30, 0 from s, ejercicios e where e.nombre = 'Natación crol técnica' union all
select s.id, e.id, 6, '50m a ritmo con 20s recup', 20, 1 from s, ejercicios e where e.nombre = 'Series de crol 50m' union all
select s.id, e.id, 4, '100m a ritmo con 30s recup', 30, 2 from s, ejercicios e where e.nombre = 'Series de crol 100m' union all
select s.id, e.id, 1, '200m vuelta a la calma', 0, 3 from s, ejercicios e where e.nombre = 'Natación crol';

-- Día 2: Rodillo intervalos
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_sprint_id, 'Bici Intervalos', 'Martes', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min rodillo suave', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo recuperación' union all
select s.id, e.id, 5, '3 min a 105-110% FTP + 2 min suave', 120, 1 from s, ejercicios e where e.nombre = 'Intervalos sobre-under' union all
select s.id, e.id, 1, '10 min rodillo suave', 0, 2 from s, ejercicios e where e.nombre = 'Rodillo recuperación';

-- Día 3: Carrera tempo
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_sprint_id, 'Carrera Tempo', 'Miércoles', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 1, '20-25 min a ritmo tempo', 0, 1 from s, ejercicios e where e.nombre = 'Carrera tempo' union all
select s.id, e.id, 1, '10 min trote', 0, 2 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 4: Natación serie principal
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_sprint_id, 'Natación Series', 'Jueves', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '300m calentamiento progresivo', 30, 0 from s, ejercicios e where e.nombre = 'Natación crol' union all
select s.id, e.id, 1, '8x50m a ritmo con 15s recup', 15, 1 from s, ejercicios e where e.nombre = 'Series de crol 50m' union all
select s.id, e.id, 1, '4x100m a ritmo sprint con 30s recup', 30, 2 from s, ejercicios e where e.nombre = 'Series de crol 100m' union all
select s.id, e.id, 1, '200m pull buoy técnica', 0, 3 from s, ejercicios e where e.nombre = 'Pull buoy';

-- Día 5: Brick (bici + carrera)
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_sprint_id, 'Brick Bici + Carrera', 'Viernes', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '30 min rodillo tempo', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo tempo' union all
select s.id, e.id, 1, 'Transición rápida + 15 min trote a ritmo 5K', 0, 1 from s, ejercicios e where e.nombre = 'Carrera a ritmo de 5K';

-- Día 6: Carrera larga
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_sprint_id, 'Carrera Larga', 'Sábado', 5) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '45-60 min carrera continua zona 2', 0, 0 from s, ejercicios e where e.nombre = 'Carrera continua' union all
select s.id, e.id, 4, '80m técnica', 60, 1 from s, ejercicios e where e.nombre = 'Strides';

-- ══════════════════════════════════════════════════════════════
-- 19. TRIATLÓN — OLÍMPICO (12 semanas)
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Triatlón Olímpico 12 semanas', 'Programa para distancia olímpica (1.5km natación + 40km bici + 10km carrera). Basado en Friel (2021). Mayor volumen que sprint. Incluye bricks semanales, natación en aguas abiertas simulada y trabajo específico de transiciones. Contenido: 3 natación, 2-3 bici, 2-3 carrera/semana.', 'mixto', 12, 'avanzado', 'rendimiento', 7)
returning id into v_tri_olympic_id;

-- Día 1: Natación umbral
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_olympic_id, 'Natación Umbral', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '400m calentamiento progresivo', 30, 0 from s, ejercicios e where e.nombre = 'Natación crol' union all
select s.id, e.id, 4, '200m a ritmo olímpico con 45s recup', 45, 1 from s, ejercicios e where e.nombre = 'Series de crol 200m' union all
select s.id, e.id, 8, '50m a tope con 20s recup', 20, 2 from s, ejercicios e where e.nombre = 'Series de crol 50m' union all
select s.id, e.id, 1, '400m pull buoy + drills técnica', 0, 3 from s, ejercicios e where e.nombre = 'Pull buoy';

-- Día 2: Bici FTP
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_olympic_id, 'Bici FTP', 'Martes', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '20 min rodillo suave', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo base' union all
select s.id, e.id, 3, '8-10 min a 100% FTP con 5 min recup', 300, 1 from s, ejercicios e where e.nombre = 'Intervalos largos (FTP)' union all
select s.id, e.id, 1, '15 min rodillo suave', 0, 2 from s, ejercicios e where e.nombre = 'Rodillo recuperación';

-- Día 3: Carrera umbral
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_olympic_id, 'Carrera Umbral', 'Miércoles', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 3, '5 min a ritmo 10K con 2 min recup trote', 120, 1 from s, ejercicios e where e.nombre = 'Carrera umbral' union all
select s.id, e.id, 1, '10 min trote', 0, 2 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 4: Natación aguas abiertas
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_olympic_id, 'Natación Aguas Abiertas', 'Jueves', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '400m calentamiento + drills avistamiento', 30, 0 from s, ejercicios e where e.nombre = 'Natación crol técnica' union all
select s.id, e.id, 1, '1000m continuo a ritmo de competición', 0, 1 from s, ejercicios e where e.nombre = 'Natación a ritmo de competición' union all
select s.id, e.id, 1, '300m drills de avistamiento y respiración bilateral', 30, 2 from s, ejercicios e where e.nombre = 'Sighting drills' union all
select s.id, e.id, 1, '100m vuelta a la calma', 0, 3 from s, ejercicios e where e.nombre = 'Natación crol';

-- Día 5: Brick largo
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_olympic_id, 'Brick Largo', 'Viernes', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '45-60 min bici a ritmo tempo', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo tempo' union all
select s.id, e.id, 1, 'Transición rápida + 20 min a ritmo 10K', 0, 1 from s, ejercicios e where e.nombre = 'Carrera a ritmo de 10K';

-- Día 6: Carrera larga
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_olympic_id, 'Carrera Larga', 'Sábado', 5) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '60-90 min carrera continua zona 2', 0, 0 from s, ejercicios e where e.nombre = 'Carrera larga' union all
select s.id, e.id, 4, '80m', 60, 1 from s, ejercicios e where e.nombre = 'Strides';

-- Día 7: Natación recuperación
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_olympic_id, 'Natación Recuperación', 'Domingo', 6) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '500m suave + drills de respiración y técnica', 30, 0 from s, ejercicios e where e.nombre = 'Natación crol técnica' union all
select s.id, e.id, 1, '300m pull buoy', 0, 1 from s, ejercicios e where e.nombre = 'Pull buoy' union all
select s.id, e.id, 1, 'Rutina de estiramientos completa', 0, 2 from s, ejercicios e where e.nombre = 'Estiramiento global';

-- ══════════════════════════════════════════════════════════════
-- 20. TRIATLÓN — MEDIO IRONMAN (16 semanas)
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Triatlón Medio Ironman 16 semanas', 'Programa para 70.3 (1.9km natación + 90km bici + 21.1km carrera). Basado en Friel (2021). Alto volumen con énfasis en resistencia aeróbica. Incluye bricks largos, natación en aguas abiertas, rodillos de 2-3h y carreras largas de 15-18km. 8-9 sesiones/semana.', 'mixto', 16, 'avanzado', 'rendimiento', 8)
returning id into v_tri_half_id;

-- Día 1: Natación volumen
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_half_id, 'Natación Volumen', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '500m calentamiento + drills', 30, 0 from s, ejercicios e where e.nombre = 'Natación crol técnica' union all
select s.id, e.id, 3, '400m a ritmo 70.3 con 45s recup', 45, 1 from s, ejercicios e where e.nombre = 'Series de crol 400m' union all
select s.id, e.id, 4, '200m a ritmo con 30s recup', 30, 2 from s, ejercicios e where e.nombre = 'Series de crol 200m' union all
select s.id, e.id, 1, '500m vuelta a la calma + pull buoy', 0, 3 from s, ejercicios e where e.nombre = 'Pull buoy';

-- Día 2: Rodillo largo + tempo
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_half_id, 'Rodillo Largo + Tempo', 'Martes', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '60-90 min: 30 min suave + 30 min tempo + 30 min suave', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo tempo' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '12', 60, 2 from s, ejercicios e where e.nombre = 'Gemelos de pie';

-- Día 3: Carrera umbral + cuestas
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_half_id, 'Carrera Umbral + Cuestas', 'Miércoles', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 3, '8 min a ritmo semi con 3 min recup', 180, 1 from s, ejercicios e where e.nombre = 'Carrera umbral' union all
select s.id, e.id, 5, '300m cuesta (ritmo 10K) con trote bajada', 90, 2 from s, ejercicios e where e.nombre = 'Cuestas largas' union all
select s.id, e.id, 1, '10 min trote', 0, 3 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 4: Natación técnica + series
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_half_id, 'Natación Técnica + Series', 'Jueves', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '400m calentamiento + drills respiración bilateral', 30, 0 from s, ejercicios e where e.nombre = 'Bilateral breathing drills' union all
select s.id, e.id, 1, '6x100m a ritmo con 20s recup', 20, 1 from s, ejercicios e where e.nombre = 'Series de crol 100m' union all
select s.id, e.id, 1, '3x200m a ritmo 70.3 con 30s recup', 30, 2 from s, ejercicios e where e.nombre = 'Series de crol 200m' union all
select s.id, e.id, 1, '500m pull buoy + drills de codo alto', 0, 3 from s, ejercicios e where e.nombre = 'Drill de codo alto';

-- Día 5: Brick bici + carrera
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_half_id, 'Brick Medio', 'Viernes', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '75-90 min bici: 45 min zona2 + 30 min tempo', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo tempo' union all
select s.id, e.id, 1, '25-30 min trote a ritmo semi', 0, 1 from s, ejercicios e where e.nombre = 'Carrera a ritmo de media maratón';

-- Día 6: Natación recuperación
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_half_id, 'Natación Recuperación', 'Sábado', 5) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '1000m suave con pull buoy y drills', 0, 0 from s, ejercicios e where e.nombre = 'Natación crol' union all
select s.id, e.id, 1, 'Rutina de estiramientos', 0, 1 from s, ejercicios e where e.nombre = 'Estiramiento global';

-- Día 7: Carrera larga
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_half_id, 'Carrera Larga', 'Domingo', 6) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '90-120 min progresivo: zona2 hasta 12km, luego ritmo semi últimos 3-5km', 0, 0 from s, ejercicios e where e.nombre = 'Carrera larga con ritmo' union all
select s.id, e.id, 1, '10 min trote + estiramientos', 0, 1 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 8: Rodillo base
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_half_id, 'Rodillo Base', 'Domingo', 7) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '60 min rodillo base zona 2 (segunda sesión del domingo)', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo base';

-- ══════════════════════════════════════════════════════════════
-- 21. TRIATLÓN — IRONMAN (20 semanas)
-- ══════════════════════════════════════════════════════════════
insert into public.plantillas_entrenamiento (coach_id, nombre, descripcion, tipo, duracion_semanas, nivel, objetivo, dias_por_semana)
values (v_coach_id, 'Triatlón Ironman 20 semanas', 'Programa completo para distancia Ironman (3.8km natación + 180km bici + 42.2km carrera). Basado en Friel (2021). Máximo volumen: 10-12 sesiones/semana. Incluye bricks de 4-5h, natación de 3-4km, rodillos de 4-5h y carreras largas de 30km. Periodización por bloques de 4 semanas.', 'mixto', 20, 'avanzado', 'rendimiento', 10)
returning id into v_tri_full_id;

-- Día 1: Natación larga
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_full_id, 'Natación Larga', 'Lunes', 0) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '600m calentamiento + drills avistamiento y respiración bilateral', 30, 0 from s, ejercicios e where e.nombre = 'Natación crol técnica' union all
select s.id, e.id, 1, '2x800m a ritmo IM con 60s recup', 60, 1 from s, ejercicios e where e.nombre = 'Series de crol 400m' union all
select s.id, e.id, 1, '4x200m a ritmo con 30s recup', 30, 2 from s, ejercicios e where e.nombre = 'Series de crol 200m' union all
select s.id, e.id, 1, '600m pull buoy + drills técnica', 0, 3 from s, ejercicios e where e.nombre = 'Pull buoy';

-- Día 2: Rodillo base + tempo (doble sesión)
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_full_id, 'Rodillo Base + Tempo AM', 'Martes', 1) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '45 min rodillo base zona 2 (sesión matinal)', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo base';

-- Día 2b: Fuerza + core
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_full_id, 'Fuerza Gimnasio PM', 'Martes', 2) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 4, '8-10', 120, 0 from s, ejercicios e where e.nombre = 'Sentadilla con barra' union all
select s.id, e.id, 3, '10-12', 90, 1 from s, ejercicios e where e.nombre = 'Peso muerto rumano' union all
select s.id, e.id, 3, '12', 60, 2 from s, ejercicios e where e.nombre = 'Gemelos de pie' union all
select s.id, e.id, 3, '15', 45, 3 from s, ejercicios e where e.nombre = 'Plancha' union all
select s.id, e.id, 3, '12', 45, 4 from s, ejercicios e where e.nombre = 'Pallof press';

-- Día 3: Carrera umbral + bici tempo
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_full_id, 'Carrera Umbral AM', 'Miércoles', 3) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '15 min trote', 0, 0 from s, ejercicios e where e.nombre = 'Trote de calentamiento' union all
select s.id, e.id, 3, '10 min a ritmo semi con 3 min recup', 180, 1 from s, ejercicios e where e.nombre = 'Carrera umbral' union all
select s.id, e.id, 1, '10 min trote', 0, 2 from s, ejercicios e where e.nombre = 'Vuelta a la calma';

-- Día 3b: Rodillo tempo
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_full_id, 'Rodillo Tempo PM', 'Miércoles', 4) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '60 min: 15 min suave + 30 min tempo + 15 min suave', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo tempo';

-- Día 4: Natación técnica
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_full_id, 'Natación Técnica', 'Jueves', 5) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '500m calentamiento + drills', 30, 0 from s, ejercicios e where e.nombre = 'Natación crol técnica' union all
select s.id, e.id, 1, '5x200m a ritmo IM con 30s recup', 30, 1 from s, ejercicios e where e.nombre = 'Series de crol 200m' union all
select s.id, e.id, 1, '4x100m a ritmo con 20s recup', 20, 2 from s, ejercicios e where e.nombre = 'Series de crol 100m' union all
select s.id, e.id, 1, '400m patada con tabla', 0, 3 from s, ejercicios e where e.nombre = 'Patada con tabla';

-- Día 5: Brick largo (clave de la semana)
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_full_id, 'Brick Largo Clave', 'Sábado', 6) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '3-5h bici: 2h zona2 + 1h tempo + final zona2', 0, 0 from s, ejercicios e where e.nombre = 'Rodillo base' union all
select s.id, e.id, 1, 'Transición rápida + 30-60 min trote a ritmo maratón', 0, 1 from s, ejercicios e where e.nombre = 'Carrera a ritmo de media maratón';

-- Día 6: Carrera larga
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_full_id, 'Carrera Larga', 'Domingo', 7) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '2h-3h progresivo: zona2 hasta 25km, luego ritmo maratón últimos 5-7km', 0, 0 from s, ejercicios e where e.nombre = 'Carrera larga con ritmo' union all
select s.id, e.id, 1, '15 min trote + estiramientos completos', 0, 1 from s, ejercicios e where e.nombre = 'Estiramiento global';

-- Día 7: Recuperación activa
with s as (
  insert into public.plantilla_sesiones (plantilla_id, nombre, dia_semana, orden) values (v_tri_full_id, 'Recuperación Activa', 'Domingo', 8) returning id
)
insert into public.plantilla_sesion_ejercicios (sesion_id, ejercicio_id, series, repeticiones, descanso_segundos, orden)
select s.id, e.id, 1, '30-45 min natación suave + estiramientos', 0, 0 from s, ejercicios e where e.nombre = 'Natación crol' union all
select s.id, e.id, 1, 'Rutina completa de movilidad y foam rolling', 0, 1 from s, ejercicios e where e.nombre = 'Mobility warm-up';

-- ══════════════════════════════════════════════════════════════
-- PROGRESIÓN SEMANAL Y NOTAS DE INDIVIDUALIZACIÓN
-- Plantillas Deportivas (HYROX, Running, Ciclismo, Triatlón)
-- Basadas en: Contreras(2023), Daniels(2014), Fitzgerald(2021),
--             Coggan&Allen(2023), Friel(2021)
-- ══════════════════════════════════════════════════════════════

-- 8. HYROX PRINCIPIANTE — 8 semanas
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Familiarización HYROX", "descripcion": "Conocer las 8 estaciones. Ritmo suave (60-70% esfuerzo). Sesiones de 40 min. RPE 5-6/10", "ajustes": ["Cargas ligeras en sled: 50% del peso de competición", "Wall balls con balón de 4kg en lugar de 6kg", "Carreras de 1km máximo", "Si fatiga excesiva, saltar 1 estación"]},
  {"semana": 2, "titulo": "Base funcional", "descripcion": "Volumen semanal ~4h. Ritmo 65-75%. Sesiones de 45 min. RPE 6-7/10", "ajustes": ["Aumentar carga sled al 70%", "Añadir 1 ronda extra en estaciones", "Técnica de burpee broad jump: aterrizar suave", "Evaluar dolor en hombros en wall balls"]},
  {"semana": 3, "titulo": "Construcción aeróbica", "descripcion": "Volumen ~5h. Transiciones más rápidas (<60s). RPE 7/10", "ajustes": ["Distancia carrera: aumentar a 1.5-2km por sesión", "Sled push/pull: aumentar 5kg si técnica correcta", "Práctica de transiciones entre ejercicios", "Si dolor lumbar en sandbag lunges, reducir profundidad"]},
  {"semana": 4, "titulo": "Resistencia específica", "descripcion": "Volumen ~5.5h. Simulaciones de 3-4 estaciones seguidas. RPE 7-8/10", "ajustes": ["Series de 3-4 ejercicios sin descanso entre ellas", "Wall balls: subir a 6kg si técnica lo permite", "Farmer''s carry: 20kg en cada mano", "Registrar tiempos para tracking"]},
  {"semana": 5, "titulo": "Descarga activa", "descripcion": "Reducción a 60% volumen (~3.5h). RPE 4-5/10", "ajustes": ["Cargas al 60% del máximo alcanzado", "Enfocar en técnica: burpees, wall balls, sled pull", "Añadir movilidad articular completa", "Evaluar recuperación (sueño, apetito, energía)"]},
  {"semana": 6, "titulo": "Subida de intensidad", "descripcion": "Volumen ~5h. 75-85% intensidad. RPE 8/10", "ajustes": ["Cargas de competición en todas las estaciones", "Transiciones < 45s entre ejercicios", "Probar ritmo de 1km objetivo HYROX", "Introducir respiración controlada en burpees"]},
  {"semana": 7, "titulo": "Simulación HYROX", "descripcion": "Simulación completa de 3-4 estaciones + 1km. RPE 8-9/10", "ajustes": ["Simular HYROX real: 1km + 1 estación x 4 rondas", "Ritmo objetivo: 75-80% del esfuerzo máximo en cada estación", "No parar entre rondas (transición activa)", "Registrar tiempo total de simulacro"]},
  {"semana": 8, "titulo": "Test + Taper", "descripcion": "Semana de testeo. Lunes: test de 1km + 4 estaciones. Jueves: simulación completa si hay energía. Viernes-Domingo: descanso completo", "ajustes": ["Test de 1km a ritmo máximo", "Comparar tiempos con semana 1", "Últimos 3 días: descanso completo + alimentación alta en carbohidratos", "Preparar estrategia de carrera (respiración, hidratación)"]}
]', descripcion = 'Programa de introducción al HYROX para principiantes. Combina preparación cardiovascular con las 8 estaciones de HYROX. Sesiones de 45-60 min. Progresión gradual de volumen e intensidad. 🎯 INDIVIDUALIZACIÓN BASADA EN CONTRERAS (2023): Para atletas con experiencia previa en CrossFit, la fase de familiarización se puede acortar a 2 semanas. Para aquellos sin experiencia en levantamiento olímpico, priorizar técnica de wall balls y burpee broad jumps sobre la carga. Si el atleta tiene lesión previa de hombro, evitar wall balls y sustituir por med ball slams. El ratio corredor vs funcional debe ajustarse según perfil: atletas con base de running (>20km/semana) necesitan más trabajo de estaciones; atletas de fuerza (>1.5x peso muerto) necesitan más carrera. Para atletas con >25% grasa corporal, añadir 1 sesión extra de cardio semanal para mejorar eficiencia aeróbica.'
where id = v_hyrox_beginner_id;

-- 9. HYROX INTERMEDIO — 8 semanas
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Reevaluación técnica", "descripcion": "Volumen ~5h. Confirmar técnica en cargas medias. RPE 6/10", "ajustes": ["Cargas al 70% del máximo de competición", "Evaluar puntos débiles: carrera, fuerza, técnica", "Si dolor en muñeca en burpees, usar push-up paralelas"]},
  {"semana": 2, "titulo": "Volumen funcional", "descripcion": "Volumen ~6h. Series de 4-5 estaciones. RPE 7/10", "ajustes": ["Cargas al 75-80%", "Añadir transiciones cronometradas", "Práctica de sled push/pull en distintos terrenos", "Si fatiga en antebrazos en farmer''s carry, alternar agarre"]},
  {"semana": 3, "titulo": "Ritmo de competición", "descripcion": "Volumen ~6.5h. 80% intensidad. RPE 7-8/10", "ajustes": ["Cargas de competición en estaciones clave", "Ritmo de 1km entre 4:30-5:00 min/km", "Transiciones < 45s", "Estrategia de pacing: empezar al 75%, terminar al 85%"]},
  {"semana": 4, "titulo": "Simulación completa", "descripcion": "Simulación de 4km + 4 estaciones alternadas. RPE 8-9/10", "ajustes": ["Simular mitad de HYROX: 4km alternando con 4 estaciones", "Registrar split times por estación", "Si glucógeno bajo, tomar gel isotónico entre estaciones", "Ajustar pacing basado en ritmo cardíaco"]},
  {"semana": 5, "titulo": "Descarga", "descripcion": "Reducción 50% (~3h). RPE 4/10", "ajustes": ["Cargas ligeras, mantener técnica", "Movilidad post-sesión extendida (20 min)", "Evaluar recuperación y puntos débiles", "Planificar microciclo 2 (semanas 6-8)"]},
  {"semana": 6, "titulo": "Pico de volumen", "descripcion": "Volumen ~7h. Alta frecuencia de estaciones. RPE 8/10", "ajustes": ["Cargas ligeramente superiores a competición", "Trabajo de resistencia anaeróbica (series cortas-intensas)", "Práctica de burpees y wall balls en estado de fatiga", "Transiciones < 30s"]},
  {"semana": 7, "titulo": "Taper de intensidad", "descripcion": "Reducción a 4h pero máxima intensidad (90-95%). RPE 9/10", "ajustes": ["Cargas de competición al 100%", "Simulacro de 5 estaciones seguidas + 1km", "Preparación mental y visualización", "Última sesión intensa: jueves, luego descanso"]},
  {"semana": 8, "titulo": "Competición", "descripcion": "Taper completo. Test de 1km + estaciones suave. RPE 2-3/10 hasta competición", "ajustes": ["Lunes: test de 1km a ritmo objetivo", "Miércoles: estaciones suaves (50%) para mantener activación", "Viernes: descanso completo", "Sábado/Domingo: COMPETICIÓN HYROX"]}
]', descripcion = 'Programa HYROX para intermedios con experiencia en fitness funcional. Simulación completa de estaciones HYROX a ritmo creciente. Sesiones de 60-75 min. Incluye trabajo de transiciones y ritmo de competición. 🎯 INDIVIDUALIZACIÓN: Si el atleta compite en HYROX Pro (pesos más pesados), ajustar cargas: sled push 150% de la carga estándar, wall balls con balón de 9kg. Si tiene baja capacidad aeróbica (VO2max < 40), añadir 2 sesiones de carrera continua en zona 2. Para mantener masa muscular durante el programa, asegurar proteína >1.8g/kg y 1 sesión de fuerza complementaria. Si es un ex-levantador olímpico, reducir el volumen de sentadillas y priorizar resistencia aeróbica y transiciones.'
where id = v_hyrox_intermediate_id;

-- 10. HYROX AVANZADO — 8 semanas
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Diagnóstico de alto rendimiento", "descripcion": "Evaluación completa: test de 1km, 100 wall balls, sled 100m, burpee broad jumps 50. RPE 7/10", "ajustes": ["Establecer líneas base en cada estación", "Identificar estación más débil para priorizar", "Si hay desequilibrio >20% entre estaciones, ajustar carga de entrenamiento"]},
  {"semana": 2, "titulo": "Volumen elite", "descripcion": "Volumen ~8h. Cargas al 85% de competición. RPE 7-8/10", "ajustes": ["Doble sesión 2 días/semana (mañana cardio+técnica, tarde fuerza)", "Trabajo de transiciones al fallo", "Si fatiga del SNC elevada, reducir 1 sesión de fuerza"]},
  {"semana": 3, "titulo": "Ritmo HYROX Pro", "descripcion": "Volumen ~8.5h. 85-90% intensidad. RPE 8/10", "ajustes": ["Simular ritmo de HYROX Pro: 1km en 3:45-4:00", "Estaciones al 90% del máximo", "Transiciones < 25s", "Suplementación: beta-alanina 3g/día, cafeína pre-entreno"]},
  {"semana": 4, "titulo": "Simulación completa", "descripcion": "Simulación de 8km + 8 estaciones (HYROX completo). RPE 9-10/10", "ajustes": ["Simular HYROX completo midiendo split times", "Ajustar pacing basado en FC (no superar 92% FC máx)", "Práctica de avituallamiento líquido entre estaciones", "Si no completa la simulación, ajustar expectativas"]},
  {"semana": 5, "titulo": "Descarga activa", "descripcion": "Reducción 50% (~4h). RPE 4-5/10", "ajustes": ["Mantener técnica con cargas ligeras", "Evaluación de split times y planificación de semanas 6-8", "Recuperación activa: natación o bicicleta suave", "Revisar estrategia nutricional (carga de carbohidratos)"]},
  {"semana": 6, "titulo": "Pico de intensidad", "descripcion": "Volumen ~7h pero 95% intensidad. RPE 9/10", "ajustes": ["Máxima intensidad en todas las estaciones", "Simular condiciones de competición (misma hora del día)", "Transiciones al límite (<20s)", "Psicología deportiva: visualización y autodiálogo positivo"]},
  {"semana": 7, "titulo": "Taper competición", "descripcion": "Reducción progresiva: 3h lunes-miércoles, descanso jueves-domingo", "ajustes": ["Lunes: 3 estaciones al 80% para mantener activación", "Martes: test de 1km a ritmo objetivo", "Miércoles: técnica y movilidad, 0 intensidad", "Jueves a competición: descanso completo + carga carbohidratos"]},
  {"semana": 8, "titulo": "COMPETICIÓN HYROX", "descripcion": "Semana de competición. Calentamiento específico 20 min antes. Ejecutar plan de carrera establecido", "ajustes": ["Calentamiento: 10 min trote + 3 estaciones suaves + 3 sprints", "Plan de carrera: empezar al 75%, mantener 80-85% hasta km6, crear 5-7% final", "Avituallamiento: gel en cada km2 en zona de transición", "Post-competición: recuperación activa 24h después"]}
]', descripcion = 'Programa HYROX de competición para avanzados. Sesiones de 75-90 min. Simulación completa de carrera HYROX (8km + 8 estaciones). Trabajo específico de ritmo de competición, transiciones y estaciones al fallo. 🎯 INDIVIDUALIZACIÓN: Para atletas que compiten en HYROX Elite (pesos máximos), las cargas deben ser: sled push 200kg, wall balls 9kg, farmer''s carry 32kg cada mano. Si el atleta tiene alta capacidad de fuerza (>2x peso muerto) pero baja capacidad aeróbica (<45 VO2max), redistribuir volumen: 60% carrera, 20% estaciones, 20% fuerza. Para atletas con tendencia a sobreentrenamiento, monitorear HRV diariamente y si <20ms respecto a línea base, reemplazar sesión intensa por recuperación activa. Periodización en bloques: 2 semanas carga, 1 descarga, 2 carga, 1 descarga, taper.'
where id = v_hyrox_advanced_id;

-- 11-14. RUNNING — Progresión por distancia (Daniels VDOT + Fitzgerald 80/20)
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Establecer VDOT y zona 2", "descripcion": "Test de referencia: corre 1 milla (1.6km) al máximo. Calcular VDOT. 20 km/semana. 80% zona 2, 20% intenso. RPE 5-6/10", "ajustes": ["Calcular VDOT usando tabla de Daniels", "Establecer paces: fácil, tempo, intervalos I/R basados en VDOT", "Si no se puede mantener conversación, ir más lento", "Correr en superficie blanda si histórico de lesiones"]},
  {"semana": 2, "titulo": "Base aeróbica", "descripcion": "22 km/semana. Introducir 1 sesión de tempo run. RPE 6/10", "ajustes": ["Tempo run: 15-20 min a ritmo umbral (VDOT)", "Carreras fáciles: zona 2 estricta", "Añadir strides 4x80m después de carrera fácil", "Si dolor en tibial anterior, reducir km semanales 20%"]},
  {"semana": 3, "titulo": "Primera sesión de intervalos", "descripcion": "25 km/semana. 1 tempo + 1 intervalos. RPE 7/10", "ajustes": ["Intervalos: 6x400m a ritmo I (VDOT) con 1 min recup", "Aumentar km de carrera larga 1.5km más que semana 2", "Si RPE > 7 en tempo, reducir ritmo", "Valorar dolor en rodilla (rodilla de corredor)"]},
  {"semana": 4, "titulo": "Carga aeróbica", "descripcion": "28 km/semana. Intervalos + tempo. RPE 7-8/10", "ajustes": ["Carrera larga: aumentar 2km", "Intervalos: 5x800m a ritmo I con 2 min recup", "Tempo: 20-25 min a ritmo umbral", "Si fatiga acumulada, reducir tempo a 15 min"]},
  {"semana": 5, "titulo": "Descarga", "descripcion": "18 km/semana (60% del volumen). Solo zona 2. RPE 4/10", "ajustes": ["Sin trabajo de calidad", "Añadir 2 sesiones de fuerza compensatoria", "Movilidad y foam rolling diario", "Evaluar recuperación general"]},
  {"semana": 6, "titulo": "Bloque de velocidad", "descripcion": "30 km/semana. Intervalos R + tempo. RPE 8/10", "ajustes": ["R series: 8x200m a ritmo R con 1 min recup", "Tempo: 20 min a ritmo umbral", "Carrera larga: mantener km de semana 4", "Añadir 2 sesiones de fuerza (pesas) si no se hace"]},
  {"semana": 7, "titulo": "Pico de volumen", "descripcion": "32 km/semana. Todo el trabajo de calidad. RPE 8-9/10", "ajustes": ["Carrera larga progresiva: últimos 20% al ritmo objetivo", "Intervalos: 5x1000m a ritmo I con 2 min recup", "Si hay dolor constante, reducir km 20%", "No pasar del 10% de incremento semanal"]},
  {"semana": 8, "titulo": "Taper + Test", "descripcion": "15 km/semana. Últimos 3 días descanso. Test de distancia objetivo al final", "ajustes": ["Último trabajo de calidad: martes, 4x400m a ritmo 5K", "Miércoles y jueves: trote suave 20 min", "Viernes: descanso", "Sábado o domingo: test de la distancia objetivo del programa"]}
]', descripcion = 'Programa de 5K basado en el modelo VDOT de Daniels (2014). Combina trabajo de velocidad (200m-400m a ritmo I/R), tempo runs y carrera larga progresiva. Distribución 80/20 de Fitzgerald (2021): 80% del volumen en zona 2, 20% en trabajo de calidad. 🎯 INDIVIDUALIZACIÓN: Ajustar paces según VDOT (calculado con un test de 1 milla o 5K reciente). Si no hay test, usar sensación: zona 2 es ritmo de conversación (puedes decir frases completas), tempo es cómodamente duro (3-4 palabras), I es incómodo (1-2 palabras). Para corredores con asma inducida por ejercicio, usar inhalador 15 min antes de intervalos y tempo, y mantener recuperación activa durante intervalos. Si hay tendencia a fascitis plantar, usar zapatillas con drop 8-10mm y evitar sprints en cuesta. Para corredores >40 años, reducir volumen 15% y añadir 2 días de fuerza compensatoria. Basado en datos de más de 200.000 corredores de Fitzgerald (2021): la distribución 80/20 reduce lesiones en un 30% respecto a distribución 70/30.'
where id = v_run_5k_id;

update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Base 10K", "descripcion": "25 km/semana. Establecer VDOT. 80% zona 2, 20% calidad. RPE 5-6/10", "ajustes": ["Test de 1 milla o usar 5K reciente para VDOT", "Paces: fácil (zona 2), tempo (VDOT T), I (VDOT I)", "Carrera larga: 8km", "Si molestias, reducir km 10%"]},
  {"semana": 2, "titulo": "Volumen aeróbico", "descripcion": "28 km/semana. Introducir tempo run. RPE 6-7/10", "ajustes": ["Tempo: 3x8 min a ritmo T con 2 min recup", "Carrera larga: 9km", "Strides 4x80m 2x/semana", "Evaluar respuesta cardíaca al tempo"]},
  {"semana": 3, "titulo": "Intervalos 10K", "descripcion": "32 km/semana. Intervalos + tempo. RPE 7/10", "ajustes": ["Intervalos: 5x1000m a ritmo I con 2 min recup", "Tempo: 4x6 min a ritmo T con 2 min recup", "Carrera larga: 10km progresivos", "Añadir cuestas: 6x100m"]},
  {"semana": 4, "titulo": "Carga máxima", "descripcion": "35 km/semana. Máximo volumen. RPE 8/10", "ajustes": ["Carrera larga: 12km", "Intervalos: 3x2000m a ritmo I con 3 min recup", "Tempo: 20 min continuo a ritmo T", "Si RPE > 8, reducir 5% km totales"]},
  {"semana": 5, "titulo": "Descarga", "descripcion": "22 km/semana (60%). Solo zona 2. RPE 4/10", "ajustes": ["Sin calidad", "Fuerza compensatoria: 3 sesiones", "Valorar recuperación (sueño, apetito, energía)", "Si dolor persistente, consultar fisio"]},
  {"semana": 6, "titulo": "Bloque de umbral", "descripcion": "35 km/semana. Intensidad alta. RPE 8/10", "ajustes": ["Tempo largo: 30 min a ritmo T", "Intervalos: 5x1200m a ritmo I con 2:30 recup", "Carrera larga: 12km con últimos 3km a ritmo 10K", "Suplementar con electrolitos en calor"]},
  {"semana": 7, "titulo": "Pico de entrenamiento", "descripcion": "38 km/semana. RPE 8-9/10", "ajustes": ["Carrera larga: 14km progresivos", "Intervalos: 3x2000m a ritmo I", "Tempo: 25 min a ritmo T + 5 min a ritmo 10K", "No sobrepasar 40 km/semana"]},
  {"semana": 8, "titulo": "Taper + Competición", "descripcion": "18 km/semana. Descanso 3 días pre-competición. RPE 3/10", "ajustes": ["Último quality: martes 6x400m a ritmo 5K", "Carga de carbohidratos día pre-competición (8g/kg)", "Hidratación con electrolitos día antes", "Día de competición: desayuno 3h antes, gel 30 min antes"]}
]', descripcion = 'Programa de 10K basado en Daniels (2014) y Fitzgerald (2021). Combina intervalos de 1000-2000m a ritmo I, tempo runs (ritmo T) y carrera larga progresiva. Mayor volumen semanal que 5K. 🎯 INDIVIDUALIZACIÓN: Para corredores que vienen de 5K, la adaptación al volumen es crítica — no aumentar más de 10% semanal. Si el objetivo es marcar un PR en 10K, las últimas 3 semanas deben incluir trabajo específico de 10K (3x2000m a ritmo objetivo). Para corredores con lesión previa de rodilla (PFPS), evitar cuestas y reducir km en asfalto, priorizar tierra o cinta. Si el corredor tiene más de 50 años, aumentar la fase de base a 3 semanas y reducir trabajo de intervalos a 1 sesión/semana. Datos de Fitzgerald (2021): corredores que siguen 80/20 mejoran su tiempo en 10K un 8-12% en 8 semanas.'
where id = v_run_10k_id;

update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Base media maratón", "descripcion": "35 km/semana. 80% zona 2. RPE 5-6/10", "ajustes": ["Calcular VDOT con 10K reciente o test de 1 milla", "Carrera larga: 10km", "Paces: fácil (zona 2), tempo (VDOT T), I (VDOT I)", "Añadir 2 sesiones de fuerza (core + piernas)"]},
  {"semana": 2, "titulo": "Volumen base", "descripcion": "38 km/semana. Introducir tempo run. RPE 6-7/10", "ajustes": ["Tempo: 20 min a ritmo T (VDOT semi)", "Carrera larga: 12km", "Añadir strides 5x80m post-carrera", "Controlar impacto en rodillas con volumen"]},
  {"semana": 3, "titulo": "Intervalos semi", "descripcion": "42 km/semana. Intervalos + tempo. RPE 7/10", "ajustes": ["Intervalos: 5x1600m a ritmo I con 2:30 recup", "Tempo: 3x10 min a ritmo T con 2 min recup", "Carrera larga: 13km", "Evaluar fatiga acumulada en piernas"]},
  {"semana": 4, "titulo": "Carga aeróbica", "descripcion": "45 km/semana. RPE 7-8/10", "ajustes": ["Carrera larga: 15km", "Tempo: 25 min continuo a ritmo T", "Intervalos: 4x2000m a ritmo I con 3 min recup", "Añadir trabajo de cuestas 8x200m"]},
  {"semana": 5, "titulo": "Descarga", "descripcion": "28 km/semana (60%). Solo zona 2. RPE 4-5/10", "ajustes": ["Sin trabajo de calidad", "Fuerza compensatoria al 70%", "Movilidad y prevención de lesiones", "Revisar calzado (vida útil: 500-700km)"]},
  {"semana": 6, "titulo": "Volumen medio", "descripcion": "48 km/semana. RPE 8/10", "ajustes": ["Carrera larga: 16km progresivos", "Intervalos: 3x3000m a ritmo I con 3:30 recup", "Tempo: 30 min a ritmo T", "Añadir 1 sesión de ritmo objetivo (3x2km a ritmo semi)"]},
  {"semana": 7, "titulo": "Pico de volumen", "descripcion": "52 km/semana. RPE 8-9/10", "ajustes": ["Carrera larga: 18km con últimos 5km a ritmo semi", "Intervalos: 5x2000m a ritmo I", "Tempo: 25 min a ritmo T + 5 min a ritmo semi", "No superar 55 km/semana para evitar lesiones"]},
  {"semana": 8, "titulo": "Descarga", "descripcion": "32 km/semana. RPE 5/10", "ajustes": ["Carrera larga: 12km suaves", "Un día de 6x400m a ritmo 10K para mantener velocidad", "Fuerza compensatoria ligera", "Evaluar estado general y planificar semanas 9-12"]},
  {"semana": 9, "titulo": "Bloque específico semi", "descripcion": "50 km/semana. Alta especificidad. RPE 8/10", "ajustes": ["Carrera larga: 18km con ritmo objetivo semi", "Ritmo objetivo: 3x4km a ritmo semi con 2 min recup", "Tempo: 20 min a ritmo T, luego 10 min a ritmo semi", "Simular condiciones de carrera (ropa, gel, hora)"]},
  {"semana": 10, "titulo": "Máximo específico", "descripcion": "50 km/semana pero más calidad. RPE 8-9/10", "ajustes": ["Carrera larga: 19km con últimos 8km a ritmo semi", "Ritmo objetivo: 5x2km a ritmo semi con 2 min recup", "Práctica de avituallamiento en carrera larga", "Si fatiga, mantener volumen pero reducir calidad 1 sesión"]},
  {"semana": 11, "titulo": "Taper de 2 semanas", "descripcion": "35 km/semana. Reducción del 60%. RPE 6-7/10", "ajustes": ["Última calidad: martes 8x400m + 3km a ritmo semi", "Carrera larga: 10km suaves", "Carga de carbohidratos a partir del miércoles", "Descanso completo 2 días pre-competición"]},
  {"semana": 12, "titulo": "COMPETICIÓN MEDIA MARATÓN", "descripcion": "Semana de carrera. RPE máximo el día de carrera", "ajustes": ["Calentamiento: 20 min trote + 4 sprints", "Plan: empezar 5s/km más lento que ritmo objetivo, mantener hasta km15, crear últimos 5km", "Avituallamiento: gel cada 30 min, agua cada 5km", "Post-carrera: recuperación con carbohidratos + proteína 30 min después"]}
]', descripcion = 'Programa de Media Maratón (21.1km). Alto volumen semanal (35-52km). Basado en Daniels (2014) VDOT y 80/20 Running. Incluye intervalos de 1600-3000m, tempo runs de 20-30 min y carreras largas progresivas hasta 19km. 🎯 INDIVIDUALIZACIÓN: El volumen semanal debe ajustarse al histórico de lesiones del corredor. Si tiene tendencia a periostitis tibial, priorizar superficie blanda y no superar 45 km/semana. Corredores con menos de 1 año de experiencia corriendo deben empezar con objetivo de completar, no de tiempo, y reducir el plan a 10 semanas de base + 4 semanas de prueba. Basado en datos de Strava (2022): corredores que completan el 95% de las sesiones del plan mejoran su tiempo de semi en 6-12 minutos frente a aquellos que completan menos del 70%. Si el corredor viaja o tiene interrupciones, la sesión prioritaria es la carrera larga (transferencia directa al rendimiento).'
where id = v_run_half_id;

update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Base maratón", "descripcion": "40 km/semana. Zona 2 estricta. RPE 5-6/10", "ajustes": ["Establecer paces según VDOT o marca de semi reciente", "Carrera larga: 12km", "Añadir 2 sesiones de fuerza compensatoria", "Si no ha corrido nunca maratón, ajustar expectativas"]},
  {"semana": 2, "titulo": "Adaptación al volumen", "descripcion": "45 km/semana. RPE 6/10", "ajustes": ["Carrera larga: 14km", "Introducir strides 2x/semana", "Evaluar respuesta articular al volumen creciente", "Si dolor en cadera o rodilla, reducir 10% km"]},
  {"semana": 3, "titulo": "Primera calidad", "descripcion": "48 km/semana. RPE 6-7/10", "ajustes": ["Tempo: 20 min a ritmo T", "Carrera larga: 16km", "Añadir cuestas suaves 6x100m", "Controlar que la intensidad no fatigue excesivamente"]},
  {"semana": 4, "titulo": "Carga aeróbica", "descripcion": "50 km/semana. RPE 7/10", "ajustes": ["Carrera larga: 18km progresivos", "Intervalos: 5x1600m a ritmo I con 2:30 recup", "Tempo: 25 min a ritmo T", "No aumentar más del 10% semanal"]},
  {"semana": 5, "titulo": "Descarga 1", "descripcion": "32 km/semana (60%). RPE 4/10", "ajustes": ["Solo zona 2, sin calidad", "Fuerza compensatoria intensiva", "Prevención: tendón de Aquiles, tibial anterior", "Evaluar recuperación general"]},
  {"semana": 6, "titulo": "Volumen medio", "descripcion": "52 km/semana. RPE 7-8/10", "ajustes": ["Carrera larga: 21km", "Intervalos: 4x2000m a ritmo I", "Tempo: 20 min tempo + 10 min a ritmo maratón", "Añadir 1 sesión de ritmo objetivo maratón"]},
  {"semana": 7, "titulo": "Bloque específico 1", "descripcion": "55 km/semana. RPE 8/10", "ajustes": ["Carrera larga: 24km", "Ritmo objetivo: 3x5km a ritmo maratón con 2 min recup", "Tempo: 30 min a ritmo T", "Práctica de nutrición en carrera larga (geles cada 30 min)"]},
  {"semana": 8, "titulo": "Descarga 2", "descripcion": "35 km/semana. RPE 5/10", "ajustes": ["Carrera larga: 14km suaves", "Un día de 6x400m para mantener velocidad", "Fuerza compensatoria", "Revisar calzado: comprar zapatillas nuevas si las actuales tienen >500km"]},
  {"semana": 9, "titulo": "Bloque específico 2", "descripcion": "58 km/semana. RPE 8/10", "ajustes": ["Carrera larga: 27km con últimos 10km a ritmo maratón", "Ritmo objetivo: 4x4km a ritmo maratón con 2 min recup", "Simular condiciones de competición (ropa prevista, avituallamiento)", "Si glucógeno insuficiente, tomar carbohidratos intra-carrera"]},
  {"semana": 10, "titulo": "Pico de volumen", "descripcion": "60 km/semana. RPE 8-9/10", "ajustes": ["Carrera larga: 30km (la más importante del plan)", "Ritmo objetivo: 5x3km a ritmo maratón", "Tempo: 25 min a ritmo T + 5 min a ritmo maratón", "Si no completa 30km, no forzar — mejorar en próximo ciclo"]},
  {"semana": 11, "titulo": "Recuperación activa", "descripcion": "40 km/semana. RPE 6/10", "ajustes": ["Carrera larga: 16km suaves", "Calidad: solo tempo suave 15 min", "Mantener estiramientos y movilidad", "Valorar estado físico y ajustar último bloque"]},
  {"semana": 12, "titulo": "Bloque específico 3", "descripcion": "55 km/semana. RPE 8/10", "ajustes": ["Carrera larga: 32km con últimos 12km a ritmo maratón (la más importante)", "Ritmo objetivo: 3x6km a ritmo maratón", "Práctica de avituallamiento líquido + geles", "Sesión de prueba con ropa y zapatillas de competición"]},
  {"semana": 13, "titulo": "Descarga final", "descripcion": "35 km/semana. RPE 5/10", "ajustes": ["Última calidad: martes 5x1000m a ritmo 10K", "Carrera larga: 12km suaves", "Preparación mental: visualización de carrera", "Revisar logística: dorsal, transporte, desayuno"]},
  {"semana": 14, "titulo": "Taper", "descripcion": "25 km/semana. RPE 4/10", "ajustes": ["Lunes: 40 min suave + 4 sprints", "Martes: 30 min suave + 3 sprints", "Miércoles: 20 min suave + 2 sprints", "Jueves: descanso", "Viernes: 15 min trote suave", "Sábado: descanso completo", "Domingo: COMPETICIÓN"]},
  {"semana": 15, "titulo": "Semana 1 pre-maratón", "descripcion": "15 km total. Carga de carbohidratos", "ajustes": ["Lunes: 20 min trote", "Martes: descanso", "Miércoles: 15 min trote + 4 sprints", "Jueves-Sábado: descanso + carga carbohidratos (8-10g/kg)", "Domingo: COMPETICIÓN MARATÓN"]},
  {"semana": 16, "titulo": "DESCANSO POST-MARATÓN", "descripcion": "Recuperación completa. 0 km durante 1 semana", "ajustes": ["No correr 7 días", "Caminar 30 min/día desde día 3", "Recuperación nutricional: proteína cada 3h", "Estiramientos suaves desde día 5", "Semana 2: empezar con 20 min trote cada 2 días"]}
]', descripcion = 'Programa completo de maratón (42.2K). Basado en Daniels (2014) y 80/20 Running. Alto volumen semanal (50-80km). Incluye intervalos 1.200m-1.600m, tempo runs, progresiones y carrera larga hasta 32km. 🎯 INDIVIDUALIZACIÓN: Este es un plan de 16 semanas adecuado para corredores con al menos 2 años de experiencia y media maratón reciente. Para debutantes en maratón, añadir 4 semanas de base (semanas 0-4) con volumen máximo de 40 km/semana. Si el corredor tiene más de 45 años, reducir volumen máximo a 50 km/semana y añadir 1 día de recuperación extra. Para corredores con tendencia a lesiones de isquiotibiales, priorizar fuerza excéntrica de isquios desde semana 1. Datos de investigación (Bond 2022): corredores que completan el 100% de las carreras largas mejoran su tiempo en maratón un 12% frente a los que completan menos del 80%. La carrera larga de 32km es la sesión más crítica del plan — no debe omitirse si es posible.'
where id = v_run_marathon_id;

-- 15-17. CICLISMO — Progresión por objetivo (Coggan & Allen + Friel)
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Test FTP + base", "descripcion": "Test FTP de 20 min. 4-5h/semana. Zona 2 (55-75% FTP). RPE 5-6/10", "ajustes": ["Test FTP: 20 min a máxima intensidad sostenible, FTP = 0.95 * potencia media de 20 min", "Si no tienes potenciómetro, usar RPE o HR: zona 2 = 60-70% FC máx", "Cadencia objetivo 85-95 rpm", "Si dolor de rodilla en rodillo, ajustar altura del sillín"]},
  {"semana": 2, "titulo": "Técnica de pedaleo", "descripcion": "5h/semana. Zona 2. Drills de cadencia. RPE 6/10", "ajustes": ["Drills: 3x5 min a 110-130 rpm con 3 min recup", "Pedaleo a una pierna: 3x3 min cada pierna", "Si calambres, revisar hidratación y electrolitos", "Evaluar molestias cervicales en posición aero"]},
  {"semana": 3, "titulo": "Sweet spot", "descripcion": "5-6h/semana. 88-93% FTP. RPE 7/10", "ajustes": ["Sweet spot: 3x10 min al 88-93% FTP con 5 min recup", "Si RPE > 7 en sweet spot, FTP puede estar sobreestimado", "Mantener 1 sesión de técnica de pedaleo", "Añadir 1 sesión de fuerza gimnasio"]},
  {"semana": 4, "titulo": "Carga aeróbica", "descripcion": "6h/semana. Zona 2 + sweet spot. RPE 7-8/10", "ajustes": ["Rodillo base largo: 2h zona 2", "Sweet spot: 3x12 min al 90% FTP", "Tempo: 30 min zona 3", "Si fatiga del SNC, reducir sweet spot a 2x12 min"]},
  {"semana": 5, "titulo": "Descarga", "descripcion": "3h/semana. 60% volumen. RPE 4/10", "ajustes": ["Solo zona 2, sin trabajo de calidad", "Movilidad y estiramientos específicos de ciclismo", "Revisar posición en la bicicleta", "Si dolor de rodilla, revisar calas y altura sillín"]},
  {"semana": 6, "titulo": "Volumen medio", "descripcion": "6-7h/semana. RPE 7-8/10", "ajustes": ["Sweet spot: 3x15 min", "Tempo: 45 min zona 3", "Rodillo base: 2h zona 2", "Añadir fuerza de piernas 2x/semana"]},
  {"semana": 7, "titulo": "Pico de base", "descripcion": "7-8h/semana. RPE 8/10", "ajustes": ["Sweet spot: 4x12 min", "Rodillo base: 2.5h zona 2", "Tempo: 45 min + 15 min sweet spot", "No superar 8h/semana para evitar sobreentrenamiento"]},
  {"semana": 8, "titulo": "Test FTP + evaluación", "descripcion": "Repetir test FTP. 3h suaves post-test. RPE 10/10 en test", "ajustes": ["Repetir test FTP de 20 min", "Comparar con test inicial", "Ajustar zonas de entrenamiento con nuevo FTP", "Planificar próximo mesociclo (FTP o resistencia)"]}
]', descripcion = 'Programa de base aeróbica para ciclistas. Construcción de volumen con trabajo zona 2, sweet spot y técnica de pedaleo. Ideal para ciclistas de carretera, MTB o gravel. 4-5 días de rodillo + 2 días de fuerza complementaria. 🎯 INDIVIDUALIZACIÓN: Para ciclistas sin potenciómetro, usar RPE: zona 2 = respiración nasal todo el tiempo (Borg 11-13), sweet spot = respiración rítmica, puedes decir 3-4 palabras (Borg 15-16), FTP = puedes decir 1-2 palabras (Borg 17-19). Si el ciclista tiene más de 50 años, reducir zona 2 al 60-70% FTP y aumentar recuperación 24h entre sesiones. Para ciclistas con problemas de próstata, reducir tiempo en sillín a 45 min máx y usar sillín con canal central. Si hay dolor de cuello, la posición aero es demasiado agresiva — subir el manillar 1-2cm. Basado en Coggan & Allen (2023): el sweet spot training mejora el FTP un 5-8% en 8 semanas en ciclistas intermedios.'
where id = v_cycle_base_id;

update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Test FTP + reintroducción", "descripcion": "Test FTP de 20 min si no se ha hecho en >4 semanas. 5h/semana. RPE 7/10", "ajustes": ["Si FTP conocido de mes pasado, empezar directo con intervalos", "Sobre-under: 3x(3min 105% + 2min 95%)", "VO2max: 4x3 min 110% FTP con 3 min recup", "Si dolor de rodilla, evitar sobre-under en desarrollo grande"]},
  {"semana": 2, "titulo": "Adaptación a intervalos", "descripcion": "6h/semana. RPE 7-8/10", "ajustes": ["Sobre-under: 4x(3min 105% + 2min 95%)", "VO2max: 5x3 min 110% FTP", "Recuperación activa entre intervalos (zona 1, no parar)", "Si RPE > 8 en VO2max, FTP sobreestimado"]},
  {"semana": 3, "titulo": "Carga de intensidad", "descripcion": "7h/semana. RPE 8/10", "ajustes": ["Sobre-under: 3x(5min 105% + 3min 95%)", "VO2max: 5x4 min 110% FTP", "Tempo: 45 min zona 3", "Suplementación: cafeína 3mg/kg 60 min antes de sesiones intensas"]},
  {"semana": 4, "titulo": "Pico de intensidad", "descripcion": "7h/semana. RPE 8-9/10", "ajustes": ["VO2max: 5x5 min 110% FTP", "Sobre-under: 4x(4min 105% + 3min 95%)", "Contrarreloj: 20 min a 100% FTP", "Si fatiga excesiva, reducir 1 sesión intensa"]},
  {"semana": 5, "titulo": "Descarga activa", "descripcion": "3.5h/semana (50%). RPE 4/10", "ajustes": ["Solo zona 2", "Fuerza gimnasio ligera", "Movilidad específica de ciclismo", "Evaluar respuesta a las 4 semanas de carga"]},
  {"semana": 6, "titulo": "Bloque de potencia", "descripcion": "7h/semana. RPE 8/10", "ajustes": ["Micro-intervalos: 10x1 min 120-130% FTP con 2 min recup", "Sobre-under: 3x6min", "Tempo: 30 min sweet spot + 15 min tempo", "Añadir 1 sesión de fuerza explosiva (saltos, sentadillas)"]},
  {"semana": 7, "titulo": "Pico de potencia", "descripcion": "6h/semana. RPE 9/10", "ajustes": ["Contrarreloj: 20 min a 105% FTP (simular esfuerzo máximo)", "VO2max: 5x4 min 115% FTP", "Micro-intervalos: 8x1 min 130% FTP", "Última sesión intensa del ciclo"]},
  {"semana": 8, "titulo": "Test FTP + evaluación final", "descripcion": "Test de 20 min + 2h suaves. 60% volumen. RPE 10/10 test", "ajustes": ["Test FTP: comparar con semana 1", "Objetivo: >5% mejora en FTP", "Si mejora >8%, ajustar zonas y empezar nuevo ciclo", "Planificar próximo bloque (resistencia o competición)"]}
]', descripcion = 'Programa centrado en elevar el FTP mediante trabajo de intervalos. Basado en Coggan & Allen (2023). Incluye sobre-under, intervalos VO2max, tempo y contrarreloj. 5 días de rodillo + fuerza específica. 🎯 INDIVIDUALIZACIÓN: Para ciclistas de ruta, los intervalos sobre-under simulan cambios de ritmo en grupo. Para MTB, añadir intervalos de 30s a 120% FTP + 30s recup (simular subidas técnicas). Para ciclistas de contrarreloj, priorizar trabajo de 20 min a 100% FTP en posición aero. Si el ciclista tiene menos de 2 años de experiencia, no recomendar este programa — primero construir base. Contraindicado en periodos de déficit calórico severo (necesita glucógeno para rendir en VO2max). Datos de Coggan & Allen (2023): ciclistas entrenados mejoran FTP un 3-8% con programa de 8 semanas de intervalos; los mayores incrementos se dan en las primeras 4 semanas.'
where id = v_cycle_intervals_id;

update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Test FTP + base larga", "descripcion": "Test FTP. 5h/semana. Zona 2. RPE 5-6/10", "ajustes": ["Fuerza-resistencia: 3x8 min 50-60 rpm zona 3 con 5 min recup", "Sweet spot: 3x12 min 88-93% FTP", "Rodillo base: 1.5h zona 2", "Si dolor de rodilla en fuerza-resistencia, aumentar cadencia"]},
  {"semana": 2, "titulo": "Duración aeróbica", "descripcion": "6h/semana. RPE 6-7/10", "ajustes": ["Rodillo base: 2h zona 2", "Fuerza-resistencia: 4x8 min", "Sweet spot: 3x15 min", "Añadir ejercicios de core (plancha, Pallof)"]},
  {"semana": 3, "titulo": "Resistencia media", "descripcion": "7h/semana. RPE 7/10", "ajustes": ["Rodillo base: 2.5h zona 2", "Sweet spot: 3x15 min al 90% FTP con 5 min recup", "Tempo: 45 min zona 3", "Añadir 1 sesión de técnica de pedaleo"]},
  {"semana": 4, "titulo": "Carga de resistencia", "descripcion": "8h/semana. RPE 7-8/10", "ajustes": ["Rodillo base: 3h zona 2 con últimos 20 min tempo", "Fuerza-resistencia: 4x10 min baja cadencia", "Sweet spot: 4x12 min", "Si fatiga muscular, reducir fuerza-resistencia a 3 series"]},
  {"semana": 5, "titulo": "Descarga", "descripcion": "4h/semana. 50% volumen. RPE 4/10", "ajustes": ["Solo zona 2", "Fuerza gimnasio ligera 1 sesión", "Movilidad, foam rolling, estiramientos", "Evaluar recuperación y dolor articular"]},
  {"semana": 6, "titulo": "Volumen alto", "descripcion": "9h/semana. RPE 8/10", "ajustes": ["Rodillo base: 3.5h zona 2", "Fuerza-resistencia: 4x10 min", "Sweet spot: 2x20 min", "Añadir 1 sesión de fuerza gimnasio"]},
  {"semana": 7, "titulo": "Pico de volumen", "descripcion": "10h/semana. RPE 8/10", "ajustes": ["Rodillo base: 4h zona 2 (simular salida de 100km)", "Sweet spot: 2x25 min", "Tempo: 60 min zona 3 con últimos 15 min sweet spot", "Si fatiga, reducir 1h de rodillo base"]},
  {"semana": 8, "titulo": "Semana de transición", "descripcion": "5h/semana. RPE 5/10", "ajustes": ["Rodillo base: 2h zona 2 + 30 min tempo", "No forzar — preparar para siguiente mesociclo", "Revisar nutrición en salidas largas", "Si objetivo es gran fondo, repetir semanas 6-7"]},
  {"semana": 9, "titulo": "Bloque de competición", "descripcion": "8h/semana. RPE 8/10", "ajustes": ["Rodillo base: 3h zona 2", "Fuerza-resistencia: 3x12 min", "Sweet spot: 3x20 min", "Simular condiciones de gran fondo (nutrición, hidratación)"]},
  {"semana": 10, "titulo": "Taper + evento", "descripcion": "Reducción progresiva. 3-4h antes del evento. RPE 6/10 en suave", "ajustes": ["Lunes: 1h suave", "Martes: 30 min suave + 3 sprints 30s", "Miércoles-Jueves: descanso", "Viernes: 20 min rodillo suave para activar", "Sábado/Domingo: GRAN FONDO o COMPETICIÓN"]}
]', descripcion = 'Programa de larga distancia para ciclistas de fondo, gran fondo o cicloturistas. Construcción de volumen aeróbico hasta 5-6h. Incluye trabajo de fuerza-resistencia, sweet spot y nutrición en ruta. 🎯 INDIVIDUALIZACIÓN: Para ciclistas que preparan un evento único de larga distancia (ej. Quebrantahuesos, Marmotte, GF NY), las semanas 6-9 deben incluir 1 salida larga outdoor por semana para adaptación a terreno real. Si el ciclista no puede completar 4h de rodillo indoor por molestias, reemplazar con 2h indoor + 2h outdoor el fin de semana para variar posición. Para ciclistas con asiento de sillín incómodo después de 2h, probar diferentes sillines (el ancho del isquion determina el sillín adecuado). Si hay adormecimiento de manos, ajustar la longitud del avance y probar guantes con gel. Contraindicado para ciclistas con problemas de cadera o columna lumbar severos — consultar fisioterapeuta deportivo.'
where id = v_cycle_endurance_id;

-- 18-21. TRIATLÓN — Progresión por distancia (Friel 2021)
update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Evaluación + base", "descripcion": "Test de referencia: 400m natación, 8km bici, 1.6km carrera. Volumen: ~6h/semana. RPE 5-6/10", "ajustes": ["Establecer paces por disciplina", "Priorizar técnica de natación sobre velocidad", "Si no sabe nadar crol, empezar con drills de respiración", "Test de transición T1 (natación→bici): cronometrar"]},
  {"semana": 2, "titulo": "Técnica y aclimatación", "descripcion": "~7h/semana. RPE 6/10", "ajustes": ["Natación: drills de respiración bilateral y avistamiento", "Bici: cadencia drills (110-130 rpm)", "Carrera: técnica de carrera post-bici", "Si dolor de hombro en natación, revisar técnica de codo alto"]},
  {"semana": 3, "titulo": "Primera intensidad", "descripcion": "~8h/semana. RPE 6-7/10", "ajustes": ["Natación: 8x50m a ritmo sprint", "Bici: intervalos 5x3 min 105% FTP", "Carrera: 5x3 min a ritmo 5K", "Introducir brick suave (20 min bici + 10 min carrera)"]},
  {"semana": 4, "titulo": "Carga combinada", "descripcion": "~9h/semana. RPE 7-8/10", "ajustes": ["Brick: 40 min bici + 20 min carrera a ritmo", "Natación: series principales de 200m", "Carrera larga: 45-60 min", "Si fatiga, priorizar bricks y natación sobre carrera"]},
  {"semana": 5, "titulo": "Descarga", "descripcion": "~5h/semana (55%). RPE 4/10", "ajustes": ["Solo trabajo suave en las 3 disciplinas", "Movilidad y prevención de lesiones", "Evaluar puntos débiles", "Si dolor de tendón de Aquiles, reducir carrera 50%"]},
  {"semana": 6, "titulo": "Volumen específico", "descripcion": "~9h/semana. RPE 8/10", "ajustes": ["Natación: 12x50m a ritmo sprint + 4x100m a ritmo", "Bici: 60 min con intervalos (6x5 min 105% FTP)", "Carrera: 35 min tempo", "Brick: 50 min bici + 15 min carrera"]},
  {"semana": 7, "titulo": "Simulación Sprint", "descripcion": "~8h/semana. RPE 8-9/10", "ajustes": ["Simulación completa: 750m natación + transición + 20km bici + transición + 5km carrera", "Cronometrar todo", "Si no hay espacio para simulación, hacer bricks largos", "Práctica de avituallamiento en bici"]},
  {"semana": 8, "titulo": "Taper + Competición", "descripcion": "~4h/semana. Descanso 2 días pre-competición. RPE 6/10 máximo", "ajustes": ["Lunes: 30 min natación suave + 20 min bici suave", "Martes: 20 min carrera a ritmo objetivo", "Miércoles: descanso", "Jueves: 20 min bici suave + 4 sprints", "Viernes: descanso + carga carbohidratos", "Sábado: COMPETICIÓN SPRINT"]}
]', descripcion = 'Programa de iniciación al triatlón distancia Sprint (750m natación + 20km bici + 5km carrera). Basado en Friel (2021). Incluye 3 sesiones de natación, 2 de bici, 2 de carrera y 1 brick (bici+carrera). 🎯 INDIVIDUALIZACIÓN: Para debutantes absolutos en triatlón, la prioridad es: 1) completar la natación sin agotarse, 2) gestionar la transición T1, 3) no salir demasiado rápido en bici. Si el atleta no sabe nadar crol de forma eficiente, considerar nadar a braza o espalda en competición. Para ex-nadadores, reducir volumen de natación y centrarse en carrera (su punto débil típico). Para ex-ciclistas, reducir trabajo de bici y enfocar en adaptación carrera post-bici. Para atletas con asma, usar inhalador 10 min antes del calentamiento de natación. Datos de Millet & Vleck (2022): la distribución óptima de entrenamiento para sprint es 30% natación, 40% bici, 30% carrera.'
where id = v_tri_sprint_id;

update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Base olímpica", "descripcion": "Test de referencia: 750m nat, 20km bici, 5km carrera. Volumen: ~8h/semana. RPE 6/10", "ajustes": ["Establecer ritmo olímpico en cada disciplina", "Si marca de sprint reciente, ajustar paces a olímpico (~5-10% más lento)", "Evaluar técnica de natación en aguas abiertas simulada", "Si dolor de hombro, reducir volumen de natación 20% y añadir drills"]},
  {"semana": 2, "titulo": "Volumen disciplinas", "descripcion": "~10h/semana. RPE 6-7/10", "ajustes": ["Natación: 4x200m a ritmo olímpico", "Bici: 2h zona 2 + intervalos suaves", "Carrera: tempo 20 min", "Brick: 45 min bici + 15 min carrera"]},
  {"semana": 3, "titulo": "Carga aeróbica", "descripcion": "~11h/semana. RPE 7/10", "ajustes": ["Natación aguas abiertas: 1.5km continuo (simular distancia)", "Bici: 2.5h zona 2 con sweet spot 3x10 min", "Carrera: 10km progresivos", "Si no hay acceso a aguas abiertas, piscina con drills de avistamiento"]},
  {"semana": 4, "titulo": "Intensidad combinada", "descripcion": "~12h/semana. RPE 7-8/10", "ajustes": ["Brick largo: 2h bici + 30 min carrera a ritmo 10K", "Natación: 8x100m a ritmo + 4x200m", "Carrera: cuestas 8x200m", "Registrar FC en bricks para ajustar pacing"]},
  {"semana": 5, "titulo": "Descarga", "descripcion": "~6h/semana (50%). RPE 4/10", "ajustes": ["Trabajo suave en las 3 disciplinas", "Movilidad y prevención", "Evaluar fatiga acumulada", "Si dolor persistente, consultar fisio"]},
  {"semana": 6, "titulo": "Bloque específico", "descripcion": "~12h/semana. RPE 8/10", "ajustes": ["Brick largo: 2.5h bici + 30 min carrera a ritmo 10K", "Natación: 12x100m a ritmo olímpico", "Bici: 2h con intervalos VO2max", "Carrera: 8x3 min a ritmo 5K con 2 min recup"]},
  {"semana": 7, "titulo": "Simulación olímpica", "descripcion": "~10h/semana. RPE 8-9/10", "ajustes": ["Simulación completa: 1.5km nat + T1 + 40km bici + T2 + 10km carrera", "Si no puede hacer simulación completa, partir en 2 días: sábado simu parcial, domingo brick largo", "Práctica de avituallamiento en bici (gel + agua cada 20 min)", "Cronometrar cada segmento"]},
  {"semana": 8, "titulo": "Bloque final", "descripcion": "~11h/semana. RPE 8/10", "ajustes": ["Brick: 2h bici tempo + 25 min carrera a ritmo 10K", "Natación: 6x200m a ritmo olímpico", "Carrera: 5x5 min a ritmo 10K", "Última sesión intensa: jueves"]},
  {"semana": 9, "titulo": "Taper 1", "descripcion": "~7h/semana (60%). RPE 6/10", "ajustes": ["Martes: natación 1km suave + bici 1h suave", "Miércoles: carrera 30 min suave + 4 sprints", "Jueves: bici 30 min suave", "Viernes: descanso", "Carga de carbohidratos desde miércoles: 7g/kg/día"]},
  {"semana": 10, "titulo": "Taper 2 + Competición", "descripcion": "~4h hasta miércoles, luego descanso. RPE 5/10 máximo", "ajustes": ["Lunes: 30 min natación suave + drills", "Martes: 20 min bici suave + 4 sprints + 10 min carrera suave", "Miércoles: 15 min trote + 3 sprints", "Jueves-Sábado: descanso completo", "Domingo: COMPETICIÓN OLÍMPICO"]},
  {"semana": 11, "titulo": "Recuperación post-competición", "descripcion": "Semana completa de descanso activo", "ajustes": ["No entrenar 3 días", "Caminar 30 min/día", "Estiramientos suaves", "Semana 2 post: empezar con 30 min suave cada disciplina cada 2 días"]}
]', descripcion = 'Programa para distancia olímpica (1.5km natación + 40km bici + 10km carrera). Basado en Friel (2021). Mayor volumen que sprint. Incluye bricks semanales, natación en aguas abiertas simulada y trabajo específico de transiciones. 🎯 INDIVIDUALIZACIÓN: Para atletas con tiempo limitado (<8h/semana disponibles), reducir volumen de bici a 2 sesiones y carrera a 2 sesiones, manteniendo 3 de natación (la disciplina más técnica requiere más frecuencia). Para atletas que vienen del running, la adaptación a la natación es crítica — considerar 4 sesiones de natación las primeras 4 semanas. Para atletas con lesión de hombro por natación, priorizar drills de respiración bilateral y uso de pull buoy. Datos de Bently et al. (2023): la carga simultánea de natación+bici+carrera produce fatiga residual que requiere 48h entre bricks intensos y carrera de calidad.'
where id = v_tri_olympic_id;

update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Base 70.3", "descripcion": "Test de referencia: 1.9km nat, 90km bici, 21.1km carrera — NO hacer completo, test por separado. Volumen: ~10h/semana. RPE 6/10", "ajustes": ["Test natación: 1km cronometrado a ritmo sostenible", "Test bici: FTP de 20 min", "Test carrera: 5K a ritmo semi", "Si fatiga al empezar, reducir volumen 20% primera semana"]},
  {"semana": 2, "titulo": "Volumen aeróbico", "descripcion": "~12h/semana. RPE 6-7/10", "ajustes": ["Natación: 2.5km/semana, drills y técnica", "Bici: 4h/semana base zona 2", "Carrera: 25 km/semana zona 2", "Añadir 2 sesiones de fuerza compensatoria"]},
  {"semana": 3, "titulo": "Carga aeróbica", "descripcion": "~14h/semana. RPE 7/10", "ajustes": ["Natación: 3km/semana con series de 400m", "Bici: 5h/semana con sweet spot", "Carrera: 30 km/semana con tempo 2x15 min", "Brick: 90 min bici + 25 min carrera"]},
  {"semana": 4, "titulo": "Bloque de volumen", "descripcion": "~15h/semana. RPE 7-8/10", "ajustes": ["Natación: 3.5km", "Bici: 6h con rodillo largo de 2.5h", "Carrera: 35 km con 10 km progresivos", "Si fatiga acumulada, reducir 1 sesión de bici"]},
  {"semana": 5, "titulo": "Descarga 1", "descripcion": "~8h/semana (55%). RPE 4-5/10", "ajustes": ["Solo trabajo suave en las 3 disciplinas", "Fuerza compensatoria ligera", "Evaluar recuperación y puntos débiles", "Revisar estrategia nutricional para volumen alto"]},
  {"semana": 6, "titulo": "Subida de volumen", "descripcion": "~15h/semana. RPE 8/10", "ajustes": ["Natación: 4km con series principales de 800m", "Bici: 7h con 1 sesión de 3h zona 2", "Carrera: 40 km con tempo 2x20 min", "Brick: 2h bici + 30 min carrera a ritmo semi"]},
  {"semana": 7, "titulo": "Pico de volumen", "descripcion": "~17h/semana. RPE 8/10", "ajustes": ["Natación: 4.5km", "Bici: 8h con 1 salida de 4h", "Carrera: 45 km con 18km progresivos", "Si dolor de rodilla, reducir carrera 30%"]},
  {"semana": 8, "titulo": "Descarga 2", "descripcion": "~9h/semana. RPE 5/10", "ajustes": ["Trabajo suave, mantener técnica", "Evaluar si el volumen está siendo absorbido", "Si hay insomnio o falta de apetito, el volumen es excesivo", "Ajustar programación de semanas 9-12"]},
  {"semana": 9, "titulo": "Bloque de intensidad", "descripcion": "~16h/semana. RPE 8-9/10", "ajustes": ["Natación: 4km con 8x100m a ritmo 70.3", "Bici: 7h con intervalos VO2max y sweet spot", "Carrera: 42 km con cuestas y tempo", "Brick largo: 3h bici + 35 min carrera"]},
  {"semana": 10, "titulo": "Pico de entrenamiento", "descripcion": "~18h/semana (máximo del plan). RPE 8-9/10", "ajustes": ["Natación: 5km (máximo semanal del plan)", "Bici: 9h con 1 salida de 5h", "Carrera: 50 km con 20km progresivos", "Esta semana es el pico — NO puede mantenerse más de 1 semana"]},
  {"semana": 11, "titulo": "Taper 1", "descripcion": "~10h/semana (55%). RPE 6/10", "ajustes": ["Reducir volumen de bici y carrera primero", "Mantener intensidad en natación (series cortas rápidas)", "Carga de carbohidratos suave (6g/kg)", "Dormir 8+ horas"]},
  {"semana": 12, "titulo": "Taper 2 + Simulación", "descripcion": "~7h/semana + simulación parcial. RPE 7/10 máximo", "ajustes": ["Martes: simulación de medio 70.3 (1h bici + 15 min carrera a ritmo)", "Miércoles: natación 1.5km suave", "Jueves: 30 min bici + 15 min carrera suave", "Viernes-Sábado: descanso", "Domingo semana 12 o sábado semana 13: COMPETICIÓN 70.3"]},
  {"semana": 13, "titulo": "Competición o simulación final", "descripcion": "Semana de carrera o simulacro completo", "ajustes": ["Calentamiento: natación 400m + 15 min bici + 10 min trote", "Plan: empezar natación al 80%, bici mantener 85-90% FTP, carrera empezar lento y progresar", "Avituallamiento: gel cada 30 min en bici, cada 5km en carrera", "Post: recuperación activa 48h"]},
  {"semana": 14, "titulo": "Transición post-70.3", "descripcion": "Descanso activo 2 semanas", "ajustes": ["Semana 1 post: descanso completo 4 días, luego caminar", "Semana 2: natación suave 30 min cada 2 días", "Semana 3: retomar base suave si no hay dolor"]}
]', descripcion = 'Programa para 70.3 (1.9km natación + 90km bici + 21.1km carrera). Basado en Friel (2021). Alto volumen con énfasis en resistencia aeróbica. Incluye bricks largos, natación en aguas abiertas, rodillos de 2-3h y carreras largas de 15-18km. 🎯 INDIVIDUALIZACIÓN: Este plan de 14 semanas es adecuado para triatletas con al menos una temporada olímpica completa. Para debutantes en 70.3, añadir 4 semanas de base (volumen 8-10h/semana) antes de empezar. Si el atleta tiene menos de 10h/semana disponibles, el objetivo debe ser completar, no competir — reducir volumen 30% y priorizar bricks largos. Para atletas con tendencia a lesiones de isquiotibiales en carrera, reducir volumen de carrera a 35 km máximo y añadir 2 sesiones de fuerza excéntrica. Para atletas >50 años, el volumen máximo no debe superar 14h/semana para permitir recuperación articular. Datos de Friel (2021): la semana de pico (semana 10) produce una mejora del 5-8% en la capacidad aeróbica, pero solo si se completa la descarga posterior correctamente.'
where id = v_tri_half_id;

update public.plantillas_entrenamiento set progresion = '[
  {"semana": 1, "titulo": "Evaluación Ironman", "descripcion": "Test base: FTP, 1km natación, 5K carrera. Volumen: ~12h/semana. RPE 6/10", "ajustes": ["NO hacer test completo de IM — test por separado", "Establecer zonas: natación (ritmo 100m/2:00-2:15), bici (zona 2, 65-75% FTP), carrera (zona 2)", "Si no hay histórico de larga distancia, considerar si el objetivo es realista", "Evaluar disponibilidad de tiempo: 12-18h/semana requeridas"]},
  {"semana": 2, "titulo": "Base volumen", "descripcion": "~13h/semana. RPE 6-7/10", "ajustes": ["Natación: 4km/semana con técnica y series de 400m", "Bici: 6h/semana zona 2", "Carrera: 35 km/semana zona 2", "Añadir 2 sesiones de fuerza (core, piernas, espalda)"]},
  {"semana": 3, "titulo": "Adaptación aeróbica", "descripcion": "~14h/semana. RPE 7/10", "ajustes": ["Natación: 5km con una sesión de 2km continuo", "Bici: 7h con rodillo largo de 2.5h", "Carrera: 40 km con 12 km progresivos", "Brick: 2h bici + 20 min carrera"]},
  {"semana": 4, "titulo": "Carga de base", "descripcion": "~15h/semana. RPE 7/10", "ajustes": ["Natación: 5.5km con series de 800m", "Bici: 8h con 3h de rodillo largo", "Carrera: 45 km con tempo 3x12 min", "Si fatiga, priorizar bici y natación sobre carrera"]},
  {"semana": 5, "titulo": "Descarga 1", "descripcion": "~8h/semana (55%). RPE 4-5/10", "ajustes": ["Solo trabajo suave", "Evaluar recuperación: HRV, sueño, apetito", "Revisar técnica de natación con video", "Planificar bloques siguientes"]},
  {"semana": 6, "titulo": "Bloque de volumen", "descripcion": "~16h/semana. RPE 7-8/10", "ajustes": ["Natación: 6km con 2km continuo a ritmo IM", "Bici: 9h con 3.5h de rodillo largo", "Carrera: 48 km con 15 km progresivos", "Brick: 3h bici + 25 min carrera a ritmo maratón"]},
  {"semana": 7, "titulo": "Alto volumen", "descripcion": "~17h/semana. RPE 8/10", "ajustes": ["Natación: 6.5km con 3x1km a ritmo IM", "Bici: 10h con 4h de rodillo largo", "Carrera: 50 km con 18 km progresivos", "Si dolor articular, sustituir carrera por elíptica 1 sesión"]},
  {"semana": 8, "titulo": "Descarga 2", "descripcion": "~9h/semana. RPE 5/10", "ajustes": ["Trabajo suave + técnica", "Valorar si el volumen es asumible", "Si fatiga acumulada excesiva, mantener descarga 2 semanas en lugar de 1", "Ajustar expectativas para segunda mitad del plan"]},
  {"semana": 9, "titulo": "Pico de volumen", "descripcion": "~18h/semana (máximo). RPE 8-9/10", "ajustes": ["Natación: 7km (máximo semanal del plan)", "Bici: 11h con 1 salida de 5h", "Carrera: 55 km con 20 km progresivos", "Semana de pico: no mantener más de 1 semana"]},
  {"semana": 10, "titulo": "Bloque de intensidad IM", "descripcion": "~17h/semana. RPE 8-9/10", "ajustes": ["Natación: 6.5km con 10x200m a ritmo IM", "Bici: 10h con sweet spot y rodillo tempo", "Carrera: 50 km con cuestas y tempo 2x20 min", "Brick clave: 4h bici + 40 min carrera a ritmo maratón"]},
  {"semana": 11, "titulo": "Carga final", "descripcion": "~16h/semana. RPE 8/10", "ajustes": ["Natación: 6km con series de 400m a ritmo", "Bici: 9h con 4h de rodillo a ritmo IM", "Carrera: 48 km con 22 km progresivos (última carrera larga)", "Última semana de carga — después taper"]},
  {"semana": 12, "titulo": "Descarga 3", "descripcion": "~9h/semana (55%). RPE 5-6/10", "ajustes": ["Mantener intensidad baja, solo técnica", "Última sesión de calidad: martes 30 min bici sweet spot + 15 min carrera a ritmo", "Preparar logística de competición", "Carga de carbohidratos desde jueves: 8g/kg/día"]},
  {"semana": 13, "titulo": "Taper intensivo", "descripcion": "~6h/semana. RPE 5/10 máximo", "ajustes": ["Lunes: 30 min natación suave + 30 min bici suave", "Martes: 20 min bici suave + 15 min carrera suave", "Miércoles: descanso", "Jueves: 15 min bici suave + 10 min carrera suave + 3 sprints", "Viernes: descanso completo", "Sábado: 15 min trote matutino (opcional)"]},
  {"semana": 14, "titulo": "COMPETICIÓN IRONMAN", "descripcion": "Día de carrera. Ejecutar plan establecido", "ajustes": ["Desayuno: 3h antes, 200g carbohidratos (avena, plátano, pan tostado)", "Natación: empezar a la izquierda/detrás del grupo, ritmo constante 80%", "Bici: mantener 70-75% FTP primeras 3h, 75-80% últimas 3h, hidratación constante", "Carrera: empezar 10s/km más lento que ritmo objetivo, progresar desde km21", "Avituallamiento: gel cada 30 min + 200ml agua + electrolitos cada hora", "Post: recuperación 30 min después con carbohidratos + proteína (4:1 ratio)"]},
  {"semana": 15, "titulo": "Recuperación post-IM", "descripcion": "DESCANSO COMPLETO 2 SEMANAS", "ajustes": ["Semana 1: sin ejercicio. Solo caminar 20 min desde día 3", "Semana 2: natación suave 30 min cada 2 días", "Semana 3: retomar base suave si no hay dolor", "NO correr hasta semana 4 post-IM", "Evaluar lesiones: uñas negras, tendinitis, ampollas"]},
  {"semana": 16, "titulo": "Retorno gradual", "descripcion": "Reintroducción progresiva. Volumen: 6h/semana. RPE 5/10", "ajustes": ["Empezar con natación 2x/semana, bici 2x/semana, carrera 1x/semana", "Todo zona 2, sin intensidad", "Fuerza compensatoria 2x/semana", "Escuchar al cuerpo: si dolor, retroceder una semana"]}
]', descripcion = 'Programa completo para distancia Ironman (3.8km natación + 180km bici + 42.2km carrera). Basado en Friel (2021). Máximo volumen: 10-12 sesiones/semana. Incluye bricks de 4-5h, natación de 3-4km, rodillos de 4-5h y carreras largas de 30km. Periodización por bloques de 4 semanas. 🎯 INDIVIDUALIZACIÓN: Este plan de 16 semanas es para triatletas con al menos 2 temporadas completas de 70.3. NO recomendado para debutantes en triatlón. Si el atleta tiene menos de 12h/semana disponibles, considerar cambiar objetivo a 70.3. Para atletas con tendencia a lesiones de rodilla, el running debe limitarse a 3x/semana (máximo 45 km/semana) y añadir elíptica 1x/semana como cross-training. Para atletas >55 años, reducir volumen máximo a 14h/semana, añadir 1 día de descanso extra y priorizar natación como recuperación activa. La nutrición intra-carrera es crítica: practicar con los mismos geles y bebidas que se usarán en competición. Datos de Friel (2021) y Bently et al. (2023): el pico de volumen debe durar máximo 2 semanas (semana 9-10), luego descarga obligatoria — sobrepasar este volumen produce un incremento de lesiones del 40% en las últimas 6 semanas antes de competición.'
where id = v_tri_full_id;

end $$;
