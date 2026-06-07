# Spec: Recetario Agente Chef — Base de recetas + agente personalizado

**Fecha:** 07-06-2026  
**Estado:** Aprobado por Carlos  
**Proyecto:** NutriCoach — `nutricoach/`

---

## Problema

El recetario actual tiene dos defectos críticos que impiden que el agente trabaje como un nutricionista-chef real:

1. **Nombres técnicos visibles al cliente.** Las recetas actuales tienen nombres como "Arroz suave con pollo y calabacin para tapering" o "Pasta con pavo y tomate para carga de carbohidratos". El cliente ve terminología clínica que rompe la experiencia y resulta poco apetecible.

2. **El agente no personaliza.** Selecciona recetas por compatibilidad de metadatos pero ignora los gustos del cliente, su historial de adherencia, los formularios de onboarding y el feedback semanal. El resultado no se siente personalizado.

---

## Objetivo

Construir un sistema de dos capas que permita al agente generar planes de recetas que:

- **Parezcan diseñados a mano** para cada cliente: nombre atractivo, ingredientes que le gustan, técnica que prefiere, macros exactos de su plan.
- **Sean nutricionalmente correctos** según evidencia científica y el momento del deportista.
- **Nunca muestren terminología técnica** al cliente (tapering, pre-entreno, CHO, TDEE, bowl, etc.).
- **Escalen sin trabajo manual**: 40 esqueletos generan 200+ recetas distintas adaptables por cliente.

---

## Arquitectura: dos capas

### Capa 1 — Esqueletos (invariantes técnicos)

Define la anatomía de la receta: roles de ingrediente, ratios de macros, metadatos técnicos ocultos y sustituciones posibles por rol.

```typescript
{
  id: 'arroz-pollo-verdura-pre-endurance',
  ingredientes: [
    { rol: 'carbohidrato_base',   nombre: 'arroz blanco',     gramos: 90  },
    { rol: 'proteina_principal',  nombre: 'pechuga de pollo', gramos: 130 },
    { rol: 'verdura_volumen',     nombre: 'calabacín',        gramos: 100 },
    { rol: 'grasa_saludable',     nombre: 'aceite de oliva',  gramos: 8   },
    { rol: 'salsa_condimento',    nombre: 'limón',            gramos: 20  },
  ],
  tecnica: 'plancha + vapor',
  metadatos: {
    momentos:               ['pre_entreno', 'tapering'],
    deportes:               ['running', 'ciclismo', 'endurance'],
    objetivos:              ['rendimiento'],
    digestibilidad:         'alta',
    nivel_carbohidrato:     'alto',
    nivel_proteina:         'medio',
    patologias_compatibles: ['resistencia_insulina'],
    fodmaps:                'bajos',
    adaptable_gramos:       true,
  },
  sustituciones: {
    carbohidrato_base:   ['pasta', 'boniato', 'quinoa', 'cuscús', 'patata'],
    proteina_principal:  ['merluza', 'atún', 'pavo', 'huevo', 'bacalao'],
    verdura_volumen:     ['brócoli', 'judías verdes', 'espinacas', 'pimiento', 'zanahoria'],
    salsa_condimento:    ['limón', 'vinagre de Módena', 'mostaza suave', 'tomate triturado'],
  },
}
```

Los metadatos son **exclusivamente para uso del agente**. El cliente nunca los ve.

### Capa 2 — Recetas generadas por DeepSeek

DeepSeek recibe el esqueleto adaptado al cliente y genera texto visible de calidad chef-healthy:

- `nombre`: atractivo, en castellano mediterráneo, sin terminología técnica
- `descripcion`: 2-3 frases culinarias
- `instrucciones`: pasos detallados con intención culinaria (textura, montaje, contraste)
- `consejos`: tips opcionales

---

## Los 40 esqueletos

### Distribución por perfil

