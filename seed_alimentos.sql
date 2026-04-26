-- ============================================================
-- SEED: Alimentos base (ejecutar DESPUÉS del schema)
-- ============================================================
-- Nota: Los valores son por 100g de alimento
-- ============================================================

insert into public.alimentos (nombre, categoria, calorias, proteinas, carbohidratos, grasas, fibra, custom) values
-- CARNES
('Pechuga de pollo (cruda)', 'Carnes', 110, 23.2, 0, 1.9, 0, false),
('Pechuga de pollo (cocinada)', 'Carnes', 165, 31, 0, 3.6, 0, false),
('Muslo de pollo sin piel', 'Carnes', 177, 24.8, 0, 8.2, 0, false),
('Pavo pechuga (cruda)', 'Carnes', 104, 22, 0, 1.7, 0, false),
('Ternera magra (solomillo)', 'Carnes', 143, 21.4, 0, 6.1, 0, false),
('Ternera picada (5% grasa)', 'Carnes', 137, 21.4, 0, 5.5, 0, false),
('Lomo de cerdo', 'Carnes', 182, 20.9, 0, 10.7, 0, false),
('Jamón serrano', 'Carnes', 241, 30.5, 0.3, 13, 0, false),
('Fiambre de pavo', 'Carnes', 96, 18.4, 1.2, 1.7, 0, false),
-- PESCADOS
('Salmón (fresco)', 'Pescados', 208, 20.4, 0, 13.4, 0, false),
('Atún (fresco)', 'Pescados', 144, 23.3, 0, 5.1, 0, false),
('Atún en lata al natural', 'Pescados', 103, 23.5, 0, 0.7, 0, false),
('Merluza', 'Pescados', 74, 17.4, 0, 0.6, 0, false),
('Bacalao (fresco)', 'Pescados', 82, 18, 0, 0.7, 0, false),
('Dorada', 'Pescados', 96, 19.4, 0.6, 1.8, 0, false),
('Gambas', 'Pescados', 85, 18.9, 0.2, 0.6, 0, false),
('Sardina (fresca)', 'Pescados', 208, 19.8, 0, 13.9, 0, false),
-- HUEVOS
('Huevo entero (L)', 'Huevos', 155, 13, 1.1, 10.6, 0, false),
('Clara de huevo', 'Huevos', 52, 10.9, 0.7, 0.2, 0, false),
('Yema de huevo', 'Huevos', 339, 15.9, 3.6, 26.5, 0, false),
-- LÁCTEOS
('Queso cottage', 'Lácteos', 98, 11.1, 3.4, 4.3, 0, false),
('Queso fresco batido 0%', 'Lácteos', 49, 8, 3.5, 0.2, 0, false),
('Queso mozzarella', 'Lácteos', 280, 22.2, 2.2, 20.3, 0, false),
('Queso parmesano', 'Lácteos', 431, 38.5, 3.2, 28.8, 0, false),
('Yogur griego natural (0%)', 'Lácteos', 57, 9.9, 4, 0.2, 0, false),
('Yogur griego natural (entero)', 'Lácteos', 115, 7, 4, 8, 0, false),
('Yogur natural desnatado', 'Lácteos', 36, 3.5, 5, 0.2, 0, false),
('Leche entera', 'Lácteos', 61, 3.2, 4.8, 3.5, 0, false),
('Leche desnatada', 'Lácteos', 33, 3.4, 4.9, 0.1, 0, false),
('Proteína whey (polvo)', 'Suplementos', 375, 75, 7, 4, 0, false),
-- CEREALES
('Arroz blanco (crudo)', 'Cereales', 362, 6.7, 79.3, 0.7, 0.4, false),
('Arroz integral (crudo)', 'Cereales', 350, 7.5, 73, 2.7, 3.5, false),
('Arroz blanco (cocinado)', 'Cereales', 130, 2.4, 28.6, 0.2, 0.2, false),
('Pasta (seca)', 'Cereales', 358, 12.5, 70.5, 1.8, 2.5, false),
('Pasta integral (seca)', 'Cereales', 348, 12, 68, 2.5, 6.3, false),
('Pasta (cocinada)', 'Cereales', 131, 5, 25, 1.1, 1.8, false),
('Avena (copos)', 'Cereales', 389, 17, 66, 7, 10.6, false),
('Pan integral', 'Cereales', 247, 10, 44, 3.3, 7, false),
('Pan blanco', 'Cereales', 265, 9, 49, 3.2, 2.7, false),
('Quinoa (cocida)', 'Cereales', 120, 4.4, 21.3, 1.9, 2.8, false),
-- TUBÉRCULOS
('Patata (cruda)', 'Tubérculos', 77, 2, 17, 0.1, 2.2, false),
('Patata cocida', 'Tubérculos', 87, 1.9, 20, 0.1, 1.8, false),
('Boniato (crudo)', 'Tubérculos', 86, 1.6, 20.1, 0.1, 3, false),
-- LEGUMBRES
('Garbanzos (cocidos)', 'Legumbres', 164, 8.9, 27.4, 2.6, 7.6, false),
('Lentejas (cocidas)', 'Legumbres', 116, 9, 20.1, 0.4, 7.9, false),
('Judías blancas (cocidas)', 'Legumbres', 139, 9.7, 25, 0.5, 6.3, false),
('Edamame (cocido)', 'Legumbres', 121, 11.9, 8.9, 5.2, 5.2, false),
('Tofu firme', 'Legumbres', 83, 8.2, 1.9, 4.8, 0.3, false),
-- VERDURAS
('Espinacas (crudas)', 'Verduras', 23, 2.9, 3.6, 0.4, 2.2, false),
('Brócoli (crudo)', 'Verduras', 34, 2.8, 7, 0.4, 2.6, false),
('Coliflor (cruda)', 'Verduras', 25, 1.9, 5, 0.3, 2, false),
('Lechuga romana', 'Verduras', 17, 1.2, 3.3, 0.3, 2.1, false),
('Tomate', 'Verduras', 18, 0.9, 3.9, 0.2, 1.2, false),
('Pepino', 'Verduras', 15, 0.7, 3.6, 0.1, 0.5, false),
('Pimiento rojo', 'Verduras', 31, 1, 6, 0.3, 2.1, false),
('Cebolla', 'Verduras', 40, 1.1, 9.3, 0.1, 1.7, false),
('Zanahoria (cruda)', 'Verduras', 41, 0.9, 9.6, 0.2, 2.8, false),
('Calabacín (crudo)', 'Verduras', 17, 1.2, 3.1, 0.3, 1, false),
('Champiñones', 'Verduras', 22, 3.1, 3.3, 0.3, 1, false),
('Espárragos', 'Verduras', 20, 2.2, 3.9, 0.1, 2.1, false),
('Kale (col rizada)', 'Verduras', 49, 4.3, 9, 0.9, 3.6, false),
('Rúcula', 'Verduras', 25, 2.6, 3.7, 0.7, 1.6, false),
-- FRUTAS
('Plátano', 'Frutas', 89, 1.1, 22.8, 0.3, 2.6, false),
('Manzana', 'Frutas', 52, 0.3, 13.8, 0.2, 2.4, false),
('Naranja', 'Frutas', 47, 0.9, 11.8, 0.1, 2.4, false),
('Fresas', 'Frutas', 32, 0.7, 7.7, 0.3, 2, false),
('Arándanos', 'Frutas', 57, 0.7, 14.5, 0.3, 2.4, false),
('Kiwi', 'Frutas', 61, 1.1, 14.7, 0.5, 3, false),
('Mango', 'Frutas', 60, 0.8, 15, 0.4, 1.6, false),
('Sandía', 'Frutas', 30, 0.6, 7.6, 0.2, 0.4, false),
('Pera', 'Frutas', 57, 0.4, 15.2, 0.1, 3.1, false),
('Piña', 'Frutas', 50, 0.5, 13.1, 0.1, 1.4, false),
-- GRASAS
('Aguacate', 'Grasas', 160, 2, 8.5, 14.7, 6.7, false),
('Aceite de oliva virgen extra', 'Grasas', 884, 0, 0, 100, 0, false),
('Almendras', 'Frutos secos', 576, 21.2, 21.7, 49.4, 12.5, false),
('Nueces', 'Frutos secos', 654, 15.2, 13.7, 65.2, 6.7, false),
('Mantequilla de cacahuete', 'Grasas', 588, 25.1, 20, 50, 6, false),
('Semillas de chía', 'Semillas', 486, 16.5, 42.1, 30.7, 34.4, false),
-- BEBIDAS
('Leche de avena', 'Bebidas', 46, 1, 6.6, 1.5, 0.8, false),
('Leche de almendras (sin azúcar)', 'Bebidas', 17, 0.6, 0.3, 1.4, 0.4, false),
('Leche de soja', 'Bebidas', 54, 3.6, 6.3, 1.8, 0.4, false),
-- OTROS
('Miel', 'Condimentos', 304, 0.3, 82.4, 0, 0.2, false),
('Cacao puro en polvo', 'Otros', 228, 19.6, 57.9, 13.7, 33, false),
('Chocolate negro 85%', 'Otros', 598, 12.9, 45.9, 42.6, 10.9, false);
