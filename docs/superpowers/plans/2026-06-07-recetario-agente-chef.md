# Recetario Agente Chef — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una base de 40 esqueletos de receta + generador DeepSeek + agente inteligente que personaliza recetas por cliente sin mostrar nunca terminología técnica.

**Architecture:** Sistema de dos capas: esqueletos técnicos (TypeScript puro, metadatos ocultos) + generación DeepSeek (nombre + descripción + instrucciones en castellano mediterráneo). El agente lee el perfil completo del cliente (gustos, historial adherencia, formularios, check-ins, Garmin) para adaptar ingredientes, técnica y gramos antes de llamar a DeepSeek.

**Tech Stack:** Next.js 16, TypeScript, DeepSeek API (`deepseek-chat`), Supabase service role, `dotenv`

---

## Mapa de ficheros

| Acción | Fichero | Rol |
|--------|---------|-----|
| Crear | `lib/recetas/esqueletos/types.ts` | Tipos base del sistema de esqueletos |
| Crear | `lib/recetas/esqueletos/perdida-grasa.ts` | 14 esqueletos perfil pérdida de grasa |
| Crear | `lib/recetas/esqueletos/rendimiento.ts` | 14 esqueletos perfil rendimiento deportivo |
| Crear | `lib/recetas/esqueletos/patologia.ts` | 12 esqueletos perfil patología + deporte |
| Crear | `lib/recetas/esqueletos/index.ts` | Exporta todos + helper de filtrado |
| Crear | `lib/recetas/agente-recetario/vocabulary-guard.ts` | Valida que no hay términos técnicos visibles |
| Crear | `scripts/generar-recetas-desde-esqueletos.ts` | Script generador masivo con DeepSeek |
| Modificar | `lib/recetas/agente-recetario/templates.ts` | Eliminar nombres técnicos, añadir sustituciones |
| Modificar | `lib/recetas/agente-recetario/generator.ts` | Lógica personalización por contexto cliente |
| Modificar | `lib/recetas/agente-recetario/validator.ts` | Integrar vocabulary-guard |
| Modificar | `lib/agentes/types.ts` | Ampliar ContextoCliente con gustos + adherencia |
| Modificar | `lib/agentes/executor.ts` | Ampliar cargarContextoCliente con nuevos campos |

---

## Task 1: Tipos base del sistema de esqueletos

**Ficheros:**
- Crear: `lib/recetas/esqueletos/types.ts`

- [ ] **Crear el fichero de tipos**

```typescript
// lib/recetas/esqueletos/types.ts

export type RolIngrediente =
  | 'carbohidrato_base'
  | 'proteina_principal'
  | 'proteina_secundaria'
  | 'grasa_saludable'
  | 'verdura_volumen'
  | 'fruta_complemento'
  | 'salsa_condimento'
  | 'lacteo_base'
  | 'especias_aromaticos'

export type Tecnica =
  | 'plancha'
  | 'horno'
  | 'vapor'
  | 'guisado'
  | 'estofado'
  | 'salteado'
  | 'crudo'
  | 'plancha + vapor'
  | 'horno + plancha'

export type Digestibilidad = 'alta' | 'media' | 'baja'
export type NivelMacro = 'bajo' | 'medio' | 'alto'
export type FodmapNivel = 'bajos' | 'medios' | 'altos'

export type PerfilEsqueleto = 'perdida_grasa' | 'rendimiento' | 'patologia'

export type IngredienteEsqueleto = {
  rol: RolIngrediente
  nombre: string
  gramos: number
  esFijo?: boolean // si true, no se sustituye aunque el cliente rechace el alimento
}

export type MetadatosEsqueleto = {
  momentos: string[]          // ['pre_entreno', 'tapering', 'base', 'post_entreno', 'carga_cho', 'recuperacion', 'deficit', 'entreno', 'descanso']
  deportes: string[]          // ['running', 'ciclismo', 'hyrox', 'fuerza', 'natacion', 'endurance', 'todos']
  objetivos: string[]         // ['perdida_grasa', 'rendimiento', 'salud', 'ganancia_muscular']
  digestibilidad: Digestibilidad
  nivel_carbohidrato: NivelMacro
  nivel_proteina: NivelMacro
  nivel_grasa: NivelMacro
  patologias_compatibles: string[]  // ['resistencia_insulina', 'colon_irritable', 'hipotiroidismo', 'dislipidemia', 'ninguna']
  patologias_incompatibles: string[] // rechazar si el cliente tiene estas
  fodmaps: FodmapNivel
  adaptable_gramos: boolean
  timing_ideal: string[]      // ['manana', 'mediodia', 'tarde', 'noche']
}

export type SustitucionesPorRol = Partial<Record<RolIngrediente, string[]>>

export type Esqueleto = {
  id: string
  perfil: PerfilEsqueleto
  tipoPlato: string           // 'Desayuno' | 'Comida' | 'Cena' | 'Merienda' | 'Snack' | 'Almuerzo'
  ingredientes: IngredienteEsqueleto[]
  tecnica: Tecnica
  metadatos: MetadatosEsqueleto
  sustituciones: SustitucionesPorRol
}
```

- [ ] **Commit**

```bash
git add lib/recetas/esqueletos/types.ts
git commit -m "feat: tipos base sistema esqueletos recetario"
```

---

## Task 2: Vocabulary guard

**Ficheros:**
- Crear: `lib/recetas/agente-recetario/vocabulary-guard.ts`

- [ ] **Crear el validador de vocabulario**

```typescript
// lib/recetas/agente-recetario/vocabulary-guard.ts

const TERMINOS_PROHIBIDOS: Array<{ patron: RegExp; sugerencia: string }> = [
  { patron: /\btapering\b/i,         sugerencia: 'día de carga ligera' },
  { patron: /\bpre[- ]entreno\b/i,   sugerencia: 'antes del ejercicio' },
  { patron: /\bpost[- ]entreno\b/i,  sugerencia: 'después del ejercicio' },
  { patron: /\bcarga\s+cho\b/i,      sugerencia: 'jornada de energía' },
  { patron: /\bcarga\s+de\s+carbohidratos\b/i, sugerencia: 'jornada de energía' },
  { patron: /\bTDEE\b/,              sugerencia: 'gasto energético' },
  { patron: /\bmacros\b/i,           sugerencia: '' },
  { patron: /\bproteico\b/i,         sugerencia: '' },
  { patron: /\bfit\b/i,              sugerencia: '' },
  { patron: /\bhealthy\b/i,          sugerencia: '' },
  { patron: /\bsaludable\b/i,        sugerencia: 'casero' },
  { patron: /\bbol\b/i,              sugerencia: 'plato' },
  { patron: /\bbowl\b/i,             sugerencia: 'plato' },
  { patron: /\bsmoothi/i,            sugerencia: 'batido' },
  { patron: /\bacaí\b/i,             sugerencia: '' },
  { patron: /\bgranola\s+bowl\b/i,   sugerencia: 'copos con frutas' },
  { patron: /\bdorado\b/i,           sugerencia: 'tostado' },  // sentido culinario latinoamericano
  { patron: /\bRPE\b/,               sugerencia: '' },
  { patron: /\bRIR\b/,               sugerencia: '' },
  { patron: /\bHRV\b/,               sugerencia: '' },
  { patron: /\bTLS\b/,               sugerencia: '' },
  { patron: /\bkcal\b/i,             sugerencia: '' },
  { patron: /\bIG\s+bajo\b/i,        sugerencia: '' },
  { patron: /\bFODMAP/i,             sugerencia: '' },
  { patron: /\bgoitrógenos?\b/i,     sugerencia: '' },
  { patron: /\bdislipidemia\b/i,     sugerencia: '' },
  { patron: /\bhipotiroidismo\b/i,   sugerencia: '' },
  { patron: /\bresistencia\s+a\s+la\s+insulina\b/i, sugerencia: '' },
  { patron: /\bcolon\s+irritable\b/i, sugerencia: '' },
  { patron: /para\s+el?\s+rendimiento\b/i, sugerencia: '' },
  { patron: /para\s+(la\s+)?recuperación\b/i, sugerencia: '' },
]

export type VocabularyViolation = {
  campo: string
  patron: string
  sugerencia: string
}

export type VocabularyResult = {
  valido: boolean
  violaciones: VocabularyViolation[]
}

export function validarVocabulario(receta: {
  nombre: string
  descripcion: string
  instrucciones: string[]
  consejos?: string
}): VocabularyResult {
  const violaciones: VocabularyViolation[] = []

  const camposARevisar: Array<[string, string]> = [
    ['nombre', receta.nombre],
    ['descripcion', receta.descripcion],
    ['instrucciones', receta.instrucciones.join(' ')],
    ['consejos', receta.consejos ?? ''],
  ]

  for (const [campo, texto] of camposARevisar) {
    for (const { patron, sugerencia } of TERMINOS_PROHIBIDOS) {
      if (patron.test(texto)) {
        violaciones.push({ campo, patron: patron.source, sugerencia })
      }
    }
  }

  return { valido: violaciones.length === 0, violaciones }
}
```

- [ ] **Commit**

```bash
git add lib/recetas/agente-recetario/vocabulary-guard.ts
git commit -m "feat: vocabulary guard — bloquea términos técnicos en recetas visibles"
```

---

## Task 3: Esqueletos pérdida de grasa (14)

**Ficheros:**
- Crear: `lib/recetas/esqueletos/perdida-grasa.ts`

- [ ] **Crear los 14 esqueletos**

