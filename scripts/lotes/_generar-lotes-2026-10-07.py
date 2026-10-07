# Genera los lotes de recetas del 07-10-2026 (desayunos de deportista, meriendas, comidas ligeras, veganas).
# Uso: python3 scripts/lotes/_generar-lotes-2026-10-07.py   (escribe 2026-10-07_*.json; luego importar-lote-verificado.ts)
import json, glob, os
base = os.path.dirname(__file__)
cat = {}
NUEVOS = ('2026-10-07_desayunos-deportista.json', '2026-10-07_meriendas-reales.json', '2026-10-07_comidas-ligeras.json')
for f in sorted(x for x in glob.glob(os.path.join(base, '*.json')) if os.path.basename(x) not in NUEVOS):
    for k, v in json.load(open(f))['alimentos'].items():
        cat.setdefault(v['nombre'], v)

def lote(nombre, tipo_plato, criterios, recetas, apto_rendimiento=False, tipo_receta=None):
    usados = {}
    for r in recetas:
        for n, _ in r['ingredientes']:
            usados[n] = cat[n]
    out = {'lote': nombre, 'tipo_plato': tipo_plato, 'fuente': 'lote_verificado', 'criterios': criterios, 'alimentos': {}, 'recetas': []}
    if apto_rendimiento: out['apto_rendimiento'] = True
    if tipo_receta: out['tipo_receta'] = tipo_receta
    clave = {n: f'a{i}' for i, n in enumerate(sorted(usados))}
    out['alimentos'] = {clave[n]: v for n, v in usados.items()}
    for r in recetas:
        out['recetas'].append({**{k: v for k, v in r.items() if k != 'ingredientes'}, 'ingredientes': [[clave[n], g] for n, g in r['ingredientes']]})
    return out

R = lambda nombre, t, desc, ing, instr, cons, plato=None, porciones=1: {
    'nombre': nombre, 'descripcion': desc, 'tiempo_prep_min': t, 'porciones': porciones, **({'tipo_plato': plato} if plato else {}),
    'ingredientes': ing, 'instrucciones': instr, 'consejos': cons}

