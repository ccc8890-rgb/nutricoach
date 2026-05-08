# 📌 RESUMEN EJECUTIVO — NutriCoach MVP (30 segundos)

**Para leer cuando Claude está ausente. Si necesitas contexto completo, ve a [`ESTRATEGIA_MVP_COMPLETA.md`](nutricoach/ESTRATEGIA_MVP_COMPLETA.md)**

---

## ¿Qué es esto?
App para reemplazar **Harbiz** ($50/mes). Coach crea cuestionarios → Cliente anónimo rellena → IA (DeepSeek V3) genera dieta → Coach aprueba → Cliente accede a portal completo (plan, check-in, progreso, notas).

## Estado actual (28-04-2026)
- **Código:** Fases 0-4 completas al 100% ✅
- **Sistema de micronutrientes y fuentes:** Implementado pero **NO VISIBLE** en navegador — ver [`AUDITORIA_MICRONUTRIENTES.md`](nutricoach/salidas/28-04-2026_AUDITORIA_MICRONUTRIENTES.md) para diagnóstico completo
- **Auditoría ejecutada:** 8 bugs documentados (3 críticos, 3 medios, 2 leves)
- **Próxima sesión:** Verificar si los cambios son visibles tras rebuild, corregir bugs, continuar con UI Recetas y Selector Receta→Comida

## Stack
- **Next.js 14** (App Router)
- **Supabase** (Auth + DB)
- **DeepSeek V3** (IA)
- **Tailwind CSS**
- **Vercel** (hosting futuro)

## Estado de los componentes

| Feature | Estado |
|---------|--------|
| Cuestionarios (crear, link público, rellenar, ver respuestas) | ✅ |
| DeepSeek V3 (generar dieta, informe semanal, ajuste macros) | ✅ |
| Revisión y aprobación (5 estados) | ✅ |
| Control manual (editor dietas, buscar alimentos, PDF) | ✅ |
| Portal cliente público | ✅ |
| Notificaciones | ✅ |
| Dashboard | ✅ |
| Portal Cliente Avanzado (3 tabs) | ✅ |
| Check-in semanal | ✅ |
| Informe Semanal IA | ✅ |
| Ajuste Macros IA | ✅ |
| Planificación calendario | ✅ |
| Lista de la compra | ✅ |
| Página detalle cliente | ✅ |
| Notas del coach | ✅ |
| **Sistema micronutrientes (BD + API + UI)** | ⚠️ Código listo, datos poblados, UI no visible |
| **UI Recetas: ingredientes editables + macros** | ❌ Pendiente |
| **Selector "Añadir receta a comida"** | ❌ Pendiente |

## Comandos útiles
```bash
# Arrancar servidor (si no responde)
cd ~/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach
lsof -ti:3000 | xargs kill -9 2>/dev/null; rm -rf .next; npm run dev

# Puerto local
http://localhost:3000

# Página de alimentos (con badges + micronutrientes)
http://localhost:3000/dietas/alimentos
```

## Contacto
- Carlos: ccc8890@gmail.com
- Documento de estado completo: [`ESTADO_Y_PROXIMOS_PASOS.md`](nutricoach/ESTADO_Y_PROXIMOS_PASOS.md)
- Auditoría de bugs: [`salidas/28-04-2026_AUDITORIA_MICRONUTRIENTES.md`](nutricoach/salidas/28-04-2026_AUDITORIA_MICRONUTRIENTES.md)

---

**Última actualización:** 28-04-2026 ~18:12
**Build:** Reconstruido desde cero (`.next` borrado)
