-- ============================================================
-- Compara la LISTA DE PRECIOS CDP (vigencia 01/07/2026) contra los
-- "Precios para costos" de Tango (STA12) en MAESTRO y MAESTRO_TASTY.
-- Solo lectura. Correr en SSMS y usar el resultado para corregir el panel.
--
-- PRECIO_LISTA ya está normalizado a la unidad de Tango (los que vienen
-- por caja/paquete están divididos: mayonesa/196, sal/1000, servilletas/800).
-- ESTADO:
--   ACTUALIZAR   -> difiere más de 1% de lo cargado
--   OK           -> coincide (±1%)
--   SIN COSTO    -> el artículo existe pero no tiene reposición cargada
--   NO EXISTE    -> el código asignado no existe en ese maestro
--   VER UNIDAD   -> la lista viene por bulto y Tango por otra unidad (revisar a mano)
-- ============================================================
USE CENTRAL_ESTADISTICA;

WITH Lista (COD, PRODUCTO, PRECIO_LISTA, NOTA) AS (
  SELECT * FROM (VALUES
    ('060001', 'PAN DE PAPA UNIVERSAL (⚠ en maestro Pan de papa es 060007)', 375.00, NULL),
    ('060007', 'PAN DE PAPA UNIVERSAL (código real del maestro)', 375.00, NULL),
    ('060003', 'PAN MR TASTY PANCHO', 337.00, NULL),
    ('060004', 'PAN CIABATTA', 650.00, NULL),
    ('040016', 'PAPAS MCCAIN SC 9MM (por KG)', 5653.18, NULL),
    ('040010', 'PAPAS MCCAIN CRINKLES (por KG)', 4999.33, NULL),
    ('080008', 'CHEDDAR BARRA 140 FETAS', 19520.00, 'VER UNIDAD: lista por barra; Tango parece por KG (~1,72kg/barra)'),
    ('080009', 'CHEDDAR MANGA (por KG)', 6576.67, NULL),
    ('010022', 'KETCHUP HELLMANS (por KG)', 3760.00, NULL),
    ('010021', 'MAYONESA HELLMANS (por KG)', 3832.84, NULL),
    ('050041', 'MOSTAZA SAVORA (por KG)', 3017.27, NULL),
    ('010010', 'AZUCAR EN SOBRES (por sobre)', 16.21, NULL),
    ('010007', 'MAYONESA SACHET (caja196 -> por sobre)', 69.52, NULL),
    ('010011', 'SAL FINA SOBRES (caja1000 -> por sobre)', 7.24, NULL),
    ('040013', 'NOT BURGER (caja62 -> por unidad)', 1240.25, NULL),
    ('140004', 'TRIANGULOS MOZZARELLA (por KG)', 18606.67, NULL),
    ('140005', 'AROS DE CEBOLLA (por KG)', 11164.00, NULL),
    ('140010', 'BITES ESPINACA Y QUESO (por KG)', 12637.35, NULL),
    ('040009', 'MEDALLON POLLO ARTICO (por KG)', 8304.19, NULL),
    ('070039', 'PAPEL PARAFINADO DESEMBARCO', 53.19, NULL),
    ('070017', 'PAPEL ALUMINIO BURGUER', 183.88, NULL),
    ('070015', 'SERVILLETA C/LOGO (paquete800 -> por unidad)', 21.93, NULL),
    ('070013', 'CAJA BURGUER DESEMBARCO', 283.59, NULL),
    ('070003', 'CAJA MILANESA', 459.95, NULL),
    ('070001', 'BOLSA DELIVERY DESEMBARCO', 130.62, NULL),
    ('140001', 'ESTUCHE PAPAS', 54.76, NULL),
    ('070040', 'BALDE 150OZ TASTY', 529.29, NULL),
    ('070014', 'PAPEL PARAFINADO TASTY', 53.19, NULL),
    ('138032', 'ENSALADERA TASTY GRANDE', 339.45, NULL),
    ('070016', 'BOLSA DELIVERY TASTY', 110.90, NULL),
    ('070036', 'SOBRE CHICO PAPAS TASTY (⚠ duplicado con papel M&G)', 32.96, NULL),
    ('070023', 'BANDEJA FOODTRUCK CHICA', 61.65, NULL),
    ('070022', 'BANDEJA FOODTRUCK GRANDE', 96.84, NULL),
    ('148002', 'CONO DE PAPAS', 69.45, NULL),
    ('070031', 'PORTA PANCHO', 23.51, NULL),
    ('160003', 'BALDE 1L HELADO TASTY', 410.58, NULL)
  ) v (COD, PRODUCTO, PRECIO_LISTA, NOTA)
),
Tango AS (
  SELECT 'MAESTRO' AS MAESTRO, a.COD_ARTICU, a.DESCRIPCIO, m.SIGLA_MEDIDA, s.PRECIO_REP
  FROM MAESTRO.dbo.STA11 a
  LEFT JOIN MAESTRO.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
  LEFT JOIN MAESTRO.dbo.STA12 s ON s.COD_ARTICU = a.COD_ARTICU
  UNION ALL
  SELECT 'MAESTRO_TASTY', a.COD_ARTICU, a.DESCRIPCIO, m.SIGLA_MEDIDA, s.PRECIO_REP
  FROM MAESTRO_TASTY.dbo.STA11 a
  LEFT JOIN MAESTRO_TASTY.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
  LEFT JOIN MAESTRO_TASTY.dbo.STA12 s ON s.COD_ARTICU = a.COD_ARTICU
)
SELECT
  l.COD,
  l.PRODUCTO,
  t.MAESTRO,
  t.DESCRIPCIO       AS ARTICULO_TANGO,
  t.SIGLA_MEDIDA     AS UM_TANGO,
  l.PRECIO_LISTA,
  t.PRECIO_REP       AS REPOSICION_TANGO,
  CASE
    WHEN l.NOTA IS NOT NULL THEN l.NOTA
    WHEN t.COD_ARTICU IS NULL THEN 'NO EXISTE'
    WHEN ISNULL(t.PRECIO_REP, 0) = 0 THEN 'SIN COSTO -> CARGAR'
    WHEN ABS(l.PRECIO_LISTA - t.PRECIO_REP) / t.PRECIO_REP > 0.01
      THEN 'ACTUALIZAR (' + FORMAT((l.PRECIO_LISTA - t.PRECIO_REP) / t.PRECIO_REP, '+0.0%;-0.0%') + ')'
    ELSE 'OK'
  END AS ESTADO
FROM Lista l
LEFT JOIN Tango t ON t.COD_ARTICU = l.COD
ORDER BY CASE WHEN t.COD_ARTICU IS NULL THEN 2 WHEN ISNULL(t.PRECIO_REP,0) = 0 THEN 1
              WHEN ABS(l.PRECIO_LISTA - ISNULL(t.PRECIO_REP,0)) / NULLIF(t.PRECIO_REP,0) > 0.01 THEN 0
              ELSE 3 END, l.COD, t.MAESTRO;