```typescript
// lib/recetas/esqueletos/perdida-grasa.ts
import type { Esqueleto } from './types'

export const ESQUELETOS_PERDIDA_GRASA: Esqueleto[] = [
  {
    id: 'pg-01-desayuno-base',
    perfil: 'perdida_grasa',
    tipoPlato: 'Desayuno',
    ingredientes: [
      { rol: 'lacteo_base',          nombre: 'yogur griego natural 0%',  gramos: 150 },
      { rol: 'carbohidrato_base',    nombre: 'avena en copos',            gramos: 40  },
      { rol: 'fruta_complemento',    nombre: 'frutos rojos',              gramos: 80  },
      { rol: 'proteina_secundaria',  nombre: 'proteína en polvo sabor natural', gramos: 20 },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['base', 'descanso'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'resistencia_insulina'],
      patologias_incompatibles: [],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['manana'],
    },
    sustituciones: {
      lacteo_base: ['kéfir natural', 'yogur de cabra', 'queso fresco batido 0%'],
      carbohidrato_base: ['copos de centeno', 'muesli sin azúcar', 'granola casera'],
      fruta_complemento: ['arándanos', 'frambuesas', 'mango', 'kiwi', 'plátano'],
      proteina_secundaria: ['huevo cocido', 'requesón', 'clara de huevo cocida'],
    },
  },
  {
    id: 'pg-02-desayuno-dia-entreno',
    perfil: 'perdida_grasa',
    tipoPlato: 'Desayuno',
    ingredientes: [
      { rol: 'carbohidrato_base',  nombre: 'pan de centeno',    gramos: 80  },
      { rol: 'proteina_principal', nombre: 'huevo entero',      gramos: 120 },
      { rol: 'fruta_complemento',  nombre: 'plátano',           gramos: 100 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 5   },
    ],
    tecnica: 'plancha',
    metadatos: {
      momentos: ['entreno', 'base'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa', 'rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['manana'],
    },
    sustituciones: {
      carbohidrato_base: ['pan de espelta', 'tostada integral', 'tortita de arroz'],
      proteina_principal: ['pechuga de pavo en lonchas', 'atún al natural', 'requesón'],
      fruta_complemento: ['naranja', 'manzana', 'kiwi'],
    },
  },
  {
    id: 'pg-03-comida-base',
    perfil: 'perdida_grasa',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'pechuga de pollo',  gramos: 150 },
      { rol: 'carbohidrato_base',  nombre: 'arroz blanco',      gramos: 70  },
      { rol: 'verdura_volumen',    nombre: 'brócoli',           gramos: 180 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 8   },
      { rol: 'salsa_condimento',   nombre: 'limón',             gramos: 20  },
    ],
    tecnica: 'plancha + vapor',
    metadatos: {
      momentos: ['base', 'deficit'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'hipotiroidismo', 'resistencia_insulina'],
      patologias_incompatibles: ['colon_irritable'], // brócoli puede ser FODMAP problemático
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['mediodia'],
    },
    sustituciones: {
      proteina_principal: ['merluza', 'pavo', 'atún fresco', 'bacalao', 'gambas'],
      carbohidrato_base: ['pasta integral', 'quinoa', 'boniato', 'patata'],
      verdura_volumen: ['judías verdes', 'espinacas', 'calabacín', 'pimiento', 'zanahoria'],
      salsa_condimento: ['vinagre de Módena', 'mostaza suave', 'hierbas provenzales'],
    },
  },
  {
    id: 'pg-04-comida-dia-entreno',
    perfil: 'perdida_grasa',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'pechuga de pollo',  gramos: 160 },
      { rol: 'carbohidrato_base',  nombre: 'pasta integral',    gramos: 85  },
      { rol: 'verdura_volumen',    nombre: 'calabacín',         gramos: 130 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 10  },
      { rol: 'salsa_condimento',   nombre: 'tomate triturado',  gramos: 60  },
    ],
    tecnica: 'salteado',
    metadatos: {
      momentos: ['entreno', 'post_entreno'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa', 'rendimiento'],
      digestibilidad: 'media',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna'],
      patologias_incompatibles: [],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['mediodia', 'tarde'],
    },
    sustituciones: {
      proteina_principal: ['pavo picado', 'ternera magra', 'atún fresco'],
      carbohidrato_base: ['macarrones integrales', 'espaguetis', 'arroz', 'cuscús'],
      verdura_volumen: ['pimiento rojo', 'berenjena', 'espinacas', 'champiñones'],
      salsa_condimento: ['sofrito casero', 'pisto ligero', 'salsa de tomate y albahaca'],
    },
  },
  {
    id: 'pg-05-comida-dia-descanso',
    perfil: 'perdida_grasa',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'merluza',            gramos: 180 },
      { rol: 'verdura_volumen',    nombre: 'espinacas',          gramos: 200 },
      { rol: 'carbohidrato_base',  nombre: 'patata',             gramos: 120 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',    gramos: 8   },
    ],
    tecnica: 'vapor',
    metadatos: {
      momentos: ['descanso', 'deficit'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'dislipidemia', 'resistencia_insulina'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['mediodia'],
    },
    sustituciones: {
      proteina_principal: ['bacalao', 'lubina', 'dorada al horno', 'rape', 'pechuga de pollo'],
      verdura_volumen: ['acelgas', 'judías verdes', 'zanahoria cocida', 'calabacín'],
      carbohidrato_base: ['boniato', 'arroz blanco', 'quinoa'],
    },
  },
  {
    id: 'pg-06-cena-base',
    perfil: 'perdida_grasa',
    tipoPlato: 'Cena',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'pechuga de pollo',  gramos: 140 },
      { rol: 'verdura_volumen',    nombre: 'calabacín',         gramos: 200 },
      { rol: 'verdura_volumen',    nombre: 'tomate',            gramos: 100 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 8   },
      { rol: 'especias_aromaticos', nombre: 'hierbas provenzales', gramos: 2 },
    ],
    tecnica: 'horno',
    metadatos: {
      momentos: ['base', 'deficit', 'descanso'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'bajo',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'resistencia_insulina', 'dislipidemia'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['noche'],
    },
    sustituciones: {
      proteina_principal: ['pavo', 'merluza', 'gambas', 'sepia', 'rape'],
      verdura_volumen: ['berenjena', 'pimiento', 'cebolla', 'champiñones', 'judías verdes'],
      especias_aromaticos: ['tomillo', 'romero', 'orégano', 'ajo en polvo'],
    },
  },
  {
    id: 'pg-07-cena-post-entreno-tarde',
    perfil: 'perdida_grasa',
    tipoPlato: 'Cena',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'pechuga de pavo',   gramos: 150 },
      { rol: 'carbohidrato_base',  nombre: 'arroz blanco',      gramos: 60  },
      { rol: 'verdura_volumen',    nombre: 'judías verdes',     gramos: 150 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 7   },
    ],
    tecnica: 'plancha + vapor',
    metadatos: {
      momentos: ['post_entreno', 'entreno'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa', 'rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['noche'],
    },
    sustituciones: {
      proteina_principal: ['pollo', 'merluza', 'atún fresco', 'salmón'],
      carbohidrato_base: ['pasta', 'boniato', 'quinoa'],
      verdura_volumen: ['espinacas', 'brócoli', 'calabacín', 'zanahoria'],
    },
  },
  {
    id: 'pg-08-cena-dia-descanso',
    perfil: 'perdida_grasa',
    tipoPlato: 'Cena',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'huevo entero',      gramos: 150 },
      { rol: 'verdura_volumen',    nombre: 'espinacas',         gramos: 200 },
      { rol: 'verdura_volumen',    nombre: 'tomate cherry',     gramos: 80  },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 8   },
    ],
    tecnica: 'plancha',
    metadatos: {
      momentos: ['descanso', 'deficit'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'bajo',
      nivel_proteina: 'alto',
      nivel_grasa: 'medio',
      patologias_compatibles: ['ninguna', 'resistencia_insulina'],
      patologias_incompatibles: ['dislipidemia'],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['noche'],
    },
    sustituciones: {
      proteina_principal: ['clara de huevo', 'tofu firme', 'pechuga de pollo', 'queso fresco 0%'],
      verdura_volumen: ['acelgas', 'pimiento asado', 'berenjena', 'calabacín'],
    },
  },
  {
    id: 'pg-09-merienda-activa',
    perfil: 'perdida_grasa',
    tipoPlato: 'Merienda',
    ingredientes: [
      { rol: 'lacteo_base',       nombre: 'yogur griego natural 0%', gramos: 150 },
      { rol: 'fruta_complemento', nombre: 'frutos rojos',            gramos: 80  },
      { rol: 'grasa_saludable',   nombre: 'nueces',                  gramos: 15  },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['base', 'descanso'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'bajo',
      nivel_proteina: 'alto',
      nivel_grasa: 'medio',
      patologias_compatibles: ['ninguna', 'resistencia_insulina'],
      patologias_incompatibles: [],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['tarde'],
    },
    sustituciones: {
      lacteo_base: ['kéfir', 'queso fresco batido', 'requesón'],
      fruta_complemento: ['arándanos', 'kiwi', 'manzana', 'melocotón'],
      grasa_saludable: ['almendras', 'anacardos', 'semillas de chía'],
    },
  },
  {
    id: 'pg-10-merienda-pre-entreno',
    perfil: 'perdida_grasa',
    tipoPlato: 'Merienda',
    ingredientes: [
      { rol: 'fruta_complemento',  nombre: 'plátano',          gramos: 100 },
      { rol: 'carbohidrato_base',  nombre: 'tortita de arroz', gramos: 20  },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['pre_entreno', 'entreno'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa', 'rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'bajo',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'colon_irritable'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['manana', 'tarde'],
    },
    sustituciones: {
      fruta_complemento: ['dátil', 'manzana', 'naranja', 'uvas'],
      carbohidrato_base: ['pan blanco', 'galleta de avena casera'],
    },
  },
  {
    id: 'pg-11-merienda-post-entreno',
    perfil: 'perdida_grasa',
    tipoPlato: 'Merienda',
    ingredientes: [
      { rol: 'proteina_secundaria', nombre: 'proteína en polvo',  gramos: 25  },
      { rol: 'lacteo_base',         nombre: 'leche semidesnatada', gramos: 200 },
      { rol: 'fruta_complemento',   nombre: 'plátano',            gramos: 80  },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['post_entreno'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa', 'rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna'],
      patologias_incompatibles: [],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['manana', 'tarde'],
    },
    sustituciones: {
      lacteo_base: ['bebida de avena', 'leche de almendra sin azúcar'],
      fruta_complemento: ['frutos rojos', 'mango', 'melocotón'],
    },
  },
  {
    id: 'pg-12-snack-saciante',
    perfil: 'perdida_grasa',
    tipoPlato: 'Snack',
    ingredientes: [
      { rol: 'grasa_saludable',    nombre: 'almendras',               gramos: 25  },
      { rol: 'proteina_secundaria', nombre: 'queso fresco en porciones', gramos: 50 },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['base', 'descanso'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'bajo',
      nivel_proteina: 'medio',
      nivel_grasa: 'alto',
      patologias_compatibles: ['ninguna', 'resistencia_insulina'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: false,
      timing_ideal: ['manana', 'tarde'],
    },
    sustituciones: {
      grasa_saludable: ['nueces', 'anacardos', 'pistachos sin sal'],
      proteina_secundaria: ['jamón york', 'pavo en lonchas', 'atún al natural'],
    },
  },
  {
    id: 'pg-13-snack-dulce-fit',
    perfil: 'perdida_grasa',
    tipoPlato: 'Snack',
    ingredientes: [
      { rol: 'fruta_complemento', nombre: 'manzana',                 gramos: 150 },
      { rol: 'lacteo_base',       nombre: 'yogur griego natural 0%', gramos: 80  },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['base', 'descanso'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'bajo',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'hipotiroidismo'],
      patologias_incompatibles: [],
      fodmaps: 'medios',
      adaptable_gramos: false,
      timing_ideal: ['tarde', 'manana'],
    },
    sustituciones: {
      fruta_complemento: ['pera', 'melocotón', 'mandarina', 'kiwi'],
      lacteo_base: ['requesón', 'kéfir natural'],
    },
  },
  {
    id: 'pg-14-almuerzo-media-manana',
    perfil: 'perdida_grasa',
    tipoPlato: 'Almuerzo',
    ingredientes: [
      { rol: 'fruta_complemento',   nombre: 'naranja',         gramos: 150 },
      { rol: 'proteina_secundaria', nombre: 'jamón york bajo en sal', gramos: 40 },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['base', 'deficit'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'bajo',
      nivel_proteina: 'bajo',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'dislipidemia', 'resistencia_insulina'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: false,
      timing_ideal: ['manana'],
    },
    sustituciones: {
      fruta_complemento: ['manzana', 'pera', 'mandarina', 'kiwi'],
      proteina_secundaria: ['pavo en lonchas', 'atún al natural', 'requesón'],
    },
  },
]
```