| Perfil | Momentos/situaciones | Tipos de plato | N |
|--------|---------------------|----------------|---|
| Pérdida de grasa | base, déficit moderado, día entreno, día descanso | Desayuno, Comida, Cena, Merienda, Snack | 14 |
| Rendimiento deportivo | pre-entreno, post-entreno, carga CHO, tapering, recuperación, base | Desayuno, Comida, Cena, Merienda | 14 |
| Patología + deporte | hipotiroidismo, colon irritable, resistencia insulina, dislipidemia | Comida, Cena, Desayuno, Snack | 12 |

**40 esqueletos × ~5 sustituciones por rol → 200+ recetas generables**

### Roles de ingrediente definidos

| Rol | Qué es | Ejemplos |
|-----|--------|---------|
| `carbohidrato_base` | Fuente principal de CHO | arroz, pasta, boniato, avena, pan, patata |
| `proteina_principal` | Fuente proteica dominante | pollo, merluza, huevo, atún, pavo, salmón |
| `proteina_secundaria` | Proteína complementaria | queso fresco, yogur griego, legumbre |
| `grasa_saludable` | Grasa de calidad | aceite de oliva, aguacate, frutos secos |
| `verdura_volumen` | Verdura de relleno | calabacín, brócoli, espinacas, pimiento |
| `fruta_complemento` | Fruta como componente | plátano, manzana, frutos rojos, naranja |
| `salsa_condimento` | Salsa o condimento | limón, tomate, mostaza, yogur-limón, pesto |
| `lacteo_base` | Base láctea o vegetal | leche, yogur, bebida de avena |

---

## Contexto de cliente que lee el agente

```typescript
contextoCliente: {
  // Del onboarding y formularios
  alimentos_favoritos:            string[],
  alimentos_rechazados:           string[],
  dieta_habitual:                 string,
  intolerancias:                  string[],
  patologias:                     string[],
  horario_entrenos:               string,    // 'mañana' | 'tarde' | 'noche'

  // Inferido de historial de adherencia (registro_comidas_dia)
  recetas_completadas_30d:        string[],
  recetas_saltadas_30d:           string[],
  patron_abandono:                string,    // ej: 'salta verduras crudas y legumbres'
  tecnicas_culinarias_preferidas: string[],  // inferido de completadas

  // De check-ins semanales
  energia_media:                  number,
  adherencia_7d:                  number,
  peso_trend:                     'bajando' | 'estable' | 'subiendo',

  // De Garmin/Strava (actividad_externa_cliente)
  carga_entreno_semana:           'baja' | 'media' | 'alta',
  sesion_proximas_horas:          boolean,

  // Del perfil atleta
  deporte:                        string,
  objetivo:                       string,
  sport_modality:                 string,
}
```

---

## Flujo de generación personalizada

```
Esqueleto compatible con perfil
    ↓
Aplica sustituciones por alimentos_rechazados + intolerancias
    ↓
Elige técnica según tecnicas_culinarias_preferidas
    ↓
Consulta TAG_BRIDGE + papers KB para razonamiento científico
    ↓
Ajusta gramos a macros del plan del cliente
    ↓
Construye briefing para DeepSeek con restricciones de vocabulario
    ↓
DeepSeek genera: nombre + descripción + instrucciones + consejos
    ↓
Validador de vocabulario (bloquea si hay términos prohibidos)
    ↓
Receta insertada en BD con metadatos ocultos (estado: 'en_revision')
```

---

## Razonamiento científico del agente

El agente no solo filtra por metadatos — razona sobre *por qué* una receta es la correcta para ese momento.

**Ejemplo: runner con colon irritable antes de competición**

```
Agente consulta KB:
  → 'colon_irritable' + 'pre_competicion'
  → Singh 2017: FODMAPs bajos reducen síntomas en >75%
  → Jeukendrup 2011: 1-4h antes → CHO 1-4g/kg, bajo en grasa y fibra

Agente descarta automáticamente:
  → Esqueletos con brócoli, cebolla, legumbres, lácteos, trigo integral

Agente selecciona:
  → 'arroz-pollo-zanahoria' (digestibilidad: alta, FODMAPs: bajos)

Instrucción a DeepSeek:
  "Receta sencilla de arroz con pollo y zanahoria. Estilo casero.
   Sin cebolla, sin ajo crudo, sin lácteos. Nombre atractivo castellano."

Resultado visible al cliente:
  "Arroz blanco con pollo a la plancha y zanahoria tierna"
```

