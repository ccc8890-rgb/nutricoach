#!/usr/bin/env python3
"""Lote vegano del 18-10-2026: cubre los huecos del recetario vegano (auditoría de taxonomía).
Huecos: desayunos con ≥20 g de proteína (2), meriendas con ≥15 g (1), post-entreno (0), cenas (9).
Alimentos: solo catálogo verificado (nombre exacto + prefijo de id). Cantidades en seco para cereales y pasta.
Los macros los calcula el importador desde la BD. Sin «víspera/carrera/recuperación» en título, descripción ni pasos."""
import json, os

A = {  # clave: (nombre exacto, prefijo, rol, alérgenos)
 'avena': ('Avena', '31b21452', 'carbohidrato_base', ['Gluten']),
 'soja': ('Bebida de soja con calcio y vitaminas sin azúcares añadidos', '8de6665d', 'lacteo_complemento', ['Soja']),
 'avenab': ('Leche de avena', 'bf38a422', 'lacteo_complemento', ['Gluten']),
 'prot': ('Proteína vegetal (polvo)', '957b6d12', 'proteina_principal', ['Soja']),
 'platano': ('Plátano', '1131a576', 'fruta_complemento', []),
 'chia': ('Semillas de chía', 'b5b5e57f', 'grasa_saludable', []),
 'canela': ('Canela molida', '57a8bd13', 'especias_aromaticos', []),
 'pan': ('Pan integral', '1948a73a', 'carbohidrato_base', ['Gluten']),
 'tempeh': ('Tempeh', 'bca25e6d', 'proteina_principal', ['Soja']),
 'aguacate': ('Aguacate', '91ad5545', 'grasa_saludable', []),
 'tomate': ('Tomate', '7f40a393', 'verdura_volumen', []),
 'aceite': ('Aceite de oliva virgen extra', 'efdb0f46', 'grasa_saludable', []),
 'limon': ('Limón', '60ad001e', 'salsa_condimento', []),
 'fresa': ('Fresa', 'b54b6e8b', 'fruta_complemento', []),
 'almendra': ('Almendra Hacendado sin piel', '3a38b590', 'grasa_saludable', ['Frutos Secos']),
 'arce': ('Sirope de arce', '34d6fafa', 'salsa_condimento', []),
 'hgarb': ('Harina de garbanzo', '50bcb9d4', 'carbohidrato_base', []),
 'espinacas': ('Espinacas', 'cb57d667', 'verdura_volumen', []),
 'curcuma': ('Cúrcuma', '94ba864e', 'especias_aromaticos', []),
 'hummus': ('Hummus', '2856bf23', 'salsa_condimento', ['Sésamo']),
 'mango': ('Mango', '4166da6e', 'fruta_complemento', []),
 'granola': ('Granola', '54fee582', 'carbohidrato_base', ['Gluten']),
 'pita': ('Pan de pita', 'd21b8e95', 'carbohidrato_base', ['Gluten']),
 'edamame': ('Edamame', '642cd6e3', 'proteina_principal', ['Soja']),
 'pepino': ('Pepino', '2e8d5d64', 'verdura_volumen', []),
 'pipas': ('Pipas de calabaza tostadas', '0123ea99', 'grasa_saludable', []),
 'datiles': ('Dátiles medjool', 'e6dd0fa6', 'fruta_complemento', []),
 'seitan': ('Seitán Bio', '24ef9ec3', 'proteina_principal', ['Gluten']),
 'pimiento': ('Pimiento rojo', 'd106e3bb', 'verdura_volumen', []),
 'cacahuete': ('Crema de cacahuete (natural)', '6328f4b9', 'grasa_saludable', ['Cacahuetes']),
 'basmati': ('Arroz basmati cocido', '8c5f6c49', 'carbohidrato_base', []),
 'guisantes': ('Guisantes congelados (cocidos)', '2faee000', 'verdura_volumen', []),
 'sojasalsa': ('Salsa de soja', 'caa47a33', 'salsa_condimento', ['Soja', 'Gluten']),
 'ajo': ('Ajo', 'bdc11c5a', 'especias_aromaticos', []),
 'cebolla': ('Cebolla', '950afc33', 'verdura_volumen', []),
 'pasta': ('Pasta (seca)', '13f26d7a', 'carbohidrato_base', ['Gluten']),
 'sojatex': ('Soja texturizada (seca)', '97c4e147', 'proteina_principal', ['Soja']),
 'lentejas': ('Lentejas cocidas', 'e69fd4f0', 'carbohidrato_base', []),
 'tomatetri': ('Tomate triturado', '1390b7a4', 'salsa_condimento', []),
 'zanahoria': ('Zanahoria', '4dacb910', 'verdura_volumen', []),
 'quinoa': ('Quinoa', '53587262', 'carbohidrato_base', []),
 'boniato': ('Boniato', '6c5d82a5', 'carbohidrato_base', []),
 'brocoli': ('Brócoli', '8820b293', 'verdura_volumen', []),
 'cuscus': ('Cuscús', '11d56939', 'carbohidrato_base', ['Gluten']),
 'pasas': ('Pasas', 'ad30a656', 'fruta_complemento', []),
 'naranja': ('Naranja', '5e122ac4', 'fruta_complemento', []),
 'zumo': ('Zumo de naranja', 'f2671248', 'fruta_complemento', []),
 'coco': ('Leche de coco', 'c661ff5c', 'grasa_saludable', []),
 'comino': ('Comino', '88959dfb', 'especias_aromaticos', []),
 'fideos': ('Fideos', '794bf491', 'carbohidrato_base', ['Gluten']),
 'tofu': ('Tofu firme', 'c0736451', 'proteina_principal', ['Soja']),
 'coliflor': ('Coliflor', 'e5efc372', 'verdura_volumen', []),
 'tahini': ('tahini', '6e801766', 'grasa_saludable', ['Sésamo']),
 'calabaza': ('Calabaza', 'cfd9ca77', 'verdura_volumen', []),
 'alubia': ('Alubia cocida roja', '35e28212', 'carbohidrato_base', []),
 'arrozint': ('Arroz integral', 'b5839902', 'carbohidrato_base', []),
 'pimenton': ('Pimentón dulce', 'e4fdfad8', 'especias_aromaticos', []),
}

