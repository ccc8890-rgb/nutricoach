-- ============================================================
-- RESTORE: Alimentos perdidos tras DELETE de duplicados
-- DELETE eliminó alimentos únicos que solo existían en el
-- segundo seed (26-04-2026). Aquí se restauran.
-- ============================================================
-- USO: node scripts/run-sql.mjs (o pegar en SQL Editor de Supabase)

insert into public.alimentos (nombre, categoria, calorias, proteinas, carbohidratos, grasas, fibra, custom) values

-- ACEITES (faltan)
('Aceite de oliva virgen extra', 'Grasas', 884, 0, 0, 100, 0, false),
('Aceite de coco', 'Grasas', 892, 0, 0, 99.1, 0, false),
('Mantequilla', 'Grasas', 717, 0.9, 0.1, 81.1, 0, false),
('Ghee (mantequilla clarificada)', 'Grasas', 900, 0.3, 0, 99.8, 0, false),
('Mayonesa light', 'Grasas', 292, 1.1, 10.9, 28, 0, false),
('Crema de cacahuete (natural)', 'Aceites y Grasas', 598, 25, 20, 50, 6, false),
('Pasta de almendras (sin azúcar)', 'Grasas', 614, 21.2, 18.7, 56, 10.6, false),

-- SALSAS Y CONDIMENTOS (faltan)
('Vinagre de manzana', 'Condimentos', 22, 0, 0.9, 0, 0, false),
('Kétchup', 'Condimentos', 101, 1.7, 24.6, 0.1, 0.3, false),
('Salsa tabasco', 'Condimentos', 12, 0.4, 1, 0.2, 0, false),

-- ESPECIAS Y HIERBAS (básicas para cocina)
('Sal', 'Condimentos', 0, 0, 0, 0, 0, false),
('Pimienta negra', 'Condimentos', 251, 10.4, 64, 3.3, 26.5, false),
('Ajo crudo', 'Verduras', 149, 6.4, 33, 0.5, 2.1, false),
('Perejil', 'Condimentos', 36, 3, 6.3, 0.8, 3.3, false),
('Romero', 'Condimentos', 131, 3.3, 20.7, 5.9, 14.1, false),
('Tomillo', 'Condimentos', 101, 5.6, 24.5, 1.7, 14, false),
('Laurel', 'Condimentos', 313, 7.4, 48.7, 8.4, 26.3, false),
('Orégano', 'Condimentos', 265, 9, 68.9, 4.3, 42.5, false),
('Cilantro', 'Condimentos', 23, 2.1, 3.7, 0.5, 2.8, false),
('Comino', 'Condimentos', 375, 17.8, 44.2, 22.3, 10.5, false),
('Canela', 'Condimentos', 247, 4, 80.6, 1.2, 53.1, false),
('Pimentón', 'Condimentos', 282, 14.1, 54, 12.9, 37.4, false),
('Pimentón dulce', 'Condimentos', 282, 14.1, 54, 12.9, 37.4, false),
('Comino molido', 'Condimentos', 375, 17.8, 44.2, 22.3, 10.5, false),
('Canela molida', 'Condimentos', 247, 4, 80.6, 1.2, 53.1, false),
('Nuez moscada molida', 'Condimentos', 525, 5.8, 49.3, 36.3, 20.8, false),
('Jengibre fresco', 'Verduras', 80, 1.8, 17.8, 0.7, 2, false),

-- LÁCTEOS (faltan)
('Queso manchego curado', 'Lácteos', 392, 27, 0.5, 32, 0, false),
('Queso manchego semicurado', 'Lácteos', 355, 26, 0.5, 28, 0, false),
('Queso burgos', 'Lácteos', 118, 14, 2.5, 5.5, 0, false),
('Requesón', 'Lácteos', 89, 11.1, 3.6, 3.4, 0, false),
('Kéfir natural', 'Lácteos', 61, 3.3, 4.8, 3.2, 0, false),
('Queso crema light', 'Lácteos', 162, 7.1, 5.3, 12.5, 0, false),
('Skyr natural', 'Lácteos', 63, 11, 4, 0.2, 0, false),
('Nata para cocinar (18%)', 'Lácteos', 188, 2.7, 3.7, 18, 0, false),

-- CEREALES/PAN (faltan)
('Pan de centeno', 'Cereales', 259, 8.5, 48, 3.3, 6.5, false),
('Pan de molde integral', 'Cereales', 237, 9, 39, 5.5, 6.8, false),
('Pan de molde blanco', 'Cereales', 265, 8.5, 48, 4, 2.5, false),
('Tortita de arroz', 'Cereales', 381, 7.5, 80.7, 3.6, 1.3, false),
('Muesli sin azúcar', 'Cereales', 370, 10, 61, 7, 7.5, false),
('Granola', 'Cereales', 430, 8.5, 65, 15, 5, false),
('Arroz basmati (crudo)', 'Cereales', 349, 7.9, 77.5, 0.9, 1.3, false),
('Cuscús (cocido)', 'Cereales', 112, 3.8, 23.2, 0.2, 1.4, false),
('Pan de pita', 'Cereales', 275, 9.1, 55.5, 1.7, 1.6, false),

-- TUBÉRCULOS (faltan)
('Boniato cocido', 'Tubérculos', 90, 2, 20.7, 0.1, 3.3, false),
('Patata frita al horno (sin aceite)', 'Tubérculos', 148, 3.4, 31.5, 1.4, 3.5, false),

-- LEGUMBRES (faltan)
('Soja texturizada (seca)', 'Legumbres', 345, 52, 22, 3.4, 13, false),
('Tempeh', 'Legumbres', 193, 18.5, 9.4, 10.8, 4.1, false),

