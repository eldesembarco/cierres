-- ============================================================
-- vw_ConsumoInsumos: consumo TEÓRICO de insumos por local/día, VALORIZADO.
-- Explota las RECETAS de Tango sobre la venta real por artículo y lo valoriza
-- al PRECIO DE REPOSICIÓN ("Precios para costos"). Correr en SSMS como admin.
-- Idempotente (CREATE OR ALTER).
--
-- REGLA DE MAESTROS (definida con Pablo el 10/07): "todo nace de MAESTRO".
--   * Recetas: para sucursales Tasty se usa la de MAESTRO_TASTY si existe
--     (adaptaciones de marca, p.ej. otro pan) y si no, la de MAESTRO.
--     Para Desembarco, MAESTRO directo. Con esto los baldes/promos Tasty
--     (508063, 508047, 138xxx...) explotan con su receta de MAESTRO:
--     validado 10/07 → CMV Tasty pasa de 15,4% (roto) a 39,8% (real).
--   * Costos: MAESTRO es la fuente (es el panel que mantiene administración);
--     MAESTRO_TASTY solo aporta si el artículo no tiene costo en MAESTRO.
--   * Lo vendido sin receta (gaseosas, latas) cuenta 1:1 como sí mismo.
--     Se excluye COSTO_ENVIO. Explosión recursiva (tope 6 niveles; real: 2).
--
-- Validaciones (30 días al 10/07, 20 locales propios):
--   food cost D 38,3% / T 39,8%; Hurlingham 07/07 = 110 servilletas, 68 bolas,
--   24 LT barril. REQUIERE mantener el db_datareader de bridge_lectura en
--   MAESTRO y MAESTRO_TASTY (GRANT del 08/07).
-- ============================================================
USE CENTRAL_ESTADISTICA;
GO
CREATE OR ALTER VIEW dbo.vw_ConsumoInsumos AS
WITH Sucur AS (
  SELECT ID_SUCURSAL,
         CASE WHEN DESC_SUCURSAL LIKE 'Mrt%' OR DESC_SUCURSAL LIKE 'Casa central Mrt%'
              THEN 'T' ELSE 'D' END AS MARCA
  FROM dbo.SUCURSAL
),
RecetasT AS (
  -- Tasty: su maestro pisa; lo que no tenga, cae a MAESTRO (todo nace ahí).
  SELECT COD_ARTICU, COD_INSUMO, CAST(CANTIDAD AS decimal(18,6)) AS CANTIDAD
  FROM MAESTRO_TASTY.dbo.STA03
  UNION ALL
  SELECT m.COD_ARTICU, m.COD_INSUMO, CAST(m.CANTIDAD AS decimal(18,6))
  FROM MAESTRO.dbo.STA03 m
  WHERE NOT EXISTS (SELECT 1 FROM MAESTRO_TASTY.dbo.STA03 t WHERE t.COD_ARTICU = m.COD_ARTICU)
),
Recetas AS (
  SELECT 'D' AS MARCA, COD_ARTICU, COD_INSUMO, CAST(CANTIDAD AS decimal(18,6)) AS CANTIDAD
  FROM MAESTRO.dbo.STA03
  UNION ALL
  SELECT 'T', COD_ARTICU, COD_INSUMO, CANTIDAD FROM RecetasT
),
Explosion AS (
  SELECT v.FECHA, v.ID_SUCURSAL, s.MARCA, v.COD_ARTICULO AS COD_ARTICU,
         CAST(v.CANTIDAD AS decimal(18,6)) AS CANTIDAD, 0 AS NIVEL
  FROM dbo.vw_VentasPorArticulo v
  JOIN Sucur s ON s.ID_SUCURSAL = v.ID_SUCURSAL
  WHERE v.COD_ARTICULO <> 'COSTO_ENVIO'
  UNION ALL
  SELECT e.FECHA, e.ID_SUCURSAL, e.MARCA, r.COD_INSUMO,
         CAST(e.CANTIDAD * r.CANTIDAD AS decimal(18,6)), e.NIVEL + 1
  FROM Explosion e
  JOIN Recetas r ON r.MARCA = e.MARCA AND r.COD_ARTICU = e.COD_ARTICU
  WHERE e.NIVEL < 6
),
Articulos AS (
  -- Descripción/unidad: por marca, con fallback a MAESTRO para Tasty.
  SELECT 'D' AS MARCA, a.COD_ARTICU, a.DESCRIPCIO, m.SIGLA_MEDIDA
  FROM MAESTRO.dbo.STA11 a
  LEFT JOIN MAESTRO.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
  UNION ALL
  SELECT 'T', a.COD_ARTICU, a.DESCRIPCIO, m.SIGLA_MEDIDA
  FROM MAESTRO_TASTY.dbo.STA11 a
  LEFT JOIN MAESTRO_TASTY.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
  UNION ALL
  SELECT 'T', a.COD_ARTICU, a.DESCRIPCIO, m.SIGLA_MEDIDA
  FROM MAESTRO.dbo.STA11 a
  LEFT JOIN MAESTRO.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
  WHERE NOT EXISTS (SELECT 1 FROM MAESTRO_TASTY.dbo.STA11 t WHERE t.COD_ARTICU = a.COD_ARTICU)
),
CostosBase AS (
  SELECT COD_ARTICU, CAST(PRECIO_REP AS decimal(18,4)) AS PRECIO_REP
  FROM MAESTRO.dbo.STA12 WHERE PRECIO_REP > 0
),
Costos AS (
  SELECT 'D' AS MARCA, COD_ARTICU, PRECIO_REP FROM CostosBase
  UNION ALL
  SELECT 'T', COD_ARTICU, PRECIO_REP FROM CostosBase
  UNION ALL
  SELECT 'T', t.COD_ARTICU, CAST(t.PRECIO_REP AS decimal(18,4))
  FROM MAESTRO_TASTY.dbo.STA12 t
  WHERE t.PRECIO_REP > 0
    AND NOT EXISTS (SELECT 1 FROM CostosBase b WHERE b.COD_ARTICU = t.COD_ARTICU)
)
SELECT
  e.FECHA                                          AS FECHA,
  e.ID_SUCURSAL                                    AS ID_SUCURSAL,
  e.COD_ARTICU                                     AS COD_ARTICULO,
  COALESCE(MAX(ar.DESCRIPCIO), e.COD_ARTICU)       AS DESCRIPCION,
  CAST(NULL AS varchar(60))                        AS RUBRO,
  MAX(ar.SIGLA_MEDIDA)                             AS UNIDAD,
  SUM(e.CANTIDAD)                                  AS CANTIDAD,
  MAX(co.PRECIO_REP)                               AS COSTO_UNITARIO,
  CAST(SUM(e.CANTIDAD) * MAX(co.PRECIO_REP) AS decimal(18,2)) AS COSTO_TOTAL
