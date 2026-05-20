# 🏆 Auditoría Profunda: Sistema Actual vs. Coach Nutricional Top-ED (Mercado Premium)

**Fecha:** 20-05-2026
**Objetivo:** Evaluar cada módulo del sistema NutriCoach contra el estándar de un coach real de primer nivel, identificar gaps y proponer mejoras priorizadas.

---

## 📋 Resumen Ejecutivo

El sistema actual tiene **sólidas bases científicas**: conocimiento basado en 15 protocolos, cálculo de TDEE por Mifflin-St Jeor, segmentación por perfil, flags psicológicos y motor de periodización. Sin embargo, hay **8 gaps estructurales** que separan el sistema de un coach top-ed real. Este documento los detalla con soluciones concretas.

---

## 🔬 Gap #1 — Generación de dieta SIN comidas reales (CRÍTICO)

### Estado actual
[`app/api/generar-plan-inicial/route.ts`](app/api/generar-plan-inicial/route.ts:184-259) genera un JSON con `kcal_objetivo`, `macros` y `distribucion_comidas` (porcentajes por comida) pero **NO asigna recetas reales**. El plan que ve el coach son solo números. Por otro lado, [`lib/deepseek.ts`](lib/deepseek.ts:66-142) (`construirPrompt()`) ya tiene toda la lógica para generar dietas con **recetas reales agrupadas por categoría**, pero **nunca se llama desde el endpoint de plan inicial**.

### Lo que haría un coach top-ed
- Entregar un plan de comidas completo desde el día 1: desayuno, comida, merienda, cena con recetas asignadas, porciones calculadas y lista de la compra.
- Ajustar porciones de cada receta para cumplir macros ±5%.
- Personalizar por patología usando datos de micronutrientes (azúcares para diabetes, sodio para HTA, fibra para digestivo).

### Solución
Unificar [`generar-plan-inicial/route.ts`](app/api/generar-plan-inicial/route.ts) con [`deepseek.ts > construirPrompt()`](lib/deepseek.ts:66-142):

1. En el endpoint, después de calcular TDEE y macros objetivo, **llamar a `construirPrompt()`** con las recetas disponibles filtradas por perfil del cliente.
2. La respuesta de DeepSeek ahora incluirá `plantilla_id_elegida`, `comidas` (con `receta_id` y `cantidad_porciones`) y `macros_totales`.
3. Guardar `receta_id` en el plan para poder reconstruir la lista de la compra automáticamente.

```typescript
// En generar-plan-inicial/route.ts — después de calcular kcalObjetivo y macros
import { construirPrompt, generarDietaConIA } from '@/lib/deepseek'

// Obtener recetas disponibles (filtrar por perfil)
const { data: recetas } = await supabase
  .from('recetas')
  .select('id, nombre, categoria, kcal, proteinas, carbohidratos, grasas, azucares, sodio_mg, fibra')

const promptComidas = construirPrompt(datosCliente, plantillas, recetas, evidenciaBlock)
const resultado = await generarDietaConIA(promptComidas)
```

**Prioridad:** 🔴 Crítica | **Impacto:** La diferencia entre un plan de macros y un plan de comidas real

---

## 📊 Gap #2 — Periodización de Macronutrientes Incompleta

### Estado actual
- [`lib/periodizacion/motor-macros.ts`](lib/periodizacion/motor-macros.ts) ajusta calorías semanales (+10% por fatiga + carga alta) y ajuste diario por TLS.
- [`lib/periodizacion/arbol-decision.ts`](lib/periodizacion/arbol-decision.ts) evalúa check-ins y dispara refeed, ajuste de sueño, soporte o alerta coach.
- [`lib/periodizacion/umbrales.ts`](lib/periodizacion/umbrales.ts) define umbrales estáticos.

### Lo que haría un coach top-ed
- **Mesociclos de 3-4 semanas:** No ajusta día a día, sino que planifica bloques. Ej: 3 semanas déficit + 1 semana mantenimiento (Diet Break).
- **Carb Cycling:** Días altos en CHO (entreno intenso) / días bajos en CHO (descanso) con cambios >30%, no el 17.5% actual.
- **Refeed programado:** No solo cuando hay fatiga, sino como parte estructurada cada 2-3 semanas en déficit.
- **Reverse Dieting:** Protocolo para subir calorías gradualmente al salir de déficit (50-100 kcal/semana).
- **Umbrales dinámicos:** Que evolucionen con el cliente (no `UMBRALES_DEFAULT` fijos).