desayunos = [
 R('Bocadillo de tortilla francesa con jamón y zumo de naranja', 12, 'Desayuno completo y saciante con hidratos y proteína, para días de mucho entrenamiento.',
   [('Pan blanco', 120), ('Huevo entero, crudo', 150), ('Jamón Cocido Bonnatur 96 % Carne', 40), ('Tomate', 60), ('Aceite de oliva virgen extra', 10), ('Zumo de naranja', 200)],
   '1. Bate los huevos y haz una tortilla francesa en una sartén con parte del aceite.\n2. Abre el pan, unta el tomate rallado con el resto del aceite y añade el jamón.\n3. Rellena con la tortilla caliente y sirve con el zumo.', 'Con pan de centeno o integral sube la fibra.'),
 R('Tostadas integrales con huevos revueltos, aguacate y tomate', 10, 'Desayuno salado con grasa buena, proteína y buena cantidad de hidratos.',
   [('Pan integral', 120), ('Huevo entero, crudo', 150), ('Aguacate', 70), ('Tomate', 80), ('Aceite de oliva virgen extra', 8), ('Zumo de naranja', 200)],
   '1. Tuesta el pan.\n2. Haz los huevos revueltos a fuego suave con el aceite.\n3. Aplasta el aguacate sobre las tostadas, añade el tomate en rodajas y los huevos. Acompaña con el zumo.', 'Añade una pizca de pimentón o pimienta recién molida.'),
 R('Porridge grande de avena con plátano y crema de cacahuete', 8, 'Desayuno dulce, calórico y de absorción sostenida.',
   [('Avena', 90), ('leche semidesnatada', 300), ('Plátano', 120), ('Crema de cacahuete (natural)', 20), ('Miel', 10), ('Canela molida', 2)],
   '1. Calienta la leche con la avena a fuego medio 5 minutos removiendo.\n2. Sirve en un bol con el plátano en rodajas.\n3. Termina con la crema de cacahuete, la miel y la canela.', 'Prepáralo la noche anterior en frío (overnight) si no tienes tiempo.'),
 R('Tortitas de avena y yogur griego con frutos rojos', 15, 'Tortitas altas en proteína con fruta y yogur para un desayuno de fin de semana o de gran gasto.',
   [('Harina De Avena', 90), ('Huevo entero, crudo', 100), ('Plátano', 100), ('Yogur griego natural', 150), ('Frutos rojos congelados', 80), ('Miel', 10)],
   '1. Tritura la harina, los huevos y el plátano hasta obtener una masa lisa.\n2. Cocina las tortitas en sartén antiadherente a fuego medio por ambos lados.\n3. Sirve con el yogur, los frutos rojos y la miel.', 'Los frutos rojos congelados se descongelan en 5 minutos en el microondas.'),
 R('Tostadas de centeno con huevo poché, queso crema y salmón ahumado', 15, 'Desayuno salado y completo con proteína de calidad.',
   [('Pan de centeno', 110), ('Queso crema light', 60), ('Salmón ahumado', 50), ('Huevo entero, crudo', 100), ('Pepino', 50), ('Zumo de naranja', 150)],
   '1. Cuece los huevos en agua con un chorrito de vinagre durante 3 minutos.\n2. Tuesta el pan y unta el queso crema.\n3. Coloca el salmón, el pepino y el huevo encima. Sirve con el zumo.', 'Si no te sale el poché, usa huevo cocido en rodajas.'),
 R('Bol de skyr con granola, plátano y nueces', 5, 'Bol rápido con mucha proteína y energía, listo en cinco minutos.',
   [('Skyr natural', 250), ('Granola', 80), ('Plátano', 120), ('Nueces', 20), ('Miel', 10)],
   '1. Pon el skyr en un bol grande.\n2. Añade el plátano en rodajas y la granola por encima.\n3. Termina con las nueces troceadas y la miel.', 'Añade la granola justo antes de comer para que siga crujiente.'),
 R('Bagel de pavo, huevo y queso crema con zumo', 10, 'Bocadillo caliente y compacto, fácil de llevar.',
   [('Bagels Clásico', 100), ('Fiambre de Pechuga de Pavo', 60), ('Huevo entero, crudo', 100), ('Queso crema light', 40), ('Tomate', 60), ('Zumo de naranja', 200)],
   '1. Tuesta el bagel abierto por la mitad.\n2. Prepara el huevo a la plancha.\n3. Unta el queso crema, añade el pavo, el tomate y el huevo, y cierra. Acompaña con el zumo.', 'Cambia el pavo por jamón cocido si prefieres.'),
 R('Huevos revueltos con boniato asado y espinacas', 20, 'Desayuno salado con hidratos de absorción lenta y verdura.',
   [('Huevo entero, crudo', 150), ('Boniato', 200), ('Espinacas', 60), ('Aceite de oliva virgen extra', 10), ('Pan integral', 60)],
   '1. Corta el boniato en dados y hornéalo a 200 °C unos 20 minutos con la mitad del aceite.\n2. Saltea las espinacas y añade los huevos batidos hasta que cuajen.\n3. Sirve con el boniato y el pan tostado.', 'Prepara el boniato asado de varios días y recaliéntalo.'),
 R('Porridge de avena con bebida de soja, plátano y crema de cacahuete', 8, 'Desayuno dulce 100 % vegetal, calórico y saciante.',
   [('Avena', 80), ('Bebida de soja con calcio y vitaminas sin azúcares añadidos', 300), ('Plátano', 120), ('Crema de cacahuete (natural)', 25), ('Semillas de chía', 10), ('Dátiles medjool', 30)],
   '1. Calienta la bebida con la avena a fuego medio 5 minutos.\n2. Añade el plátano en rodajas y los dátiles troceados.\n3. Termina con la crema de cacahuete y las semillas de chía.', 'Sin cocinar: deja la avena en remojo en frío toda la noche.'),
 R('Tostadas integrales con tofu revuelto, aguacate y tomate', 12, 'Desayuno salado vegano con proteína completa.',
   [('Tofu firme', 150), ('Pan integral', 100), ('Aguacate', 70), ('Tomate', 80), ('Aceite de oliva virgen extra', 8), ('Zumo de naranja', 200)],
   '1. Desmenuza el tofu y saltéalo con el aceite y una pizca de pimentón o cúrcuma.\n2. Tuesta el pan y cúbrelo con el aguacate aplastado.\n3. Añade el tofu y el tomate en rodajas. Acompaña con el zumo.', 'Una pizca de sal negra (kala namak) le da sabor a huevo.'),
 R('Bol de avena con frutos rojos, nueces y bebida de soja', 6, 'Bol vegetal energético, con fruta y grasa buena.',
   [('Avena', 70), ('Bebida de soja con calcio y vitaminas sin azúcares añadidos', 250), ('Frutos rojos congelados', 100), ('Nueces', 20), ('Semillas de chía', 10), ('Plátano', 100)],
   '1. Cocina la avena con la bebida de soja unos 4 minutos.\n2. Pásala a un bol y añade el plátano en rodajas y los frutos rojos.\n3. Termina con las nueces y las semillas de chía.', 'Los frutos rojos congelados enfrían el bol: añádelos al final si la quieres caliente.'),
]