---

## Vocabulario culinario

### Permitido en nombres y descripciones

- **Texturas:** meloso, cremoso, jugoso, tierno, crujiente, suave, especiado, aromático
- **Técnicas españolas:** al horno, a la plancha, al vapor, guisado, estofado, salteado, en salsa, al ajillo, con sofrito
- **Referencias:** mediterráneo, casero, de temporada, de la huerta
- **Carbohidratos:** arroz, pasta, macarrones, fideos, boniato, patata, avena
- **Salsas fit:** yogur-limón, tomate especiado, pesto de albahaca, mostaza-miel, tahini ligero

### Prohibido en campos visibles (nombre, descripción, instrucciones)

- Terminología de periodización: tapering, carga, carga CHO, pre-entreno, post-entreno
- Términos clínicos: TDEE, macros, proteico, fit, saludable (como adjetivo de nombre)
- Latinismos culinarios no españoles: dorado (en sentido culinario latinoamericano), tatemado, al mojo
- Anglicismos: bowl, smoothie bowl, açaí bowl, granola bowl
- Términos de entrenamiento: RPE, RIR, HRV, TLS

---

## Validador de vocabulario

Archivo: `lib/recetas/agente-recetario/vocabulary-guard.ts`

- Comprueba `nombre`, `descripcion`, `instrucciones` y `consejos`
- Falla la receta antes de insertarla si detecta término prohibido
- Devuelve el término infractor y una sugerencia de reemplazo
- Se ejecuta también en el quality gate existente

---

## Ficheros afectados

### Nuevos
| Archivo | Rol |
|---------|-----|
| `lib/recetas/esqueletos/perdida-grasa.ts` | 14 esqueletos perfil grasa |
| `lib/recetas/esqueletos/rendimiento.ts` | 14 esqueletos perfil rendimiento |
| `lib/recetas/esqueletos/patologia.ts` | 12 esqueletos perfil patología |
| `lib/recetas/esqueletos/index.ts` | Exporta todos + tipos |
| `lib/recetas/agente-recetario/vocabulary-guard.ts` | Validador vocabulario |
| `scripts/generar-recetas-desde-esqueletos.ts` | Generador masivo con DeepSeek |

### Modificados
| Archivo | Cambio |
|---------|--------|
| `lib/recetas/agente-recetario/templates.ts` | Reescritura: nombres eliminados, sustituciones añadidas |
| `lib/recetas/agente-recetario/generator.ts` | Lógica personalización con contexto cliente |
| `lib/recetas/agente-recetario/validator.ts` | Integra vocabulary-guard |
| `lib/agentes/executor.ts` | `cargarContextoCliente()` ampliado con gustos + adherencia |

---

## Fases de implementación

### Fase A — Diseño (sin BD)
1. Reescribir templates existentes (eliminar nombres técnicos, añadir sustituciones)
2. Escribir los 40 esqueletos en los 3 archivos de perfil
3. Crear vocabulary-guard con lista completa de términos prohibidos

### Fase B — Generación
1. Script `generar-recetas-desde-esqueletos.ts` con flags `--dry-run`, `--limite`, `--perfil`, `--variaciones`
2. Ejecutar en dry-run, revisar calidad de nombres e instrucciones
3. Ejecutar con `--apply`, revisar en `/recetas` y aprobar en lote

### Fase C — Agente inteligente
1. Ampliar `cargarContextoCliente()` con gustos, adherencia e historial
2. Actualizar `generator.ts` con lógica de sustitución y personalización
3. Test E2E: cliente real → plan generado → recetas visibles en portal

---

## Criterios de éxito

- Ningún nombre de receta contiene términos técnicos (vocabulary-guard al 100%)
- Un cliente con intolerancia al gluten nunca recibe receta con gluten
- Un cliente que ha rechazado 3 veces la ensalada no la vuelve a recibir
- El agente cita al menos 1 paper al justificar la selección de recetas para un momento específico
- Carlos, al ver el plan generado para un cliente real, no necesita cambiar ninguna receta manualmente
