-- ============================================================
-- SEED: Alimentos base faltantes (ejecutar DESPUÉS de limpieza)
-- ============================================================
-- Estos son alimentos genéricos comunes que faltaban en la BD
-- y causaban que el matching eligiera productos procesados incorrectos
-- ============================================================

INSERT INTO public.alimentos (nombre, categoria, calorias, proteinas, carbohidratos, grasas, fibra, custom) VALUES

-- CONDIMENTOS / SALSAS
('Vinagre', 'Condimentos', 18, 0, 0.9, 0, 0, false),
('Vinagre de manzana', 'Condimentos', 22, 0, 0.9, 0, 0, false),
('Salsa de soja', 'Condimentos', 53, 8, 4.7, 0.4, 0, false),
('Mostaza', 'Condimentos', 67, 3.7, 4.8, 3.3, 1.5, false),
('Kétchup', 'Condimentos', 101, 1.1, 23.4, 0.1, 0.4, false),
('Mayonesa', 'Condimentos', 724, 1.1, 1.3, 79, 0, false),

-- VERDURAS
('Cebolla morada', 'Verduras', 40, 1.1, 9.3, 0.1, 1.7, false),
('Hinojo', 'Verduras', 31, 1.2, 7.3, 0.2, 3.1, false),
('Pimiento verde', 'Verduras', 20, 0.9, 4.6, 0.2, 1.7, false),
('Calabaza', 'Verduras', 26, 1, 6.5, 0.1, 0.5, false),
('Berenjena', 'Verduras', 25, 1, 5.9, 0.2, 3, false),
('Judías verdes', 'Verduras', 31, 1.8, 7, 0.1, 3.2, false),
('Remolacha', 'Verduras', 43, 1.6, 9.6, 0.2, 2.8, false),
('Apio', 'Verduras', 16, 0.7, 3, 0.2, 1.6, false),
('Rábano', 'Verduras', 16, 0.7, 3.4, 0.1, 1.6, false),
('Alcachofa', 'Verduras', 53, 3.3, 11, 0.2, 5.4, false),
('Canónigos', 'Verduras', 23, 2, 3.6, 0.4, 1.6, false),
('Endibias', 'Verduras', 15, 1, 1.6, 0.1, 1.5, false),
('Col lombarda', 'Verduras', 27, 1.4, 5.8, 0.2, 2, false),
('Coles de Bruselas', 'Verduras', 43, 3.4, 9, 0.3, 3.8, false),
('Nabos', 'Verduras', 28, 0.9, 6.4, 0.1, 1.8, false),

-- CEREALES
('Pan de molde integral', 'Cereales', 247, 10, 44, 3.3, 7, false),
('Pan de molde blanco', 'Cereales', 265, 9, 49, 3.2, 2.7, false),
('Pan rallado', 'Cereales', 395, 13, 75, 5.3, 4, false),
('Cebada', 'Cereales', 354, 12.5, 73.5, 2.3, 17.3, false),
('Centeno', 'Cereales', 338, 10.3, 75.9, 1.6, 15.1, false),
('Arroz salvaje', 'Cereales', 357, 14.7, 73, 1.1, 6.2, false),

-- FRUTAS
('Uvas', 'Frutas', 69, 0.7, 18.1, 0.2, 0.9, false),
('Melón', 'Frutas', 34, 0.8, 8.2, 0.2, 0.9, false),
('Cerezas', 'Frutas', 50, 1, 12.2, 0.3, 1.6, false),
('Higos', 'Frutas', 74, 0.8, 19.2, 0.3, 2.9, false),
('Ciruelas', 'Frutas', 46, 0.7, 11.4, 0.3, 1.4, false),
('Albaricoque', 'Frutas', 48, 1.4, 11.1, 0.4, 2, false),
('Melocotón', 'Frutas', 39, 0.9, 9.5, 0.3, 1.5, false),
('Limón', 'Frutas', 29, 1.1, 9.3, 0.3, 2.8, false),
('Pomelo', 'Frutas', 42, 0.8, 10.7, 0.1, 1.6, false),
('Papaya', 'Frutas', 43, 0.5, 11, 0.3, 1.7, false),
('Granada', 'Frutas', 83, 1.7, 18.7, 1.2, 4, false),
('Coco rallado', 'Frutas', 660, 6.9, 23.7, 64.5, 16.3, false),

