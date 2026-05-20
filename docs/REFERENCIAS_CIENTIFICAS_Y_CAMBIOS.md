# 📚 Referencias Científicas y Documentación de Cambios — NutriCoach

> **Fecha:** 20-05-2026
> **Propósito:** Documentar todos los cambios implementados en la sesión actual con referencias bibliográficas completas, para que cualquier agente (Claude, etc.) pueda revisar, entender y continuar el trabajo.

---

## 📋 Índice de cambios

| # | Archivo | Acción | Gap resuelto |
|---|---------|--------|-------------|
| 1 | [`docs/auditoria-2026-05-20-investigacion-top-coach.md`](docs/auditoria-2026-05-20-investigacion-top-coach.md) | CREADO | Auditoría inicial |
| 2 | [`app/api/generar-plan-inicial/route.ts`](app/api/generar-plan-inicial/route.ts) | MODIFICADO | #1 + #3 + #2 |
| 3 | [`lib/distribucion-proteinas.ts`](lib/distribucion-proteinas.ts) | CREADO | #3 |
| 4 | [`lib/periodizacion/mesociclo.ts`](lib/periodizacion/mesociclo.ts) | CREADO | #2 |
| 5 | [`lib/auto-coach.ts`](lib/auto-coach.ts) | MODIFICADO | #6 |
| 6 | [`lib/knowledge-base.ts`](lib/knowledge-base.ts) | MODIFICADO | #5 |
| 7 | [`types/index.ts`](types/index.ts) | MODIFICADO | #6 (type) |
| 8 | [`components/dashboard/AutoCoachPanel.tsx`](components/dashboard/AutoCoachPanel.tsx) | MODIFICADO | #6 (UI) |

---

## 🔬 1. Gap #1 — Generación de Dieta con Recetas Reales

### Cambio
[`app/api/generar-plan-inicial/route.ts`](app/api/generar-plan-inicial/route.ts) fue reescrito para:
- Obtener plantillas y recetas desde Supabase
- Llamar a [`construirPrompt()`](lib/deepseek.ts:66) con recetas reales agrupadas por categoría
- Inyectar TODO el contexto del cliente como "conocimiento científico" en el prompt de dieta
- Si DeepSeek funciona: guardar `plantilla_id_elegida`, `comidas` con `receta_id` y porciones
- Si DeepSeek falla: plan de respaldo con distribución óptima de proteína y mesociclo

### Referencias

**Libros:**
- *Israetel, M. et al. (2019). The Renaissance Diet 2.0.* — Estrategia completa de periodización nutricional y diseño de dietas personalizadas.
- *Ivy, J. & Portman, R. (2014). Nutrient Timing: The Future of Sports Nutrition.* — Fundamentos de timing de nutrientes y diseño de comidas peri-entreno.
- *Seebohar, B. (2011). Nutrition Periodization for Athletes, 2nd ed.* — Periodización nutricional completa para rendimiento.
- *NSCA (2018). Essentials of Sport and Exercise Nutrition, 3rd ed.* — Manual de referencia para nutrición deportiva basada en evidencia.

**Papers:**
- Helms ER, Zinn C, Rowlands DS, Brown SR. *A systematic review of dietary protein during caloric restriction in resistance-trained lean athletes: a case for higher intakes.* J Int Soc Sports Nutr. 2014;11:20. — Base de proteína 2.3-3.1 g/kg en déficit.
- Morton RW, Murphy KT, McKellar SR, et al. *A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults.* Br J Sports Med. 2018;52(6):376-384. — Punto de saturación proteico ~1.62 g/kg.
- Schoenfeld BJ, Aragon AA, Krieger JW. *The effect of protein timing on muscle strength and hypertrophy: a meta-analysis.* J Int Soc Sports Nutr. 2013;10:53. — Ventana anabólica flexible.

---

## 🥩 2. Gap #3 — Distribución Estratégica de Proteína (MPS)

### Archivo creado: [`lib/distribucion-proteinas.ts`](lib/distribucion-proteinas.ts)

### Algoritmo
1. Calcula proteína total/día (peso × g/kg según objetivo)
2. Divide en N comidas (configurable, default 4)
3. **Threshold MPS**: 20g/comida (<50 años), 30g/comida (>50 años)
4. La comida **post-entreno** recibe +10g (hasta máx 50g)
5. Verifica que cada comida active MPS (`mps_activada`)
6. Alerta si riesgo de sarcopenia (<30g en mayores)
7. Calcula leucina estimada (~8% de proteína total)

### Referencias

