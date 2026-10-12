-- Objetivos del año: prioridad (A = principal, B = secundaria, C = de paso) y estado (confirmada / posible).
-- Una «posible» planifica el entrenamiento del año pero NO activa tapering ni carga de hidratos en la dieta hasta que se confirme.
alter table public.competiciones
  add column if not exists prioridad text not null default 'A' check (prioridad in ('A', 'B', 'C')),
  add column if not exists estado text not null default 'confirmada' check (estado in ('confirmada', 'posible'));
