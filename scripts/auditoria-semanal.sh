#!/bin/bash
# Auditoría semanal del recetario (solo lectura): enlaces ingrediente→alimento e intolerancias.
# Informes en salidas/. Lanzado por ~/Library/LaunchAgents/com.carlos.nutricoach-auditoria.plist
cd "$(dirname "$0")/.." || exit 1
export PATH="/usr/local/bin:/usr/bin:/bin"
echo "=== $(date '+%d-%m-%Y %H:%M') ==="
node scripts/auditar-matches-ingredientes.mjs | head -3
node scripts/auditar-intolerancias-completo.mjs | head -3
