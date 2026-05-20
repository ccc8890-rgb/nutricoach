-- ============================================================
-- RE-VINCULACIÓN LIMPIA: productos_supermercado → seed_alimentos
-- Incluye receta_ingredientes para evitar FK violation
-- ============================================================
-- Falsos positivos ELIMINADOS:
--   - "Lomo de cerdo" → "Lomos de Conejo"
--   - "Rosquillas al cacao" → "Brazo de Cacao"
--   - "Pan integral" → "Harina integral"
--   - "Preparado en polvo cuajada..." → "Ajo en polvo"
--   - "Cachopo de vacuno..." → "Queso fresco"
-- ============================================================

begin;

-- Patata cocida → Patata Chef Gourmet
update public.receta_ingredientes set alimento_id = '75ac529c-7a96-4e71-ade2-348154559a2f' where alimento_id = '3dc4f298-9945-4ac9-a0e2-a37355f6b2c5';
update public.productos_supermercado set alimento_id = '75ac529c-7a96-4e71-ade2-348154559a2f' where alimento_id = '3dc4f298-9945-4ac9-a0e2-a37355f6b2c5';
update public.precios_historico set alimento_id = '75ac529c-7a96-4e71-ade2-348154559a2f' where alimento_id = '3dc4f298-9945-4ac9-a0e2-a37355f6b2c5';
delete from public.alimentos where id = '3dc4f298-9945-4ac9-a0e2-a37355f6b2c5';

-- Queso mozzarella → Mozzarella vaca
update public.receta_ingredientes set alimento_id = 'ed74958d-a612-4e7c-bb30-46cec5153687' where alimento_id = '906d6a97-a24c-4bef-8ada-cb4534fb8651';
update public.productos_supermercado set alimento_id = 'ed74958d-a612-4e7c-bb30-46cec5153687' where alimento_id = '906d6a97-a24c-4bef-8ada-cb4534fb8651';
update public.precios_historico set alimento_id = 'ed74958d-a612-4e7c-bb30-46cec5153687' where alimento_id = '906d6a97-a24c-4bef-8ada-cb4534fb8651';
delete from public.alimentos where id = '906d6a97-a24c-4bef-8ada-cb4534fb8651';

-- cafe espresso → Café Espresso Molido
update public.receta_ingredientes set alimento_id = '7605da1a-11d6-4d9e-9ec8-e2ef42836950' where alimento_id = '1f184a24-afb2-41b4-9a3d-46e0326194e3';
update public.productos_supermercado set alimento_id = '7605da1a-11d6-4d9e-9ec8-e2ef42836950' where alimento_id = '1f184a24-afb2-41b4-9a3d-46e0326194e3';
update public.precios_historico set alimento_id = '7605da1a-11d6-4d9e-9ec8-e2ef42836950' where alimento_id = '1f184a24-afb2-41b4-9a3d-46e0326194e3';
delete from public.alimentos where id = '1f184a24-afb2-41b4-9a3d-46e0326194e3';

-- Napolitana de crema 31% → Napolitana crema 31%
update public.receta_ingredientes set alimento_id = '7830cd2e-7d22-4c0c-9159-b6fe79ccbc7e' where alimento_id = 'f05c4b01-7daa-4961-ab10-e9daf85afd77';
update public.productos_supermercado set alimento_id = '7830cd2e-7d22-4c0c-9159-b6fe79ccbc7e' where alimento_id = 'f05c4b01-7daa-4961-ab10-e9daf85afd77';
update public.precios_historico set alimento_id = '7830cd2e-7d22-4c0c-9159-b6fe79ccbc7e' where alimento_id = 'f05c4b01-7daa-4961-ab10-e9daf85afd77';
delete from public.alimentos where id = 'f05c4b01-7daa-4961-ab10-e9daf85afd77';

-- Salmón ahumado → Lomito Salmón
update public.receta_ingredientes set alimento_id = '0bcd3d20-7b3d-40a1-ba4c-d0357f4e3942' where alimento_id = 'f9cbf575-3a74-40ab-b5db-a9d85148b917';
update public.productos_supermercado set alimento_id = '0bcd3d20-7b3d-40a1-ba4c-d0357f4e3942' where alimento_id = 'f9cbf575-3a74-40ab-b5db-a9d85148b917';
update public.precios_historico set alimento_id = '0bcd3d20-7b3d-40a1-ba4c-d0357f4e3942' where alimento_id = 'f9cbf575-3a74-40ab-b5db-a9d85148b917';
delete from public.alimentos where id = 'f9cbf575-3a74-40ab-b5db-a9d85148b917';