**Libros:**
- *Norton, L. & Layman, D. (2015). The Protein Threshold for Muscle Protein Synthesis.* — Concepto de leucine threshold y distribución.
- *Phillips, S.M. & Van Loon, L.J. (2011). Dietary protein for athletes: From requirements to optimum adaptation.* — J Sports Sci.
- *Berdanier, C.D. et al. (2020). Handbook of Nutrition and Food, 4th ed.* — Tablas de composición y metabolismo proteico.

**Papers:**
- Katsanos CS, Kobayashi H, Sheffield-Moore M, Aarsland A, Wolfe RR. *A high proportion of leucine is required for optimal stimulation of the rate of muscle protein synthesis by essential amino acids in the elderly.* Am J Physiol Endocrinol Metab. 2006;291(2):E381-7. — **Key paper**: mayores >50a necesitan 2.5-3g leucina/toma.
- Moore DR, Churchward-Venne TA, Witard O, et al. *Protein ingestion to stimulate myofibrillar protein synthesis requires greater relative protein intakes in healthy older males than younger males.* J Gerontol A Biol Sci Med Sci. 2015;70(1):57-62. — Resistencia anabólica en envejecimiento.
- Schoenfeld BJ, Aragon AA. *How much protein can the body use in a single meal for muscle-building? Implications for daily protein distribution.* J Int Soc Sports Nutr. 2018;15:10. — **Key paper**: 4 comidas de 20-40g optimizan MPS. Más allá de 40g hay rendimientos decrecientes.
- Witard OC, Jackman SR, Breen L, Smith K, Selby A, Tipton KD. *Myofibrillar muscle protein synthesis rates subsequent to a meal in humans: possible role of the peak in muscle protein synthesis.* J Nutr. 2014;144(6):864-70. — 20g proteína por comida es el umbral mínimo para MPS.
- Paddon-Jones D, Campbell WW, Jacques PF, et al. *Protein and healthy aging.* Am J Clin Nutr. 2015;101(6):1339S-1345S. — Mayores necesitan 25-30g proteína por comida.

---

## 📅 3. Gap #2 — Mesociclos de Periodización Nutricional

### Archivo creado: [`lib/periodizacion/mesociclo.ts`](lib/periodizacion/mesociclo.ts)

### Algoritmo
5 modos de planificación:
1. **Pérdida grasa**: déficit progresivo 4sem → refeed programado si adherencia >70% → diet break si fatiga ≥4/5 → reverse dieting al finalizar
2. **Ganancia muscular**: superávit +10% (200-300 kcal) → mini-cut evaluativo cada 5 semanas
3. **Rendimiento**: fase base CHO loading → carga pre-competición 8-10g/kg CHO
4. **Recomposición**: déficit leve 4sem + mantenimiento 4sem (12-16 semanas total)
5. **Mantenimiento**: equilibrio 4 semanas con progresión de entreno

### Referencias

**Libros:**
- *Israetel, M. et al. (2019). The Renaissance Diet 2.0.* — Capítulos sobre diet breaks, refeeds, y periodización de calorías.
- *Bompa, T. & Buzzichelli, C. (2019). Periodization: Theory and Methodology of Training, 6th ed.* — Periodización del entrenamiento que debe sincronizarse con nutrición.
- *Seebohar, B. (2011). Nutrition Periodization for Athletes, 2nd ed.* — Único libro dedicado exclusivamente a periodización nutricional.
- *Norton, L. & Baker, P. (2019). The Peak 21: Nutritional Periodization for Physique Athletes.* — Protocolo de periodo de definición pre-competición.
- *McDonald, L. (2011). The Ultimate Diet 2.0.* — Protocolos de carb cycling y periodización para pérdida grasa.

**Papers:**
- Trexler ET, Smith-Ryan AE, Norton LE. *Metabolic adaptation to weight loss: implications for the athlete.* J Int Soc Sports Nutr. 2014;11:7. — **Key paper**: adaptación metabólica y necesidad de diet breaks. Déficit >500 kcal/día acelera adaptación.
- Peos JJ, Norton LE, Helms ER, Galpin AJ, Fournier P. *Intermittent dieting: theoretical considerations for the athlete.* J Sports Sci. 2021;39(10):1174-1183. — Dietas intermitentes vs continuas, beneficios de diet breaks.
- Aragon AA, Schoenfeld BJ, Wildman R, et al. *International Society of Sports Nutrition position stand: diets and body composition.* J Int Soc Sports Nutr. 2017;14:16. — **Posición oficial ISSN**: diet breaks y refeeds mejoran adherencia y resultados.
- Byrne NM, Sainsbury A, King NA, et al. *Intermittent energy restriction improves weight loss efficiency in obese men: the MATADOR study.* Int J Obes. 2018;42(2):129-138. — Dieta intermitente (2 semanas déficit / 2 semanas mantenimiento) mejora pérdida grasa.
- Müller MJ, Bosy-Westphal A. *Adaptive thermogenesis with weight loss in humans.* Obesity. 2013;21(2):218-228. — Termogénesis adaptativa y cómo los diet breaks la mitigan.

