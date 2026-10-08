# Lote del 08-10-2026: más recetas veganas y cenas ligeras. Solo usa alimentos ya verificados en lotes anteriores.
# Uso: python3 scripts/lotes/_generar-lotes-2026-10-08.py   (escribe 2026-10-08_*.json; luego importar-lote-verificado.ts)
import json, glob, os
base = os.path.dirname(__file__)
cat = {}
NUEVOS = ('2026-10-08_veganas-2.json', '2026-10-08_cenas-ligeras.json')
for f in sorted(x for x in glob.glob(os.path.join(base, '2026-*.json')) if os.path.basename(x) not in NUEVOS):
    for v in json.load(open(f))['alimentos'].values():
        cat.setdefault(v['nombre'], v)

def lote(nombre, tipo_plato, criterios, recetas, tipo_receta=None):
    usados = {}
    for r in recetas:
        for n, _ in r['ingredientes']:
            usados[n] = cat[n]
    out = {'lote': nombre, 'tipo_plato': tipo_plato, 'fuente': 'lote_verificado', 'criterios': criterios, 'alimentos': {}, 'recetas': []}
    if tipo_receta: out['tipo_receta'] = tipo_receta
    clave = {n: f'a{i}' for i, n in enumerate(sorted(usados))}
    out['alimentos'] = {clave[n]: v for n, v in usados.items()}
    for r in recetas:
        out['recetas'].append({**{k: v for k, v in r.items() if k != 'ingredientes'}, 'ingredientes': [[clave[n], g] for n, g in r['ingredientes']]})
    return out

R = lambda nombre, t, desc, ing, instr, cons, plato=None, porciones=1: {
    'nombre': nombre, 'descripcion': desc, 'tiempo_prep_min': t, 'porciones': porciones, **({'tipo_plato': plato} if plato else {}),
    'ingredientes': ing, 'instrucciones': instr, 'consejos': cons}

