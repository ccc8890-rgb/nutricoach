# Piloto Regeneracion Imagenes Recetas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un piloto local de regeneracion visual para 12 recetas rechazadas, con panel comparativo y sin modificar la BD.

**Architecture:** Un script independiente consulta recetas e ingredientes en Supabase, obtiene una imagen candidata por estrategia, aplica edicion ligera con OpenAI si procede, guarda los archivos en `salidas/revision-imagenes/piloto-20-05-2026/` y genera un HTML comparativo. No se reutiliza el script de subida para evitar cambios accidentales en produccion.

**Tech Stack:** Node.js ESM, Supabase service role, `sharp`, `yt-dlp`, `agent-browser`, OpenAI Images API, HTML estatico.

---

### Task 1: Script piloto local

**Files:**
- Create: `scripts/piloto-regeneracion-imagenes.mjs`

- [ ] Crear script ESM que cargue `.env.local`, consulte las 12 recetas por nombre y sus `receta_ingredientes`.
- [ ] Implementar tres estrategias: `source_edit`, `search_edit`, `ai_fallback`.
- [ ] Guardar candidatos locales y `resultados.json` en `salidas/revision-imagenes/piloto-20-05-2026/`.
- [ ] Generar `comparativa-piloto.html` con actual vs candidato.
- [ ] Ejecutar preview sin generar.
- [ ] Ejecutar `--genera` y revisar errores.

### Task 2: Validacion

**Files:**
- Read: `salidas/revision-imagenes/piloto-20-05-2026/comparativa-piloto.html`

- [ ] Abrir el panel local por HTTP.
- [ ] Carlos revisa si el estilo mejora.
- [ ] Si el piloto funciona, extender a las 194 rechazadas en una segunda fase.