### Solución
```typescript
// lib/periodizacion/mesociclo.ts (NUEVO)
interface SemanaMesociclo {
  tipo: 'deficit' | 'mantenimiento' | 'refeed' | 'carga'
  kcal_modificador: number  // -15%, 0%, +10%, +20%
  cho_modificador: number
  duracion_dias: number
}

function planificarMesociclo(
  objetivo: string,
  semanas_en_deficit: number,
  fatiga_acumulada: number,
  adherencia: number
): SemanaMesociclo[] {
  if (objetivo === 'perder_grasa' && semanas_en_deficit >= 4) {
    return [
      { tipo: 'deficit', kcal_modificador: -0.15, cho_modificador: -0.20, duracion_dias: 14 },
      { tipo: 'refeed', kcal_modificador: 0, cho_modificador: +0.30, duracion_dias: 7 },
    ]
  }
  // Más lógica...
}
```

**Prioridad:** 🟡 Alta | **Impacto:** Previene estancamiento, mejora adherencia a largo plazo

---

## 🎯 Gap #3 — Distribución de Proteína por Comida para MPS

### Estado actual
El sistema calcula proteína total/día (ej: 221g para Carlos) pero **no distribuye estratégicamente**. Un coach top-ed sabe que la síntesis de proteína muscular (MPS) se maximiza con **20-40g de proteína por comida**, espaciadas cada 3-4 horas.

### Lo que haría un coach top-ed
- Distribuir la proteína objetivo en **4-5 tomas de 25-40g**.
- Para adultos >50 años (como Pedro, 65): aumentar a **30-45g por comida** por resistencia anabólica.
- Priorizar proteína post-entreno (20-40g lo antes posible).
- Ajustar distribución según horarios reales del cliente.

### Solución
En [`generar-plan-inicial/route.ts`](app/api/generar-plan-inicial/route.ts:250-259), en el bloque de distribución de comidas:

```typescript
function distribuirProteinas(
  proteinasTotales: number,
  edad: number,
  numComidas: number
): number[] {
  const porComida = edad > 50 
    ? Math.max(Math.round(proteinasTotales / numComidas), 30)
    : Math.round(proteinasTotales / numComidas)
  
  // Asegurar que la comida post-entreno tenga más proteína
  const distribucion = Array(numComidas).fill(porComida)
  distribucion[1] = Math.min(distribucion[1] + 10, 50) // Comida post-entreno
  return distribucion
}
```

**Prioridad:** 🟡 Alta | **Impacto:** Mejora retención muscular en déficit, crucial para mayores

---

## 🏃 Gap #4 — Nutrición-Entrenamiento Desacoplados

### Estado actual
- [`lib/motor-entreno.ts`](lib/motor-entreno.ts) genera recomendaciones de entrenamiento (modalidad, volumen, intensidad).
- El plan nutricional ignora completamente el output del motor de entreno.
- No hay ajuste automático de macros por carga de entrenamiento.

### Lo que haría un coach top-ed
- Si el motor detecta volumen alto (TLS > 30), los macros se ajustan automáticamente: +CHO en días intensos, -CHO en descanso.
- Periodización de nutrientes sincronizada con el ciclo de entrenamiento (semana de carga → superávit calórico controlado).
- Nutrición peri-entreno calculada automáticamente según tipo de entreno:
  - Fuerza/Powerlifting: CHO pre + BCAA/EAA intra
  - Resistencia: CHO pre + intra (geles/bebidas)
  - HIIT/CrossFit: CHO pre + proteína post

### Solución
```typescript
// lib/integracion-nutricion-entreno.ts (NUEVO)
function ajustarMacrosPorEntreno(
  macrosBase: MacrosBase,
  recomendacionEntreno: RecomendacionEntreno,
  perfil: PerfilEntrenoCliente
): MacrosAjustados {
  const diasSemana = recomendacionEntreno.dias_semana
  
  return {
    // Días de entreno intenso: +CHO
    dias_entreno: {
      ...macrosBase,
      carbohidratos: macrosBase.carbohidratos * 1.20,
      grasas: macrosBase.grasas * 0.90,
    },
    // Días de descanso: -CHO, +grasa
    dias_descanso: {
      ...macrosBase,
      carbohidratos: macrosBase.carbohidratos * 0.70,
      grasas: macrosBase.grasas * 1.15,
    },
    // Peri-entreno
    peri_entreno: {
      pre: recomendacionEntreno.modalidad === 'resistencia' 
        ? '50-75g CHO (fruta/avena)' 
        : '30-40g CHO + 10g proteína',
      durante: recomendacionEntreno.tls_semanal > 200 
        ? '30-60g CHO/hora (bebida isotónica)' 
        : 'agua',
      post: '20-40g proteína + 1g CHO/kg peso',
    }
  }
}
```

