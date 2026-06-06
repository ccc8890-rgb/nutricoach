# Training Visual Diferenciado + Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al bloque de entrenamiento un header visual propio (B1: gradiente indigo + pill "Hoy: [día]") en el tab "plan" del portal cliente, y corregir el contraste de textos secundarios en dark mode en `SemanaEntrenoCard` y `/cliente/semana`.

**Architecture:** Modificaciones puramente de presentación en tres archivos — `SemanaEntrenoCard.tsx` recibe un nuevo wrapper con header, `app/cliente/page.tsx` elimina el divider antiguo, y `app/cliente/semana/page.tsx` corrige valores de color. Sin cambios en APIs, fetches ni lógica de negocio.

**Tech Stack:** React, Next.js App Router, Phosphor Icons, CSS variables (`var(--*)`) + valores hardcoded para dark mode.

---

## File Map

| Archivo | Acción | Qué cambia |
|---|---|---|
| `components/training/SemanaEntrenoCard.tsx` | Modify | Añadir header wrapper con gradiente indigo + pill día; corregir colores leyenda, CTA y metadata |
| `app/cliente/page.tsx` | Modify | Eliminar bloque divider separador (líneas 504–512) |
| `app/cliente/semana/page.tsx` | Modify | Corregir `var(--text-muted)` en labels stats, metadata sesiones, badge "Hecha", color sesión completada |

No se crean archivos nuevos. No hay cambios en tests (este proyecto no tiene suite de tests unitarios para UI).

---

## Task 1: Eliminar el divider separador en `app/cliente/page.tsx`

**Files:**
- Modify: `app/cliente/page.tsx:504-512`

- [ ] **Step 1: Eliminar el bloque `{/* Separador */}`**

En `app/cliente/page.tsx`, eliminar exactamente estas líneas (504–512):

```tsx
            {/* Separador */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                <Barbell size={11} />
                Entrenamiento
              </div>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
```

El resultado debe quedar así (sin separador entre el bloque de dieta y `SemanaEntrenoCard`):

```tsx
            )}

            {entreno ? (
              <>
                <SemanaEntrenoCard planId={entreno.id} planNombre={entreno.nombre} />
```

- [ ] **Step 2: Verificar build sin errores**

```bash
cd nutricoach && npx tsc --noEmit --pretty false 2>&1 | head -20
```

Esperado: sin errores TypeScript.

- [ ] **Step 3: Commit**

```bash
git add app/cliente/page.tsx
git commit -m "fix: eliminar divider separador training (reemplazado por header en SemanaEntrenoCard)"
```

---

## Task 2: Añadir header B1 a `SemanaEntrenoCard.tsx`

**Files:**
- Modify: `components/training/SemanaEntrenoCard.tsx`

El componente actualmente devuelve un `<div>` con `rounded-2xl overflow-hidden`. Hay que:
1. Añadir un nuevo bloque de header antes del contenido actual
2. Actualizar colores de leyenda, CTA y lista de sesiones

- [ ] **Step 1: Añadir la constante `TODAY_NAME` ya existe — verificar que `todaySession` también se calcula**

Revisar que la línea `const todaySession = sesionesOrdenadas.find(s => s.dia_semana === TODAY_NAME)` ya existe (línea ~101). Sí existe. No hay nada que añadir.

- [ ] **Step 2: Reemplazar el div raíz del return por la versión con header**

Localizar el bloque return en `components/training/SemanaEntrenoCard.tsx` (línea ~130):

```tsx
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header strip */}
      <div
        className="px-4 pt-4 pb-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--semantic-info-bg)' }}
          >
            <Barbell size={14} style={{ color: 'var(--semantic-info)' }} />
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{planNombre}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {sesionesOrdenadas.length} sesión{sesionesOrdenadas.length !== 1 ? 'es' : ''} / semana
              {completadasHoy.size > 0 && ` · ${completadasHoy.size} hecha${completadasHoy.size !== 1 ? 's' : ''} hoy`}
            </p>
          </div>
        </div>
      </div>
```

Reemplazar **todo ese bloque** (desde `return (` hasta el cierre `</div>` del "Header strip") con:

```tsx
  const diaActualLabel = TODAY_NAME

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header training B1 */}
      <div
        className="px-4 pt-4 pb-3 flex items-center justify-between"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, transparent 60%)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.20)',
            }}
          >
            <Barbell size={15} style={{ color: '#818CF8' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>Entrenamiento</p>
            <p className="text-[11px]" style={{ color: '#9898A0' }}>
              {planNombre} · {sesionesOrdenadas.length} día{sesionesOrdenadas.length !== 1 ? 's' : ''} / semana
            </p>
          </div>
        </div>
        {todaySession ? (
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{
              background: 'rgba(99,102,241,0.12)',
              color: '#818CF8',
              border: '1px solid rgba(99,102,241,0.22)',
            }}
          >
            Hoy: {diaActualLabel}
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: '#6F6F78' }}>{diaActualLabel}</span>
        )}
      </div>
```

- [ ] **Step 3: Corregir la leyenda de dots (mismos colores que los dots)**

Localizar la leyenda (línea ~186):
```tsx
      <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--semantic-info)' }}>●</span> Entreno &nbsp;
        <span style={{ color: 'rgba(128,128,128,0.5)' }}>●</span> Descanso &nbsp;
        <span style={{ color: 'var(--semantic-active)' }}>✓</span> Completado
      </p>
```

Reemplazar con:
```tsx
      <div className="flex items-center gap-3 text-[10px] font-medium mb-3">
        <span style={{ color: '#6F6F78' }}><span style={{ color: '#818CF8' }}>●</span> Hoy</span>
        <span style={{ color: '#6F6F78' }}><span style={{ color: '#8A9AB8' }}>●</span> Entreno</span>
        <span style={{ color: '#6F6F78' }}><span style={{ color: '#4ADE80' }}>✓</span> Hecho</span>
        <span style={{ color: '#6F6F78' }}><span style={{ color: '#45454F' }}>●</span> Descanso</span>
      </div>
```

- [ ] **Step 4: Corregir el CTA de la sesión principal**

Localizar el bloque `{/* Next session CTA */}` (línea ~216). Hay dos spans que cambian de estilo:

El span "Empezar entreno" (cuando `nextSession.dia_semana === TODAY_NAME` y no está completado):
```tsx
                  <span
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
```
Ya usa `var(--accent)` + `white` — correcto en dark mode (el acento en dark es `#E8E8F0` sobre `white`, que es válido). No cambiar.

El span "Ver entreno" (días no-hoy):
```tsx
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)' }}
                  >
                    Ver entreno
                  </span>
```
Reemplazar con:
```tsx
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.10)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.18)' }}
                  >
                    Ver entreno
                  </span>
```

Y el `<CaretRight>` al final del mismo bloque:
```tsx
              <CaretRight size={14} style={{ color: nextSessionCompleted ? 'var(--semantic-active)' : 'var(--semantic-info)' }} />
```
Reemplazar con:
```tsx
              <CaretRight size={14} style={{ color: nextSessionCompleted ? '#4ADE80' : '#818CF8' }} />
```

- [ ] **Step 5: Corregir metadata de la sesión principal (día, ejercicios, duración)**

Localizar (línea ~251):
```tsx
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {nextSession.dia_semana || 'Sesión'}
                  {nextSession.ejercicios_count > 0 && ` · ${nextSession.ejercicios_count} ej.`}
                  {nextSession.duracion_estimada_min && ` · ${nextSession.duracion_estimada_min} min`}
                </p>
```
Reemplazar `color: 'var(--text-muted)'` con `color: '#9898A0'`.

- [ ] **Step 6: Corregir colores de la lista de otras sesiones**

Localizar el bloque `{/* All sessions list */}` (línea ~289). El `<Link>` tiene:
```tsx
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-opacity hover:opacity-70"
                    style={{ color: completada ? 'var(--semantic-active)' : 'var(--text-muted)' }}
```
Cambiar:
- `'var(--semantic-active)'` → `'#4ADE80'`
- `'var(--text-muted)'` → `'#9898A0'`

El badge del día en la lista:
```tsx
                      style={{
                        background: completada
                          ? 'var(--semantic-active-bg)'
                          : 'rgba(128,128,128,0.1)',
                      }}
```
Cambiar `'var(--semantic-active-bg)'` → `'rgba(74,222,128,0.10)'`.

El texto del nombre dentro de la lista:
```tsx
                      <span className="block text-sm truncate" style={{ color: completada ? 'var(--semantic-active)' : 'var(--text)' }}>
```
Cambiar `'var(--semantic-active)'` → `'#4ADE80'`.

El texto "Completada" al final:
```tsx
                      <span className="text-[10px] font-medium" style={{ color: 'var(--semantic-active)' }}>Completada</span>
```
Cambiar `'var(--semantic-active)'` → `'#4ADE80'`.