def alimentos(*claves):
    return {k: {'nombre': A[k][0], 'prefijo': A[k][1], 'rol': A[k][2], 'alergenos': A[k][3], 'origen': 'vegetal'} for k in claves}

def lote(nombre, tipo_plato, recetas, criterios, **extra):
    usados = sorted({k for r in recetas for k, _ in r['ingredientes']})
    d = {'lote': nombre, 'tipo_plato': tipo_plato, 'fuente': 'lote_verificado', 'criterios': criterios,
         'alimentos': alimentos(*usados), 'recetas': recetas}
    d.update(extra)
    return d

def r(nombre, desc, prep, ingr, pasos, consejo, **extra):
    d = {'nombre': nombre, 'descripcion': desc, 'tiempo_prep_min': prep, 'porciones': 1,
         'ingredientes': ingr, 'instrucciones': '\n'.join(f'{i}. {p}' for i, p in enumerate(pasos, 1)), 'consejos': consejo}
    d.update(extra)
    return d

C_VIT = 'La vitamina C (limón, pimiento, naranja) ayuda a absorber el hierro de las legumbres y la soja.'

desayunos = lote('veganas-3-desayunos-2026-10-18', 'Desayuno', [
  r('Gachas de avena con proteína vegetal, plátano y chía', 'Gachas cremosas con 30 g de proteína vegetal para un desayuno saciante.', 10,
    [['avena', 60], ['soja', 250], ['prot', 25], ['platano', 100], ['chia', 10], ['canela', 2]],
    ['Calienta la bebida de soja con la avena y la canela 5 minutos, removiendo.', 'Apártalo del fuego, deja templar 1 minuto y mezcla la proteína en polvo hasta que quede sin grumos.', 'Sirve con el plátano en rodajas y la chía por encima.'],
    'Si quedan muy espesas, añade un chorrito de bebida de soja.'),
  r('Tostadas de tempeh con aguacate y tomate', 'Tostadas saladas con tempeh dorado: proteína completa y grasa buena.', 15,
    [['pan', 80], ['tempeh', 100], ['aguacate', 60], ['tomate', 80], ['aceite', 5], ['limon', 5]],
    ['Corta el tempeh en lonchas finas y dóralo en la sartén con el aceite 3 minutos por lado.', 'Tuesta el pan y cubre con el aguacate machacado con unas gotas de limón.', 'Añade las lonchas de tempeh y el tomate en rodajas.'],
    'Un poco de sal y pimienta negra realzan el tempeh. ' + C_VIT),
  r('Pudding de chía con proteína, fresas y almendras', 'Pudding frío preparado la noche anterior, con 30 g de proteína.', 5,
    [['chia', 30], ['soja', 250], ['prot', 20], ['fresa', 120], ['almendra', 15], ['arce', 10]],
    ['Mezcla en un bote la bebida de soja, la proteína en polvo y la chía hasta que no queden grumos.', 'Tapa y refrigera al menos 4 horas, mejor toda la noche.', 'Sirve con las fresas troceadas, las almendras picadas y el sirope de arce.'],
    'Remuévelo a los 10 minutos de prepararlo para que la chía no haga bloques.'),
  r('Tortitas de garbanzo con espinacas y hummus', 'Tortitas saladas sin huevo ni lácteos, con proteína de legumbre.', 20,
    [['hgarb', 80], ['espinacas', 80], ['curcuma', 1], ['hummus', 60], ['aceite', 8], ['tomate', 80]],
    ['Mezcla la harina de garbanzo con 130 ml de agua, la cúrcuma y una pizca de sal hasta obtener una masa fluida.', 'Saltea las espinacas 2 minutos con una gota de aceite y añádelas a la masa.', 'Cocina dos tortitas en una sartén antiadherente con el resto del aceite, 3 minutos por lado.', 'Sirve con el hummus y el tomate en rodajas.'],
    'Deja reposar la masa 10 minutos antes de cocinar: queda más tierna.'),
  r('Smoothie bowl de mango y espinacas con proteína', 'Bowl frío y espeso con fruta, espinacas y 30 g de proteína.', 10,
    [['mango', 150], ['platano', 80], ['espinacas', 40], ['soja', 200], ['prot', 25], ['granola', 25], ['chia', 10]],
    ['Tritura el mango, el plátano, las espinacas, la bebida de soja y la proteína hasta obtener una crema espesa.', 'Pásala a un bol y cúbrela con la granola y la chía.'],
    'Congela la fruta en trozos para un bowl más espeso y frío.'),
  r('Pita de hummus, edamame y verduras', 'Pan de pita relleno de legumbre y verdura crujiente, listo en 10 minutos.', 10,
    [['pita', 70], ['edamame', 80], ['hummus', 50], ['pepino', 60], ['tomate', 50], ['pipas', 10]],
    ['Descongela o cuece el edamame y mézclalo con el hummus.', 'Abre la pita, rellénala con la mezcla, el pepino y el tomate en láminas.', 'Termina con las pipas de calabaza.'],
    'Caliéntala 1 minuto en la tostadora para que quede más aromática.'),
], {'kcal_min': 380, 'kcal_max': 700, 'proteina_pct_min_vegano': 0.17}, tipo_receta='desayuno')

