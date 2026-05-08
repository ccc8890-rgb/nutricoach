-- ============================================================
-- FIX BUG 1: Permitir lectura pública del catálogo de alimentos
-- ============================================================
-- La política actual solo permite SELECT con auth.role() = 'authenticated'
-- Esto hace que la API /api/alimentos devuelva [] para peticiones sin sesión
-- 
-- Nueva política:
--   - Cualquiera (incluso anónimo) puede leer alimentos del catálogo (custom = false)
--   - Solo usuarios autenticados pueden leer alimentos custom (propios o compartidos)

-- Eliminar política antigua
drop policy if exists "Anyone authenticated can read alimentos" on public.alimentos;

-- Política 1: Lectura pública del catálogo compartido
create policy "Anyone can read shared alimentos"
  on public.alimentos
  for select
  using (custom = false or custom is null);

-- Política 2: Usuarios autenticados pueden leer todos los alimentos
create policy "Authenticated can read all alimentos"
  on public.alimentos
  for select
  using (auth.role() = 'authenticated');