**Prioridad:** 🟡 Alta | **Impacto:** Sincroniza nutrición con gasto real, evita infra/sub-alimentación en días clave

---

## 🧬 Gap #5 — Knowledge Base Insuficiente (Patologías)

### Estado actual
[`lib/knowledge-base.ts`](lib/knowledge-base.ts) tiene **15 protocolos** que cubren: pérdida grasa, ganancia muscular, recomposición, rendimiento, running, ciclismo/triatlón, Hyrox/CrossFit, fuerza/powerlifting, diabetes T2, hipotiroidismo, menopausia/SOP, vegetariano/vegano, sarcopenia, amateur recreacional.

### Lo que haría un coach top-ed
Un coach real necesita protocolos para:
1. **🩸 HTA/Hipertensión** (Pedro) — Faltante actual
2. **🩸 Dislipemia** — Colesterol LDL/HDL/triglicéridos
3. **🩺 Síndrome Metabólico** — Combinación HTA + dislipemia + resistencia insulina
4. **🦋 Hashimoto / Tiroiditis** — Diferente de hipotiroidismo genérico
5. **🧠 Ansiedad / Depresión** — Impacto en alimentación emocional
6. **🤰 Post-parto / Lactancia** — Necesidades específicas
7. **🍷 Higado graso (NAFLD)** — Muy frecuente
8. **🦴 Osteopenia / Osteoporosis** — Calcio/Vit D/proteína
9. **💊 Interacciones fármaco-nutriente** — Antihipertensivos, estatinas, antidepresivos, AINES
10. **🧬 Genética / Nutrigenómica** — MTHFR, FTO, APOE (visión futura)

### Solución
Añadir a [`BASE_CONOCIMIENTO`](lib/knowledge-base.ts) los protocolos faltantes. Especialmente crítico:

```typescript
{
  id: 'hta',
  nombre: 'Hipertensión arterial (HTA)',
  tags: ['hta', 'hipertension', 'presion_alta', 'cardiovascular'],
  descripcion: 'Abordaje nutricional para reducción de PA',
  referencias: ['DASH diet (NEJM 1997, 2015)', 'JACC 2021: sodio < 1500mg/día'],
  principios: [
    'Reducción de sodio a < 1500-2000 mg/día',
    'Aumento potasio (frutas, verduras, legumbres): > 3500 mg/día',
    'Dieta DASH: rica en frutas, verduras, lácteos desnatados, cereales integrales',
    'Limitar alcohol: ≤ 1 ud/día mujeres, ≤ 2 ud/día hombres',
    'Magnesio > 300 mg/día de fuentes dietéticas',
    'Proteína magra: pescado azul por omega-3 (EPA+DHA > 2g/semana)',
  ],
  aplicacion: (perfil) => ({
    mensaje: 'PRIORIDAD: reducir sodio, aumentar potasio y fibra. Implementar patrón DASH.',
    limite_alimentos: ['embutidos', 'conservas_saladas', 'snacks_salados', 'quesos_curados', 'pan_industrial'],
    priorizar_alimentos: ['frutas_frescas', 'verduras_hoja_verde', 'legumbres', 'pescado_azul', 'frutos_secos_sin_sal'],
  })
}
```

**Prioridad:** 🔴 Crítica (HTA urgente) / 🟡 Alta (resto) | **Impacto:** Clientes con patologías reciben protocolos genéricos en lugar de específicos

---

## 🔄 Gap #6 — Ciclo Feedback Auto-Coach → Periodización (Inexistente)

### Estado actual
- [`lib/auto-coach.ts`](lib/auto-coach.ts) detecta adherencia baja, peso estancado, pérdida rápida, sueño bajo, energía baja, falta de check-ins, inactividad.
- [`lib/periodizacion/arbol-decision.ts`](lib/periodizacion/arbol-decision.ts) evalúa check-ins y dispara acciones.
- **Problema:** Son sistemas independientes. Auto-coach detecta estancamiento pero no dispara la periodización. La periodización evalúa check-ins pero no recibe datos históricos de auto-coach.

### Lo que haría un coach top-ed
- Auto-coach detecta peso estancado 2 semanas → dispara evaluación de periodización → decide si es momento de refeed, ajuste calórico, o cambio de estrategia.
- Auto-coach detecta adherencia < 50% 3 semanas → NO más restricción → revisar plan completo.
- Historial de decisiones se guarda para aprender qué funciona con cada cliente.