-- Pan de molde blanco → Pan de molde
update public.receta_ingredientes set alimento_id = '265ec681-c36c-446d-9db9-ff28565528a3' where alimento_id = 'bf3a3005-dc82-4074-9ad8-edfa78549b40';
update public.productos_supermercado set alimento_id = '265ec681-c36c-446d-9db9-ff28565528a3' where alimento_id = 'bf3a3005-dc82-4074-9ad8-edfa78549b40';
update public.precios_historico set alimento_id = '265ec681-c36c-446d-9db9-ff28565528a3' where alimento_id = 'bf3a3005-dc82-4074-9ad8-edfa78549b40';
delete from public.alimentos where id = 'bf3a3005-dc82-4074-9ad8-edfa78549b40';

-- Lenguado → Lenguado Limpio Congelado
update public.receta_ingredientes set alimento_id = '6ea99673-910d-472c-b81d-f223abcfae4e' where alimento_id = '4fe24603-9a19-4180-8b42-c6b01715b72a';
update public.productos_supermercado set alimento_id = '6ea99673-910d-472c-b81d-f223abcfae4e' where alimento_id = '4fe24603-9a19-4180-8b42-c6b01715b72a';
update public.precios_historico set alimento_id = '6ea99673-910d-472c-b81d-f223abcfae4e' where alimento_id = '4fe24603-9a19-4180-8b42-c6b01715b72a';
delete from public.alimentos where id = '4fe24603-9a19-4180-8b42-c6b01715b72a';

-- Pan de molde integral → Pan Molde Integral
update public.receta_ingredientes set alimento_id = '2abaef96-9342-4633-91d7-3f6ab74aa479' where alimento_id = 'a915657e-d572-484a-ae60-a9118a9c3fdf';
update public.productos_supermercado set alimento_id = '2abaef96-9342-4633-91d7-3f6ab74aa479' where alimento_id = 'a915657e-d572-484a-ae60-a9118a9c3fdf';
update public.precios_historico set alimento_id = '2abaef96-9342-4633-91d7-3f6ab74aa479' where alimento_id = 'a915657e-d572-484a-ae60-a9118a9c3fdf';
delete from public.alimentos where id = 'a915657e-d572-484a-ae60-a9118a9c3fdf';

-- Zanahoria → Zanahoria Baby
update public.receta_ingredientes set alimento_id = '75591dbf-1820-466d-b023-e60b2f05d899' where alimento_id = '4aa57a00-d5c0-4a59-b975-f1a23871d75d';
update public.productos_supermercado set alimento_id = '75591dbf-1820-466d-b023-e60b2f05d899' where alimento_id = '4aa57a00-d5c0-4a59-b975-f1a23871d75d';
update public.precios_historico set alimento_id = '75591dbf-1820-466d-b023-e60b2f05d899' where alimento_id = '4aa57a00-d5c0-4a59-b975-f1a23871d75d';
delete from public.alimentos where id = '4aa57a00-d5c0-4a59-b975-f1a23871d75d';

-- Hummus → Hummus Trío
update public.receta_ingredientes set alimento_id = 'cb31445a-63a8-439c-a6de-c02383867769' where alimento_id = 'c419ea25-c01c-414f-a2fd-83be8cbff44d';
update public.productos_supermercado set alimento_id = 'cb31445a-63a8-439c-a6de-c02383867769' where alimento_id = 'c419ea25-c01c-414f-a2fd-83be8cbff44d';
update public.precios_historico set alimento_id = 'cb31445a-63a8-439c-a6de-c02383867769' where alimento_id = 'c419ea25-c01c-414f-a2fd-83be8cbff44d';
delete from public.alimentos where id = 'c419ea25-c01c-414f-a2fd-83be8cbff44d';