meriendas = lote('veganas-3-meriendas-2026-10-18', 'Merienda', [
  r('Batido verde de soja, plátano y espinacas', 'Batido cremoso con 30 g de proteína y apenas sabor a espinaca.', 5,
    [['soja', 300], ['prot', 25], ['platano', 100], ['espinacas', 40], ['chia', 5]],
    ['Pon todos los ingredientes en la batidora con unos cubitos de hielo.', 'Tritura 1 minuto hasta que quede liso y sirve enseguida.'],
    'Si usas plátano congelado queda más espeso, como un helado.'),
  r('Tostada de hummus, edamame y tomate', 'Merienda salada con proteína de soja y legumbre.', 8,
    [['pan', 60], ['hummus', 60], ['edamame', 70], ['tomate', 70], ['limon', 5]],
    ['Tuesta el pan y úntalo con el hummus.', 'Reparte el edamame cocido y el tomate en rodajas.', 'Exprime unas gotas de limón por encima.'],
    'Con una pizca de pimentón o comino queda más sabrosa.'),
  r('Edamame con limón y pipas de calabaza', 'Snack caliente de vaina con 26 g de proteína.', 8,
    [['edamame', 180], ['pipas', 15], ['limon', 10]],
    ['Cuece el edamame 3 minutos en agua con sal y escúrrelo.', 'Aliña con el zumo de limón y espolvorea las pipas.'],
    'Se come sacando los granos de la vaina con los dientes.'),
  r('Bolitas de dátil, almendra y proteína', 'Bolitas sin horno, con dátil y 25 g de proteína vegetal.', 15,
    [['datiles', 50], ['prot', 25], ['almendra', 20], ['avena', 20], ['canela', 2]],
    ['Tritura los dátiles deshuesados con las almendras hasta obtener una pasta.', 'Añade la avena, la proteína, la canela y 1 cucharada de agua; amasa.', 'Forma 6 bolitas y refrigéralas 30 minutos.'],
    'Se conservan 5 días en la nevera: prepara tandas para toda la semana.'),
  r('Mini pita de seitán con pimiento y hummus', 'Bocadillo rápido con 32 g de proteína de trigo.', 10,
    [['pita', 50], ['seitan', 100], ['pimiento', 50], ['hummus', 30]],
    ['Dora el seitán en lonchas en una sartén seca 2 minutos por lado.', 'Calienta la pita, úntala con el hummus y rellena con el seitán y el pimiento en tiras.'],
    'El pimiento crudo aporta vitamina C, que favorece la absorción del hierro.'),
  r('Barritas de avena, plátano y cacahuete sin horno', 'Barritas de cuchara con 30 g de proteína, sin horno.', 15,
    [['avena', 40], ['cacahuete', 20], ['prot', 25], ['platano', 60], ['arce', 10]],
    ['Machaca el plátano y mézclalo con la crema de cacahuete y el sirope.', 'Añade la avena y la proteína en polvo y amasa; si hace falta, agrega un chorrito de agua.', 'Extiéndelo en un molde pequeño, presiona y refrigera 1 hora antes de cortar.'],
    'Cortadas en porciones se guardan 4 días en la nevera.'),
], {'kcal_min': 220, 'kcal_max': 480, 'proteina_pct_min_vegano': 0.2}, tipo_receta='snack_postre')