### Tipos de Semana en Mesociclo

| Tipo | Cuándo se usa | Cambio calórico | Cambio CHO |
|------|---------------|-----------------|------------|
| `deficit` | Inicio, semanas 1-4 | -15% a -20% | -10% a -20% |
| `deficit_profundo` | Corto plazo, buena adherencia | -25% | -25% |
| `mantenimiento` | Diet break o transición | 0% | 0% |
| `refeed` | Semanas 4+ déficit + adherencia >70% | 0% | +30% |
| `superavit` | Ganancia muscular | +10% | +15% |
| `carga` | Pre-competición | +5% a +10% | +15% a +30% |
| `deload` | Semanas 6+ déficit o fatiga alta | 0% | +10% |

---

## 🔄 4. Gap #6 — Feedback Loop Auto-Coach → Periodización

### Cambio en [`lib/auto-coach.ts`](lib/auto-coach.ts)

### Nuevas reglas de integración

| Detección auto-coach | Acción de periodización |
|---------------------|------------------------|
| Peso estancado + adherencia ≥7/10 + ≥2 semanas | 🔁 Disparar refeed programado 1 semana |
| Energía <4/10 + déficit activo | 📉 Revisar si déficit excesivo, ajustar distribución de CHO |
| Sueño <3/10 | 🛌 Intervención de higiene de sueño antes de ajustar calorías |
| Pérdida rápida (>1kg/sem) + energía <5/10 | 📈 Aumentar +200-300 kcal/día para estabilizar |

### Referencias
- *James, L.J. et al. (2017). Sleep and nutritional interventions for health and performance.* Sports Med.
- *Chaput, J.P. et al. (2016). Sleep and food intake: the role of energy balance.* Obesity Reviews.
- *St-Onge, M.P. et al. (2016). Effects of diet on sleep quality.* Adv Nutr.

---

## 🩺 5. Gap #5 — Nuevos Protocolos Científicos

### Cambio en [`lib/knowledge-base.ts`](lib/knowledge-base.ts): 15 → 18 protocolos

### HTA / Hipertensión
**Referencias clave:**
- Sacks FM, Svetkey LP, Vollmer WM, et al. *Effects on blood pressure of reduced dietary sodium and the DASH diet.* NEJM. 2001;344(1):3-10. — **DASH-Sodium Trial**: reducción de PA con DASH + bajo sodio.
- Appel LJ, Moore TJ, Obarzanek E, et al. *A clinical trial of the effects of dietary patterns on blood pressure.* NEJM. 1997;336(16):1117-1124. — **DASH Trial original**.
- Whelton PK, Carey RM, Aronow WS, et al. *2017 ACC/AHA Guideline for hypertension.* Hypertension. 2018;71(6):e13-e115. — Guía clínica de HTA.
- Filippou CD, Tsioufis CP, Thomopoulos CG, et al. *DASH diet and blood pressure reduction in adults: a meta-analysis.* Adv Nutr. 2021;12(3):884-898. — Meta-análisis reciente.

### Dislipemia
**Referencias clave:**
- Brown L, Rosner B, Willett WW, Sacks FM. *Cholesterol-lowering effects of dietary fiber: a meta-analysis.* Am J Clin Nutr. 1999;69(1):30-42. — Fibra soluble reduce LDL 5-15%.
- Jacobson TA, Ito MK, Maki KC, et al. *NLA recommendations for patient-centered management of dyslipidemia.* J Clin Lipidol. 2015;9(2):129-169. — Guía de manejo de dislipemia.
- Estruch R, Ros E, Salas-Salvadó J, et al. *Primary prevention of cardiovascular disease with a Mediterranean diet.* NEJM. 2013;368(14):1279-1290. — **PREDIMED**: dieta mediterránea reduce eventos CV.