- [ ] **Step 7: Verificar TypeScript**

```bash
cd nutricoach && npx tsc --noEmit --pretty false 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 8: Commit**

```bash
git add components/training/SemanaEntrenoCard.tsx
git commit -m "feat: header training B1 + dark mode fixes en SemanaEntrenoCard"
```

---

## Task 3: Corregir dark mode en `/cliente/semana/page.tsx`

**Files:**
- Modify: `app/cliente/semana/page.tsx`

Esta página usa `var(--text-muted)` para labels de stats, metadata de sesiones y estado completado. En dark mode este valor (`#6F6F78`) tiene contraste insuficiente. Se corrige con valores explícitos.

- [ ] **Step 1: Corregir labels de stats en la sección summary**

Localizar el grid de 3 columnas con stats (línea ~271):
```tsx
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>sesiones</p>
```
```tsx
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>pendientes</p>
```
```tsx
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>min plan</p>
```

Cambiar los tres a `color: '#9898A0'`.

- [ ] **Step 2: Corregir metadata de la sesión principal (sesionPrincipal)**

Localizar (línea ~298):
```tsx
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {sesionPrincipal.dia_semana || 'Sesión'} · {sesionPrincipal.ejercicios_count} ejercicios{sesionPrincipal.duracion_estimada_min ? ` · ${sesionPrincipal.duracion_estimada_min} min` : ''}
                  </p>
```
Cambiar `color: 'var(--text-muted)'` → `color: '#9898A0'`.

- [ ] **Step 3: Corregir metadata de cada sesión en la lista de cards**

Localizar (línea ~412):
```tsx
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span className="inline-flex items-center gap-1"><Dumbbell size={12} /> {s.ejercicios_count} ejercicios</span>
                      {s.duracion_estimada_min && (
                        <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {s.duracion_estimada_min} min</span>
                      )}
                      {s.completada && <span style={{ color: 'var(--semantic-active)' }}>{s.registros_count} sets registrados</span>}
                    </p>
```

Aplicar dos cambios:
1. `color: 'var(--text-muted)'` → `color: '#9898A0'`
2. `color: 'var(--semantic-active)'` → `color: '#4ADE80'`

- [ ] **Step 4: Verificar TypeScript**

```bash
cd nutricoach && npx tsc --noEmit --pretty false 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/cliente/semana/page.tsx
git commit -m "fix: dark mode contraste textos secundarios en /cliente/semana"
```

---

## Task 4: Build final y verificación

- [ ] **Step 1: Build de producción**

```bash
cd nutricoach && npm run build 2>&1 | tail -20
```

Esperado: `✓ Compiled successfully` sin errores TypeScript ni errores de módulo.

- [ ] **Step 2: Verificar en dev server visualmente**

```bash
cd nutricoach && npm run dev &
```

Abrir `http://localhost:3000/cliente` (o usar las credenciales del cliente de prueba) y verificar:
- Tab "plan": bloque entrenamiento con header indigo + pill "Hoy: [día]"
- Leyenda de dots con colores legibles
- Botón "Empezar" / "Ver entreno" visible
- Sin divider separador entre dieta y training

Abrir `http://localhost:3000/cliente/semana` y verificar:
- Labels "sesiones", "pendientes", "min plan" legibles
- Metadata de sesiones (ejercicios, duración) legible
- Texto "sets registrados" en verde

- [ ] **Step 3: Commit final (si hubiera ajuste menor)**

```bash
git add -A
git commit -m "fix: ajuste visual post-verificacion training dark mode"
```

O si no hay cambios adicionales, no hay commit.

---

## Self-Review

**Cobertura del spec:**
- ✅ Header B1 con gradiente indigo + pill → Task 2 Step 2
- ✅ Eliminar divider separador → Task 1
- ✅ Leyenda dots con colores por estado → Task 2 Step 3
- ✅ Botón "Ver entreno" con color `#818CF8` → Task 2 Step 4
- ✅ Metadata sesión `#9898A0` → Task 2 Step 5
- ✅ Lista otras sesiones colores correctos → Task 2 Step 6
- ✅ Labels stats `/cliente/semana` → Task 3 Step 1
- ✅ Metadata sesión principal → Task 3 Step 2
- ✅ Metadata lista sesiones → Task 3 Step 3
- ✅ Build verificación → Task 4

**Placeholders:** Ninguno — todos los pasos tienen código exacto.

**Consistencia de tipos:** Sin cambios de tipos, solo estilos CSS.
