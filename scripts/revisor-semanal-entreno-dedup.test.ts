import assert from 'node:assert/strict'
import { debeSuprimirPorInactividadRepetida } from '../lib/agentes/revisor-semanal-entreno'

// Sin tarea pendiente previa -> no suprimir (primera alerta de la racha)
assert.equal(debeSuprimirPorInactividadRepetida(null), false)
assert.equal(debeSuprimirPorInactividadRepetida(undefined), false)

// Última pendiente ya era "0 sesiones" sin triar -> suprimir (evita ruido semanal)
assert.equal(debeSuprimirPorInactividadRepetida({ sesiones_realizadas: 0 }), true)

// Última pendiente tenía actividad real -> no suprimir (situación nueva, sí avisar)
assert.equal(debeSuprimirPorInactividadRepetida({ sesiones_realizadas: 3 }), false)

console.log('OK — revisor-semanal-entreno-dedup')
