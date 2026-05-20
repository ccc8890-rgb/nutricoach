# NutriCoach — Cerebro del Coach + Onboarding Inteligente

**Fecha:** 2026-05-20  
**Sesión de brainstorming:** Carlos Casanova  
**Prioridad:** Alta — core del producto

---

## Visión

Convertir NutriCoach en un sistema que amplifica la expertise de Carlos como dietista. La IA no reemplaza al coach: aplica su metodología, conocimiento científico y recetario propio para generar planes de alta calidad que el coach revisa en minutos, no en horas.

**Problema central:** El tiempo entre "cliente nuevo" y "cliente con plan activo" es demasiado largo. Los clientes pierden la motivación inicial si esperan más de pocas horas.

---

## Arquitectura del sistema

```
Perfil cliente (onboarding) 
  + Metodología del coach (tabla BD)
  + Recetario NutriCoach (257+ recetas con macros)
  → Motor IA (DeepSeek) 
  → Plan con recetas reales + macros exactos
  → Revisión express del coach (móvil, ≤ 2 min)
  → Plan activo para el cliente
```

---

## Componentes a implementar

### 1. Metodología del Coach (`tabla: metodologia_coach`)

**Qué es:** Una tabla en Supabase donde Carlos guarda sus reglas de trabajo. El motor de generación de planes la lee como contexto adicional al prompt.

**Campos:**
```sql
CREATE TABLE metodologia_coach (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  -- Proteína por objetivo (g/kg)
  proteina_perdida_grasa numeric DEFAULT 2.2,
  proteina_recomposicion numeric DEFAULT 2.0,
  proteina_rendimiento numeric DEFAULT 1.8,
  proteina_ganancia_musculo numeric DEFAULT 2.0,
  proteina_salud_general numeric DEFAULT 1.0,
  -- Reglas fijas (array de strings)
  reglas_fijas text[] DEFAULT '{}',
  -- Estilo de alimentación preferido
  estilos_dieta text[] DEFAULT '{mediterraneo,flexible}',
  -- Texto libre de filosofía (inyectado en el prompt de IA)
  filosofia_coaching text DEFAULT '',
  -- Configuración de comidas
  num_comidas_default int DEFAULT 4,
  -- Déficit/superávit máximo permitido
  deficit_maximo_kcal int DEFAULT 500,
  superavit_maximo_kcal int DEFAULT 400,
  updated_at timestamptz DEFAULT now()
);
```

**UI:** Página `/coach/metodologia` — formulario editable con secciones:
- Proteína por objetivo (sliders numéricos)
- Reglas fijas (lista editable con +/-)
- Estilo preferido (chips)
- Filosofía (textarea)

**Integración con plan:** En `generar-plan-inicial/route.ts`, antes de construir el prompt, se hace `SELECT * FROM metodologia_coach WHERE coach_id = ?` y se inyecta el resultado como bloque adicional en el prompt.

---

### 2. Planes con Recetas Reales (recipe-integrated generation)

**Problema actual:** `generar-plan-inicial` devuelve distribución de macros por comida, pero no recetas concretas. El cliente ve "Desayuno: 450 kcal · 35g proteína" sin saber qué comer.

**Solución:** Añadir una segunda fase post-generación que, para cada comida del plan, llama a `/api/recetas/sugeridas` y asocia las mejores recetas.

**Flujo:**
```
1. DeepSeek genera distribución: [{ nombre: "Desayuno", kcal: 450, proteinas: 35 }, ...]
2. Para cada comida → GET /api/recetas/sugeridas?kcal=450&proteinas=35&limite=3
3. Guardar asociación en tabla comida_recetas_sugeridas (nueva) o en campo JSONB de comidas
4. Cliente ve en su portal: "Desayuno — opciones: Tostada de salmón / Tortilla de claras / Bowl de avena proteico"
```

**Tabla nueva:**
```sql
CREATE TABLE comida_recetas_sugeridas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comida_id uuid REFERENCES comidas NOT NULL,
  receta_id uuid REFERENCES recetas NOT NULL,
  orden int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

**Si no hay receta que encaje:** El prompt incluye instrucción para que la IA proponga una receta nueva con los ingredientes del recetario existente. La receta se crea con estado `en_revision` para que Carlos la apruebe.

---

### 3. Auto-trigger de Plan al Completar Onboarding

**Problema actual:** El cliente termina el onboarding → espera a que el coach lo vea → el coach genera el plan manualmente.

**Solución:** Cuando el cliente guarda el onboarding, el sistema lanza automáticamente `POST /api/generar-plan-inicial` en background. El coach recibe notificación y solo tiene que revisar.

**Cambio en:** `app/api/onboarding/route.ts` (o donde se guarda el onboarding) — añadir al final:
```typescript
// Fire-and-forget — genera plan en background
fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generar-plan-inicial`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cliente_id }),
}).catch(() => {})
```

