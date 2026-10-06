export type GrupoAnalitica = 'salud' | 'rendimiento' | 'hormonal'

export interface MarcadorAnalitica {
  key: string
  label: string
  unit: string
  ref: string
  why: string
  grupo: GrupoAnalitica
}

export const MARCADORES_BASE: MarcadorAnalitica[] = [
  { key: 'glucosa', label: 'Glucosa en ayunas', unit: 'mg/dL', ref: '70-99', why: 'Metabolismo de carbohidratos', grupo: 'salud' },
  { key: 'hba1c', label: 'HbA1c', unit: '%', ref: '<5.7', why: 'Control glucémico últimos 3 meses', grupo: 'salud' },
  { key: 'colesterol_total', label: 'Colesterol total', unit: 'mg/dL', ref: '<200', why: 'Salud cardiovascular', grupo: 'salud' },
  { key: 'ldl', label: 'LDL (colesterol malo)', unit: 'mg/dL', ref: '<100', why: 'Riesgo cardiovascular', grupo: 'salud' },
  { key: 'hdl', label: 'HDL (colesterol bueno)', unit: 'mg/dL', ref: '>60', why: 'Protector cardiovascular', grupo: 'salud' },
  { key: 'trigliceridos', label: 'Triglicéridos', unit: 'mg/dL', ref: '<150', why: 'Metabolismo graso', grupo: 'salud' },
  { key: 'tsh', label: 'TSH (tiroides)', unit: 'mUI/L', ref: '0.4-4.0', why: 'Metabolismo basal', grupo: 'salud' },
  { key: 'vitamina_d', label: 'Vitamina D (25-OH)', unit: 'ng/mL', ref: '30-80', why: 'Inmunidad, huesos, músculo', grupo: 'salud' },
  { key: 'hierro', label: 'Hierro sérico', unit: 'µg/dL', ref: '60-170', why: 'Energía y transporte de oxígeno', grupo: 'salud' },
  { key: 'ferritina', label: 'Ferritina', unit: 'ng/mL', ref: '20-300', why: 'Reservas de hierro, recuperación', grupo: 'salud' },
]

export const MARCADORES_PERFORMANCE: MarcadorAnalitica[] = [
  { key: 'b12', label: 'Vitamina B12', unit: 'pg/mL', ref: '200-900', why: 'Energía, sistema nervioso', grupo: 'rendimiento' },
  { key: 'acido_folico', label: 'Ácido fólico', unit: 'ng/mL', ref: '3-20', why: 'Síntesis de ADN, eritrocitos', grupo: 'rendimiento' },
  { key: 'zinc', label: 'Zinc', unit: 'µg/dL', ref: '60-130', why: 'Testosterona, inmunidad, recuperación', grupo: 'rendimiento' },
  { key: 'magnesio', label: 'Magnesio', unit: 'mg/dL', ref: '1.6-2.6', why: 'Función muscular, sueño, energía', grupo: 'rendimiento' },
  { key: 'hemoglobina', label: 'Hemoglobina', unit: 'g/dL', ref: 'H:13.5-17.5 / M:12-15.5', why: 'Transporte de oxígeno', grupo: 'rendimiento' },
  { key: 'hematocrito', label: 'Hematocrito', unit: '%', ref: 'H:41-53 / M:36-46', why: 'Capacidad aeróbica', grupo: 'rendimiento' },
  { key: 'cpk', label: 'CPK (creatina quinasa)', unit: 'U/L', ref: 'H:<200 / M:<170', why: 'Daño muscular, recuperación', grupo: 'rendimiento' },
  { key: 'pcr', label: 'PCR (inflamación)', unit: 'mg/L', ref: '<1.0', why: 'Inflamación sistémica', grupo: 'rendimiento' },
]

export const MARCADORES_ELITE: MarcadorAnalitica[] = [
  { key: 'testosterona_total', label: 'Testosterona total', unit: 'ng/dL', ref: 'H:300-1000 / M:15-70', why: 'Anabolismo, recuperación, libido', grupo: 'hormonal' },
  { key: 'testosterona_libre', label: 'Testosterona libre', unit: 'pg/mL', ref: 'H:5-21', why: 'Fracción activa — más precisa', grupo: 'hormonal' },
  { key: 'cortisol', label: 'Cortisol (mañana)', unit: 'µg/dL', ref: '6-23', why: 'Estrés, sobreentrenamiento', grupo: 'hormonal' },
  { key: 'igf1', label: 'IGF-1', unit: 'ng/mL', ref: 'según edad', why: 'Eje GH, síntesis proteica', grupo: 'hormonal' },
  { key: 'insulina_ayunas', label: 'Insulina en ayunas', unit: 'µU/mL', ref: '<25', why: 'Sensibilidad a insulina', grupo: 'hormonal' },
  { key: 'homocisteina', label: 'Homocisteína', unit: 'µmol/L', ref: '<15', why: 'Riesgo cardiovascular, vitaminas B', grupo: 'hormonal' },
  { key: 'acido_urico', label: 'Ácido úrico', unit: 'mg/dL', ref: 'H:3.5-7.2 / M:2.5-6.0', why: 'Dietas altas en proteína, gota', grupo: 'hormonal' },
  { key: 'albumina', label: 'Albúmina', unit: 'g/dL', ref: '3.5-5.0', why: 'Estado nutricional proteico', grupo: 'hormonal' },
  { key: 'omega3_index', label: 'Índice Omega-3', unit: '%', ref: '>8%', why: 'Inflamación, recuperación, corazón', grupo: 'hormonal' },
  { key: 'lh_fsh', label: 'LH / FSH (mujeres)', unit: 'mUI/mL', ref: 'según fase ciclo', why: 'Función hormonal, RED-S', grupo: 'hormonal' },
]

export const MARCADORES_ANALITICA = [...MARCADORES_BASE, ...MARCADORES_PERFORMANCE, ...MARCADORES_ELITE]
export const CLAVES_MARCADORES_ANALITICA = new Set(MARCADORES_ANALITICA.map(marcador => marcador.key))
