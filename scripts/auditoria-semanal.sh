#!/bin/bash
# Pasada autónoma del recetario (cada 6 h, la lanza launchd): corrige lo seguro y avisa de lo dudoso.
#  1. Intolerancias: compara etiquetas con ingredientes y corrige (copia en salidas/).
#  2. Enlaces ingrediente→alimento: aplica las reglas aprobadas por Carlos y recalcula macros (copia en salidas/).
#  3. Campos (dificultad, cocción, tipo de plato, categoría, tags, ración): rellena y normaliza con reglas.
#  4. Recalcula puntuaciones derivadas (inteligencia de receta, calidad profesional).
#  5. Cuenta lo que queda dudoso y, si hay algo nuevo, deja un aviso en pantalla.
cd "$(dirname "$0")/.." || exit 1
export PATH="/usr/local/bin:/usr/bin:/bin"
echo "=== $(date '+%d-%m-%Y %H:%M') ==="
INT=$(node scripts/auditar-intolerancias-completo.mjs --aplica 2>&1 | grep -E "^Recetas:|^Aplicado")
echo "$INT"
node scripts/auditar-matches-ingredientes.mjs > /tmp/nutricoach-matches.txt 2>&1
head -1 /tmp/nutricoach-matches.txt
COR=$(node scripts/aplicar-correcciones-matches.mjs --aplica 2>&1 | grep -E "^filas a corregir|^Nada que corregir")
echo "$COR"
CAMPOS=$(npx tsx scripts/completar-campos-recetas.mts --aplica 2>&1 | grep -E "^recetas|^Aplicado|^Avisos")
echo "$CAMPOS"
npx tsx scripts/recalcular-recipe-intelligence.ts --apply --limite=2000 > /dev/null 2>&1 && echo "Puntuaciones de inteligencia de receta recalculadas"
npx tsx scripts/batch-audit-profesional.ts --apply 2>&1 | grep -E "^Auditadas"
URG=$(grep -oE "URGENTES[^:]*: [0-9]+" /tmp/nutricoach-matches.txt | grep -oE "[0-9]+$")
echo "Enlaces urgentes pendientes de revisión manual: ${URG:-?}"
CAMB=$(echo "$INT $COR $CAMPOS" | grep -E "Aplicado en [1-9]|filas a corregir: [1-9]|con cambios: [1-9]" | wc -l | tr -d ' ')
if [ "$CAMB" != "0" ]; then
  osascript -e 'display notification "Recetario revisado y corregido. Mira logs/nutricoach-auditoria.log" with title "NutriCoach"' 2>/dev/null
fi