**Estado intermedio para el cliente:** Mientras el plan se genera, el portal muestra:
> "¡Tu perfil está listo! Carlos está preparando tu plan personalizado. Te avisaremos en cuanto esté listo."

---

### 4. Auto-Coach Mejorado — Dashboard de Seguimiento

**Qué existe:** `lib/auto-coach.ts` tiene `analizarTodosClientes()` con 8 tipos de alertas (plateau, sin progreso, baja energía, sin check-in, etc.)

**Qué falta:**
- Señal de "último acceso al portal" (login timestamp en `clientes` o tabla `portal_accesos`)
- Panel visual en el dashboard del coach
- Nudges automáticos: si cliente no accede en X días → enviar push/email

**Nuevas señales a añadir:**
```typescript
// En analizarCliente() añadir:
// 8. Días sin acceder al portal (requiere columna last_portal_access en clientes)
if (diasSinAcceso >= 5) {
  recomendaciones.push({
    tipo: 'sin_actividad_portal',
    urgencia: diasSinAcceso >= 10 ? 'alta' : 'media',
    titulo: `${diasSinAcceso} días sin abrir la app`,
    sugerencia_accion: 'Enviar mensaje de motivación. El cliente puede haberse desconectado del proceso.'
  })
}

// 9. Sin entrenar si tiene plan de entreno
if (tieneplanEntreno && diasSinRegistroEntreno >= 5) {
  recomendaciones.push({
    tipo: 'sin_entreno',
    urgencia: 'media',
    titulo: `${diasSinRegistroEntreno} días sin registrar entreno`,
    sugerencia_accion: 'Verificar si el cliente tiene dificultades con los entrenamientos o necesita ajuste del plan.'
  })
}
```

**Panel en dashboard:** Componente `AutoCoachPanel.tsx` que llama a `GET /api/auto-coach` y muestra:
- Tarjetas de alerta por urgencia (rojo/naranja/verde)
- Click en cliente → va directo a su ficha

---

### 5. Revisión Express Móvil

**Pantalla simplificada** para revisar y aprobar planes desde el móvil sin abrir el portátil:

`app/clientes/[id]/revisar-rapido/page.tsx`

**Contenido:**
- Header: foto + nombre + objetivo + días desde onboarding
- Plan en una sola card: kcal objetivo · macros · distribución visual
- Recetas sugeridas por comida (chips clicables)
- 3 botones grandes: ✅ **Aprobar** · ✏️ **Ajustar** · 🔄 **Regenerar**
- Si aprueba → `POST /api/aprobar-cliente` → email al cliente

---

## Prioridad de implementación

| # | Feature | Impacto | Esfuerzo | Días estimados |
|---|---------|---------|---------|----------------|
| 1 | Metodología del coach (SQL + UI + inject en prompt) | Alto | Bajo | 1 |
| 2 | Auto-trigger plan en onboarding | Alto | Bajo | 0.5 |
| 3 | Recetas reales en el plan generado | Alto | Medio | 1.5 |
| 4 | Auto-coach dashboard panel | Medio | Bajo | 1 |
| 5 | Revisión express móvil | Medio | Medio | 1 |

**Total estimado: 5 días de desarrollo**

---

## Lo que NO se implementa ahora

- Integración Strava/Garmin (alto esfuerzo, bajo número de clientes actuales)
- Creación automática de recetas nuevas por IA (el recetario de 257 recetas cubre bien los casos)
- App nativa iOS/Android (PWA es suficiente)

---

## Notas técnicas

- `metodologia_coach` se lee con `createServiceSupabase()` en la ruta de generación de planes
- El auto-trigger del plan usa `fire-and-forget` para no bloquear la respuesta del onboarding
- El panel auto-coach puede reutilizar la lógica de `analizarTodosClientes()` existente; solo necesita un endpoint API y un componente React
- La tabla `comida_recetas_sugeridas` puede ser opcional si se guarda en un campo JSONB en `comidas`
