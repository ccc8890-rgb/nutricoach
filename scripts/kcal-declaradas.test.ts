import assert from 'node:assert/strict'
// misma expresión que usa el motor (el script no exporta sin ejecutar main): se prueba aquí el patrón
const kcal = (t: string) => { const m = t.match(/(\d{2,4})\s*(?:k?cal(?:or[ií]as|ories)?)\b/i); const v = m ? Number(m[1]) : NaN; return v >= 80 && v <= 1500 ? v : null }
assert.equal(kcal('DAK BULGOGI – 371 cal | 51P | 12F | 15C'), 371)
assert.equal(kcal('Solo 250 kcal por ración'), 250)
assert.equal(kcal('about 420 calories each'), 420)
assert.equal(kcal('2 cucharadas de aceite'), null)
assert.equal(kcal('cal 5 minutos'), null)
console.log('kcal-declaradas OK')