-- Barra pa mediterrania → Barra Huerta
update public.receta_ingredientes set alimento_id = 'a809e3e6-6773-4fe0-9278-57938ae63eeb' where alimento_id = '12be1cd2-95a7-4685-8897-c2af4f5b8139';
update public.productos_supermercado set alimento_id = 'a809e3e6-6773-4fe0-9278-57938ae63eeb' where alimento_id = '12be1cd2-95a7-4685-8897-c2af4f5b8139';
update public.precios_historico set alimento_id = 'a809e3e6-6773-4fe0-9278-57938ae63eeb' where alimento_id = '12be1cd2-95a7-4685-8897-c2af4f5b8139';
delete from public.alimentos where id = '12be1cd2-95a7-4685-8897-c2af4f5b8139';

-- Tomate natural → Tomate en Rama
update public.receta_ingredientes set alimento_id = 'c1c6ab93-958a-4617-8c8a-2581923bb1b4' where alimento_id = '2a76a1e3-d073-43d3-8a79-fad47395fa02';
update public.productos_supermercado set alimento_id = 'c1c6ab93-958a-4617-8c8a-2581923bb1b4' where alimento_id = '2a76a1e3-d073-43d3-8a79-fad47395fa02';
update public.precios_historico set alimento_id = 'c1c6ab93-958a-4617-8c8a-2581923bb1b4' where alimento_id = '2a76a1e3-d073-43d3-8a79-fad47395fa02';
delete from public.alimentos where id = '2a76a1e3-d073-43d3-8a79-fad47395fa02';

-- Fideos orientales Yakisoba → Fideos
update public.receta_ingredientes set alimento_id = '794bf491-a73f-4eda-b3b6-f465f67a8a14' where alimento_id = '41c7810d-743a-4991-8fcd-bf53ee21ef96';
update public.productos_supermercado set alimento_id = '794bf491-a73f-4eda-b3b6-f465f67a8a14' where alimento_id = '41c7810d-743a-4991-8fcd-bf53ee21ef96';
update public.precios_historico set alimento_id = '794bf491-a73f-4eda-b3b6-f465f67a8a14' where alimento_id = '41c7810d-743a-4991-8fcd-bf53ee21ef96';
delete from public.alimentos where id = '41c7810d-743a-4991-8fcd-bf53ee21ef96';

-- Caramelo líquido → Caramelo Cereza
update public.receta_ingredientes set alimento_id = '40950098-5f1a-4afa-afbe-e3b8303616ee' where alimento_id = '624a33a1-2694-423b-ac4c-87b61aa5f944';
update public.productos_supermercado set alimento_id = '40950098-5f1a-4afa-afbe-e3b8303616ee' where alimento_id = '624a33a1-2694-423b-ac4c-87b61aa5f944';
update public.precios_historico set alimento_id = '40950098-5f1a-4afa-afbe-e3b8303616ee' where alimento_id = '624a33a1-2694-423b-ac4c-87b61aa5f944';
delete from public.alimentos where id = '624a33a1-2694-423b-ac4c-87b61aa5f944';

-- Bebida isotónica → Bebida isotonica sabor citrico Iso drink
update public.receta_ingredientes set alimento_id = '51b51a7c-9a19-43cc-aef6-f8c3f38ccce6' where alimento_id = '97772f63-4027-4680-b8d1-c363d42d3e99';
update public.productos_supermercado set alimento_id = '51b51a7c-9a19-43cc-aef6-f8c3f38ccce6' where alimento_id = '97772f63-4027-4680-b8d1-c363d42d3e99';
update public.precios_historico set alimento_id = '51b51a7c-9a19-43cc-aef6-f8c3f38ccce6' where alimento_id = '97772f63-4027-4680-b8d1-c363d42d3e99';
delete from public.alimentos where id = '97772f63-4027-4680-b8d1-c363d42d3e99';

-- Refresco fusión frutas Hacendado cero → Refresco fusion frutas Hacendado cero gas
update public.receta_ingredientes set alimento_id = 'e6e92c87-7590-4a16-b809-e35aef5f447c' where alimento_id = 'b10de687-74b2-4a4d-9b72-339f279d90bc';
update public.productos_supermercado set alimento_id = 'e6e92c87-7590-4a16-b809-e35aef5f447c' where alimento_id = 'b10de687-74b2-4a4d-9b72-339f279d90bc';
update public.precios_historico set alimento_id = 'e6e92c87-7590-4a16-b809-e35aef5f447c' where alimento_id = 'b10de687-74b2-4a4d-9b72-339f279d90bc';
delete from public.alimentos where id = 'b10de687-74b2-4a4d-9b72-339f279d90bc';