- [ ] **Commit**

```bash
git add lib/recetas/esqueletos/perdida-grasa.ts
git commit -m "feat: 14 esqueletos perfil pérdida de grasa"
```

---

## Task 4: Esqueletos rendimiento deportivo (14)

**Ficheros:**
- Crear: `lib/recetas/esqueletos/rendimiento.ts`

- [ ] **Crear los 14 esqueletos**

```typescript
// lib/recetas/esqueletos/rendimiento.ts
import type { Esqueleto } from './types'

export const ESQUELETOS_RENDIMIENTO: Esqueleto[] = [
  {
    id: 'rd-01-desayuno-base-entreno',
    perfil: 'rendimiento',
    tipoPlato: 'Desayuno',
    ingredientes: [
      { rol: 'carbohidrato_base',  nombre: 'avena en copos',         gramos: 70  },
      { rol: 'lacteo_base',        nombre: 'leche semidesnatada',    gramos: 200 },
      { rol: 'fruta_complemento',  nombre: 'plátano',                gramos: 100 },
      { rol: 'proteina_secundaria', nombre: 'proteína en polvo',     gramos: 25  },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['base', 'entreno'],
      deportes: ['running', 'ciclismo', 'hyrox', 'endurance', 'todos'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna'],
      patologias_incompatibles: [],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['manana'],
    },
    sustituciones: {
      carbohidrato_base: ['copos de centeno', 'pan de espelta tostado', 'arroz cocido'],
      lacteo_base: ['leche entera', 'bebida de avena', 'kéfir'],
      fruta_complemento: ['dátiles', 'mango', 'frutos rojos', 'naranja'],
    },
  },
  {
    id: 'rd-02-desayuno-pre-competicion',
    perfil: 'rendimiento',
    tipoPlato: 'Desayuno',
    ingredientes: [
      { rol: 'carbohidrato_base',  nombre: 'arroz blanco',       gramos: 90  },
      { rol: 'proteina_principal', nombre: 'pechuga de pavo',    gramos: 80  },
      { rol: 'salsa_condimento',   nombre: 'mermelada de fresa', gramos: 20  },
    ],
    tecnica: 'plancha',
    metadatos: {
      momentos: ['tapering', 'pre_entreno'],
      deportes: ['running', 'ciclismo', 'triathlon', 'endurance'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'medio',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'colon_irritable'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['manana'],
    },
    sustituciones: {
      carbohidrato_base: ['pan blanco tostado', 'tortita de arroz', 'plátano + avena'],
      proteina_principal: ['pechuga de pollo', 'huevo cocido', 'atún al natural'],
      salsa_condimento: ['miel', 'compota de manzana sin azúcar añadido'],
    },
  },
  {
    id: 'rd-03-desayuno-tapering',
    perfil: 'rendimiento',
    tipoPlato: 'Desayuno',
    ingredientes: [
      { rol: 'carbohidrato_base',  nombre: 'pan blanco',      gramos: 100 },
      { rol: 'proteina_principal', nombre: 'pechuga de pavo', gramos: 70  },
      { rol: 'fruta_complemento',  nombre: 'plátano',         gramos: 120 },
      { rol: 'salsa_condimento',   nombre: 'miel',            gramos: 15  },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['tapering'],
      deportes: ['running', 'ciclismo', 'endurance', 'todos'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'medio',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'colon_irritable'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['manana'],
    },
    sustituciones: {
      carbohidrato_base: ['arroz blanco cocido', 'tortitas de arroz', 'cereales sin fibra'],
      proteina_principal: ['jamón york', 'queso fresco', 'atún al natural'],
    },
  },
  {
    id: 'rd-04-desayuno-post-entreno-duro',
    perfil: 'rendimiento',
    tipoPlato: 'Desayuno',
    ingredientes: [
      { rol: 'proteina_principal',  nombre: 'huevo entero',      gramos: 150 },
      { rol: 'carbohidrato_base',   nombre: 'pan de espelta',    gramos: 80  },
      { rol: 'fruta_complemento',   nombre: 'zumo de naranja',   gramos: 200 },
      { rol: 'grasa_saludable',     nombre: 'aceite de oliva',   gramos: 5   },
    ],
    tecnica: 'plancha',
    metadatos: {
      momentos: ['post_entreno', 'recuperacion'],
      deportes: ['todos'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['manana'],
    },
    sustituciones: {
      proteina_principal: ['claras de huevo + 1 yema', 'pechuga de pavo', 'requesón'],
      carbohidrato_base: ['avena', 'tostada integral', 'arroz cocido'],
    },
  },
  {
    id: 'rd-05-comida-pre-entreno',
    perfil: 'rendimiento',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'carbohidrato_base',  nombre: 'arroz blanco',       gramos: 95  },
      { rol: 'proteina_principal', nombre: 'pechuga de pollo',   gramos: 130 },
      { rol: 'verdura_volumen',    nombre: 'calabacín',          gramos: 100 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',    gramos: 6   },
    ],
    tecnica: 'plancha + vapor',
    metadatos: {
      momentos: ['pre_entreno', 'tapering'],
      deportes: ['running', 'ciclismo', 'hyrox', 'endurance', 'fuerza'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'medio',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'colon_irritable', 'resistencia_insulina'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['mediodia'],
    },
    sustituciones: {
      carbohidrato_base: ['pasta blanca', 'patata cocida', 'boniato', 'cuscús'],
      proteina_principal: ['pechuga de pavo', 'merluza', 'atún fresco', 'bacalao'],
      verdura_volumen: ['zanahoria cocida', 'judías verdes', 'espinacas salteadas'],
    },
  },
  {
    id: 'rd-06-comida-tapering',
    perfil: 'rendimiento',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'carbohidrato_base',  nombre: 'arroz blanco',      gramos: 110 },
      { rol: 'proteina_principal', nombre: 'pechuga de pollo',  gramos: 125 },
      { rol: 'verdura_volumen',    nombre: 'zanahoria cocida',  gramos: 80  },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 5   },
    ],
    tecnica: 'vapor',
    metadatos: {
      momentos: ['tapering'],
      deportes: ['running', 'ciclismo', 'triathlon', 'endurance'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'medio',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'colon_irritable'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['mediodia'],
    },
    sustituciones: {
      carbohidrato_base: ['pasta blanca', 'patata cocida', 'boniato'],
      proteina_principal: ['merluza al vapor', 'pavo', 'bacalao desalado'],
      verdura_volumen: ['judías verdes cocidas', 'espinacas al vapor', 'calabacín al vapor'],
    },
  },
  {
    id: 'rd-07-comida-carga-cho',
    perfil: 'rendimiento',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'carbohidrato_base',  nombre: 'pasta blanca',      gramos: 130 },
      { rol: 'proteina_principal', nombre: 'pechuga de pavo',   gramos: 110 },
      { rol: 'salsa_condimento',   nombre: 'tomate triturado',  gramos: 80  },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 5   },
    ],
    tecnica: 'guisado',
    metadatos: {
      momentos: ['tapering', 'carga_cho'],
      deportes: ['running', 'ciclismo', 'triathlon', 'endurance'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'medio',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna'],
      patologias_incompatibles: ['colon_irritable', 'resistencia_insulina'],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['mediodia'],
    },
    sustituciones: {
      carbohidrato_base: ['macarrones', 'arroz blanco', 'espaguetis', 'gnocchi de patata'],
      proteina_principal: ['pechuga de pollo', 'atún al natural'],
      salsa_condimento: ['sofrito casero suave', 'salsa de tomate y albahaca'],
    },
  },
  {
    id: 'rd-08-comida-base-equilibrada',
    perfil: 'rendimiento',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'salmón fresco',      gramos: 150 },
      { rol: 'carbohidrato_base',  nombre: 'quinoa',             gramos: 75  },
      { rol: 'verdura_volumen',    nombre: 'espinacas salteadas', gramos: 150 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',    gramos: 10  },
      { rol: 'salsa_condimento',   nombre: 'limón',              gramos: 20  },
    ],
    tecnica: 'horno',
    metadatos: {
      momentos: ['base', 'recuperacion'],
      deportes: ['todos'],
      objetivos: ['rendimiento'],
      digestibilidad: 'media',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'medio',
      patologias_compatibles: ['ninguna', 'dislipidemia', 'hipotiroidismo'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['mediodia'],
    },
    sustituciones: {
      proteina_principal: ['atún fresco', 'lubina', 'dorada', 'bacalao'],
      carbohidrato_base: ['arroz integral', 'boniato', 'lentejas'],
      verdura_volumen: ['brócoli', 'judías verdes', 'pimiento asado'],
    },
  },
  {
    id: 'rd-09-cena-post-entreno',
    perfil: 'rendimiento',
    tipoPlato: 'Cena',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'pechuga de pollo',   gramos: 170 },
      { rol: 'carbohidrato_base',  nombre: 'arroz blanco',       gramos: 75  },
      { rol: 'verdura_volumen',    nombre: 'judías verdes',      gramos: 150 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',    gramos: 8   },
    ],
    tecnica: 'plancha + vapor',
    metadatos: {
      momentos: ['post_entreno', 'recuperacion'],
      deportes: ['todos'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['noche'],
    },
    sustituciones: {
      proteina_principal: ['pavo', 'merluza', 'huevo + claras', 'ternera magra'],
      carbohidrato_base: ['pasta', 'boniato', 'quinoa'],
      verdura_volumen: ['espinacas', 'brócoli', 'calabacín'],
    },
  },
  {
    id: 'rd-10-cena-tapering',
    perfil: 'rendimiento',
    tipoPlato: 'Cena',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'merluza',           gramos: 160 },
      { rol: 'carbohidrato_base',  nombre: 'patata cocida',     gramos: 180 },
      { rol: 'verdura_volumen',    nombre: 'zanahoria cocida',  gramos: 80  },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 5   },
    ],
    tecnica: 'vapor',
    metadatos: {
      momentos: ['tapering'],
      deportes: ['running', 'ciclismo', 'endurance', 'todos'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'medio',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'colon_irritable'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['noche'],
    },
    sustituciones: {
      proteina_principal: ['bacalao', 'lubina', 'pechuga de pollo', 'rape'],
      carbohidrato_base: ['arroz blanco', 'boniato', 'pasta blanca'],
      verdura_volumen: ['judías verdes', 'espinacas al vapor'],
    },
  },
  {
    id: 'rd-11-cena-recuperacion',
    perfil: 'rendimiento',
    tipoPlato: 'Cena',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'salmón fresco',     gramos: 160 },
      { rol: 'carbohidrato_base',  nombre: 'arroz integral',    gramos: 65  },
      { rol: 'verdura_volumen',    nombre: 'espinacas',         gramos: 150 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 10  },
      { rol: 'especias_aromaticos', nombre: 'cúrcuma + pimienta negra', gramos: 2 },
    ],
    tecnica: 'horno',
    metadatos: {
      momentos: ['recuperacion', 'post_entreno'],
      deportes: ['todos'],
      objetivos: ['rendimiento'],
      digestibilidad: 'media',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'medio',
      patologias_compatibles: ['ninguna', 'dislipidemia'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['noche'],
    },
    sustituciones: {
      proteina_principal: ['atún fresco', 'caballa', 'sardinas frescas', 'trucha'],
      carbohidrato_base: ['quinoa', 'boniato', 'lentejas rojas'],
      verdura_volumen: ['brócoli', 'pimiento asado', 'judías verdes'],
    },
  },
  {
    id: 'rd-12-merienda-pre-entreno-corta',
    perfil: 'rendimiento',
    tipoPlato: 'Merienda',
    ingredientes: [
      { rol: 'fruta_complemento', nombre: 'plátano',         gramos: 100 },
      { rol: 'lacteo_base',       nombre: 'yogur natural 0%', gramos: 125 },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['pre_entreno'],
      deportes: ['todos'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'bajo',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'colon_irritable'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['manana', 'tarde'],
    },
    sustituciones: {
      fruta_complemento: ['dátiles', 'uvas', 'higos', 'naranja'],
      lacteo_base: ['bebida de avena', 'kéfir'],
    },
  },
  {
    id: 'rd-13-merienda-post-entreno',
    perfil: 'rendimiento',
    tipoPlato: 'Merienda',
    ingredientes: [
      { rol: 'proteina_secundaria', nombre: 'proteína en polvo',   gramos: 30  },
      { rol: 'lacteo_base',         nombre: 'leche semidesnatada', gramos: 250 },
      { rol: 'fruta_complemento',   nombre: 'plátano',             gramos: 100 },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['post_entreno'],
      deportes: ['todos'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna'],
      patologias_incompatibles: [],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['manana', 'tarde'],
    },
    sustituciones: {
      lacteo_base: ['leche de almendra enriquecida', 'leche de avena'],
      fruta_complemento: ['mango', 'dátiles', 'frutos rojos'],
    },
  },
  {
    id: 'rd-14-snack-carga-cho',
    perfil: 'rendimiento',
    tipoPlato: 'Snack',
    ingredientes: [
      { rol: 'carbohidrato_base',  nombre: 'plátano',         gramos: 120 },
      { rol: 'carbohidrato_base',  nombre: 'dátiles medjoul', gramos: 30  },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['tapering', 'carga_cho', 'pre_entreno'],
      deportes: ['running', 'ciclismo', 'endurance'],
      objetivos: ['rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'bajo',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['ninguna', 'colon_irritable'],
      patologias_incompatibles: ['resistencia_insulina'],
      fodmaps: 'bajos',
      adaptable_gramos: false,
      timing_ideal: ['manana', 'tarde'],
    },
    sustituciones: {
      carbohidrato_base: ['tortitas de arroz con miel', 'compota de manzana', 'uvas pasas'],
    },
  },
]
```

