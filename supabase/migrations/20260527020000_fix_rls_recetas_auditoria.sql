-- Fix: habilitar RLS en recetas_auditoria
-- La tabla solo se escribe desde server-side con service_role (bypassa RLS).
-- No se necesitan políticas de acceso público; el service_role sigue funcionando.
-- Esto cierra el aviso "rls_disabled_in_public" del Security Advisor de Supabase.

alter table public.recetas_auditoria enable row level security;

-- Los coaches autenticados pueden leer el historial de auditoría
create policy "coaches pueden leer auditoria"
  on public.recetas_auditoria
  for select
  to authenticated
  using (true);

-- Sólo el service_role puede insertar (no hace falta política explícita,
-- service_role siempre bypassa RLS, pero la añadimos para documentar el intent).
-- No se añade policy de INSERT para authenticated para forzar que solo entre
-- desde el servidor con service_role.
