# Auditoría: Configuración Antigravity IDE / VS Code con Codex CLI

**Fecha:** 2026-05-20  
**Motivo:** Intentar que Codex CLI usara Antigravity IDE en lugar de VS Code

---

## Historial completo de cambios (y reversiones)

### 🔄 Cambio 1 — Re-registrar Antigravity IDE en LaunchServices
- **Qué se hizo:** `lsregister -f "/Applications/Antigravity IDE.app"`
- **Estado actual:** ✅ Aplicado (no destructivo, seguro)
- **Cómo revertir:** No necesario, es solo un registro del sistema
- **Efecto:** macOS sabe que la app existe

### 🔄 Cambio 2 — Instalar `duti` y configurar handlers
- **Qué se hizo:** `brew install duti` + `duti -s com.google.antigravity-ide` para varias extensiones
- **Estado actual:** ❌ **DESINSTALADO** (`brew uninstall duti`)
- **Cómo revertir:** Ya no está instalado
- **Efecto residual:** Los pop-ups de macOS preguntando "COD vs Antigravity IDE" que el usuario resolvió eligiendo "Seguir usando Antigravity IDE" en todos. Esto configura los handlers de tipo de archivo a nivel de macOS (Finder).
- **Nota:** Si en el futuro los archivos no se abren con la app deseada desde Finder, ir a "Obtener Información" > "Abrir con" y cambiarlo.

### 🔄 Cambio 3 — Añadir variables de entorno a `~/.zshrc`
- **Qué se hizo:** Se añadieron 3 líneas: `CODEX_EDITOR`, `VISUAL`, `EDITOR`
- **Estado actual:** ❌ **REVERTIDO** — líneas eliminadas
- **Estado final de `~/.zshrc`:** Solo queda la línea `export PATH="/Users/carloscasanova/.antigravity-ide/antigravity-ide/bin:$PATH"` que **YA estaba antes** (añadida por Antigravity IDE al instalarse)

### 🔄 Cambio 4 — Codex CLI config `inherit = "full"`
- **Qué se hizo:** Cambiar `inherit = "core"` → `inherit = "full"` en `~/.codex/config.toml`
- **Estado actual:** ❌ **REVERTIDO** — vuelta a `inherit = "core"`
- **Cómo revertir:** Ya está en el valor original

### 🔄 Cambio 5 — Renombrar VS Code a backup
- **Qué se hizo:** `sudo mv "Visual Studio Code.app" "Visual Studio Code - backup.app"`
- **Estado actual:** ❌ **REVERTIDO** — vuelta a `Visual Studio Code.app`
- **Cómo revertir:** Ya está restaurado
- **Problema detectado:** Codex CLI se quedó sin editor visible al no encontrar VS Code

---

## Estado final del sistema

| Elemento | Estado |
|----------|--------|
| `/Applications/Visual Studio Code.app` | ✅ Restaurado |
| `/Applications/Antigravity IDE.app` | ✅ Intacto (nunca se tocó) |
| `~/.zshrc` | ✅ Original — solo PATH de Antigravity IDE (ya existía) |
| `~/.codex/config.toml` | ✅ `inherit = "core"` (original) |
| `duti` (brew) | ✅ Desinstalado |
| LaunchServices | ✅ Ambas apps registradas |
| Pop-ups macOS | ✅ Resueltos — usuario eligió "Antigravity IDE" con "Siempre" |
| Proyecto nutricoach | ✅ Intacto — sin cambios |

---

## Conclusión técnica

**Codex CLI está hardcodeado para buscar VS Code por su bundle ID** (`com.microsoft.VSCode`) y no se puede redirigir a otro editor como Antigravity IDE. Incluso renombrando VS Code, Codex se queda sin editor en lugar de usar la alternativa.

**Antigravity IDE y VS Code son el mismo programa base** (Electron fork de VS Code). La diferencia es solo branding/logo. Usar VS Code desde Codex CLI es funcionalmente idéntico a usar Antigravity IDE.

---

## Para referencia futura

Si en el futuro se quiere cambiar el editor por defecto desde Finder:
- **Abrir con Antigravity IDE:** Clic derecho > "Obtener Información" > "Abrir con" > Seleccionar Antigravity IDE > "Cambiar todo"
- **Abrir con VS Code:** Mismo proceso pero seleccionando Visual Studio Code