meriendas = [
 R('Bocadillo pequeño de pavo y tomate', 5, 'Merienda salada, ligera y saciante.',
   [('Pan integral', 60), ('Fiambre de Pechuga de Pavo', 40), ('Tomate', 40), ('Aceite de oliva virgen extra', 5)],
   '1. Abre el pan y unta el tomate rallado con el aceite.\n2. Añade las lonchas de pavo y cierra.', 'Con pan de centeno queda más contundente.'),
 R('Yogur con granola y fresas', 3, 'Merienda fresca de preparación inmediata.',
   [('Yogur natural', 125), ('Granola', 30), ('Fresas', 80)],
   '1. Pon el yogur en un vaso o bol.\n2. Añade las fresas troceadas y la granola por encima justo antes de comer.', 'Cambia las fresas por la fruta de temporada.'),
 R('Tostada de aguacate y huevo cocido', 8, 'Merienda con grasa buena y proteína.',
   [('Pan integral', 50), ('Aguacate', 50), ('Huevo entero, crudo', 60)],
   '1. Cuece el huevo 10 minutos y pélalo.\n2. Tuesta el pan, extiende el aguacate aplastado y corona con el huevo en rodajas.', 'Unas gotas de limón evitan que el aguacate se oscurezca.'),
 R('Batido de plátano, leche y avena', 5, 'Batido espeso y energético, fácil de llevar.',
   [('leche semidesnatada', 250), ('Plátano', 120), ('Avena', 30), ('Cacao Puro en Polvo sin Azúcar', 5)],
   '1. Pon todos los ingredientes en la batidora.\n2. Tritura hasta que quede homogéneo y sirve frío.', 'Con el plátano congelado queda más cremoso.'),
 R('Tortitas de arroz con requesón y fresas', 4, 'Merienda ligera y dulce con proteína.',
   [('Tortitas de Arroz Integral Paquete', 30), ('Requesón', 100), ('Fresas', 80), ('Miel', 5)],
   '1. Unta el requesón sobre las tortitas.\n2. Añade las fresas laminadas y un hilo de miel.', 'Sírvelas al momento para que no se reblandezcan.'),
 R('Manzana con crema de cacahuete y yogur griego', 5, 'Merienda de fruta, proteína y grasa buena.',
   [('Manzana', 150), ('Crema de cacahuete (natural)', 20), ('Yogur griego natural', 100)],
   '1. Corta la manzana en gajos.\n2. Mezcla la crema de cacahuete con el yogur y úsalo para mojar la manzana.', 'Sirve con canela por encima.'),
 R('Fruta y frutos secos', 2, 'Merienda de preparación inmediata, rica en grasa buena.',
   [('Manzana', 150), ('Nueces', 25), ('Almendras', 15)],
   '1. Lava y corta la manzana.\n2. Acompáñala con un puñado de nueces y almendras.', 'Pésalos una vez y usa siempre el mismo puñado.'),
 R('Tostada de queso fresco y mermelada', 4, 'Merienda dulce y suave con proteína.',
   [('Pan de centeno', 50), ('Queso fresco batido desnatado 0% MG', 100), ('Mermelada Arandano', 15)],
   '1. Tuesta el pan de centeno.\n2. Extiende el queso fresco batido y termina con la mermelada.', 'Usa mermelada sin azúcares añadidos.'),
 R('Wrap pequeño de atún y verduras', 7, 'Merienda salada con proteína de pescado.',
   [('Tortilla de Trigo', 50), ('Atún en lata al natural', 50), ('Tomate', 40), ('Cebolla', 10), ('Aceite de oliva virgen extra', 4)],
   '1. Escurre el atún y mézclalo con el tomate y la cebolla picados.\n2. Rellena la tortilla, enróllala y córtala por la mitad.', 'Caliéntala 20 segundos en sartén para sellarla.'),
 R('Tortitas de arroz con hummus casero y zanahoria', 8, 'Merienda 100 % vegetal con proteína de legumbre.',
   [('Garbanzos cocidos', 80), ('Aceite de oliva virgen extra', 8), ('Limón', 10), ('Comino', 1), ('Tortitas de Arroz Integral Paquete', 30), ('Zanahoria', 60)],
   '1. Tritura los garbanzos con el aceite, el limón y el comino hasta obtener una crema.\n2. Úntala sobre las tortitas y acompaña con la zanahoria en bastones.', 'Si queda espeso, añade una cucharada de agua.'),
 R('Plátano con crema de cacahuete y avena', 4, 'Merienda vegetal, energética y rápida.',
   [('Plátano', 120), ('Crema de cacahuete (natural)', 20), ('Avena', 30)],
   '1. Corta el plátano en rodajas gruesas.\n2. Cúbrelo con la crema de cacahuete y espolvorea la avena.', 'Tuesta la avena unos minutos en seco para más sabor.'),
 R('Tostada de crema de cacahuete y fresas', 4, 'Merienda dulce vegana con fruta.',
   [('Pan integral', 60), ('Crema de cacahuete (natural)', 15), ('Fresas', 80)],
   '1. Tuesta el pan integral.\n2. Unta la crema de cacahuete y coloca las fresas laminadas.', 'Añade semillas de chía por encima.'),
]