### Solución
```typescript
// En auto-coach.ts — integrar con periodización
import { evaluarCheckin } from '@/lib/periodizacion/arbol-decision'
import { calcularAjusteCaloricoSemanal } from '@/lib/periodizacion/motor-macros'

export async function analizarCliente(clienteId: string) {
  const recomendaciones = []
  
  // Detecciones existentes (adherencia, peso, sueño...)
  const detecciones = await detectarProblemas(clienteId)
  
  // Si detecta estancamiento de peso + buena adherencia
  if (detecciones.pesoEstancado && detecciones.adherencia > 70) {
    const ultimoCheckin = await getUltimoCheckin(clienteId)
    const evaluacion = evaluarCheckin(ultimoCheckin, UMBRALES_DEFAULT)
    
    if (evaluacion.accion === 'refeed') {
      recomendaciones.push({
        tipo: 'periodizacion_refeed',
        mensaje: 'Cliente estancado con buena adherencia. Iniciar refeed 1 semana.',
        accion: 'Ajustar macros automáticamente: +10% kcal, +30% CHO'
      })
    }
  }
  
  return { recomendaciones, detecciones }
}
```

**Prioridad:** 🟡 Alta | **Impacto:** Cierra el círculo detección → acción → resultado

---

## 📐 Gap #7 — Micronutrientes: Seguimiento Activo vs. Pasivo

### Estado actual
- Las recetas tienen datos de **azúcares, sodio y fibra** por porción.
- El prompt de [`generar-plan-inicial`](app/api/generar-plan-inicial/route.ts:102-105) incluye instrucciones básicas para filtrar por estos valores.
- **No hay verificación post-generación** de que el plan cumple los targets de micronutrientes.

### Lo que haría un coach top-ed
- Verificar que el plan generado cumple: sodio < 2000mg/día, fibra > 25g/día, azúcares añadidos < 20g/día.
- Para HTA: verificar sodio < 1500mg/día.
- Para diabetes: verificar fibra > 30g/día, azúcares < 10g/100g por receta.
- Ajustar recetas si no cumple targets.

### Solución
```typescript
// lib/validacion-micronutrientes.ts (NUEVO)
interface TargetMicronutriente {
  nutriente: 'sodio_mg' | 'fibra' | 'azucares'
  max?: number
  min?: number
}

function validarPlanMicronutrientes(
  comidas: ComidaGenerada[],
  condiciones: string[]
): { valido: boolean; alertas: string[] } {
  const targets: TargetMicronutriente[] = [
    { nutriente: 'sodio_mg', max: condiciones.includes('hta') ? 1500 : 2000 },
    { nutriente: 'fibra', min: condiciones.includes('diabetes') ? 30 : 25 },
    { nutriente: 'azucares', max: 20 },
  ]
  
  // Calcular totales del plan
  // Comparar con targets
  // Devolver alertas si no cumple
}
```

**Prioridad:** 🟢 Media | **Impacto:** Garantiza seguridad en clientes con patologías

---

## 📝 Gap #8 — Educación y Micro-Learning Automatico

### Estado actual
El sistema no entrega contenido educativo al cliente. Solo recibe el plan y los check-ins.

### Lo que haría un coach top-ed
- Enviar **píldoras educativas** basadas en el perfil del cliente:
  - Diabetes T2: "Cómo el vinagre en las comidas reduce el pico glucémico"
  - HTA: "3 formas de reducir sodio sin sacrificar sabor"
  - Déficit: "Por qué no saltarse comidas acelera el hambre"
- Automatizado según fase del proceso: semana 1 → "cómo medir porciones", semana 3 → "qué hacer cuando comes fuera", etc.

### Solución
```typescript
// lib/micro-learning.ts (NUEVO)
const MODULOS_EDUCATIVOS = {
  perder_grasa: [
    { semana: 1, titulo: 'El déficit calórico no es hambre', contenido: '...' },
    { semana: 3, titulo: 'Cómo manejar el hambre emocional', contenido: '...' },
  ],
  diabetes: [
    { semana: 1, titulo: 'Orden de ingesta: verduras → proteína → CHO', contenido: '...' },
  ],
  // ...
}

function obtenerModulos(perfil: PerfilCliente, semana: number): ModuloEducativo[] {
  return MODULOS_EDUCATIVOS
    .filter(m => m.perfil.includes(perfil.objetivo) || m.perfil.some(p => perfil.condiciones.includes(p)))
    .filter(m => m.semana === semana)
}
```

**Prioridad:** 🟢 Media | **Impacto:** Diferencia entre un plan y una experiencia educativa completa

