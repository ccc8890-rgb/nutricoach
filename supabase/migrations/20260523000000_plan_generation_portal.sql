-- supabase/migrations/20260523000000_plan_generation_portal.sql

-- 1. onboarding_responses: 4 campos nuevos
ALTER TABLE onboarding_responses
  ADD COLUMN IF NOT EXISTS horario_comidas jsonb,
  ADD COLUMN IF NOT EXISTS come_fuera_dias int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alimentos_base text[],
  ADD COLUMN IF NOT EXISTS objetivo_deportivo text,
  ADD COLUMN IF NOT EXISTS historial_dieta text;

-- 2. comidas: campo para alternativas pre-calculadas
ALTER TABLE comidas
  ADD COLUMN IF NOT EXISTS alternativas_receta_ids uuid[],
  ADD COLUMN IF NOT EXISTS kcal_target int,
  ADD COLUMN IF NOT EXISTS proteinas_target int,
  ADD COLUMN IF NOT EXISTS carbos_target int,
  ADD COLUMN IF NOT EXISTS grasas_target int,
  ADD COLUMN IF NOT EXISTS notas_peri_entreno text;

-- 3. comida_alimentos: factor de ajuste de gramaje
ALTER TABLE comida_alimentos
  ADD COLUMN IF NOT EXISTS factor_ajuste float DEFAULT 1.0;

-- 4. recetas: tipo, salsas recomendadas, receta privada de cliente
ALTER TABLE recetas
  ADD COLUMN IF NOT EXISTS tipo_receta text DEFAULT 'completa'
    CHECK (tipo_receta IN ('completa','guarnicion','salsa_base','snack_postre','bebida','desayuno')),
  ADD COLUMN IF NOT EXISTS salsas_recomendadas uuid[],
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fuente text DEFAULT 'manual'
    CHECK (fuente IN ('manual','scraping','ia_generada','ia_personalizada'));

-- 5. receta_ingredientes: rol, cantidad fija, receta vinculada
ALTER TABLE receta_ingredientes
  ADD COLUMN IF NOT EXISTS rol_ingrediente text
    CHECK (rol_ingrediente IN (
      'proteina_principal','carbohidrato_base','verdura_volumen','grasa_saludable',
      'salsa_condimento','especias_aromaticos','estructural','lacteo_complemento','fruta_complemento'
    )),
  ADD COLUMN IF NOT EXISTS es_cantidad_fija boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS receta_vinculada_id uuid REFERENCES recetas(id) ON DELETE SET NULL;

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_recetas_tipo_receta ON recetas(tipo_receta);
CREATE INDEX IF NOT EXISTS idx_recetas_cliente_id ON recetas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_recetas_fuente ON recetas(fuente);
CREATE INDEX IF NOT EXISTS idx_receta_ingredientes_rol ON receta_ingredientes(rol_ingrediente);