- [ ] **Commit**

```bash
git add lib/recetas/esqueletos/rendimiento.ts
git commit -m "feat: 14 esqueletos perfil rendimiento deportivo"
```

---

## Task 5: Esqueletos patología + deporte (12)

**Ficheros:**
- Crear: `lib/recetas/esqueletos/patologia.ts`

- [ ] **Crear los 12 esqueletos**

```typescript
// lib/recetas/esqueletos/patologia.ts
import type { Esqueleto } from './types'

export const ESQUELETOS_PATOLOGIA: Esqueleto[] = [
  {
    id: 'pat-01-colon-irritable-comida',
    perfil: 'patologia',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'pechuga de pollo',  gramos: 150 },
      { rol: 'carbohidrato_base',  nombre: 'arroz blanco',      gramos: 90  },
      { rol: 'verdura_volumen',    nombre: 'zanahoria cocida',  gramos: 100 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 7   },
    ],
    tecnica: 'plancha + vapor',
    metadatos: {
      momentos: ['base', 'pre_entreno', 'tapering'],
      deportes: ['running', 'ciclismo', 'todos'],
      objetivos: ['rendimiento', 'salud'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['colon_irritable'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['mediodia'],
    },
    sustituciones: {
      proteina_principal: ['merluza al vapor', 'bacalao', 'pavo', 'gambas'],
      carbohidrato_base: ['patata cocida', 'pasta de arroz', 'tapioca cocida'],
      verdura_volumen: ['judías verdes bien cocidas', 'espinacas al vapor', 'calabacín bien cocido'],
    },
  },
  {
    id: 'pat-02-colon-irritable-cena',
    perfil: 'patologia',
    tipoPlato: 'Cena',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'merluza',           gramos: 160 },
      { rol: 'carbohidrato_base',  nombre: 'patata cocida',     gramos: 160 },
      { rol: 'verdura_volumen',    nombre: 'judías verdes',     gramos: 120 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 6   },
    ],
    tecnica: 'vapor',
    metadatos: {
      momentos: ['base', 'tapering'],
      deportes: ['todos'],
      objetivos: ['salud', 'rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['colon_irritable'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['noche'],
    },
    sustituciones: {
      proteina_principal: ['bacalao desalado', 'pechuga de pollo', 'rape', 'pavo'],
      carbohidrato_base: ['arroz blanco', 'boniato cocido'],
      verdura_volumen: ['zanahoria cocida', 'espinacas al vapor', 'calabacín al vapor'],
    },
  },
  {
    id: 'pat-03-colon-irritable-desayuno',
    perfil: 'patologia',
    tipoPlato: 'Desayuno',
    ingredientes: [
      { rol: 'carbohidrato_base',  nombre: 'arroz blanco cocido',    gramos: 150 },
      { rol: 'fruta_complemento',  nombre: 'plátano maduro',         gramos: 100 },
      { rol: 'salsa_condimento',   nombre: 'aceite de coco virgen',  gramos: 5   },
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['base', 'pre_entreno'],
      deportes: ['todos'],
      objetivos: ['salud', 'rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'bajo',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['colon_irritable'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['manana'],
    },
    sustituciones: {
      carbohidrato_base: ['pan blanco sin fibra tostado', 'tortitas de arroz'],
      fruta_complemento: ['naranja pelada', 'uvas', 'mandarina'],
    },
  },
  {
    id: 'pat-04-resistencia-insulina-comida',
    perfil: 'patologia',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'pechuga de pollo',    gramos: 170 },
      { rol: 'verdura_volumen',    nombre: 'espinacas salteadas', gramos: 200 },
      { rol: 'carbohidrato_base',  nombre: 'lentejas cocidas',    gramos: 100 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',     gramos: 10  },
      { rol: 'salsa_condimento',   nombre: 'vinagre de Módena',   gramos: 10  },
    ],
    tecnica: 'plancha + salteado',
    metadatos: {
      momentos: ['base', 'post_entreno'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa', 'salud'],
      digestibilidad: 'media',
      nivel_carbohidrato: 'bajo',
      nivel_proteina: 'alto',
      nivel_grasa: 'medio',
      patologias_compatibles: ['resistencia_insulina'],
      patologias_incompatibles: [],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['mediodia'],
    },
    sustituciones: {
      proteina_principal: ['salmón', 'ternera magra', 'merluza', 'huevo'],
      verdura_volumen: ['brócoli', 'judías verdes', 'pimiento', 'coliflor'],
      carbohidrato_base: ['garbanzos', 'judías negras', 'quinoa', 'arroz integral'],
    },
  },
  {
    id: 'pat-05-resistencia-insulina-cena',
    perfil: 'patologia',
    tipoPlato: 'Cena',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'salmón fresco',        gramos: 160 },
      { rol: 'verdura_volumen',    nombre: 'brócoli',              gramos: 200 },
      { rol: 'verdura_volumen',    nombre: 'pimiento asado',       gramos: 100 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',      gramos: 10  },
    ],
    tecnica: 'horno',
    metadatos: {
      momentos: ['base', 'descanso'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa', 'salud'],
      digestibilidad: 'media',
      nivel_carbohidrato: 'bajo',
      nivel_proteina: 'alto',
      nivel_grasa: 'medio',
      patologias_compatibles: ['resistencia_insulina', 'dislipidemia'],
      patologias_incompatibles: [],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['noche'],
    },
    sustituciones: {
      proteina_principal: ['atún fresco', 'caballa', 'pechuga de pollo', 'ternera magra'],
      verdura_volumen: ['coliflor', 'espinacas', 'calabacín', 'judías verdes'],
    },
  },
  {
    id: 'pat-06-resistencia-insulina-desayuno',
    perfil: 'patologia',
    tipoPlato: 'Desayuno',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'huevo entero',      gramos: 150 },
      { rol: 'lacteo_base',        nombre: 'queso fresco 0%',   gramos: 80  },
      { rol: 'verdura_volumen',    nombre: 'tomate',            gramos: 100 },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 5   },
    ],
    tecnica: 'plancha',
    metadatos: {
      momentos: ['base', 'descanso'],
      deportes: ['todos'],
      objetivos: ['perdida_grasa', 'salud'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'bajo',
      nivel_proteina: 'alto',
      nivel_grasa: 'medio',
      patologias_compatibles: ['resistencia_insulina'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['manana'],
    },
    sustituciones: {
      proteina_principal: ['claras + 1 yema', 'pechuga de pavo en lonchas'],
      verdura_volumen: ['espinacas', 'pimiento', 'champiñones'],
      lacteo_base: ['yogur griego natural 0%', 'requesón'],
    },
  },
  {
    id: 'pat-07-hipotiroidismo-comida',
    perfil: 'patologia',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'atún fresco',        gramos: 160 }, // yodo
      { rol: 'carbohidrato_base',  nombre: 'arroz blanco',       gramos: 85  },
      { rol: 'verdura_volumen',    nombre: 'judías verdes',      gramos: 150 }, // no goitrógena
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',    gramos: 8   },
      { rol: 'especias_aromaticos', nombre: 'perejil fresco',    gramos: 5   }, // selenio
    ],
    tecnica: 'plancha + vapor',
    metadatos: {
      momentos: ['base'],
      deportes: ['todos'],
      objetivos: ['salud', 'rendimiento'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['hipotiroidismo'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['mediodia'],
    },
    sustituciones: {
      proteina_principal: ['bacalao', 'gambas', 'merluza', 'pechuga de pollo'],
      verdura_volumen: ['zanahoria', 'espárragos', 'pimiento', 'calabacín'],
      // NO sustituir por crucíferas crudas (brócoli, coliflor, col) — goitrógenas
    },
  },
  {
    id: 'pat-08-hipotiroidismo-cena',
    perfil: 'patologia',
    tipoPlato: 'Cena',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'pechuga de pollo',      gramos: 150 },
      { rol: 'verdura_volumen',    nombre: 'espárragos trigueros',  gramos: 150 },
      { rol: 'carbohidrato_base',  nombre: 'quinoa',                gramos: 60  },
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',       gramos: 8   },
      { rol: 'especias_aromaticos', nombre: 'nueces troceadas',     gramos: 15  }, // selenio
    ],
    tecnica: 'horno',
    metadatos: {
      momentos: ['base', 'descanso'],
      deportes: ['todos'],
      objetivos: ['salud'],
      digestibilidad: 'media',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'medio',
      patologias_compatibles: ['hipotiroidismo'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['noche'],
    },
    sustituciones: {
      proteina_principal: ['pavo', 'merluza', 'salmón', 'gambas'],
      verdura_volumen: ['judías verdes', 'zanahoria', 'pimiento asado'],
      especias_aromaticos: ['semillas de sésamo', 'semillas de girasol'],
    },
  },
  {
    id: 'pat-09-dislipidemia-comida',
    perfil: 'patologia',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'salmón fresco',       gramos: 160 }, // omega-3
      { rol: 'carbohidrato_base',  nombre: 'avena cocida',        gramos: 60  }, // fibra soluble
      { rol: 'verdura_volumen',    nombre: 'brócoli',             gramos: 180 }, // esteroles
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',     gramos: 10  }, // mono
      { rol: 'especias_aromaticos', nombre: 'ajo cocido',         gramos: 8   }, // alicina
    ],
    tecnica: 'horno',
    metadatos: {
      momentos: ['base'],
      deportes: ['todos'],
      objetivos: ['salud'],
      digestibilidad: 'media',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'medio',
      patologias_compatibles: ['dislipidemia'],
      patologias_incompatibles: [],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['mediodia'],
    },
    sustituciones: {
      proteina_principal: ['caballa', 'atún fresco', 'sardinas frescas', 'trucha'],
      carbohidrato_base: ['legumbres', 'arroz integral', 'quinoa'],
      verdura_volumen: ['espinacas', 'col de Bruselas cocida', 'alcachofa cocida'],
    },
  },
  {
    id: 'pat-10-dislipidemia-cena',
    perfil: 'patologia',
    tipoPlato: 'Cena',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'caballa al horno',     gramos: 140 }, // omega-3
      { rol: 'verdura_volumen',    nombre: 'espinacas salteadas',  gramos: 200 },
      { rol: 'carbohidrato_base',  nombre: 'garbanzos cocidos',    gramos: 80  }, // esteroles
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',      gramos: 10  },
    ],
    tecnica: 'horno + salteado',
    metadatos: {
      momentos: ['base', 'descanso'],
      deportes: ['todos'],
      objetivos: ['salud'],
      digestibilidad: 'media',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'medio',
      patologias_compatibles: ['dislipidemia'],
      patologias_incompatibles: ['colon_irritable'],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['noche'],
    },
    sustituciones: {
      proteina_principal: ['sardinas frescas', 'atún fresco', 'trucha', 'salmón'],
      carbohidrato_base: ['lentejas', 'judías blancas', 'quinoa'],
      verdura_volumen: ['brócoli cocido', 'alcachofa', 'judías verdes'],
    },
  },
  {
    id: 'pat-11-dislipidemia-desayuno',
    perfil: 'patologia',
    tipoPlato: 'Desayuno',
    ingredientes: [
      { rol: 'carbohidrato_base',  nombre: 'avena en copos',         gramos: 60  }, // fibra soluble
      { rol: 'lacteo_base',        nombre: 'bebida de avena',        gramos: 200 }, // sin colesterol
      { rol: 'fruta_complemento',  nombre: 'manzana',                gramos: 120 }, // pectina
      { rol: 'grasa_saludable',    nombre: 'nueces',                 gramos: 20  }, // omega-3
    ],
    tecnica: 'crudo',
    metadatos: {
      momentos: ['base'],
      deportes: ['todos'],
      objetivos: ['salud'],
      digestibilidad: 'media',
      nivel_carbohidrato: 'alto',
      nivel_proteina: 'bajo',
      nivel_grasa: 'medio',
      patologias_compatibles: ['dislipidemia'],
      patologias_incompatibles: [],
      fodmaps: 'medios',
      adaptable_gramos: true,
      timing_ideal: ['manana'],
    },
    sustituciones: {
      fruta_complemento: ['pera', 'frutos rojos', 'naranja'],
      grasa_saludable: ['semillas de lino molidas', 'almendras', 'semillas de chía'],
      lacteo_base: ['bebida de soja sin azúcar', 'leche semidesnatada'],
    },
  },
  {
    id: 'pat-12-multipatologia-comida',
    perfil: 'patologia',
    tipoPlato: 'Comida',
    ingredientes: [
      { rol: 'proteina_principal', nombre: 'pechuga de pollo',  gramos: 160 },
      { rol: 'carbohidrato_base',  nombre: 'arroz blanco',      gramos: 80  }, // IG, sin FODMAPs
      { rol: 'verdura_volumen',    nombre: 'zanahoria cocida',  gramos: 120 }, // segura todo
      { rol: 'grasa_saludable',    nombre: 'aceite de oliva',   gramos: 8   },
    ],
    tecnica: 'plancha + vapor',
    metadatos: {
      momentos: ['base'],
      deportes: ['todos'],
      objetivos: ['salud', 'perdida_grasa'],
      digestibilidad: 'alta',
      nivel_carbohidrato: 'medio',
      nivel_proteina: 'alto',
      nivel_grasa: 'bajo',
      patologias_compatibles: ['colon_irritable', 'resistencia_insulina', 'hipotiroidismo', 'dislipidemia'],
      patologias_incompatibles: [],
      fodmaps: 'bajos',
      adaptable_gramos: true,
      timing_ideal: ['mediodia'],
    },
    sustituciones: {
      proteina_principal: ['merluza', 'bacalao', 'pavo', 'gambas'],
      carbohidrato_base: ['patata cocida', 'boniato'],
      verdura_volumen: ['judías verdes cocidas', 'espinacas al vapor'],
    },
  },
]
```