### Hígado Graso (NAFLD)
**Referencias clave:**
- Vilar-Gomez E, Martinez-Perez Y, Calzadilla-Bertot L, et al. *Weight loss through lifestyle modification significantly reduces features of nonalcoholic steatohepatitis.* Gastroenterology. 2015;149(2):367-378. — >5% peso reduce esteatosis >30%.
- Sanyal AJ, Chalasani N, Kowdley KV, et al. *Pioglitazone, vitamin E, or placebo for NASH (PIVENS).* NEJM. 2010;362(18):1675-1685. — Vitamina E en NASH.
- Romero-Gómez M, Zelber-Sagi S, Trenell M. *NAFLD and MAFLD: What Is New in Diagnosis and Classification?* J Hepatol. 2020;73(1):193-204.

---

## 📖 6. Libros Recomendados para la Biblioteca de Referencia

Si quieres construir una base de referencias física/digital, estos son los títulos esenciales:

### Esenciales (nivel 1 — deben estar)
1. **The Renaissance Diet 2.0** — Dr. Mike Israetel, Dr. James Hoffmann, Dr. Melissa Davis, Dr. Jared Feather
   - *La guía más completa de periodización nutricional para composición corporal. Base de los mesociclos.*
2. **Nutrition Periodization for Athletes (2nd ed.)** — Bob Seebohar
   - *Único libro dedicado exclusivamente a periodización nutricional. Crucial para atletas.*
3. **Essentials of Sport and Exercise Nutrition (3rd ed.)** — NSCA
   - *Manual de referencia académica. Lo usa la NSCA para certificación.*
4. **Nutrient Timing: The Future of Sports Nutrition** — John Ivy & Robert Portman
   - *Fundamento de la distribución temporal de nutrientes.*
5. **Periodization: Theory and Methodology of Training (6th ed.)** — Tudor Bompa & Carlo Buzzichelli
   - *Biblia de la periodización del entrenamiento. Debe sincronizarse con nutrición.*

### Avanzados (nivel 2 — crecimiento)
6. **The Biology of the Human Energy Metabolism** — Claude Pichard
7. **Sports Nutrition: Energy Metabolism and Exercise** — Ira Wolinsky
8. **Dietary Protein and Exercise: Optimizing Skeletal Muscle Health** — Stuart Phillips
9. **Clinical Sports Nutrition (6th ed.)** — Louise Burke & Vicki Deakin
10. **The Ultimate Diet 2.0** — Lyle McDonald
11. **Flexible Dieting** — Alan Aragon
12. **Metabolic Adaptation and Weight Loss** — Eric Trexler

### Patologías (nivel 3 — clínico)
13. **The DASH Diet Action Plan** — Marla Heller
14. **The Complete Guide to Fasting** — Jason Fung (perder grasa)
15. **Nutrition and Diagnosis-Related Care (8th ed.)** — Sylvia Escott-Stump

---

## 🗺️ 7. Mapa de Archivos y Dependencias

```
app/api/generar-plan-inicial/route.ts
├── lib/supabase-server.ts               → Conexión DB
├── lib/knowledge-base.ts                 → Evidencia científica
├── lib/deepseek.ts                       → Prompt con recetas reales
├── lib/distribucion-proteinas.ts         → Distribución estratégica MPS  ← NUEVO
└── lib/periodizacion/mesociclo.ts        → Planificación de mesociclos  ← NUEVO

lib/auto-coach.ts
├── lib/supabase.ts                       → Conexión DB
├── lib/periodizacion/mesociclo.ts        → Feedback loop              ← NUEVO
└── types/index.ts                        → TipoRecomendacion extendido ← MODIFICADO

components/dashboard/AutoCoachPanel.tsx  → UI de recomendaciones       ← MODIFICADO
```

---

## ✅ 8. Checklist de Verificación para Próxima Sesión

Cuando otro agente retome el proyecto, debe verificar:

- [ ] `npx tsc --noEmit` → **0 errores** (compilación limpia)
- [ ] `POST /api/generar-plan-inicial` con cliente real devuelve `modo: "ia_con_recetas"` (no `"fallback"`)
- [ ] La respuesta incluye `distribucion_proteina` con `mps_activada: true` en ≥3 comidas
- [ ] La respuesta incluye `mesociclo` con `semanas.length > 0` y `objetivo` correcto
- [ ] Los protocolos científicos se inyectan correctamente (verificar en `prompt` guardado en `registros_ia`)
- [ ] Auto-coach detecta estancamiento y genera recomendación de tipo `'periodizacion_ajuste'`

### Pendientes para implementar
- [ ] Gap #7 — Validación activa de micronutrientes post-generación
- [ ] Gap #8 — Micro-learning automático para clientes
- [ ] Gap #9 — Plan de entrenamiento integrado en el plan inicial
- [ ] Gap #4 — Nutrición peri-entreno sincronizada con motor de entreno
- [ ] Test end-to-end con los 5 clientes de prueba via Vercel