comidas_ligeras = [
 R('Merluza al horno con patata y verduras', 35, 'Plato de pescado blanco al horno, ligero y completo.',
   [('Merluza', 200), ('Patata', 200), ('Cebolla', 50), ('Pimiento rojo', 60), ('Aceite de oliva virgen extra', 10), ('Ajo', 3), ('Perejil', 3), ('Limón', 10)],
   '1. Corta la patata, la cebolla y el pimiento en rodajas y colócalos en una bandeja con la mitad del aceite.\n2. Hornea a 200 °C 20 minutos y añade la merluza con el ajo y el perejil.\n3. Termina 10 minutos más y aliña con limón y el resto del aceite.', 'La patata debe quedar casi hecha antes de añadir el pescado.'),
 R('Lentejas estofadas con verduras y arroz', 30, 'Plato de legumbre completo y saciante.',
   [('Lentejas cocidas', 250), ('Arroz blanco', 50), ('Zanahoria', 60), ('Cebolla', 50), ('Pimentón dulce', 2), ('Aceite de oliva virgen extra', 10), ('Ajo', 3)],
   '1. Sofríe la cebolla, la zanahoria y el ajo con el aceite.\n2. Añade el pimentón, las lentejas y el arroz con agua que lo cubra.\n3. Cuece 15 minutos hasta que el arroz esté tierno.', 'Si usas lentejas secas, cuécelas aparte con antelación.'),
 R('Garbanzos con espinacas y bacalao', 25, 'Plato de cuchara con legumbre y pescado, rico en proteína.',
   [('Garbanzos cocidos', 200), ('Espinacas', 150), ('Bacalao (fresco)', 150), ('Aceite de oliva virgen extra', 10), ('Ajo', 3), ('Pimentón', 2), ('Cebolla', 40)],
   '1. Sofríe la cebolla y el ajo con el aceite y el pimentón.\n2. Añade los garbanzos y las espinacas y cuece 5 minutos.\n3. Incorpora el bacalao en trozos y cocina 6 minutos más.', 'Desala el bacalao si es salado antes de usarlo.'),
 R('Pollo al limón con boniato asado y judías verdes', 35, 'Plato equilibrado de ave con guarnición de hidrato y verdura.',
   [('Pechuga de pollo', 200), ('Boniato', 200), ('Judías verdes', 150), ('Aceite de oliva virgen extra', 10), ('Limón', 15), ('Ajo', 3)],
   '1. Hornea el boniato en dados a 200 °C 25 minutos.\n2. Marca el pollo a la plancha con el ajo y termina con zumo de limón.\n3. Cuece las judías verdes y sirve todo junto con el aceite.', 'Corta el pollo en filetes finos para que se haga rápido.'),
 R('Pavo con verduras salteadas y quinoa', 25, 'Plato ligero con proteína magra y cereal completo.',
   [('Pechuga de pavo', 180), ('Quinoa', 70), ('Calabacín', 100), ('Pimiento rojo', 80), ('Zanahoria', 50), ('Aceite de oliva virgen extra', 10)],
   '1. Cuece la quinoa 12 minutos y escúrrela.\n2. Saltea el pavo en tacos con el aceite y retíralo.\n3. Saltea las verduras, vuelve a añadir el pavo y sirve con la quinoa.', 'Lava bien la quinoa antes de cocerla para quitar el amargor.'),
 R('Dorada al horno con calabaza y espárragos', 30, 'Pescado al horno con verdura de temporada.',
   [('Dorada', 220), ('Calabaza', 200), ('Patata', 120), ('Espárragos', 100), ('Aceite de oliva virgen extra', 10), ('Limón', 10)],
   '1. Corta la calabaza y la patata en dados y hornéalas 15 minutos a 200 °C.\n2. Añade la dorada y los espárragos con parte del aceite.\n3. Hornea 12 minutos más y termina con limón.', 'Pide la dorada ya limpia y en lomos.'),
 R('Pescadilla con guisantes y patata', 30, 'Pescado blanco en salsa ligera con guarnición de patata.',
   [('Pescadilla', 200), ('Guisantes frescos', 100), ('Patata', 180), ('Cebolla', 40), ('Aceite de oliva virgen extra', 10), ('Perejil', 3)],
   '1. Sofríe la cebolla con el aceite y añade la patata en rodajas con agua que la cubra.\n2. Cuece 12 minutos y añade los guisantes y la pescadilla.\n3. Cocina 6 minutos más y termina con perejil.', 'Añade el pescado al final para que no se deshaga.'),
 R('Alubias con verduras', 30, 'Plato de legumbre ligero y sin carne.',
   [('Alubia cocida roja', 250), ('Zanahoria', 60), ('Pimiento rojo', 60), ('Cebolla', 40), ('Aceite de oliva virgen extra', 8), ('Pimentón', 2), ('Ajo', 3)],
   '1. Sofríe la cebolla, el pimiento, la zanahoria y el ajo con el aceite.\n2. Añade el pimentón y las alubias con un poco de agua.\n3. Cuece 12 minutos a fuego suave.', 'Mejora al día siguiente: ideal para preparar en tandas.'),
 R('Tofu salteado con quinoa y verduras', 20, 'Plato vegano con proteína completa.',
   [('Tofu firme', 180), ('Quinoa', 70), ('Brócoli', 100), ('Zanahoria', 60), ('Salsa de soja', 10), ('Aceite de oliva virgen extra', 4), ('Ajo', 3)],
   '1. Cuece la quinoa 12 minutos y escúrrela.\n2. Dora el tofu en dados con el aceite y el ajo.\n3. Añade el brócoli y la zanahoria, saltea 5 minutos y termina con la salsa de soja.', 'Presiona el tofu 10 minutos antes para que quede más firme.'),
 R('Curry de garbanzos con calabaza y arroz basmati', 30, 'Plato vegano especiado y reconfortante.',
   [('Garbanzos cocidos', 200), ('Calabaza', 150), ('Tomate triturado', 100), ('Cebolla', 50), ('Arroz basmati', 60), ('Comino', 2), ('Pimentón', 2), ('Aceite de oliva virgen extra', 8)],
   '1. Sofríe la cebolla con el aceite y las especias.\n2. Añade la calabaza, el tomate y los garbanzos con un poco de agua y cuece 15 minutos.\n3. Sirve con el arroz basmati cocido aparte.', 'Los garbanzos de bote funcionan igual: acláralos antes.'),
 R('Berenjena y calabacín al horno con garbanzos y quinoa', 35, 'Plato vegano de verduras al horno con legumbre y cereal.',
   [('Berenjena', 120), ('Calabacín', 100), ('Garbanzos cocidos', 120), ('Quinoa', 60), ('Tomate triturado', 80), ('Aceite de oliva virgen extra', 10), ('Comino', 1), ('Perejil', 3)],
   '1. Corta la berenjena y el calabacín en dados y hornéalos 20 minutos a 200 °C con el aceite.\n2. Cuece la quinoa 12 minutos.\n3. Mezcla las verduras con los garbanzos, el tomate y el comino, y sirve con la quinoa y el perejil.', 'Salar la berenjena 10 minutos antes reduce el amargor.'),
]

salida = [
 ('2026-10-07_desayunos-deportista.json', lote('desayunos-deportista-2026-10-07', 'Desayuno', {'kcal_min': 550, 'kcal_max': 950}, desayunos, apto_rendimiento=True)),
 ('2026-10-07_meriendas-reales.json', lote('meriendas-reales-2026-10-07', 'Merienda', {'kcal_min': 180, 'kcal_max': 420}, meriendas)),
 ('2026-10-07_comidas-ligeras.json', lote('comidas-ligeras-2026-10-07', 'Comida', {'kcal_min': 380, 'kcal_max': 750, 'grasa_pct_max': 0.35}, comidas_ligeras, tipo_receta='completa')),
]
for nombre, d in salida:
    json.dump(d, open(os.path.join(base, nombre), 'w'), ensure_ascii=False, indent=1)
    print(nombre, len(d['recetas']), 'recetas')