- [ ] **Commit**

```bash
git add lib/recetas/esqueletos/patologia.ts
git commit -m "feat: 12 esqueletos perfil patología + deporte"
```

---

## Task 6: Índice de esqueletos

**Ficheros:**
- Crear: `lib/recetas/esqueletos/index.ts`

- [ ] **Crear el índice y el helper de filtrado**

```typescript
// lib/recetas/esqueletos/index.ts
export type { Esqueleto, IngredienteEsqueleto, MetadatosEsqueleto, SustitucionesPorRol, RolIngrediente } from './types'
import { ESQUELETOS_PERDIDA_GRASA } from './perdida-grasa'
import { ESQUELETOS_RENDIMIENTO } from './rendimiento'
import { ESQUELETOS_PATOLOGIA } from './patologia'
import type { Esqueleto } from './types'

export const TODOS_LOS_ESQUELETOS: Esqueleto[] = [
  ...ESQUELETOS_PERDIDA_GRASA,
  ...ESQUELETOS_RENDIMIENTO,
  ...ESQUELETOS_PATOLOGIA,
]

export type FiltroEsqueleto = {
  objetivo?: string
  momento?: string
  tipoPlato?: string
  deporte?: string
  patologias?: string[]   // las del cliente — filtra incompatibles
  fodmapsMaximo?: 'bajos' | 'medios' | 'altos'
}

const FODMAP_ORDEN = { bajos: 0, medios: 1, altos: 2 }

export function filtrarEsqueletos(filtro: FiltroEsqueleto): Esqueleto[] {
  return TODOS_LOS_ESQUELETOS.filter((e) => {
    const m = e.metadatos

    if (filtro.objetivo && !m.objetivos.includes(filtro.objetivo)) return false
    if (filtro.momento && !m.momentos.includes(filtro.momento)) return false
    if (filtro.tipoPlato && e.tipoPlato !== filtro.tipoPlato) return false
    if (filtro.deporte && !m.deportes.includes(filtro.deporte) && !m.deportes.includes('todos')) return false

    // Rechazar si el cliente tiene patología incompatible
    if (filtro.patologias?.length) {
      const tieneIncompatible = m.patologias_incompatibles.some((p) =>
        filtro.patologias!.includes(p)
      )
      if (tieneIncompatible) return false
    }

    // Filtrar por nivel FODMAP máximo tolerado
    if (filtro.fodmapsMaximo) {
      if (FODMAP_ORDEN[m.fodmaps] > FODMAP_ORDEN[filtro.fodmapsMaximo]) return false
    }

    return true
  })
}
```