rendimiento = lote('veganas-3-entreno-2026-10-18', 'Comida', [
  r('Arroz basmati con seitán, guisantes y salsa de soja', 'Plato completo con hidratos y 50 g de proteína vegetal.', 20,
    [['basmati', 250], ['seitan', 150], ['guisantes', 80], ['sojasalsa', 10], ['aceite', 8], ['ajo', 5], ['cebolla', 40]],
    ['Sofríe la cebolla y el ajo picados en el aceite 4 minutos.', 'Añade el seitán en dados y dóralo 3 minutos.', 'Incorpora el arroz cocido, los guisantes y la salsa de soja; saltea 4 minutos.'],
    'Usa arroz cocido del día anterior: queda más suelto.', perfil='post'),
  r('Pasta con ragú de soja texturizada y lentejas', 'Ragú vegano de proteína alta con pasta y hierro de legumbre.', 30,
    [['pasta', 90], ['sojatex', 30], ['lentejas', 120], ['tomatetri', 150], ['cebolla', 50], ['zanahoria', 50], ['aceite', 8], ['ajo', 5]],
    ['Hidrata la soja texturizada 10 minutos en agua caliente y escúrrela.', 'Sofríe la cebolla, la zanahoria y el ajo picados en el aceite 6 minutos.', 'Añade la soja, las lentejas y el tomate; cocina a fuego suave 12 minutos.', 'Cuece la pasta, escúrrela y mézclala con el ragú.'],
    C_VIT, perfil='post'),
  r('Bowl de quinoa, tempeh y boniato asado', 'Bowl completo con quinoa, tempeh y boniato, con 38 g de proteína.', 35,
    [['quinoa', 70], ['tempeh', 120], ['boniato', 200], ['brocoli', 100], ['aceite', 8], ['sojasalsa', 10]],
    ['Asa el boniato en dados 25 minutos a 200 °C.', 'Cuece la quinoa 12 minutos en el doble de agua.', 'Dora el tempeh en dados en una sartén con el aceite 5 minutos y añade la salsa de soja.', 'Cuece el brócoli al vapor 5 minutos y monta el bol.'],
    'Aliña con unas gotas de limón: la vitamina C mejora la absorción del hierro.', perfil='post'),
  r('Batido de plátano, avena y proteína vegetal', 'Batido espeso con 38 g de proteína y 63 g de hidratos.', 5,
    [['soja', 300], ['avena', 40], ['prot', 30], ['platano', 120]],
    ['Tritura todos los ingredientes con hielo durante 1 minuto.', 'Sirve enseguida.'],
    'Si lo quieres más fino, usa copos de avena molidos.', perfil='post', tipo_plato='Merienda', tipo_receta='snack_postre'),
  r('Cuscús dulce con pasas, naranja y canela', 'Plato ligero y fácil de digerir, rico en hidratos y casi sin grasa.', 10,
    [['cuscus', 90], ['pasas', 20], ['zumo', 150], ['canela', 2]],
    ['Hidrata el cuscús con agua hirviendo (la misma cantidad) tapado 5 minutos.', 'Suelta los granos con un tenedor y mezcla con las pasas y la canela.', 'Riega con el zumo de naranja y sirve templado o frío.'],
    'Perfecto cuando necesitas energía sin sobrecargar el estómago.', perfil='pre', tipo_plato='Desayuno', tipo_receta='desayuno'),
], {'kcal_min': 400, 'kcal_max': 800, 'proteina_pct_min_vegano': 0.15, 'hc_pct_min': 0.45}, apto_rendimiento=True, tipo_receta='completa',
  criterios_por_perfil={'post': {'kcal_min': 400, 'kcal_max': 800, 'proteina_pct_min_vegano': 0.15, 'hc_pct_min': 0.45},
                        'pre': {'kcal_min': 250, 'kcal_max': 600, 'hc_pct_min': 0.6, 'grasa_pct_max': 0.15}})