FROM Explosion e
LEFT JOIN Articulos ar ON ar.MARCA = e.MARCA AND ar.COD_ARTICU = e.COD_ARTICU
LEFT JOIN Costos co    ON co.MARCA = e.MARCA AND co.COD_ARTICU = e.COD_ARTICU
WHERE NOT EXISTS (SELECT 1 FROM Recetas r WHERE r.MARCA = e.MARCA AND r.COD_ARTICU = e.COD_ARTICU)
GROUP BY e.FECHA, e.ID_SUCURSAL, e.COD_ARTICU;
GO
-- Control 1: Hurlingham (42) 07/07 ~110 servilletas / 68 bolas / 24 LT barril, con $.
SELECT TOP 10 COD_ARTICULO, DESCRIPCION, UNIDAD, CANTIDAD, COSTO_UNITARIO, COSTO_TOTAL
FROM dbo.vw_ConsumoInsumos WHERE FECHA = '2026-07-07' AND ID_SUCURSAL = 42
ORDER BY COSTO_TOTAL DESC;
-- Control 2: un local Tasty debe mostrar consumo de los baldes explotados
-- (bolas, panes, papas) — si aparece casi vacío, algo quedó mal.
SELECT TOP 10 COD_ARTICULO, DESCRIPCION, UNIDAD, CANTIDAD, COSTO_TOTAL
FROM dbo.vw_ConsumoInsumos WHERE FECHA = '2026-07-07' AND ID_SUCURSAL = 56
ORDER BY COSTO_TOTAL DESC;
