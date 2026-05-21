# Training Pro Sprint 4 — Exercise Library

> Spec creado 21-05-2026. Implementación a cargo de DeepSeek (Roo Code).

## Objetivo

Permitir al coach añadir foto y vídeo demo a cada ejercicio, y que el cliente pueda verlos durante la ejecución de la sesión.

---

## Decisiones de diseño

| Decisión | Elección |
|----------|----------|
| Almacenamiento fotos | Cloudinary (igual que recetas) |
| Almacenamiento vídeos | URL externa YouTube/Vimeo (embed iframe) |
| Modal demo | Lightbox simple dentro de la pantalla de ejecución |

---

## 1. Base de datos — Migration SQL

```sql
-- Añadir foto_url a ejercicios (video_url ya existe en el tipo TS pero verificar en BD)
ALTER TABLE public.ejercicios
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS video_url text;
```

Verificar primero con:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ejercicios' AND table_schema = 'public'
ORDER BY ordinal_position;
```

---

## 2. Types (`types/index.ts`)

Añadir `foto_url` a la interfaz `Ejercicio` (línea ~121):

```typescript
export interface Ejercicio {
  id: string
  nombre: string
  grupo_muscular?: string
  tipo?: 'fuerza' | 'cardio' | 'flexibilidad' | 'funcional'
  descripcion?: string
  video_url?: string
  foto_url?: string   // ← AÑADIR
  custom: boolean
  coach_id?: string
}
```

---

## 3. API — Subir foto de ejercicio

**Nuevo endpoint:** `POST /api/ejercicios/[id]/subir-foto/route.ts`

- Auth: solo coach
- Recibe: `FormData` con campo `file` (imagen)
- Sube a Cloudinary: carpeta `nutricoach/ejercicios/`, public_id = UUID del ejercicio
- Actualiza `ejercicios.foto_url` en BD con la URL de Cloudinary
- Devuelve: `{ foto_url: string }`

Reutilizar `lib/cloudinary.ts` (función `uploadToCloudinary`).

---

## 4. API — Guardar video_url de ejercicio

**Nuevo endpoint:** `PUT /api/ejercicios/[id]/route.ts`

- Auth: solo coach
- Body: `{ video_url?: string, foto_url?: string }`
- Hace UPDATE en `ejercicios` con los campos recibidos
- Devuelve: el ejercicio actualizado

---

## 5. UI Coach — Editor de media en plantillas

**Archivo:** `app/entrenos/plantillas/page.tsx` (o el modal de detalle de ejercicio que exista)

Añadir junto a cada ejercicio en la lista un icono de edición (lápiz) que abra un modal `EjercicioMediaModal` con:

```
┌─────────────────────────────────────────┐
│  Editar media — Press Banca             │
├─────────────────────────────────────────┤
│  📷 Foto demo                           │
│  [imagen actual o placeholder gris]     │
│  [Subir foto ↑]                         │
├─────────────────────────────────────────┤
│  🎬 Vídeo demo                          │
│  URL YouTube/Vimeo:                     │
│  [___________________________________]  │
│                                         │
│            [Guardar] [Cancelar]         │
└─────────────────────────────────────────┘
```

Componente: `components/training/EjercicioMediaModal.tsx`

---

## 6. UI Cliente — Modal demo en ejecución

**Archivo:** `app/cliente/sesion/[id]/page.tsx`

Por cada ejercicio que tenga `foto_url` o `video_url`, mostrar un botón pequeño "Ver demo" (icono Play o Info).

Al pulsarlo, abre un modal `EjercicioDemoModal`:

```
┌──────────────────────────────────────────┐
│  Press Banca                    [✕]      │
├──────────────────────────────────────────┤
│  [foto si existe, sino placeholder]      │
│                                          │
│  ▶ Vídeo tutorial                        │
│  [iframe YouTube 16:9, autoplay=0]       │
│                                          │
│  descripcion del ejercicio si existe     │
└──────────────────────────────────────────┘
```

Componente: `components/training/EjercicioDemoModal.tsx`

**Extracción de video ID de YouTube:**
```typescript
function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}
```

Embed URL: `https://www.youtube.com/embed/{videoId}?rel=0`

---

## 7. Fetch en sesión cliente

En `app/cliente/sesion/[id]/page.tsx`, asegurarse de que el select de ejercicios incluye `foto_url` y `video_url`:

```typescript
.select('*, ejercicio:ejercicios(id, nombre, descripcion, video_url, foto_url, grupo_muscular, tipo)')
```

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `supabase/migrations/training_sprint4_exercise_library.sql` | Crear — ALTER TABLE |
| `types/index.ts` | Modificar — añadir `foto_url` a `Ejercicio` |
| `app/api/ejercicios/[id]/subir-foto/route.ts` | Crear — upload Cloudinary |
| `app/api/ejercicios/[id]/route.ts` | Crear — PUT video_url/foto_url |
| `components/training/EjercicioMediaModal.tsx` | Crear — UI coach |
| `components/training/EjercicioDemoModal.tsx` | Crear — UI cliente |
| `app/entrenos/plantillas/page.tsx` | Modificar — añadir botón editar media |
| `app/cliente/sesion/[id]/page.tsx` | Modificar — añadir botón "Ver demo" |

---

## Verificación final

```bash
npx tsc --noEmit --pretty false   # 0 errores
npm run build                      # build limpio
```