- [ ] **Verificar TypeScript**

```bash
cd nutricoach && npx tsc --noEmit --pretty false 2>&1 | head -20
```

Esperado: 0 errores relacionados con los esqueletos.

- [ ] **Commit**

```bash
git add lib/recetas/esqueletos/index.ts
git commit -m "feat: índice esqueletos + filtrarEsqueletos()"
```

---

## Task 7: Reescribir templates.ts

**Ficheros:**
- Modificar: `lib/recetas/agente-recetario/templates.ts`

Los templates actuales tienen nombres como "Arroz suave con pollo y calabacin para tapering". Hay que eliminar el campo `nombre` (lo genera DeepSeek) y añadir `sustituciones`.

- [ ] **Reescribir el fichero completo**

Reemplazar el contenido de `lib/recetas/agente-recetario/templates.ts` con:

```typescript
// lib/recetas/agente-recetario/templates.ts
// Templates legacy — referenciados desde agente-recetario-pro.ts
// Los esqueletos nuevos están en lib/recetas/esqueletos/

import type { RecetaCandidata } from './types'

type TemplateInput = {
  objetivo: string
  deporte?: string
  momento?: string
}

type TemplateFactory = (input: TemplateInput) => Omit<RecetaCandidata, 'nombre' | 'descripcion' | 'instrucciones' | 'consejos'>

export const PLANTILLAS_RECETARIO_PRO: Array<{
  id: string
  objetivos: string[]
  momentos: string[]
  tipoPlato: string
  factory: TemplateFactory
}> = [
  {
    id: 'tapering-arroz-pollo-calabacin',
    objetivos: ['rendimiento'],
    momentos: ['tapering'],
    tipoPlato: 'Comida',
    factory: (input) => ({
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['tapering'],
      tipoPlato: 'Comida',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'arroz blanco',      cantidadGramos: 95,  rolIngrediente: 'carbohidrato_base' },
        { nombre: 'pechuga de pollo',  cantidadGramos: 125, rolIngrediente: 'proteina_principal' },
        { nombre: 'calabacín',         cantidadGramos: 100, rolIngrediente: 'verdura_volumen' },
        { nombre: 'aceite de oliva',   cantidadGramos: 6,   rolIngrediente: 'grasa_saludable' },
      ],
      trazabilidad: { plantillaId: 'tapering-arroz-pollo-calabacin', motivoGeneracion: 'tapering endurance', modo: 'dry-run' },
    }),
  },
  {
    id: 'tapering-patata-merluza-zanahoria',
    objetivos: ['rendimiento'],
    momentos: ['tapering'],
    tipoPlato: 'Cena',
    factory: (input) => ({
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['tapering'],
      tipoPlato: 'Cena',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'patata',           cantidadGramos: 260, rolIngrediente: 'carbohidrato_base' },
        { nombre: 'merluza',          cantidadGramos: 150, rolIngrediente: 'proteina_principal' },
        { nombre: 'zanahoria',        cantidadGramos: 80,  rolIngrediente: 'verdura_volumen' },
        { nombre: 'aceite de oliva',  cantidadGramos: 5,   rolIngrediente: 'grasa_saludable' },
      ],
      trazabilidad: { plantillaId: 'tapering-patata-merluza-zanahoria', motivoGeneracion: 'tapering endurance', modo: 'dry-run' },
    }),
  },
  {
    id: 'tapering-tostadas-pavo-platano',
    objetivos: ['rendimiento'],
    momentos: ['tapering'],
    tipoPlato: 'Desayuno',
    factory: (input) => ({
      objetivos: [input.objetivo],
      deportes: input.deporte ? [input.deporte, 'endurance'] : ['endurance'],
      momentos: input.momento ? [input.momento] : ['tapering'],
      tipoPlato: 'Desayuno',
      digestibilidad: 'alta',
      ingredientes: [
        { nombre: 'pan blanco',       cantidadGramos: 90,  rolIngrediente: 'carbohidrato_base' },
        { nombre: 'pavo',             cantidadGramos: 75,  rolIngrediente: 'proteina_principal' },
        { nombre: 'plátano',          cantidadGramos: 100, rolIngrediente: 'fruta_complemento' },
        { nombre: 'miel',             cantidadGramos: 10,  rolIngrediente: 'salsa_condimento' },
      ],
      trazabilidad: { plantillaId: 'tapering-tostadas-pavo-platano', motivoGeneracion: 'tapering endurance', modo: 'dry-run' },
    }),
  },
]
```

- [ ] **Verificar build limpio**

```bash
cd nutricoach && npx tsc --noEmit --pretty false 2>&1 | head -30
```

- [ ] **Commit**

```bash
git add lib/recetas/agente-recetario/templates.ts
git commit -m "refactor: templates.ts — eliminar nombres técnicos visibles"
```

---

## Task 8: Script generador masivo con DeepSeek

**Ficheros:**
- Crear: `scripts/generar-recetas-desde-esqueletos.ts`

Este es el script principal. Lee los esqueletos, aplica sustituciones opcionales, llama a DeepSeek y guarda las recetas en BD.

- [ ] **Crear el script**

```typescript
// scripts/generar-recetas-desde-esqueletos.ts
import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { TODOS_LOS_ESQUELETOS, filtrarEsqueletos } from '../lib/recetas/esqueletos/index'
import { validarVocabulario } from '../lib/recetas/agente-recetario/vocabulary-guard'
import type { Esqueleto, IngredienteEsqueleto } from '../lib/recetas/esqueletos/types'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// ── CLI args ─────────────────────────────────────────────────────
const DRY_RUN   = !process.argv.includes('--apply')
const LIMITE    = Number(process.argv.find(a => a.startsWith('--limite='))?.split('=')[1] ?? '999')
const PERFIL    = process.argv.find(a => a.startsWith('--perfil='))?.split('=')[1]
const TIPO      = process.argv.find(a => a.startsWith('--tipo='))?.split('=')[1]
const VARIACIONES = Number(process.argv.find(a => a.startsWith('--variaciones='))?.split('=')[1] ?? '1')

// ── DeepSeek ──────────────────────────────────────────────────────
async function llamarDeepSeek(prompt: string): Promise<string> {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0].message.content
}

// ── Prompt builder ────────────────────────────────────────────────
function construirPrompt(esqueleto: Esqueleto, variacion: number): string {
  const ings = esqueleto.ingredientes
    .map(i => `- ${i.gramos}g de ${i.nombre} (rol: ${i.rol})`)
    .join('\n')

  return `Eres un chef de cocina mediterránea española experto en nutrición deportiva.
Escribe una receta atractiva en castellano de España a partir de estos ingredientes y técnica.

TÉCNICA: ${esqueleto.tecnica}
TIPO DE PLATO: ${esqueleto.tipoPlato}
INGREDIENTES:
${ings}
${variacion > 1 ? `\nEsta es la variación ${variacion} — usa una preparación, salsa o presentación diferente a las anteriores.` : ''}