-- LÁCTEOS
('Yogur natural', 'Lácteos', 61, 3.5, 4.7, 3.3, 0, false),
('Yogur natural desnatado', 'Lácteos', 36, 3.5, 5, 0.2, 0, false),
('Leche de coco (lata)', 'Lácteos', 230, 2.3, 5.5, 23.8, 0, false),
('Nata líquida', 'Lácteos', 196, 2.8, 3, 19, 0, false),
('Nata para montar (35% MG)', 'Lácteos', 337, 2.5, 3, 35, 0, false),
('Mantequilla', 'Lácteos', 717, 0.9, 0.1, 81, 0, false),
('Requesón', 'Lácteos', 80, 9, 4, 3, 0, false),

-- CARNES
('Pollo entero (crudo)', 'Carnes', 215, 18.6, 0, 15.1, 0, false),
('Alas de pollo (crudas)', 'Carnes', 203, 17.5, 0, 14.2, 0, false),
('Costillas de cerdo', 'Carnes', 277, 17, 0, 23, 0, false),
('Solomillo de cerdo', 'Carnes', 155, 23, 0, 6.5, 0, false),
('Cordero (pierna)', 'Carnes', 205, 18, 0, 14.5, 0, false),
('Conejo', 'Carnes', 136, 20, 0, 5.6, 0, false),

-- PESCADOS
('Salmón ahumado', 'Pescados', 199, 18.5, 0, 14, 0, false),
('Caballa (fresca)', 'Pescados', 205, 18.7, 0, 13.9, 0, false),
('Boquerones (frescos)', 'Pescados', 131, 18.2, 0, 6.1, 0, false),
('Pulpo (cocido)', 'Pescados', 82, 14.9, 2.2, 1.8, 0, false),
('Calamares', 'Pescados', 78, 15.6, 1.5, 1.2, 0, false),
('Mejillones (cocidos)', 'Pescados', 86, 11.9, 3.7, 2.2, 0, false),
('Almejas', 'Pescados', 73, 12.8, 2.8, 1, 0, false),

-- GRASAS / FRUTOS SECOS
('Aceite de coco', 'Grasas', 862, 0, 0, 100, 0, false),
('Aceite de girasol', 'Grasas', 884, 0, 0, 100, 0, false),
('Anacardos', 'Frutos secos', 553, 18.2, 30.2, 43.9, 3.3, false),
('Pistachos', 'Frutos secos', 560, 20.2, 27.2, 45.3, 10.6, false),
('Avellanas', 'Frutos secos', 628, 15, 17, 61, 9.7, false),
('Piñones', 'Frutos secos', 673, 13.7, 13.1, 68.4, 3.7, false),
('Semillas de sésamo', 'Semillas', 573, 17.7, 23.5, 49.7, 11.8, false),
('Semillas de lino', 'Semillas', 534, 18.3, 28.9, 42.2, 27.3, false),
('Semillas de calabaza', 'Semillas', 559, 30.2, 10.7, 49.1, 6, false),

-- GALLETAS / SNACKS (genéricos, no de marca)
('Galletas tipo María', 'Cereales', 420, 7.5, 75, 12, 2.5, false),
('Galletas tipo Digestive', 'Cereales', 460, 7, 68, 20, 4, false),
('Galletas tipo Cookie', 'Cereales', 470, 6, 65, 22, 2, false);

-- ============================================================
-- FIN
-- ============================================================
