# 🧬 Análisis Detallado: Competidores vs NutriCoach

> **Propósito:** Desglosar feature por feature lo que hacen las otras apps, cómo lo hacen, y qué significaría implementarlo en NutriCoach. Para que Carlos decida qué QUERE y qué NO.
>
> **Fecha:** 20-05-2026

---

## 📊 Comparativa Rápida

| Feature | MacroFactor | wger | FatSecret | Open Food Facts | RP Strength | **NOSOTROS** |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| Plan personalizado IA | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| Recetas reales con fotos | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ 227** |
| DeepSeek V3 generando planes | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| 18 protocolos científicos | ❌ | ❌ | ❌ | ❌ | ✅ parcial | **✅** |
| TDEE que se ajusta solo | **✅** | ❌ | ❌ | ❌ | ❌ | ❌ |
| Escaneo código barras | **✅** | ❌ | **✅** | **✅** | ❌ | ❌ |
| Food diary / registro comidas | **✅** | **✅** | **✅** | ❌ | ❌ | ❌ |
| Workout logging (sets/reps) | **✅** | **✅** | ❌ | ❌ | ❌ | ❌ básico |
| Ejercicios con taxonomía muscular | **✅** | **✅** | ❌ | ❌ | ❌ | ❌ básico |
| Estimated 1RM | **✅** | **✅** | ❌ | ❌ | ❌ | ❌ |
| Nutri-Score / calidad nutricional | ❌ | ❌ | ❌ | **✅** | ❌ | ❌ |
| Comidas guardadas favoritas | ❌ | ❌ | **✅** | ❌ | ❌ | ❌ |
| Gamificación / streaks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| App nativa mobile | **✅** | **✅** | **✅** | **✅** | **✅** | **❌ PWA** |
| MCP server (API para IA) | **✅** | **✅** REST | **✅** REST | **✅** REST | ❌ | ❌ |

---

## 1. 🥇 MACROFACTOR — El rey del ajuste automático

### Qué es
App de nutrición de **Stronger By Science** (los mismos de los meta-análisis de proteína más citados del mundo). Es la app más respetada por la comunidad científica del fitness.

### Cómo funciona su core

#### A) TDEE Dinámico (su killer feature)

No usan fórmulas (Mifflin-St Jeor, Harris-Benedict). **Calculan tu TDEE real en vivo:**

```
Cada mañana: cliente pesa → registro en app
Cada comida: cliente logra lo que come → calorías reales
Cada 7 días: algoritmo calcula:

  TDEE_real = (calorías_medias_7días) - (cambio_peso_semanal × 7700)

  Ejemplo:
  - Has comido 2,100 kcal/día de media
  - Has perdido 0.3kg esta semana (→ déficit de 2,310 kcal = 330 kcal/día)
  - Tu TDEE real = 2,100 + 330 = 2,430 kcal/día
```

**¿Por qué es mejor que fórmulas?**
- Una fórmula estima tu TDEE con ~200-400 kcal de error
- El método de MacroFactor ajusta con los datos reales de TU cuerpo
- Si empiezas a entrenar más y gastas más, el TDEE sube automáticamente la semana siguiente

#### B) Ajuste de macros semanal automático

```
Semana 1: plan dice "come 2,000 kcal para perder 0.5kg/semana"
Semana 2: pesas, has perdido 0.2kg → el algoritmo NO espera al coach
           → ajusta automáticamente: "baja a 1,850 kcal"
Semana 3: pesas, has perdido 0.6kg → "súbete a 1,900 kcal para no perder tan rápido"
```

**Parámetros que ajusta:**
- Calorías totales
- Proteína (se mantiene estable, 1.6-2.2 g/kg)
- Carbohidratos (ajuste principal)
- Grasas (ajuste secundario)

**Considera adherencia:**
- Si solo has registrado el 60% de los días → el ajuste es más conservador
- No sabe qué comiste el 40% restante, así que asume que quizás comiste más

#### C) Workout API (nuestra oportunidad de fork)

Tienen una estructura de datos impresionante para entrenos:

```
Workout
  ├── id, name, startTime, duration
  ├── gym (perfil de gimnasio)
  └── blocks[] (grupos de ejercicios para superseries)
        └── exercises[]
              ├── exerciseId → resuelve a nombre, músculos, equipamiento
              ├── note, baseWeight
              └── sets[]
                    ├── setType: "warmUp" | "standard" | "failure"
                    └── log:
                          ├── weight (kg)
                          ├── fullReps
                          ├── partialReps
                          ├── rir (reps in reserve)
                          ├── restTimer
                          └── isSkipped
```

**Tools de su MCP server:**
- `get_workouts` / `get_workout` — leer historial
- `log_workout` — crear entrenos
- `log_exercise` — añadir ejercicios a entreno existente
- `update_workout_set` — actualizar peso, reps, RIR
- `search_exercises` / `search_foods` — búsqueda en sus bases de datos
- `resolve_muscle` / `resolve_equipment` — taxonomía completa

#### D) Food Logging (lo que nos falta)

- `log_food` / `log_food_by_id` — registrar comida
- `get_food_log` — ver lo registrado por fecha
- `get_nutrition` — resumen nutricional por fecha
- `update_food_entry` / `delete_food_entry` — editar
- `log_weight` — registrar peso diario

### ✅ Lo que SÍ tiene y deberíamos implementar