REGLAS ABSOLUTAS — si las incumples el sistema rechaza la receta:
- NUNCA uses en nombre, descripción ni instrucciones: tapering, pre-entreno, post-entreno, carga, carga de carbohidratos, carga cho, TDEE, macros, proteico, fit, healthy, saludable (como adjetivo del nombre), bowl, dorado (en sentido culinario), smoothie bowl, açaí, granola bowl, RPE, RIR, HRV, FODMAP, goitrógeno, dislipidemia, hipotiroidismo, resistencia a la insulina, colon irritable
- El nombre debe sonar a receta casera mediterránea española apetecible
- Ejemplos de nombres correctos: "Arroz meloso de pollo con calabacín al limón", "Macarrones con pavo y sofrito de tomate", "Merluza al vapor con patata y zanahoria", "Tortilla cremosa de espinacas y queso fresco"
- Vocabulario permitido: meloso, cremoso, jugoso, tierno, crujiente, especiado, al horno, a la plancha, al vapor, guisado, estofado, en salsa, con sofrito, al ajillo, mediterráneo, casero, de temporada
- Instrucciones con intención culinaria: textura deseada, punto de cocción, montaje, contraste

Devuelve SOLO este JSON (sin texto extra):
{
  "nombre": "...",
  "descripcion": "...",
  "instrucciones": ["paso 1", "paso 2", "paso 3", "paso 4"],
  "consejos": "..."
}`
}

// ── Parser de respuesta ───────────────────────────────────────────
type RecetaGenerada = {
  nombre: string
  descripcion: string
  instrucciones: string[]
  consejos: string
}

function parsearRespuesta(raw: string): RecetaGenerada {
  const obj = JSON.parse(raw) as RecetaGenerada
  if (!obj.nombre || !obj.descripcion || !Array.isArray(obj.instrucciones)) {
    throw new Error('Estructura JSON inválida')
  }
  return obj
}

// ── Supabase ──────────────────────────────────────────────────────
function crearSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function obtenerCoachId(db: ReturnType<typeof crearSupabase>): Promise<string> {
  const email = process.env.NUTRICOACH_COACH_EMAIL ?? 'ccc8890@gmail.com'
  const { data } = await db.from('profiles').select('id').eq('email', email).single()
  if (!data) throw new Error(`Coach ${email} no encontrado en profiles`)
  return data.id
}

async function insertarReceta(
  db: ReturnType<typeof crearSupabase>,
  coachId: string,
  esqueleto: Esqueleto,
  generada: RecetaGenerada,
): Promise<string> {
  const { data, error } = await db.from('recetas').insert({
    coach_id:        coachId,
    nombre:          generada.nombre,
    descripcion:     generada.descripcion,
    instrucciones:   generada.instrucciones.join('\n'),
    consejos:        generada.consejos,
    tipo_plato:      esqueleto.tipoPlato,
    estado:          'en_revision',
    // Metadatos técnicos ocultos — el cliente nunca los ve
    tags:            [
      ...esqueleto.metadatos.momentos,
      ...esqueleto.metadatos.deportes.filter(d => d !== 'todos'),
      ...esqueleto.metadatos.objetivos,
      esqueleto.perfil,
    ],
    // Campos para el agente
    digestibilidad:          esqueleto.metadatos.digestibilidad,
    planning_roles:          esqueleto.metadatos.momentos,
    patologias_compatibles:  esqueleto.metadatos.patologias_compatibles,
    patologias_incompatibles: esqueleto.metadatos.patologias_incompatibles,
    esqueleto_id:            esqueleto.id,
    nivel_carbohidrato:      esqueleto.metadatos.nivel_carbohidrato,
    nivel_proteina:          esqueleto.metadatos.nivel_proteina,
    fodmaps:                 esqueleto.metadatos.fodmaps,
  }).select('id').single()

  if (error) throw new Error(error.message)
  return data!.id
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🍳 Generador de recetas desde esqueletos`)
  console.log(`   Modo: ${DRY_RUN ? 'DRY-RUN (sin insertar)' : 'APPLY'}`)
  console.log(`   Variaciones por esqueleto: ${VARIACIONES}`)
  if (PERFIL) console.log(`   Perfil: ${PERFIL}`)
  if (TIPO) console.log(`   Tipo plato: ${TIPO}`)
  console.log()

  let esqueletos = TODOS_LOS_ESQUELETOS
  if (PERFIL) esqueletos = esqueletos.filter(e => e.perfil === PERFIL)
  if (TIPO) esqueletos = esqueletos.filter(e => e.tipoPlato === TIPO)
  esqueletos = esqueletos.slice(0, LIMITE)

  console.log(`   Esqueletos a procesar: ${esqueletos.length}\n`)

  const db = DRY_RUN ? null : crearSupabase()
  const coachId = DRY_RUN ? 'dry-run' : await obtenerCoachId(db!)

  let ok = 0, rechazadas = 0, errores = 0

  for (const esqueleto of esqueletos) {
    for (let v = 1; v <= VARIACIONES; v++) {
      const label = `${esqueleto.id}${VARIACIONES > 1 ? `-v${v}` : ''}`
      process.stdout.write(`  → ${label} ... `)

      try {
        const prompt = construirPrompt(esqueleto, v)
        const raw = await llamarDeepSeek(prompt)
        const generada = parsearRespuesta(raw)

        const vocab = validarVocabulario(generada)
        if (!vocab.valido) {
          console.log(`❌ Vocabulario`)
          vocab.violaciones.forEach(viol =>
            console.log(`     campo=${viol.campo} patrón=${viol.patron}`)
          )
          rechazadas++
          continue
        }

        if (DRY_RUN) {
          console.log(`✅ "${generada.nombre}"`)
        } else {
          await insertarReceta(db!, coachId, esqueleto, generada)
          console.log(`✅ "${generada.nombre}"`)
        }
        ok++

      } catch (err) {
        console.log(`💥 Error: ${err instanceof Error ? err.message : err}`)
        errores++
      }

      // Pausa para no saturar la API
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log(`\n── Resumen ──────────────────────────────`)
  console.log(`   ✅ Generadas: ${ok}`)
  console.log(`   ❌ Rechazadas (vocabulario): ${rechazadas}`)
  console.log(`   💥 Errores: ${errores}`)
  if (DRY_RUN) console.log(`\n   ℹ️  Ejecutar con --apply para insertar en BD`)
}

main().catch(console.error)
```

- [ ] **Ejecutar en dry-run para verificar calidad**

```bash
cd nutricoach && npx tsx scripts/generar-recetas-desde-esqueletos.ts --limite=5 --perfil=rendimiento
```

Esperado: 5 recetas con nombres atractivos en castellano sin términos técnicos.

- [ ] **Ejecutar con apply (todos los esqueletos)**

Cuando la calidad del dry-run sea satisfactoria:

```bash
cd nutricoach && npx tsx scripts/generar-recetas-desde-esqueletos.ts --apply
```

Esperado: ~40 recetas en estado `en_revision` en `/recetas`.

- [ ] **Commit**

```bash
git add scripts/generar-recetas-desde-esqueletos.ts
git commit -m "feat: script generador recetas desde esqueletos con DeepSeek"
```

---

## Task 9: Ampliar ContextoCliente con gustos y adherencia

**Ficheros:**
- Modificar: `lib/agentes/types.ts` (añadir campos a ContextoCliente)
- Modificar: `lib/agentes/executor.ts` (cargar los nuevos campos)

- [ ] **Añadir campos en lib/agentes/types.ts**

En la interfaz `ContextoCliente` (tras `actividad_semanal`), añadir:

```typescript
  // Preferencias y adherencia — para personalización de recetas
  preferencias_recetas: {
    alimentos_favoritos:            string[]
    alimentos_rechazados:           string[]
    dieta_habitual:                 string | null
    intolerancias:                  string[]
    patologias:                     string[]
    tecnicas_preferidas:            string[]   // inferido de recetas completadas
    recetas_completadas_ids_30d:    string[]
    recetas_saltadas_ids_30d:       string[]
    patron_abandono:                string | null
  } | null
```

- [ ] **Cargar los campos en lib/agentes/executor.ts**

Dentro de `cargarContextoCliente`, tras el bloque de `actividadSemanal`, añadir:

```typescript
  // Cargar preferencias del cliente para personalización de recetas
  const { data: onboarding } = await db
    .from('clientes')
    .select('intolerancias, onboarding_perfil_profundo')
    .eq('id', clienteId)
    .single()

  const perfilProfundo = onboarding?.onboarding_perfil_profundo as Record<string, unknown> | null

  const { data: registros30d } = await db
    .from('registro_comidas_dia')
    .select('comida_id, estado, recetas(id, nombre, tipo_coccion)')
    .eq('cliente_id', clienteId)
    .gte('fecha', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

  const completadas: string[] = []
  const saltadas: string[] = []
  const tecnicasContador: Record<string, number> = {}

  for (const r of registros30d ?? []) {
    const receta = r.recetas as { id: string; nombre: string; tipo_coccion: string | null } | null
    if (!receta) continue
    if (r.estado === 'completada') {
      completadas.push(receta.id)
      if (receta.tipo_coccion) {
        tecnicasContador[receta.tipo_coccion] = (tecnicasContador[receta.tipo_coccion] ?? 0) + 1
      }
    } else if (r.estado === 'saltada') {
      saltadas.push(receta.id)
    }
  }

  const tecnicasPreferidas = Object.entries(tecnicasContador)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t)

  const patronAbandono = saltadas.length >= 3
    ? `Ha saltado ${saltadas.length} comidas en los últimos 30 días`
    : null

  const preferencias_recetas = {
    alimentos_favoritos:         (perfilProfundo?.alimentos_favoritos as string[]) ?? [],
    alimentos_rechazados:        (perfilProfundo?.alimentos_rechazados as string[]) ?? [],
    dieta_habitual:              (perfilProfundo?.dieta_habitual as string) ?? null,
    intolerancias:               (onboarding?.intolerancias as string[]) ?? [],
    patologias:                  (perfilProfundo?.patologias as string[]) ?? [],
    tecnicas_preferidas:         tecnicasPreferidas,
    recetas_completadas_ids_30d: completadas,
    recetas_saltadas_ids_30d:    saltadas,
    patron_abandono:             patronAbandono,
  }
```

Y añadir `preferencias_recetas` al objeto retornado:

```typescript
  return {
    cliente: { ... },
    plan_activo: plan ?? null,
    checkins_recientes: (checkins as CheckinResumen[]) ?? [],
    perfil_aprendizaje: perfil as ClientePerfilAprendizaje | null,
    metodologia_coach: (metodologia as CoachMemoria[]) ?? [],
    actividad_semanal: actividadSemanal,
    preferencias_recetas,   // ← nuevo
  }
```

- [ ] **Verificar TypeScript**

```bash
cd nutricoach && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add lib/agentes/types.ts lib/agentes/executor.ts
git commit -m "feat: ContextoCliente con preferencias y adherencia de recetas"
```

---

## Task 10: Personalización en el generador

**Ficheros:**
- Modificar: `lib/recetas/agente-recetario/generator.ts`

- [ ] **Reescribir generator.ts con lógica de personalización**

```typescript
// lib/recetas/agente-recetario/generator.ts
import type { RecetaCandidata, RecetaCoverageGap } from './types'
import { AGENTE_RECETARIO_DEFAULTS } from './types'
import { PLANTILLAS_RECETARIO_PRO } from './templates'
import { filtrarEsqueletos } from '../esqueletos/index'
import type { Esqueleto, IngredienteEsqueleto } from '../esqueletos/types'

// Contexto de preferencias del cliente para personalizar esqueletos
export type PreferenciasCliente = {
  alimentos_favoritos:    string[]
  alimentos_rechazados:   string[]
  intolerancias:          string[]
  patologias:             string[]
  tecnicas_preferidas:    string[]
  dieta_habitual:         string | null
}

// ── Selección basada en esqueletos nuevos ─────────────────────────

export function seleccionarEsqueleto(
  gap: RecetaCoverageGap,
  preferencias?: PreferenciasCliente,
): Esqueleto | null {
  const patologias = preferencias?.patologias ?? []
  const fodmapsMaximo = patologias.includes('colon_irritable') ? 'bajos' : undefined

  const compatibles = filtrarEsqueletos({
    objetivo:      gap.objetivo,
    momento:       gap.momento,
    tipoPlato:     gap.tipoPlato,
    deporte:       gap.deporte,
    patologias,
    fodmapsMaximo,
  })

  if (!compatibles.length) return null

  // Priorizar esqueletos con patologias_compatibles específicas si el cliente las tiene
  if (patologias.length) {
    const especifico = compatibles.find(e =>
      patologias.some(p => e.metadatos.patologias_compatibles.includes(p))
    )
    if (especifico) return especifico
  }

  return compatibles[0]
}

export function aplicarSustituciones(
  esqueleto: Esqueleto,
  preferencias: PreferenciasCliente,
): IngredienteEsqueleto[] {
  return esqueleto.ingredientes.map((ing) => {
    if (ing.esFijo) return ing

    // Si el alimento está rechazado, buscar sustitución en el mismo rol
    const rechazado = preferencias.alimentos_rechazados.some(r =>
      ing.nombre.toLowerCase().includes(r.toLowerCase())
    )

    if (!rechazado) return ing

    const sustituciones = esqueleto.sustituciones[ing.rol] ?? []
    const alternativa = sustituciones.find(s =>
      !preferencias.alimentos_rechazados.some(r =>
        s.toLowerCase().includes(r.toLowerCase())
      ) &&
      !preferencias.intolerancias.some(int =>
        s.toLowerCase().includes(int.toLowerCase())
      )
    )

    if (!alternativa) return ing // sin alternativa válida, mantener el original
    return { ...ing, nombre: alternativa }
  })
}

export function construirBriefingPersonalizado(
  esqueleto: Esqueleto,
  ingredientesAdaptados: IngredienteEsqueleto[],
  preferencias: PreferenciasCliente,
): string {
  const ings = ingredientesAdaptados
    .map(i => `- ${i.gramos}g de ${i.nombre}`)
    .join('\n')

  const tecnica = preferencias.tecnicas_preferidas.length
    ? preferencias.tecnicas_preferidas[0]
    : esqueleto.tecnica

  const contextoPref = [
    preferencias.dieta_habitual ? `Estilo de dieta habitual del cliente: ${preferencias.dieta_habitual}` : '',
    preferencias.alimentos_favoritos.length ? `Alimentos favoritos: ${preferencias.alimentos_favoritos.join(', ')}` : '',
    preferencias.tecnicas_preferidas.length ? `Técnica de cocina preferida: ${preferencias.tecnicas_preferidas[0]}` : '',
  ].filter(Boolean).join('\n')

  return `Eres un chef mediterráneo español experto en nutrición deportiva.
Crea una receta atractiva en castellano de España con estos ingredientes.

TÉCNICA: ${tecnica}
TIPO DE PLATO: ${esqueleto.tipoPlato}
INGREDIENTES:
${ings}
${contextoPref ? `\nCONTEXTO DEL CLIENTE:\n${contextoPref}` : ''}

REGLAS — si las incumples la receta es rechazada:
- NUNCA en nombre/descripción/instrucciones: tapering, pre-entreno, post-entreno, carga cho, TDEE, macros, proteico, fit, healthy, saludable (adjetivo), bowl, dorado (culinario), FODMAP, colon irritable, dislipidemia, hipotiroidismo, resistencia insulina
- Nombre: receta casera mediterránea española. Ej: "Arroz meloso con pollo y calabacín", "Merluza al vapor con patata"
- Instrucciones con intención culinaria: textura, punto de cocción, montaje

Responde SOLO con este JSON:
{"nombre":"...","descripcion":"...","instrucciones":["...","...","...","..."],"consejos":"..."}`
}

// ── Selector legacy (compatible con agente-recetario-pro.ts) ──────

export function generarCandidatasDesdeHueco(
  gap: RecetaCoverageGap,
  options: { cantidad?: number; preferencias?: PreferenciasCliente } = {},
): RecetaCandidata[] {
  const cantidad = Math.min(
    options.cantidad ?? 3,
    AGENTE_RECETARIO_DEFAULTS.maxCandidatesPerRun,
  )

  const compatibles = PLANTILLAS_RECETARIO_PRO.filter((template) =>
    template.objetivos.includes(gap.objetivo)
    && (!gap.momento || template.momentos.includes(gap.momento))
    && (!gap.tipoPlato || template.tipoPlato.toLowerCase() === gap.tipoPlato.toLowerCase())
  )

  return compatibles
    .slice(0, cantidad)
    .map((template) => {
      const base = template.factory({
        objetivo: gap.objetivo,
        deporte: gap.deporte,
        momento: gap.momento,
      })
      return {
        ...base,
        nombre: '',          // lo genera DeepSeek
        descripcion: '',
        instrucciones: [],
        consejos: '',
      } as RecetaCandidata
    })
}
```

- [ ] **Verificar TypeScript**

```bash
cd nutricoach && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Commit**

```bash
git add lib/recetas/agente-recetario/generator.ts
git commit -m "feat: generator con selección por esqueletos + personalización por cliente"
```

---

## Task 11: Integrar vocabulary-guard en validator.ts

**Ficheros:**
- Modificar: `lib/recetas/agente-recetario/validator.ts`

- [ ] **Añadir la comprobación de vocabulario en validarCandidataConservadora**

En `lib/recetas/agente-recetario/validator.ts`, añadir al inicio:

```typescript
import { validarVocabulario } from './vocabulary-guard'
```

Y dentro de `validarCandidataConservadora`, tras la comprobación de `!receta.nombre.trim()`:

```typescript
  // Bloquear terminología técnica en campos visibles
  const vocab = validarVocabulario({
    nombre: receta.nombre,
    descripcion: receta.descripcion,
    instrucciones: receta.instrucciones,
    consejos: receta.consejos,
  })
  if (!vocab.valido) {
    vocab.violaciones.forEach(v =>
      errores.push(`vocabulario prohibido en ${v.campo}: ${v.patron}`)
    )
  }
```

- [ ] **Verificar build completo**

```bash
cd nutricoach && npm run build 2>&1 | tail -10
```

Esperado: Build exitoso, 0 errores TypeScript.

- [ ] **Commit final**

```bash
git add lib/recetas/agente-recetario/validator.ts
git commit -m "feat: vocabulary-guard integrado en validador de candidatas"
git push origin main
```

---

## Verificación E2E (tras las 3 fases)

- [ ] **Verificar recetas generadas en la app**

Abrir `https://nutricoach-delta.vercel.app/recetas` y filtrar por estado `en_revision`.

Verificar que:
1. Ningún nombre contiene "tapering", "pre-entreno", "post-entreno", "bowl", "dorado", "carga"
2. Las descripciones tienen tono culinario mediterráneo
3. Los ingredientes corresponden a los esqueletos

- [ ] **Test de filtrado por patología**

```bash
cd nutricoach && npx tsx -e "
import { filtrarEsqueletos } from './lib/recetas/esqueletos/index'
const r = filtrarEsqueletos({ patologias: ['colon_irritable'], fodmapsMaximo: 'bajos' })
console.log('Compatible colon irritable:', r.length, 'esqueletos')
console.log(r.map(e => e.id).join('\n'))
"
```

Esperado: Solo esqueletos con `fodmaps: 'bajos'` y sin `colon_irritable` en `patologias_incompatibles`.

- [ ] **Commit de documentación**

```bash
cd nutricoach && git add -A && git commit -m "docs: plan recetario agente chef completado"
```
