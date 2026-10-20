-- Permite el nuevo tipo de acción «revision_tendencia_peso» (propuesta de ajuste ±5 % de kcal por tendencia de peso).
-- Solo amplía la lista de valores admitidos: no toca filas existentes. Aplicar con `supabase db query --linked -f <este archivo>`.
ALTER TABLE public.periodizacion_acciones DROP CONSTRAINT IF EXISTS periodizacion_acciones_accion_check;
ALTER TABLE public.periodizacion_acciones ADD CONSTRAINT periodizacion_acciones_accion_check CHECK (accion IN (
  'refeed_sugerir',
  'higiene_sueno',
  'mensaje_apoyo',
  'ajuste_calorico_10pct',
  'alerta_coach_solo',
  'revision_tendencia_peso',
  'sin_accion'
));