-- Gaseosa grande → Gaseosa pequeña
update public.receta_ingredientes set alimento_id = '30d391c8-dfe6-4514-83d1-1485b5393912' where alimento_id = '502399cc-2a62-44df-8219-a182007bc318';
update public.productos_supermercado set alimento_id = '30d391c8-dfe6-4514-83d1-1485b5393912' where alimento_id = '502399cc-2a62-44df-8219-a182007bc318';
update public.precios_historico set alimento_id = '30d391c8-dfe6-4514-83d1-1485b5393912' where alimento_id = '502399cc-2a62-44df-8219-a182007bc318';
delete from public.alimentos where id = '502399cc-2a62-44df-8219-a182007bc318';

-- Refresco Coca-Cola → Refresco cola
update public.receta_ingredientes set alimento_id = '7d982b58-5d5a-4649-a402-e0d11171f6b7' where alimento_id = 'b08d4168-9c29-4b86-a155-609767a42bf4';
update public.productos_supermercado set alimento_id = '7d982b58-5d5a-4649-a402-e0d11171f6b7' where alimento_id = 'b08d4168-9c29-4b86-a155-609767a42bf4';
update public.precios_historico set alimento_id = '7d982b58-5d5a-4649-a402-e0d11171f6b7' where alimento_id = 'b08d4168-9c29-4b86-a155-609767a42bf4';
delete from public.alimentos where id = 'b08d4168-9c29-4b86-a155-609767a42bf4';

-- Café monodosis → Café Doypack
update public.receta_ingredientes set alimento_id = 'c4b833b4-ec70-4463-91f1-2903f4493da4' where alimento_id = 'de983ea9-b185-442f-8b9f-a7bbea64a577';
update public.productos_supermercado set alimento_id = 'c4b833b4-ec70-4463-91f1-2903f4493da4' where alimento_id = 'de983ea9-b185-442f-8b9f-a7bbea64a577';
update public.precios_historico set alimento_id = 'c4b833b4-ec70-4463-91f1-2903f4493da4' where alimento_id = 'de983ea9-b185-442f-8b9f-a7bbea64a577';
delete from public.alimentos where id = 'de983ea9-b185-442f-8b9f-a7bbea64a577';

-- Café molido descafeinado → Café Doypack
update public.receta_ingredientes set alimento_id = 'c4b833b4-ec70-4463-91f1-2903f4493da4' where alimento_id = '72d0c349-03fc-4e95-946a-223051c17700';
update public.productos_supermercado set alimento_id = 'c4b833b4-ec70-4463-91f1-2903f4493da4' where alimento_id = '72d0c349-03fc-4e95-946a-223051c17700';
update public.precios_historico set alimento_id = 'c4b833b4-ec70-4463-91f1-2903f4493da4' where alimento_id = '72d0c349-03fc-4e95-946a-223051c17700';
delete from public.alimentos where id = '72d0c349-03fc-4e95-946a-223051c17700';

-- Infusión Manzanilla → Infusión Relax
update public.receta_ingredientes set alimento_id = 'caf483a7-87a8-4a4a-86e3-de183d12756b' where alimento_id = '7c4dde19-7685-4532-960b-bc563dae1df3';
update public.productos_supermercado set alimento_id = 'caf483a7-87a8-4a4a-86e3-de183d12756b' where alimento_id = '7c4dde19-7685-4532-960b-bc563dae1df3';
update public.precios_historico set alimento_id = 'caf483a7-87a8-4a4a-86e3-de183d12756b' where alimento_id = '7c4dde19-7685-4532-960b-bc563dae1df3';
delete from public.alimentos where id = '7c4dde19-7685-4532-960b-bc563dae1df3';

-- Rosquilletas tradicionales → Rosquilletas Saladas
update public.receta_ingredientes set alimento_id = '5dd16fc8-33c5-4e3d-96b0-64dc0c203423' where alimento_id = '1f17996d-0412-46ef-aabd-f44d5842d3dd';
update public.productos_supermercado set alimento_id = '5dd16fc8-33c5-4e3d-96b0-64dc0c203423' where alimento_id = '1f17996d-0412-46ef-aabd-f44d5842d3dd';
update public.precios_historico set alimento_id = '5dd16fc8-33c5-4e3d-96b0-64dc0c203423' where alimento_id = '1f17996d-0412-46ef-aabd-f44d5842d3dd';
delete from public.alimentos where id = '1f17996d-0412-46ef-aabd-f44d5842d3dd';