| Feature | Prioridad | Por qué |
|---------|-----------|---------|
| **TDEE dinámico** | 🔴 MUY ALTA | Sin esto, nuestros planes son estáticos. El cliente pierde peso al ritmo que sea, no al que planificamos |
| **Ajuste semanal automático** | 🔴 MUY ALTA | Si el plan dice -0.5kg/semana y el cliente pierde -0.2kg, necesitamos ajustar. Hoy no lo hacemos |
| **Workout logging con sets/reps/RIR** | 🔴 ALTA | Nuestro motor de entreno (Gap #9) es básico. No podemos ajustar carbs peri-entreno si no sabemos qué entrenó |
| **Estructura de datos de ejercicios** | 🟡 MEDIA | Tener base de ejercicios con músculos, equipamiento, variaciones |

### ❌ Lo que NO necesitamos copiar

| Feature | Por qué no |
|---------|------------|
| Sin recetas | **Nosotros tenemos 227 recetas reales** — ellos no. Es nuestra ventaja |
| Sin coaching humano | Nosotros tenemos auto-coach + coach real |
| Sin micro-learning | Nosotros educamos al cliente (Gap #8) |
| Sin validación micronutrientes | Gap #7 ya resuelto |
| Sin periodización en mesociclos | Gap #2 ya resuelto |

---

## 2. 🏋️ WGER — El open-source reference model

### Qué es
Gestor de entrenamiento y nutrición **open-source** (GPL). Cualquiera puede descargarlo, hostearlo, y contribuir. Tiene 13+ años de desarrollo comunitario.

### Lo que hace mejor

#### A) Exercise Database (lo más valioso para nosotros)

Tienen **cientos de ejercicios** con esta estructura:

```
Ejercicio
  ├── uuid (identificador único, no auto-incremental)
  ├── name (multi-idioma via Weblate)
  ├── category (pecho, espalda, piernas, hombros, brazos, abdominales)
  ├── muscles[] (músculos primarios)
  ├── muscles_secondary[] (músculos secundarios)
  ├── equipment[] (barra, mancuerna, polea, máquina, peso corporal, etc.)
  ├── variations[] (variaciones del mismo ejercicio)
  ├── license, license_author
  └── image
```

**¿Por qué es valioso?**
- Nosotros tenemos ejercicios en `seed_ejercicios.sql` pero sin taxonomía muscular
- No podemos decir "este cliente no ha entrenado pectoral en 3 días → sugerir press banca"
- No podemos calcular volumen semanal por grupo muscular
- Con esta estructura SÍ podríamos

#### B) Workout Logging (el estándar de la industria)

```
POST /api/v2/workoutsession/
{
  "routine": 5,          // qué rutina siguió
  "date": "2025-01-20",  
  "impression": "good",  // cómo se sintió (good, neutral, bad)
  "time_start": "08:00",
  "time_end": "09:15"
}

POST /api/v2/workoutlog/
{
  "exercise": "c788d643-...",  // UUID del ejercicio
  "reps": 10,
  "weight": 80,                // kg
  "rir": 1,                    // reps in reserve (cuántas reps dejaste en cámara)
  "estimated_1rm": 107.5       // calculado automáticamente
}
```

**Fórmula de Epley para estimated 1RM:**
```
1RM = peso × (1 + reps / 30)

Ejemplo: 80kg × 10 reps → 1RM = 80 × (1 + 10/30) = 80 × 1.33 = 106.7 kg
```

**¿Para qué sirve?**
- Ver progresión real de fuerza (no solo "hoy levanté 80kg" — depende de las reps)
- Auto-regular el peso del siguiente entrenamiento
- Detectar estancamiento (si el 1RM estimado no sube en 3 semanas → intervención)

#### C) Nutrition Plan (estructura de datos útil)

```
NutritionPlan
  └── Meals[]
        ├── order, name, time
        └── MealItems[]
              ├── ingredient (ID del alimento)
              ├── amount (gramos)
              └── weight_unit

NutritionDiary (logging diario)
  ├── plan, meal, ingredient
  ├── amount (gramos reales consumidos)
  └── datetime (timestamp exacto)
```

### ✅ Lo que podríamos forkear de wger

| Feature | Prioridad | Por qué |
|---------|-----------|---------|
| **Taxonomía de ejercicios con UUIDs** | 🟡 MEDIA | Nos permite sugerir entrenos personalizados por grupo muscular |
| **WorkoutLog con RIR** | 🔴 ALTA | Sin RIR no sabemos la intensidad real. Un cliente puede hacer 80kg x 10 con RIR 3 (fácil) o RIR 0 (al fallo). Nutrición peri-entreno diferente |
| **Estimated 1RM** | 🟡 MEDIA | Para ver progresión real de fuerza. Muy motivador para el cliente |
| **WorkoutSession con impresión** | 🟢 BAJA | "Cómo te sentiste" es un buen indicador de fatiga acumulada |

### ❌ Lo que NO nos interesa

| Feature | Por qué no |
|---------|------------|
| Toda su UI/UX | Es fea, obsoleta, sin IA |
| Su nutrition plan | Nosotros ya tenemos DeepSeek generando planes con recetas reales |
| Su sistema de autenticación | Nosotros ya tenemos onboarding autónomo con invitaciones |

---

## 3. 🍽️ FATSECRET — El food diary veterano

### Qué es
Una de las primeras apps de nutrición (2007). Tienen **una de las bases de datos de alimentos más grandes** y una API con 3-legged OAuth que permite a terceros leer/escribir el food diary del usuario.

### Lo que hace mejor

#### A) Food Diary API (lo que más nos interesa)

```
// Crear entrada en el diario
POST /profile/diary/entries
{
  "food_id": 33691,
  "food_name": "Apple",
  "serving_description": "100g",
  "metric_serving_amount": 100,
  "date": "2025-01-20",
  "meal": "breakfast"
}

// Copiar entradas de un día a otro (¡super útil para meal prep!)
POST /profile/diary/entries/copy
{
  "from_date": "2025-01-20",
  "to_date": "2025-01-21"
}

// Copiar entre comidas del mismo día
POST /profile/diary/entries/copy_meal
{
  "date": "2025-01-20",
  "from_meal": "lunch",
  "to_meal": "dinner"
}

// Editar / borrar
PUT  /profile/diary/entries/{id}   → serving, cantidad, comida
DELETE /profile/diary/entries/{id}
```

**¿Por qué es valioso?**
- El cliente puede copiar el desayuno de ayer a hoy en 1 clic
- Si hace meal prep, copia la comida de toda la semana
- El concepto de "serving" (ración) con descripción y cantidad métrica es clave

#### B) Saved Meals (comidas guardadas)

```
// Guardar una combinación de alimentos como "comida"
POST /profile/saved_meals
// → "Desayuno habitual": 3 huevos + 100g pan integral + 20g aceite oliva

// Reutilizarla después
POST /profile/diary/entries
// → "usar saved_meal X" en lugar de añadir 3 alimentos uno por uno
```

**¿Por qué es valioso?**
- La mayoría de la gente come lo mismo 3-4 desayunos diferentes
- Si guardas "Desayuno A", "Desayuno B", logras en 2 taps en vez de 10

#### C) Algoritmo de "más usados"

``` 
// Los alimentos que más registra el cliente aparecen primero
GET /profile/foods/most_eaten
GET /profile/foods/recently_eaten
```

**¿Por qué es valioso?**
- Reduce fricción: el cliente no busca "huevos" cada día, aparecen arriba
- Es lo que hace que MyFitnessPal sea rápido de usar

### ✅ Lo que podríamos implementar de FatSecret

| Feature | Prioridad | Por qué |
|---------|-----------|---------|
| **Food diary con copia entre fechas** | 🟡 MEDIA | Útil para meal prep. Bajo esfuerzo técnico |
| **Comidas guardadas** | 🟡 MEDIA | "Mi desayuno habitual" en 2 taps. Bajo esfuerzo |
| **Alimentos más usados / recientes** | 🟢 BAJA | Reduce fricción. Medio esfuerzo |

### ❌ Lo que NO nos interesa

| Feature | Por qué no |
|---------|------------|
| API OAuth 1.0 legacy | No queremos depender de FatSecret. Usaremos Open Food Facts + nuestra BD |
| Recetas sin fotos | Nosotros tenemos fotos reales |
| Sin IA | Nosotros tenemos DeepSeek |

---

## 4. 🌍 OPEN FOOD FACTS — La Wikipedia de los alimentos

### Qué es
Base de datos colaborativa de alimentos. **2.9 millones de productos** escaneados por usuarios de todo el mundo. Código abierto, API pública, sin ánimo de lucro.

### Lo que hace mejor

#### A) Barcode Lookup (nuestro principal interés)

```
GET https://world.openfoodfacts.net/api/v2/product/{barcode}

Respuesta (parcial):
{
  "code": "3017624010701",     // código de barras
  "product": {
    "product_name": "Nutella",
    "brands": "Ferrero",
    "quantity": "400g",
    "nutriments": {
      "energy-kcal_100g": 539,
      "proteins_100g": 6.8,
      "carbohydrates_100g": 57.5,
      "fat_100g": 31.8,
      "fiber_100g": 0.9,
      "sodium_100g": 0.033
    },
    "nutriscore_data": {        // Nutri-Score
      "grade": "e",             // A, B, C, D, E
      "score": 19
    },
    "ecoscore_data": {          // Eco-Score
      "grade": "d",
      "score": 58
    },
    "ingredients": [            // Lista de ingredientes con análisis
      { "id": "en:sugar", "percent": 56.8 },
      { "id": "en:palm-oil", "percent": 10.5 },
      ...
    ],
    "additives": ["e322"],      // Aditivos
    "allergens": ["en:milk", "en:soybeans"],
    "nova_group": 4,            // NOVA classification (4 = ultra-processed)
    "categories": "Breakfasts,Sweet spreads"
  }
}
```

**¿Por qué es valioso?**
- Escaneas un código de barras y obtienes TODOS los datos nutricionales
- No necesitas mantener tu propia base de datos de productos manufacturados
- Detectas ultra-processados (NOVA 4) → útil para educación del cliente

#### B) Nutri-Score

Clasificación de A (mejor) a E (peor) basada en:
- **Puntos negativos:** calorías, azúcares, grasas saturadas, sodio
- **Puntos positivos:** fibra, proteína, fruta/verdura/frutos secos

**¿Por qué es valioso?**
- Podemos puntuar cada plan semanal con Nutri-Score
- "Tu plan de esta semana tiene un Nutri-Score B" → gamificación
- Comparar planes: "Este plan es más saludable que el anterior"

#### C) NOVA Classification

Clasifica alimentos en 4 grupos según su procesamiento:
1. **NO PROCESADOS** — fruta, verdura, carne, huevos
2. **INGREDIENTES CULINARIOS** — aceite, miel, sal
3. **PROCESADOS** — queso, pan, conservas
4. **ULTRA-PROCESADOS** — galletas, refrescos, embutidos, cereales de desayuno

**¿Por qué es valioso?**
- Podemos alertar al cliente: "El 30% de tus calorías vienen de ultra-procesados"
- Micro-learning: "Reduce los ultra-procesados y mejorarás tu composición corporal"
- Diferenciación: ninguna app de coaching nutricional lo hace

### ✅ Lo que podríamos implementar de OFF

| Feature | Prioridad | Por qué |
|---------|-----------|---------|
| **Barcode scan → lookup nutricional** | 🔴 ALTA | Sin esto, el food diary es manual y tedioso. Es el estándar de la industria |
| **Nutri-Score para planes** | 🟡 MEDIA | Diferenciación. Mostrar calidad nutricional del plan al cliente |
| **Detección de ultra-procesados** | 🟢 BAJA | Educación nutricional. Bajo esfuerzo |

### ❌ Lo que NO nos interesa

| Feature | Por qué no |
|---------|------------|
| Toda la base de datos (2.9M productos) | No necesitamos copiarla. Consultamos su API en vivo |
| Eco-Score | Interesante pero no es prioridad para coaching nutricional |
| Editar productos | No vamos a contribuir a OFF, solo consumimos |

---

## 5. 🆚 TABLA: LO QUE TENEMOS vs LO QUE NECESITAMOS

### Generación de Planes — Ganamos NOsotros

| Aspecto | Nosotros | MacroFactor | Diferencia |
|---------|:--------:|:-----------:|:----------:|
| Plan con recetas reales | ✅ | ❌ | **+NOS** |
| 227 recetas con fotos | ✅ | ❌ | **+NOS** |
| IA generando planes | ✅ DeepSeek | ❌ | **+NOS** |
| 18 protocolos científicos | ✅ | ❌ | **+NOS** |
| Periodización en mesociclos | ✅ 5 modos | ❌ | **+NOS** |
| Micro-learning para cliente | ✅ | ❌ | **+NOS** |
| Validación micronutrientes | ✅ | ❌ | **+NOS** |

### Ajuste Continuo — Ganan ELLOS

| Aspecto | Nosotros | MacroFactor | Diferencia |
|---------|:--------:|:-----------:|:----------:|
| TDEE calculado con datos reales | ❌ Fórmulas | ✅ En vivo | **-NOS** |
| Ajuste semanal automático | ❌ Manual | ✅ Automático | **-NOS** |
| Food diary / registro comidas | ❌ | ✅ | **-NOS** |
| Workout logging con sets/reps | ❌ Básico | ✅ Completo | **-NOS** |
| Estimated 1RM | ❌ | ✅ | **-NOS** |

> **La estrategia:** Nosotros generamos el MEJOR plan inicial del mercado (recetas + ciencia). Ellos hacen el MEJOR ajuste continuo. Si combinamos ambas → imbatible.

---

## 6. 🎯 PROPUESTA DE QUÉ IMPLEMENTAR (ordenado por impacto)

### 🔴 NIVEL 1 — Imprescindible para competir

#### 1. TDEE Dinámico + Ajuste Semanal

**Qué es:** Que el sistema calcule el gasto calórico real del cliente basado en su peso y calorías registradas, y ajuste los macros automáticamente cada semana.

**Cómo funciona:**
```
Cada mañana: cliente se pesa → app registra
Cada comida: cliente logra → app suma calorías
Cada lunes: algoritmo:
  - TDEE real = kcal_medias_7dias + (delta_peso × 7700 / 7)
  - Si pérdida esperada = 0.5kg/sem y real = 0.2kg/sem → ajustar kcal -200
  - Si pérdida esperada = 0.5kg/sem y real = 0.8kg/sem → ajustar kcal +150
```

**Qué archivos crear:**
- `lib/ajuste-dinamico/tdee-real.ts` — algoritmo de TDEE
- `lib/ajuste-dinamico/ajuste-macros.ts` — ajuste semanal
- `app/api/log-peso/route.ts` — endpoint peso
- `app/api/log-comida/route.ts` — endpoint comida
- Migración SQL: `registro_peso_diario`, `registro_comidas_diario`

**Esfuerzo:** 5-7 días

---

#### 2. Food Diary Básico + Escaneo Barcode

**Qué es:** Que el cliente pueda registrar lo que come cada día, escaneando códigos de barras o buscando alimentos.

**Dos partes:**
1. **Food diary**: interfaz donde el cliente ve "Desayuno, Comida, Cena, Snacks" y añade alimentos con cantidades
2. **Barcode scanner**: cámara → código de barras → lookup en Open Food Facts → datos nutricionales

**Por qué es crítico:**
- Sin food diary, no podemos calcular TDEE real (necesitamos calorías consumidas)
- Es el principal engagement de las apps de nutrición
- Sin logging, el cliente no tiene accountability

**Qué archivos crear:**
- Componente `FoodDiary` — UI de logging diario
- Componente `BarcodeScanner` — cámara + lookup
- `lib/barcode-scanner.ts` — integración con OFF API
- Tablas: `registro_comidas_diario`, `comidas_guardadas`, `alimentos_frecuentes`

**Esfuerzo:** 7-10 días

---

#### 3. Workout Logging con RIR

**Qué es:** Que el cliente registre sus entrenos: ejercicio, sets, reps, peso, RIR (reps in reserve).

**Por qué es importante:**
- Sin RIR no sabemos intensidad real
- Un cliente que entrena con RIR 0 (al fallo) necesita más carbs peri-entreno que uno con RIR 3
- La fatiga acumulada por entrenos afecta la adherencia al plan nutricional
- Podemos detectar sobre-entrenamiento y ajustar calorías/diet break

**Qué archivos crear:**
- Componente `WorkoutLogger` — UI de logging de entreno
- `lib/workout/estimated-1rm.ts` — fórmula de Epley
- Enriquecer `seed_ejercicios.sql` con taxonomía muscular

**Esfuerzo:** 5-7 días

---

### 🟡 NIVEL 2 — Importante pero no crítico

#### 4. Comidas Guardadas + Algoritmo de Frecuencia

**Qué es:** El cliente guarda sus combinaciones habituales ("Desayuno A: 3 huevos + pan + aceite") y las reusa. Los alimentos más usados aparecen primero en las búsquedas.

**Esfuerzo:** 3-4 días

#### 5. Aprendizaje por Outcomes

**Qué es:** El sistema recopila datos de los resultados de los clientes y calibra los parámetros para mejorar predicciones futuras.

**Ejemplo:** Después de 20 clientes, el sistema aprende que las mujeres >40 años con hipotiroidismo tienen un TDEE un 12% menor de lo estimado → el prompt de DeepSeek se ajusta automáticamente.

**Esfuerzo:** 10-15 días (requiere datos de Fase 1 y 2 primero)

---

### 🟢 NIVEL 3 — Nice-to-have / Diferenciación

#### 6. Nutri-Score para Planes

Calidad nutricional de cada plan semanal. "Tu plan tiene un Nutri-Score B 👍"

**Esfuerzo:** 2-3 días

#### 7. Gamificación

Streaks (días seguidos de logging), logros, resumen semanal celebratorio.

**Esfuerzo:** 5-7 días

---

## 7. 💡 MI RECOMENDACIÓN (para que decidas)

### Si solo pudieras elegir 3 cosas:

1. **TDEE dinámico + ajuste semanal** — Es el core de MacroFactor. Sin esto, nuestros planes son estáticos y ciegos a la realidad.
2. **Food diary + barcode** — Necesitamos datos reales de consumo para el TDEE. Además, es lo que engancha al cliente.
3. **Workout logging con RIR** — Necesitamos saber qué entrena el cliente para ajustar nutrición peri-entreno y detectar fatiga.

### Orden que propongo:

```
Semana 1-2:  TDEE dinámico + ajuste semanal (Fase 1)
  → El cliente se pesa cada día → el sistema ajusta macros automáticamente

Semana 3-4:  Food diary + barcode (Fase 2)
  → El cliente registra lo que come → alimenta el TDEE real

Semana 5-6:  Workout logging + RIR (Fase 3)
  → El cliente registra entrenos → ajuste peri-entreno dinámico

Semana 7-9:  Aprendizaje por outcomes (Fase 4)
  → El sistema se vuelve más preciso con cada cliente

Semana 10-11: Gamificación (Fase 5)
  → Streaks, logros, celebración
```

### ¿Qué te parece esta descomposición? ¿Hay algo que quieras quitar, añadir, o cambiar de orden?

---

> **Documento relacionado:** [`plans/ESTRATEGIA_MEJORA_CONTINUA.md`](plans/ESTRATEGIA_MEJORA_CONTINUA.md) — plan completo con diagramas, tablas y estimaciones.
