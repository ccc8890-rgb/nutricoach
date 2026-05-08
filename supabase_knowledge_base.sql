-- ============================================================
-- KNOWLEDGE BASE — NutriCoach (tsvector via trigger)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  disciplina text NOT NULL CHECK (disciplina IN (
    'nutricion', 'hyrox', 'running', 'ciclismo', 'triatlon',
    'hibrido', 'fuerza', 'recuperacion', 'general'
  )),
  categoria text NOT NULL CHECK (categoria IN (
    'periodizacion', 'intensidad', 'volumen', 'fuerza',
    'resistencia', 'hiit', 'zona2', 'competicion', 'recuperacion',
    'proteina', 'hidratacion', 'suplementacion', 'patologia',
    'composicion_corporal', 'metabolismo', 'metodologia', 'otro'
  )),
  tipo text NOT NULL DEFAULT 'estudio' CHECK (tipo IN (
    'estudio', 'meta_analisis', 'revision', 'guia_clinica',
    'protocolo', 'metodologia', 'referencia', 'nota_propia'
  )),

  titulo text NOT NULL,
  resumen text NOT NULL,
  contenido_completo text,
  puntos_clave text[],
  fuente text,
  url_origen text,
  doi text,

  tags text[] DEFAULT '{}',
  poblacion text[] DEFAULT '{}',
  condiciones text[] DEFAULT '{}',
  nivel_evidencia text CHECK (nivel_evidencia IN (
    'meta_analisis', 'rct', 'revision_sistematica',
    'estudio_observacional', 'opinion_experto', 'practica_clinica'
  )),

  fuente_tipo text DEFAULT 'manual' CHECK (fuente_tipo IN (
    'manual', 'scrapeado', 'doi', 'ia_generado'
  )),
  verificado boolean DEFAULT false,
  activo boolean DEFAULT true,
  busqueda tsvector,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_coach_id_idx ON public.knowledge_base(coach_id);
CREATE INDEX IF NOT EXISTS kb_disciplina_idx ON public.knowledge_base(disciplina);
CREATE INDEX IF NOT EXISTS kb_busqueda_idx ON public.knowledge_base USING GIN(busqueda);
CREATE INDEX IF NOT EXISTS kb_tags_idx ON public.knowledge_base USING GIN(tags);
CREATE INDEX IF NOT EXISTS kb_condiciones_idx ON public.knowledge_base USING GIN(condiciones);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_lee_conocimiento" ON public.knowledge_base
  FOR SELECT USING (coach_id IS NULL OR coach_id = auth.uid());
CREATE POLICY "coach_escribe_conocimiento" ON public.knowledge_base
  FOR INSERT WITH CHECK (coach_id = auth.uid());
CREATE POLICY "coach_edita_conocimiento" ON public.knowledge_base
  FOR UPDATE USING (coach_id = auth.uid());
CREATE POLICY "coach_borra_conocimiento" ON public.knowledge_base
  FOR DELETE USING (coach_id = auth.uid());

CREATE OR REPLACE FUNCTION kb_before_upsert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  NEW.busqueda = to_tsvector(
    'spanish'::regconfig,
    coalesce(NEW.titulo, '') || ' ' ||
    coalesce(NEW.resumen, '') || ' ' ||
    coalesce(NEW.fuente, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '') || ' ' ||
    coalesce(array_to_string(NEW.condiciones, ' '), '')
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS kb_upsert ON public.knowledge_base;
CREATE TRIGGER kb_upsert
  BEFORE INSERT OR UPDATE ON public.knowledge_base
  FOR EACH ROW EXECUTE FUNCTION kb_before_upsert();