-- Pan campeón del mundo → Pan campeon mundo
update public.receta_ingredientes set alimento_id = '225e9403-5177-47d6-974d-ff3069544424' where alimento_id = '8da2ae5d-1984-4f9f-8d7d-c67b8ee2bf88';
update public.productos_supermercado set alimento_id = '225e9403-5177-47d6-974d-ff3069544424' where alimento_id = '8da2ae5d-1984-4f9f-8d7d-c67b8ee2bf88';
update public.precios_historico set alimento_id = '225e9403-5177-47d6-974d-ff3069544424' where alimento_id = '8da2ae5d-1984-4f9f-8d7d-c67b8ee2bf88';
delete from public.alimentos where id = '8da2ae5d-1984-4f9f-8d7d-c67b8ee2bf88';

-- Helado Dochi Cheesecake Hacendado → Mochi Cheesecake
update public.receta_ingredientes set alimento_id = 'f1a22b91-debf-4890-8510-67ee9b634ceb' where alimento_id = '36079c20-c70f-4294-b551-a1d08e469990';
update public.productos_supermercado set alimento_id = 'f1a22b91-debf-4890-8510-67ee9b634ceb' where alimento_id = '36079c20-c70f-4294-b551-a1d08e469990';
update public.precios_historico set alimento_id = 'f1a22b91-debf-4890-8510-67ee9b634ceb' where alimento_id = '36079c20-c70f-4294-b551-a1d08e469990';
delete from public.alimentos where id = '36079c20-c70f-4294-b551-a1d08e469990';

-- Berlina cobertura cacao crunch → Berlina cobertura cacao crunch rellena crema cacao
update public.receta_ingredientes set alimento_id = '5d59a728-a710-4da3-abfb-f15b53024f5a' where alimento_id = '39acfbfa-4e39-455b-8f14-34e6eed0634d';
update public.productos_supermercado set alimento_id = '5d59a728-a710-4da3-abfb-f15b53024f5a' where alimento_id = '39acfbfa-4e39-455b-8f14-34e6eed0634d';
update public.precios_historico set alimento_id = '5d59a728-a710-4da3-abfb-f15b53024f5a' where alimento_id = '39acfbfa-4e39-455b-8f14-34e6eed0634d';
delete from public.alimentos where id = '39acfbfa-4e39-455b-8f14-34e6eed0634d';

-- Tomate tamizado sin piel → Tomate en Rama
update public.receta_ingredientes set alimento_id = 'c1c6ab93-958a-4617-8c8a-2581923bb1b4' where alimento_id = '42cc2b09-5ce9-4f8a-9811-83ded910bdda';
update public.productos_supermercado set alimento_id = 'c1c6ab93-958a-4617-8c8a-2581923bb1b4' where alimento_id = '42cc2b09-5ce9-4f8a-9811-83ded910bdda';
update public.precios_historico set alimento_id = 'c1c6ab93-958a-4617-8c8a-2581923bb1b4' where alimento_id = '42cc2b09-5ce9-4f8a-9811-83ded910bdda';
delete from public.alimentos where id = '42cc2b09-5ce9-4f8a-9811-83ded910bdda';

-- Ajo negro dientes pelados → Ajo Picado
update public.receta_ingredientes set alimento_id = '248b631b-30cc-419c-93da-c3c61a56ebfc' where alimento_id = '79c2f973-c7c7-42af-a9c1-6d564ac5d0ac';
update public.productos_supermercado set alimento_id = '248b631b-30cc-419c-93da-c3c61a56ebfc' where alimento_id = '79c2f973-c7c7-42af-a9c1-6d564ac5d0ac';
update public.precios_historico set alimento_id = '248b631b-30cc-419c-93da-c3c61a56ebfc' where alimento_id = '79c2f973-c7c7-42af-a9c1-6d564ac5d0ac';
delete from public.alimentos where id = '79c2f973-c7c7-42af-a9c1-6d564ac5d0ac';

commit;