---

## 🐛 Bug Confirmado: Línea 324 usa `tipo: 'dieta'`

### Estado actual
[`app/api/generar-plan-inicial/route.ts:324`](app/api/generar-plan-inicial/route.ts:324) guarda el plan con `tipo: 'dieta'`. Ahora que la constraint de [`registros_ia`](app/api/generar-plan-inicial/route.ts:321-329) permite `'plan_inicial'`, hay que actualizarlo.

```typescript
// Cambiar:
tipo: 'dieta',
// Por:
tipo: 'plan_inicial',
```

**Prioridad:** 🔴 Crítica | **Arreglo inmediato** (1 línea)

---

## 📐 Gap #9 — Plan de Entrenamiento Integrado en el Plan Inicial

### Estado actual
El [`motor-entreno.ts`](lib/motor-entreno.ts) existe y puede generar recomendaciones de entrenamiento, pero el endpoint de plan inicial solo genera nutrición. No hay un plan de entrenamiento inicial.

### Lo que haría un coach top-ed
- Al generar el plan nutricional, también genera un plan de entrenamiento básico alineado.
- Las recomendaciones de entreno se guardan junto con el plan (misma sesión de IA).
- El coach puede ver nutrición + entreno en una sola vista.

### Solución
```typescript
// En generar-plan-inicial/route.ts — al final
const recomEntreno = evaluarPerfilEntreno({
  modalidad: onboarding.tipo_entreno,
  nivel: onboarding.nivel_actividad,
  dias_semana: onboarding.dias_entreno,
  // ...
})

// Guardar recomendación de entreno (tabla recomendaciones_entreno o similar)
await supabase.from('recomendaciones_entreno').insert({
  cliente_id,
  ...recomEntreno,
  creado_en: new Date().toISOString(),
})
```

**Prioridad:** 🟢 Media | **Impacto:** Visión 360° del plan

---

## 📊 Priorización y Roadmap

| Gap # | Descripción | Prioridad | Esfuerzo | Impacto |
|-------|-------------|-----------|----------|---------|
| 🔴 #1 | Dieta sin comidas reales | **CRÍTICO** | 2-3h | La diferencia entre un plan de macros y un plan real |
| 🔴 Bug | `tipo: 'dieta'` → `'plan_inicial'` | **CRÍTICO** | 1 min | Consistencia de datos |
| 🔴 #5 | Falta protocolo HTA | **CRÍTICO** | 30 min | Cliente hipertenso sin protocolo específico |
| 🟡 #2 | Periodización incompleta | **ALTA** | 4-5h | Mesociclos, carb cycling, reverse dieting |
| 🟡 #3 | Distribución proteína por MPS | **ALTA** | 1h | Maximiza retención/síntesis muscular |
| 🟡 #4 | Nutrición-entreno desacoplados | **ALTA** | 3-4h | Sincroniza macros con carga real |
| 🟡 #6 | Feedback loop auto-coach → periodización | **ALTA** | 2-3h | Cierra el círculo detección-acción |
| 🟢 #7 | Validación micronutrientes | **MEDIA** | 1-2h | Seguridad en patologías |
| 🟢 #8 | Micro-learning automático | **MEDIA** | 3-4h | Diferenciador educativo |
| 🟢 #9 | Plan entreno inicial | **MEDIA** | 1-2h | Visión 360° |

### Próximos pasos inmediatos (esta sesión)

1. ✅ [`Arreglar línea 324`](app/api/generar-plan-inicial/route.ts:324) — `tipo: 'dieta'` → `'plan_inicial'`
2. ✅ [`Añadir protocolo HTA`](lib/knowledge-base.ts) a la base de conocimiento
3. Empezar Gap #1 — Unir `generar-plan-inicial` con `construirPrompt()` para generar comidas reales

---

## 🧠 Conclusión

El sistema actual tiene **buenas bases** (conocimiento científico sólido, segmentación, flags psicológicos, motor de periodización básico, detección de adherencia) pero **tres gaps fundamentales** lo separan de un coach top-ed:

1. **No genera comidas reales** — solo números de macros. Un coach de verdad entrega un plato, no una calculadora.
2. **No cierra el círculo** — auto-coach detecta problemas pero no dispara acciones correctivas automáticas (periodización, ajuste de plan).
3. **Cobertura de patologías incompleta** — falta HTA, dislipemia, síndrome metabólico, entre otras.

Abordando estos 3 gaps, el sistema pasa de ser un "generador de macros con ciencia" a un **coach nutricional autónomo de primer nivel**.
