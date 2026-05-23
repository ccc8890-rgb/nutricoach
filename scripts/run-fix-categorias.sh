#!/bin/bash
# run-fix-categorias.sh
# Limpieza masiva de categorías de alimentos
# Ejecuta directamente contra la REST API de Supabase

SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcGVxend6bWxycGt0b2V5Z3h6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyMjUxOSwiZXhwIjoyMDkyNjk4NTE5fQ.e0iP547fppOHFfFiWEo053tjl7FmcQMAZzvCPwcVSkc"
URL="https://hopeqzwzmlrpktoeygxz.supabase.co"
AUTH="apikey: $SERVICE_KEY"
AUTH2="Authorization: Bearer $SERVICE_KEY"
HEADERS="-H '$AUTH' -H '$AUTH2' -H 'Content-Type: application/json' -H 'Prefer: return=minimal'"

patch_categoria() {
  local nueva_cat="$1"
  local filter="$2"
  local label="$3"
  
  local data="{\"categoria\":\"$nueva_cat\"}"
  local count=$(curl -s -G $HEADERS "$URL/rest/v1/alimentos" \
    --data-urlencode "select=id" \
    --data-urlencode "$filter" \
    --data-urlencode "es_comestible=eq.true" \
    --data-urlencode "limit=1000" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  
  if [ "$count" != "0" ] && [ "$count" != "" ] && [ "$count" != "?" ]; then
    echo "  → $label: $count alimentos"
    curl -s -X PATCH $HEADERS "$URL/rest/v1/alimentos" \
      -d "$data" \
      -G --data-urlencode "$filter" \
      --data-urlencode "es_comestible=eq.true" > /dev/null
  fi
}

patch_no_comestible() {
  local filter="$1"
  local label="$2"
  
  local data="{\"es_comestible\":false}"
  local count=$(curl -s -G $HEADERS "$URL/rest/v1/alimentos" \
    --data-urlencode "select=id" \
    --data-urlencode "$filter" \
    --data-urlencode "es_comestible=eq.true" \
    --data-urlencode "limit=1000" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  
  if [ "$count" != "0" ] && [ "$count" != "" ] && [ "$count" != "?" ]; then
    echo "  → $label: $count alimentos"
    curl -s -X PATCH $HEADERS "$URL/rest/v1/alimentos" \
      -d "$data" \
      -G --data-urlencode "$filter" \
      --data-urlencode "es_comestible=eq.true" > /dev/null
  fi
}

echo "=========================================="
echo " LIMPIEZA MASIVA DE CATEGORÍAS"
echo "=========================================="

echo ""
echo "📌 BLOQUE 0: ACEITUNAS → Condimentos"
patch_categoria "Condimentos" "categoria=eq.Pescados&nombre=ilike.*aceituna*" "Aceitunas en Pescados"
patch_categoria "Condimentos" "categoria=eq.Pescados&nombre=ilike.*olivada*" "Olivada en Pescados"

echo ""
echo "📌 BLOQUE 1: MARCAR NO COMESTIBLES (limpieza/hogar/cosmética)"

for cat in \
  "Bazar" "Absorbe olores y antihumedad" "Aditivos para el lavado" \
  "Antical" "Anti hormigas y cucarachicidas" "Arenas e higiene" \
  "Barbacoa, carbón y encendido" "Bolsas de conservación" "Botiquín" \
  "Cepillos de dientes" "Cepillos y esponjas" "Cera " \
  "Cera suelos" "Complementos higiene" "Cubiertos, vajilla y mantel" \
  "Cuchilla" "Detergente lavado a mano" "Encendedores, velas y carbón" \
  "Esponjas" "Espuma y laca" "Herméticos y moldes" \
  "Multiusos y otros" "Papel y bolsas de conservación" "Pañuelos" \
  "Pilas" "Planchado" "Quitamanchas" \
  "Rollo cocina" "Servilletas" "Tratamiento piscina" \
  "Activador y antical lavadora" "Aerosol spray o pistola" \
  "Ambientador eléctrico" "Bandas protectoras adhesivas" "Algodón" \
  "A mano y jabón común" "Aseo íntimo" "Aseo y cuidado" \
  "After shave" "Body-lociones" "Brillos" \
  "Crema de cara" "Crema pies" "Crema y gel de cara" \
  "Cuidado de uñas y complementos" "Lotes mujer" "Mascarillas" \
  "Perfumes y colonias" "Retoca raíces y otros" "Sérum y otros" \
  "Sérum y ampollas" "Arreglos" "Alimentación húmeda"; do
  patch_no_comestible "categoria=eq.$(python3 -c "import urllib.parse; print(urllib.parse.quote('$cat'))")" "$cat"
done

echo ""
echo "📌 BLOQUE 2: RE-CATEGORIZAR"

# Aceitunas
patch_categoria "Condimentos" "categoria=eq.Aceitunas%20con%20hueso" "Aceitunas con hueso → Condimentos"
patch_categoria "Condimentos" "categoria=eq.Aceitunas%20sin%20hueso" "Aceitunas sin hueso → Condimentos"
patch_categoria "Condimentos" "categoria=eq.Banderillas%20y%20cocktails" "Banderillas → Condimentos"

# Dulces
for cat in "Bombones" "Tarrinas" "Granizados%20y%20helados%20de%20hielo" \
  "Cremas%20de%20untar" "Cucuruchos" "Boller%C3%ADa%20envasada" \
  "Boller%C3%ADa%20dulce" "Boller%C3%ADa%20rellena%20y%20donuts" \
  "Boller%C3%ADa%20salada" "Pastelitos%20surtidos" "Pastelitos" \
  "Magdalenas" "Tartas%20y%20bizcochos" "Cocas%20y%20bizcochos" \
  "Barras%20de%20helado%20y%20barquillos" "Barritas%20y%20galletas" \
  "Galletas%20surtidas" "Con%20chocolate%20y%20rellenas" \
  "Chocolate%20a%20la%20taza" "Chocolate%20con%20leche" "Chocolatinas" \
  "Berlinas" "Bloques%2C%20tartas%20y%20Nata" "Tortitas" "Hojaldres" \
  "Cremas%20de%20desayuno"; do
  patch_categoria "Dulces%20y%20boller%C3%ADa" "categoria=eq.$cat" "$cat → Dulces"
done

# Bebidas
for cat in "Infusiones" "T%C3%A9" "Lima%20lim%C3%B3n" \
  "T%C3%B3nica%20y%20bitter" "Bitter%20y%20ginger%20ale" "Energ%C3%A9tico" \
  "Otros%20licores" "Vino%20lambrusco%20y%20espumoso" "Caf%C3%A9s%20refrigerados" \
  "Caf%C3%A9%20Grano" "Caf%C3%A9%20Molido%20descafeinado" \
  "Caf%C3%A9%20Molido%20mezcla" "Caf%C3%A9%20Molido%20natural" \
  "Bebidas%20refrescantes" "Agua%20con%20gas" "Agua%20con%20sabores" \
  "Bebidas%20vegetales" "B%C3%ADfidus" "B%C3%ADfidus%20de%20sabores"; do
  patch_categoria "Bebidas" "categoria=eq.$cat" "$cat → Bebidas"
done

# Pescados
for cat in "Sardinas" "At%C3%BAn%20y%20bonito" "Base%20pescado" \
  "Pescado" "Trucha" "Salazones" "Berberechos%20y%20almejas"; do
  patch_categoria "Pescados" "categoria=eq.$cat" "$cat → Pescados"
done

patch_categoria "Mariscos" "categoria=eq.Almejas%2C%20berberechos%20y%20navajas" "Almejas → Mariscos"

# Pan y cereales
for cat in "Pan%20rebanado" "Barra%20de%20pan" "Pan%20de%20bocadillo" \
  "Pan%20tostado" "Pan%20rallado" "Picatostes" "Galletas%20saladas" \
  "Barritas%20de%20cereales"; do
  patch_categoria "Pan%20y%20cereales" "categoria=eq.$cat" "$cat → Pan y cereales"
done

# Platos preparados
for cat in "Caldo%20liquido" "Caldo%20l%C3%ADquido" "Caldo%20en%20pastillas" \
  "Sopas%20en%20sobre" "Fideos%20y%20sopas" "Platos%20calientes" \
  "Pizzas%20refrigeradas" "Platos%20de%20cuchara" "Base%20de%20pizza" \
  "Hummus%20y%20otros" "Empanados%20y%20elaborados" "Hamburguesas"; do
  patch_categoria "Platos%20preparados" "categoria=eq.$cat" "$cat → Platos preparados"
done

# Snacks
for cat in "Patatas%20fritas" "Ma%C3%ADz%20tostado%20y%20cocktail" \
  "Snacks%20y%20otros%20aperitivos"; do
  patch_categoria "Snacks" "categoria=eq.$cat" "$cat → Snacks"
done

# Frutas
for cat in "Otras%20frutas" "Mel%C3%B3n%20y%20sand%C3%ADa" "Pi%C3%B1a" \
  "Fruta" "Tarritos%20de%20fruta" "C%C3%ADtricos" \
  "Fruta%20desecada" "Frutas%20en%20alm%C3%ADbar%20y%20en%20su%20jugo"; do
  patch_categoria "Frutas%20frescas" "categoria=eq.$cat" "$cat → Frutas"
done

# Verduras
for cat in "Calabac%C3%ADn%20y%20pimiento" "Cebolla%20y%20ajo" \
  "Otras%20verduras%20y%20hortalizas" "Tomate%20natural" "Conservas%20verdura" \
  "Setas%20y%20champi%C3%B1ones"; do
  patch_categoria "Verduras%20y%20hortalizas" "categoria=eq.$cat" "$cat → Verduras"
done

# Carnes
for cat in "Cerdo" "Pavo%20y%20otras%20aves" "Aves"; do
  patch_categoria "Carnes" "categoria=eq.$cat" "$cat → Carnes"
done

# Lácteos
for cat in "Leche" "Leche%20desnatada" "Leche%20Infantil" \
  "Yogures%20desnatados" "Queso%20fresco" "Queso%20especialidades" \
  "Postres%20de%20soja" "Otros%20postres"; do
  patch_categoria "L%C3%A1cteos" "categoria=eq.$cat" "$cat → Lácteos"
done

# Arroces y pastas
for cat in "Arroz%20especial" "Arroz" "Arroz%20cocido" "Pasta" \
  "Pasta%20fresca" "Pasta%20al%20huevo" "Pasta%20sin%20gluten" \
  "Pasta%20ensaladas" "Spaghetti%20y%20tallarines" "Masas"; do
  patch_categoria "Arroces%20y%20pastas" "categoria=eq.$cat" "$cat → Arroces y pastas"
done

# Condimentos
for cat in "Especias" "Otras%20especias" "Ketchup" "Mayonesa" \
  "Allioli" "Mermelada" "Salsas" "Otras%20salsas" "Salsas%20fr%C3%ADas" \
  "Vinagre%20y%20ali%C3%B1os" "Sazonadores" "Az%C3%BAcar" "Edulcorantes" \
  "Resto%20de%20encurtidos" "Levadura%20y%20preparado%20reposter%C3%ADa" \
  "Pat%C3%A9"; do
  patch_categoria "Condimentos" "categoria=eq.$cat" "$cat → Condimentos"
done

# Frutos secos
for cat in "Nueces" "Otros%20frutos%20secos" "Frutos%20Secos"; do
  patch_categoria "Frutos%20secos%20y%20semillas" "categoria=eq.$cat" "$cat → Frutos secos"
done

# Aceites
for cat in "Aceite%20de%20oliva%20intenso%20y%20suave" \
  "Aceite%20de%20oliva%20virgen" "Aceites%20y%20Grasas"; do
  patch_categoria "Aceites%20y%20grasas" "categoria=eq.$cat" "$cat → Aceites"
done

echo ""
echo "📌 BLOQUE 3: LIMPIAR SUPERMERCADO"

# Bebidas
patch_categoria "Bebidas" "categoria=eq.Supermercado&nombre=ilike.*agua*" "agua"
patch_categoria "Bebidas" "categoria=eq.Supermercado&nombre=ilike.*zumo*" "zumo"
patch_categoria "Bebidas" "categoria=eq.Supermercado&nombre=ilike.*cola*" "cola"

# Verduras
patch_categoria "Verduras%20y%20hortalizas" "categoria=eq.Supermercado&nombre=ilike.*calabac*" "calabacín"
patch_categoria "Verduras%20y%20hortalizas" "categoria=eq.Supermercado&nombre=ilike.*cebolla*" "cebolla"
patch_categoria "Verduras%20y%20hortalizas" "categoria=eq.Supermercado&nombre=ilike.*tomate*" "tomate"
patch_categoria "Verduras%20y%20hortalizas" "categoria=eq.Supermercado&nombre=ilike.*lechuga*" "lechuga"
patch_categoria "Verduras%20y%20hortalizas" "categoria=eq.Supermercado&nombre=ilike.*esparrag*" "espárrago"
patch_categoria "Verduras%20y%20hortalizas" "categoria=eq.Supermercado&nombre=ilike.*berenjena*" "berenjena"

# Carnes
patch_categoria "Carnes" "categoria=eq.Supermercado&nombre=ilike.*jam%C3%B3n*" "jamón"
patch_categoria "Carnes" "categoria=eq.Supermercado&nombre=ilike.*jamon*" "jamon"
patch_categoria "Carnes" "categoria=eq.Supermercado&nombre=ilike.*pollo*" "pollo"

# Lo que quede sin kcal → no comestible
echo "  → Supermercado sin kcal → no comestible"
curl -s -X PATCH $HEADERS "$URL/rest/v1/alimentos" \
  -d '{"es_comestible":false}' \
  -G --data-urlencode "categoria=eq.Supermercado" \
  --data-urlencode "es_comestible=eq.true" \
  --data-urlencode "or=(calorias.is.null,calorias.eq.0)" > /dev/null

echo ""
echo "✅ COMPLETADO"
