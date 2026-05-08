# 📚 ÍNDICE DE DOCUMENTACIÓN — NutriCoach MVP

**Sistema de documentación para continuar el proyecto cuando Claude no está disponible.**

---

## 🎯 LEE EN ESTE ORDEN

### 1️⃣ **RESUMEN_EJECUTIVO.md** (5 min)
Quick reference de todo lo que necesitas saber.
- Qué es NutriCoach
- Estado actual
- Roadmap 8 semanas
- Stack tecnológico

**Cuándo leer:** Siempre primero. Cuando necesites refresco rápido.

---

### 2️⃣ **ESTRATEGIA_MVP_COMPLETA.md** (30 min) ⭐️ DOCUMENTO MAESTRO
Especificación técnica COMPLETA. Todo lo que necesitas para implementar.

**Secciones:**
- Visión y objetivos
- Decisiones arquitectónicas
- Roadmap detallado (8 semanas)
- Estado actual de la app
- Fases detalladas con specs
- **SCHEMA Supabase completo** ← Schema exacto para copiar/pegar
- **API endpoints** ← Todos los que crear
- **UI components** ← Qué componentes React crear
- Preferencias de Carlos
- Testing por fase
- Instrucciones para DeepSeek

**Cuándo leer:** Para implementar cualquier feature. Es tu fuente de verdad.

---

### 3️⃣ **INSTRUCCIONES_DEEPSEEK.md** (10 min)
Qué hacer SI Claude desaparece. Protocolo obligatorio.

**Secciones:**
- Protocolo de emergencia
- Status actual
- Qué implementar esta semana (by fase)
- Cuándo preguntar a Carlos (con template)
- Cómo documentar tu progreso
- Checklist antes de empezar

**Cuándo leer:** Cuando asumes control (Claude sin tokens).

---

## 🔗 DOCUMENTACIÓN CONECTADA

### En el proyecto `/nutricoach`
```
nutricoach/
├── README_ESTRATEGIA.md ← Estás aquí
├── RESUMEN_EJECUTIVO.md ← Quick ref
├── ESTRATEGIA_MVP_COMPLETA.md ← Documento maestro
├── INSTRUCCIONES_DEEPSEEK.md ← Protocolo emergencia
├── CLAUDE.md ← Contexto del proyecto (leer también)
```

### En memory (`.claude/projects/.../memory/`)
```
memory/
├── MEMORY.md ← Index de memoria
├── config_delegation_rules.md ← Reglas Claude/DeepSeek
├── session_26-04_summary.md ← Qué pasó en la última sesión
├── feedback_delegacion_automatica.md ← Cómo delegamos
├── aider_issues.md ← Aider deshabilitado (NO USAR)
```

---

## 🚀 FLUJOS RÁPIDOS

### "Necesito saber qué implementar hoy"
1. Lee: `RESUMEN_EJECUTIVO.md` (mira sección "Roadmap")
2. Ve a: `ESTRATEGIA_MVP_COMPLETA.md` (sección de tu fase)
3. Códea: Usa specs exactas de "FASES DETALLADAS"

### "Claude desapareció, ¿qué hago?"
1. Lee: `INSTRUCCIONES_DEEPSEEK.md` (COMPLETO)
2. Lee: `ESTRATEGIA_MVP_COMPLETA.md` (tu fase actual)
3. Implementa: Según specs

### "Tengo duda técnica"
1. Busca en: `ESTRATEGIA_MVP_COMPLETA.md`
2. Si no está clara: Lee `INSTRUCCIONES_DEEPSEEK.md` (sección "Cuándo preguntarle a Carlos")
3. Pregunta usando template

### "Encontré error/bloqueador"
1. Lee: `INSTRUCCIONES_DEEPSEEK.md` (sección "SI ENCUENTRAS BLOQUEADOR")
2. Documenta claramente
3. Pausa trabajo, espera Claude

---

## 📊 ESTRUCTURA LÓGICA

```
RESUMEN (5 min)
    ↓
MAESTRO (30 min) ← Toda la info técnica
    ↓
ESPECÍFICO (Tu fase) ← Qué hacer esta semana
    ↓
DEEP SEEK INSTRUCCIONES (Si Claude ausente)
    ↓
IMPLEMENTAR (Con specs exactas)
```

---

## ✅ CHECKLIST: "¿Tengo todo?"

- [ ] He leído `RESUMEN_EJECUTIVO.md`
- [ ] He leído `ESTRATEGIA_MVP_COMPLETA.md` (completo)
- [ ] He leído `INSTRUCCIONES_DEEPSEEK.md` (si Claude ausente)
- [ ] Entiendo mi fase actual (0, 1, 2A, 2B, 2C, o 3)
- [ ] Sé qué tablas crear (en BD section de maestro)
- [ ] Sé qué APIs crear (en API ENDPOINTS section)
- [ ] Sé qué componentes crear (en UI COMPONENTS section)
- [ ] Tengo acceso a Supabase
- [ ] Sé a quién preguntar si tengo duda

---

## 🎯 DECISIONES CLAVE (NO CAMBIAR)

Estas están documentadas en `ESTRATEGIA_MVP_COMPLETA.md` pero repito aquí porque son críticas:

- ✅ **Stack:** Next.js 14 + Supabase + DeepSeek V3 (NO cambiar)
- ✅ **MVP:** 8 semanas (objetivo)
- ✅ **Objetivo:** Reemplazar Harbiz ($50/mes)
- ✅ **Prioridad:** Funcionalidad > Estética (v1)
- ✅ **Control:** Manual en v1 (sin IA automática aún)
- ✅ **Escalabilidad:** Preparado para agregar IA automática sin cambios arquitectónicos

---

## 🔐 PROTECCIONES

**PERMITIDO (sin preguntar a Carlos):**
- Implementar features de roadmap
- Bug fixes
- Validaciones
- Testing
- Mejoras rendimiento

**NO PERMITIDO (sin preguntar):**
- Cambiar stack
- Cambiar DB
- Cambios arquitectónicos
- Agregar features fuera de roadmap
- Cambios estéticos (espera PLAN_ESTETICO.md)

---

## 📞 CONTACTO

**Si bloqueador o duda:**
1. Abre `INSTRUCCIONES_DEEPSEEK.md`
2. Sección "Cuándo preguntarle a Carlos"
3. Sigue template
4. Pregunta claramente

**No hagas:** Asumir, workarounds, cambios no autorizados

---

## 📝 VERSIÓN Y CHANGELOG

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 26-04-2026 | Documentación inicial. 4 documentos: Resumen, Maestro, Instrucciones DeepSeek, README índice. |

---

## 🏁 ANTES DE EMPEZAR

**SI NO ENTIENDES ALGO:**
- Busca en `ESTRATEGIA_MVP_COMPLETA.md` (Ctrl+F)
- Lee sección relevante con contexto
- Si sigue sin ser claro, pregunta a Carlos

**SI ENCUENTRA BUG:**
- Documenta en file
- Pausa trabajo
- Espera Claude

**SI TERMINAS UNA FASE:**
- Documenta en file lo que hiciste
- Test con instrucciones de fase
- Avanza a siguiente fase

---

**Documento secundario: Lee ESTRATEGIA_MVP_COMPLETA.md para contexto completo**  
**Última revisión:** 26-04-2026  
**Responsable:** Carlos Casanova (product owner)
