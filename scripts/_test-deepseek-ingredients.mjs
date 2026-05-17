/**
 * Test rápido de DeepSeek para extraer ingredientes
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const API_KEY = env.DEEPSEEK_API_KEY
console.log('API Key present:', !!API_KEY)

const systemPrompt = `Eres un nutricionista experto analizando recetas.

Tu tarea es extraer la lista de ingredientes de cada receta, normalizando los nombres y calculando las cantidades en gramos.

REGLAS:
1. Extrae SOLO ingredientes reales de la receta. OMITE sal, pimienta, especias al gusto.
2. Convierte todas las medidas a gramos:
   - 1 cucharada = 15g, 1 cucharadita = 5g, 1 taza = 200g
   - 1 huevo M = 60g, 1 diente de ajo = 5g
3. Nombres limpios: "huevos" -> "huevo", "leche" -> "leche entera", "aceite" -> "aceite de oliva"
4. Si no se puede determinar cantidad, usa 0.

RESPONDE SOLO CON UN ARRAY JSON. Ejemplo:
[
  {
    "receta_id": "test-001",
    "ingredientes": [
      { "nombre_limpio": "huevo", "cantidad_gramos": 120 }
    ]
  }
]`

const userPrompt = `Analiza esta receta y extrae sus ingredientes:

=== RECETA 1 ===
ID: test-001
NOMBRE: Natillas Proteicas de Vainilla
PORCIONES: 2
INSTRUCCIONES:
1. En un bol, casca los huevos y bátelos ligeramente con unas varillas.
2. En un cazo, calienta la leche desnatada con la vainilla y el edulcorante hasta que esté caliente pero sin hervir.
3. Vierte la leche caliente sobre los huevos batidos sin dejar de remover.
4. Vuelve a poner la mezcla en el cazo y cocina a fuego bajo, removiendo constantemente, hasta que espese (unos 5 minutos).
5. Retira del fuego, añade la proteína en polvo sabor vainilla y mezcla bien.
6. Sirve en boles y deja enfriar antes de refrigerar.

=== RECETA 2 ===
ID: test-002
NOMBRE: Pavo salteado con calabacín y pimientos
PORCIONES: 1
INSTRUCCIONES:
1. Lava y corta el calabacín en rodajas finas o medias lunas. Corta los pimientos en tiras finas. Pica los dientes de ajo.
2. Corta el pavo en tiras delgadas.
3. Calienta el aceite de oliva en una sartén grande o wok a fuego alto.
4. Saltea el pavo durante 3-4 minutos hasta que esté dorado. Retira y reserva.
5. En la misma sartén, añade un poco más de aceite si es necesario y saltea el calabacín y los pimientos durante 4-5 minutos.
6. Añade el ajo picado y saltea 1 minuto más.
7. Vuelve a incorporar el pavo, mezcla todo y cocina 1-2 minutos.
8. Sazona con sal, pimienta negra y las especias al gusto.

=== RECETA 3 ===
ID: test-003
NOMBRE: Revuelto de claras con espinacas y champis
PORCIONES: 1
INSTRUCCIONES:
1. Lava bien las espinacas y los champiñones. Corta los champiñones en láminas finas.
2. En un bol, bate ligeramente las claras de huevo con un tenedor. Sazona con sal y pimienta.
3. Calienta el aceite de oliva en una sartén antiadherente a fuego medio-alto.
4. Saltea los champiñones durante 3-4 minutos hasta que estén dorados.
5. Añade las espinacas y saltéalas hasta que se hayan reducido (unos 2 minutos).
6. Vierte las claras batidas sobre las verduras y cocina a fuego medio, removiendo suavemente, hasta que cuajen pero estén cremosas.
7. Sirve inmediatamente.`

async function main() {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
            model: 'deepseek-v4-pro',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 4096,
        }),
    })

    const data = await response.json()
    console.log('Status:', response.status)

    if (!response.ok) {
        console.error('Error:', JSON.stringify(data, null, 2))
        return
    }

    const content = data.choices?.[0]?.message?.content
    console.log('\n--- RAW RESPONSE ---')
    console.log(content)
    console.log('--- END RAW ---\n')

    // Try parsing
    try {
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            console.log('✅ PARSED OK')
            console.log(JSON.stringify(parsed, null, 2))
        } else {
            console.log('❌ No array JSON found in response')
            // Try object
            const objMatch = content.match(/\{[\s\S]*\}/)
            if (objMatch) console.log('Object found:', objMatch[0].substring(0, 500))
        }
    } catch (e) {
        console.log('❌ Parse error:', e.message)
    }

    if (data.usage) {
        const cost = (data.usage.prompt_tokens / 1_000_000 * 0.15) +
            (data.usage.completion_tokens / 1_000_000 * 0.60)
        console.log(`\n💰 Tokens: ${data.usage.prompt_tokens} in / ${data.usage.completion_tokens} out ($${cost.toFixed(4)})`)
    }
}

main().catch(console.error)