veganas = [
 R('Tofu revuelto con espinacas y pan integral', 15, 'Plato vegano rápido con proteína de soja y verdura.',
   [('Tofu firme', 160), ('Espinacas', 80), ('Pan integral', 80), ('Tomate', 80), ('Cúrcuma', 1), ('Aceite de oliva virgen extra', 8)],
   '1. Desmenuza el tofu con las manos.\n2. Saltéalo con el aceite y la cúrcuma 4 minutos.\n3. Añade las espinacas hasta que se reduzcan y sirve con el pan tostado y el tomate en rodajas.', 'Un poco de pimienta negra potencia la cúrcuma.'),
 R('Hamburguesa de garbanzos y avena con ensalada', 25, 'Hamburguesa vegana casera con legumbre y cereal.',
   [('Garbanzos cocidos', 200), ('Avena', 30), ('Cebolla', 30), ('Comino', 1), ('Lechuga', 40), ('Tomate', 80), ('Aceite de oliva virgen extra', 8)],
   '1. Tritura los garbanzos con la avena, la cebolla picada y el comino hasta lograr una masa.\n2. Forma una hamburguesa y dórala en sartén con la mitad del aceite 4 minutos por lado.\n3. Sirve con la ensalada de lechuga y tomate aliñada con el aceite restante.', 'Si la masa queda blanda, añade un poco más de avena.'),
 R('Berenjena rellena de quinoa y lentejas', 40, 'Plato vegano al horno con legumbre y pseudocereal.',
   [('Berenjena', 250), ('Quinoa', 40), ('Lentejas cocidas', 120), ('Tomate triturado', 80), ('Cebolla', 40), ('Comino', 1), ('Aceite de oliva virgen extra', 8)],
   '1. Parte la berenjena por la mitad, vacíala y hornea las cáscaras 15 minutos a 200 °C.\n2. Sofríe la cebolla con la pulpa picada, el tomate y el comino y mezcla con la quinoa cocida y las lentejas.\n3. Rellena las berenjenas y hornea 10 minutos más.', 'Cuece la quinoa el día anterior para ahorrar tiempo.'),
 R('Boniato asado con garbanzos especiados y espinacas', 35, 'Plato vegano de horno con hidrato lento y legumbre.',
   [('Boniato', 250), ('Garbanzos cocidos', 150), ('Espinacas', 60), ('Pimentón dulce', 2), ('Comino', 1), ('Aceite de oliva virgen extra', 8)],
   '1. Corta el boniato en dados y hornéalo 20 minutos a 200 °C.\n2. Mezcla los garbanzos con el pimentón, el comino y el aceite y añádelos los últimos 10 minutos.\n3. Sirve sobre las espinacas frescas.', 'Con garbanzos de bote bien escurridos y secos quedan crujientes.'),
 R('Cuscús con verduras salteadas y garbanzos', 20, 'Plato vegano rápido con cereal, verdura y legumbre.',
   [('Cuscús', 70), ('Calabacín', 100), ('Pimiento rojo', 80), ('Garbanzos cocidos', 120), ('Comino', 1), ('Aceite de oliva virgen extra', 8), ('Perejil', 3)],
   '1. Hidrata el cuscús con agua hirviendo, tapado, 5 minutos.\n2. Saltea el calabacín y el pimiento en dados con el aceite y el comino.\n3. Añade los garbanzos, mezcla con el cuscús y termina con el perejil.', 'Un chorrito de limón al servir lo refresca.'),
 R('Fideos salteados con tofu y verduras', 20, 'Salteado vegano de inspiración asiática.',
   [('Fideos', 70), ('Tofu firme', 120), ('Zanahoria', 60), ('Brócoli', 100), ('Salsa de soja', 12), ('Ajo', 3), ('Semillas de sésamo', 5), ('Aceite de oliva virgen extra', 6)],
   '1. Cuece los fideos y escúrrelos.\n2. Dora el tofu en dados con el ajo y el aceite, y retíralo.\n3. Saltea la zanahoria y el brócoli, une con los fideos y el tofu, añade la soja y el sésamo.', 'Corta las verduras finas para que se hagan rápido.'),
 R('Crema de calabaza y lentejas con pan de centeno', 30, 'Crema vegana saciante con legumbre.',
   [('Calabaza', 250), ('Lentejas cocidas', 150), ('Cebolla', 40), ('Comino', 1), ('Pan de centeno', 60), ('Aceite de oliva virgen extra', 8)],
   '1. Sofríe la cebolla con el aceite y el comino.\n2. Añade la calabaza en dados y agua que la cubra, y cuece 15 minutos.\n3. Tritura con las lentejas y sirve con el pan de centeno.', 'Guarda unas lentejas enteras para decorar.'),
 R('Coliflor asada con garbanzos y quinoa', 35, 'Plato vegano de horno con verdura, legumbre y pseudocereal.',
   [('Coliflor', 250), ('Garbanzos cocidos', 120), ('Quinoa', 60), ('Pimentón dulce', 2), ('Limón', 10), ('Cilantro', 5), ('Aceite de oliva virgen extra', 10)],
   '1. Corta la coliflor en ramilletes, mézclala con el pimentón y el aceite y hornea 25 minutos a 200 °C.\n2. Cuece la quinoa 12 minutos.\n3. Mezcla todo con los garbanzos, el limón y el cilantro.', 'Los bordes tostados de la coliflor son lo mejor del plato.'),
]