cenas = lote('veganas-3-cenas-2026-10-18', 'Cena', [
  r('Curry de lentejas y espinacas con arroz basmati', 'Curry cremoso de lentejas con espinacas, rico en hierro y proteína.', 30,
    [['lentejas', 200], ['espinacas', 100], ['coco', 40], ['tomatetri', 100], ['cebolla', 60], ['ajo', 5], ['curcuma', 2], ['comino', 2], ['basmati', 150], ['aceite', 6]],
    ['Sofríe la cebolla y el ajo picados en el aceite 5 minutos con la cúrcuma y el comino.', 'Añade el tomate y las lentejas; cocina 8 minutos.', 'Incorpora las espinacas y la leche de coco y cocina 3 minutos más.', 'Sirve con el arroz basmati.'],
    C_VIT + ' Un chorrito de limón al final lo mejora.'),
  r('Salteado de seitán con brócoli y fideos', 'Salteado rápido de estilo oriental con 50 g de proteína.', 20,
    [['fideos', 70], ['seitan', 150], ['brocoli', 150], ['zanahoria', 60], ['sojasalsa', 12], ['ajo', 5], ['aceite', 8]],
    ['Cuece los fideos según el paquete y escúrrelos.', 'Saltea el ajo, la zanahoria en bastones y el brócoli en ramilletes con el aceite 5 minutos.', 'Añade el seitán en tiras y la salsa de soja; saltea 3 minutos.', 'Mezcla con los fideos y sirve.'],
    'Cocina a fuego fuerte y poco tiempo para que la verdura quede crujiente.'),
  r('Tofu crujiente con coliflor asada y quinoa', 'Tofu rebozado en harina de garbanzo, con coliflor y quinoa.', 40,
    [['tofu', 200], ['hgarb', 20], ['coliflor', 200], ['quinoa', 60], ['aceite', 6], ['tahini', 10], ['limon', 10], ['comino', 2]],
    ['Asa la coliflor en ramilletes con la mitad del aceite y el comino 25 minutos a 200 °C.', 'Corta el tofu en dados, pásalo por la harina de garbanzo y dóralo en la sartén con el resto del aceite 8 minutos.', 'Cuece la quinoa 12 minutos.', 'Mezcla el tahini con el limón y 2 cucharadas de agua para la salsa y sirve todo junto.'],
    'Presiona el tofu 10 minutos con papel de cocina antes de cortarlo: queda más crujiente.'),
  r('Crema de calabaza con tempeh crujiente y pipas', 'Crema suave de calabaza con tempeh dorado: 32 g de proteína.', 35,
    [['calabaza', 300], ['cebolla', 60], ['boniato', 100], ['tempeh', 120], ['pipas', 15], ['aceite', 6], ['comino', 2], ['pimenton', 2]],
    ['Sofríe la cebolla en el aceite, añade la calabaza y el boniato en trozos y cubre con agua; cuece 20 minutos.', 'Tritura con el comino y sal hasta que quede fina.', 'Dora el tempeh en dados en una sartén con el pimentón 5 minutos.', 'Sirve la crema con el tempeh y las pipas por encima.'],
    'Si la quieres más ligera, usa menos boniato y más calabaza.'),
  r('Alubias rojas guisadas con arroz integral y pimiento', 'Guiso reconfortante de legumbre con arroz integral, rico en hierro.', 35,
    [['alubia', 250], ['arrozint', 50], ['pimiento', 100], ['tomatetri', 100], ['cebolla', 60], ['pimenton', 3], ['ajo', 5], ['aceite', 8], ['espinacas', 60]],
    ['Cuece el arroz integral 25 minutos en agua con sal y escúrrelo.', 'Sofríe la cebolla, el ajo y el pimiento en el aceite 6 minutos con el pimentón.', 'Añade el tomate y las alubias; cocina 10 minutos.', 'Incorpora las espinacas, cocina 2 minutos y sirve sobre el arroz.'],
    C_VIT),
], {'kcal_min': 400, 'kcal_max': 750, 'proteina_pct_min_vegano': 0.17}, tipo_receta='completa')

out = os.path.dirname(os.path.abspath(__file__))
for nombre, d in [('2026-10-18_veganas-desayunos', desayunos), ('2026-10-18_veganas-meriendas', meriendas),
                  ('2026-10-18_veganas-entreno', rendimiento), ('2026-10-18_veganas-cenas', cenas)]:
    with open(os.path.join(out, nombre + '.json'), 'w') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    print(nombre, len(d['recetas']), 'recetas')