-- VERDURAS (faltan)
('Acelgas cocidas', 'Verduras', 20, 1.8, 3.6, 0.1, 2.1, false),
('Alcachofas cocidas', 'Verduras', 53, 2.9, 10.5, 0.2, 5.7, false),
('Berenjena cruda', 'Verduras', 25, 1, 5.8, 0.2, 3, false),
('Pimiento amarillo', 'Verduras', 27, 1, 6.3, 0.2, 0.9, false),
('Apio crudo', 'Verduras', 16, 0.7, 2.9, 0.2, 1.6, false),
('Puerro crudo', 'Verduras', 61, 1.5, 14.2, 0.3, 1.8, false),
('Tomate cherry', 'Verduras', 18, 0.9, 3.9, 0.2, 1.2, false),
('Calabacín (crudo)', 'Verduras', 17, 1.2, 3.1, 0.3, 1, false),

-- FRUTAS (faltan)
('Frambuesas', 'Frutas', 52, 1.2, 11.9, 0.7, 6.5, false),
('Melocotón', 'Frutas', 39, 0.9, 9.5, 0.3, 1.5, false),
('Ciruelas', 'Frutas', 46, 0.7, 11.4, 0.3, 1.4, false),
('Papaya', 'Frutas', 43, 0.5, 10.8, 0.3, 1.7, false),
('Pomelo', 'Frutas', 42, 0.8, 10.7, 0.1, 1.6, false),
('Mandarina', 'Frutas', 53, 0.9, 13.3, 0.3, 1.8, false),
('Higos frescos', 'Frutas', 74, 0.7, 19.2, 0.3, 2.9, false),

-- FRUTOS SECOS (faltan)
('Pistachos (sin sal)', 'Frutos secos', 562, 20.2, 27.2, 45.3, 10.3, false),
('Avellanas', 'Frutos secos', 628, 15, 17, 60.8, 9.7, false),
('Anacardos (sin sal)', 'Frutos secos', 553, 18.2, 30.2, 43.9, 3.3, false),
('Cacahuetes (sin sal)', 'Frutos secos', 567, 25.8, 16.1, 49.2, 8.5, false),

-- SEMILLAS (faltan)
('Semillas de girasol', 'Semillas', 584, 20.8, 20, 51.5, 8.6, false),
('Semillas de lino', 'Semillas', 534, 18.3, 28.9, 42.2, 27.3, false),
('Semillas de calabaza', 'Semillas', 559, 30.2, 10.7, 49.1, 6, false),

-- SUPLEMENTOS (faltan)
('Caseína micelar (polvo)', 'Suplementos', 370, 79, 5, 2, 0, false),
('Creatina monohidrato', 'Suplementos', 0, 0, 0, 0, 0, false),
('Avena con proteína (polvo)', 'Suplementos', 380, 25, 55, 5, 8, false),
('Barrita proteica (media)', 'Suplementos', 200, 20, 20, 5, 3, false),

-- BEBIDAS (faltan)
('Agua con gas', 'Bebidas', 0, 0, 0, 0, 0, false),
('Zumo de naranja natural', 'Bebidas', 45, 0.7, 10.4, 0.2, 0.2, false),
('Leche de coco (para cocinar)', 'Bebidas', 197, 2.3, 5.5, 19.2, 0.2, false),
('Bebida de arroz', 'Bebidas', 47, 0.3, 9.2, 1, 0.1, false),

-- OTROS (faltan)
('Guacamole', 'Otros', 150, 1.5, 8, 13.2, 5.5, false),
('Caldo vegetal (brick)', 'Otros', 8, 0.3, 1.2, 0.1, 0, false),
('Salsa pesto', 'Otros', 490, 6, 5, 50, 1.5, false),

-- CARNES (faltan)
('Pollo entero con piel', 'Carnes', 215, 18.6, 0, 15.5, 0, false),
('Contramuslo de pollo sin piel', 'Carnes', 155, 22, 0, 7.2, 0, false),
('Carne de ternera (chuleta)', 'Carnes', 172, 20, 0, 10.4, 0, false),
('Costillas de cerdo', 'Carnes', 292, 17, 0, 25, 0, false),
('Lomo embuchado', 'Carnes', 230, 34, 1, 10, 0, false),
('Chorizo fresco', 'Carnes', 386, 17, 2, 34, 0, false),
('Salchicha de pavo', 'Carnes', 148, 13, 3, 9, 0, false),
('Buey picado', 'Carnes', 250, 17, 0, 20, 0, false),
('Conejo', 'Carnes', 136, 20.1, 0, 6.2, 0, false),
('Pato (pechuga sin piel)', 'Carnes', 140, 23.5, 0, 4.8, 0, false),

-- PESCADOS (faltan)
('Lubina', 'Pescados', 97, 18.4, 0, 2.5, 0, false),
('Rape', 'Pescados', 76, 17, 0, 0.9, 0, false),
('Boquerones frescos', 'Pescados', 96, 17.2, 0, 2.7, 0, false),
('Caballa fresca', 'Pescados', 205, 18.7, 0, 13.9, 0, false),
('Lenguado', 'Pescados', 83, 17, 0, 1.5, 0, false),
('Pulpo cocido', 'Pescados', 82, 14.9, 2.2, 1, 0, false),
('Sepia', 'Pescados', 79, 16.1, 0.9, 1.1, 0, false),
('Mejillones al vapor', 'Pescados', 86, 11.9, 3.7, 2.2, 0, false),
('Almejas', 'Pescados', 74, 12.8, 2.7, 1, 0, false),
('Berberecho (en lata)', 'Pescados', 76, 14, 3.6, 0.7, 0, false),
('Salmón ahumado', 'Pescados', 179, 23.4, 0, 9.5, 0, false),
('Bacalao desalado', 'Pescados', 97, 22.7, 0, 0.6, 0, false);