cenas = [
 R('Merluza al horno con calabacín y patata', 30, 'Cena ligera de pescado blanco con verdura y patata.',
   [('Merluza', 200), ('Calabacín', 120), ('Patata', 150), ('Aceite de oliva virgen extra', 6), ('Limón', 10), ('Perejil', 3)],
   '1. Corta la patata y el calabacín en rodajas y hornéalos 15 minutos a 200 °C.\n2. Coloca la merluza encima con el aceite y el limón.\n3. Hornea 10 minutos más y termina con perejil.', 'Si la merluza es congelada, descongélala bien y sécala.'),
 R('Revuelto de gambas y espinacas con pan de centeno', 15, 'Cena rápida y ligera con marisco y huevo.',
   [('Huevo entero, crudo', 100), ('Gambas Peladas Mediana', 100), ('Espinacas', 80), ('Pan de centeno', 50), ('Ajo', 3), ('Aceite de oliva virgen extra', 5)],
   '1. Saltea el ajo laminado y las gambas 2 minutos.\n2. Añade las espinacas hasta que se reduzcan.\n3. Incorpora los huevos batidos, remueve hasta cuajar y sirve con el pan de centeno tostado.', 'Retira del fuego cuando aún esté jugoso.'),
 R('Pollo a la plancha con ensalada de rúcula y quinoa', 20, 'Cena ligera con proteína magra y cereal.',
   [('Pechuga de pollo', 150), ('Quinoa', 50), ('Rúcula', 40), ('Tomate', 80), ('Aceite de oliva virgen extra', 8), ('Limón', 10)],
   '1. Cuece la quinoa 12 minutos y déjala enfriar un poco.\n2. Marca la pechuga a la plancha 5 minutos por lado.\n3. Mezcla la quinoa con la rúcula y el tomate, aliña con aceite y limón y sirve con el pollo.', 'Aplana la pechuga para que se haga de forma uniforme.'),
 R('Crema de calabacín y patata con pavo', 25, 'Cena de cuchara ligera con un extra de proteína.',
   [('Calabacín', 250), ('Patata', 150), ('Cebolla', 40), ('Queso crema light', 30), ('Fiambre de Pechuga de Pavo', 70), ('Pan de centeno', 40), ('Aceite de oliva virgen extra', 6)],
   '1. Sofríe la cebolla con el aceite y añade el calabacín y la patata en dados con agua que los cubra.\n2. Cuece 15 minutos y tritura con el queso crema.\n3. Sirve con el pavo cortado en tiras por encima y el pan de centeno tostado.', 'Añade el pavo al final para que no se reseque.'),
 R('Dorada al horno con espárragos y boniato', 30, 'Cena de pescado al horno con verdura e hidrato lento.',
   [('Dorada', 220), ('Espárragos', 120), ('Boniato', 150), ('Aceite de oliva virgen extra', 6), ('Limón', 10)],
   '1. Hornea el boniato en rodajas 15 minutos a 200 °C.\n2. Añade la dorada y los espárragos con el aceite.\n3. Hornea 12 minutos más y sirve con limón.', 'Pide la dorada limpia y en lomos.'),
 R('Tortilla de espinacas y champiñones con tomate', 15, 'Cena ligera con huevo, claras y verdura.',
   [('Huevo entero, crudo', 100), ('Clara de huevo', 100), ('Espinacas', 80), ('Champiñones', 80), ('Tomate', 100), ('Pan integral', 60), ('Aceite de oliva virgen extra', 4)],
   '1. Saltea los champiñones laminados y las espinacas 4 minutos.\n2. Añade los huevos y las claras batidos y cuaja la tortilla.\n3. Sirve con el tomate aliñado y el pan integral tostado.', 'Escurre bien las espinacas para que no suelten agua.'),
 R('Ensalada templada de salmón ahumado, pera y nueces', 10, 'Cena fría y rápida con grasa buena y proteína.',
   [('Salmón ahumado', 70), ('Rúcula', 50), ('Pera', 100), ('Nueces', 8), ('Pan integral', 80), ('Aceite de oliva virgen extra', 4), ('Vinagre', 5)],
   '1. Reparte la rúcula en un plato con la pera en láminas.\n2. Añade el salmón en tiras y las nueces troceadas.\n3. Aliña con el aceite y el vinagre y sirve con el pan integral.', 'El salmón ahumado ya es salado: no añadas sal.'),
 R('Pescadilla con judías verdes y patata cocida', 25, 'Cena ligera de pescado blanco con verdura y patata.',
   [('Pescadilla', 220), ('Judías verdes', 150), ('Patata', 150), ('Aceite de oliva virgen extra', 6), ('Ajo', 3), ('Limón', 10)],
   '1. Cuece la patata en dados y las judías verdes 10 minutos.\n2. Dora el ajo laminado en el aceite y cocina la pescadilla 3 minutos por lado.\n3. Sirve junto con la verdura y el limón.', 'Revisa que no queden espinas.'),
]

salida = [
 ('2026-10-08_veganas-2.json', lote('veganas-2-2026-10-08', 'Comida', {'kcal_min': 400, 'kcal_max': 850, 'proteina_pct_min_vegano': 0.13}, veganas, tipo_receta='completa')),
 ('2026-10-08_cenas-ligeras.json', lote('cenas-ligeras-2026-10-08', 'Cena', {'kcal_min': 300, 'kcal_max': 650, 'grasa_pct_max': 0.38}, cenas, tipo_receta='completa')),
]
for nombre, d in salida:
    json.dump(d, open(os.path.join(base, nombre), 'w'), ensure_ascii=False, indent=1)
    print(nombre, len(d['recetas']), 'recetas')
