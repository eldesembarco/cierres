-- ============================================================
-- vw_ConsumoInsumos: consumo TEÓRICO de insumos por local/día, VALORIZADO.
-- Explota las RECETAS de Tango sobre la venta real por artículo y lo valoriza
-- al PRECIO DE REPOSICIÓN ("Precios para costos" de Tango).
-- Correr en SSMS (SRVTANGO\AXSQLEXPRESS) como admin. Idempotente.
--
-- Cómo funciona:
--   * Ventas por artículo/sucursal/día: dbo.vw_VentasPorArticulo (validada
--     contra el Z, neta de NC, fecha comercial).
--   * Recetas: STA03 de los maestros (COD_ARTICU -> COD_INSUMO x CANTIDAD).
--     MAESTRO para sucursales Desembarco, MAESTRO_TASTY para las "Mrt ...".
--   * Explosión RECURSIVA: los componentes con receta propia (elaborados,
--     p.ej. pinta -> litros de barril) se bajan hasta el insumo hoja.
--   * Lo vendido SIN receta (gaseosas en botella/lata) cuenta 1:1 como sí
--     mismo. Se excluye COSTO_ENVIO (no es un insumo).
--   * Costos: STA12.PRECIO_REP de cada maestro ("Precios para costos" ->
--     Importe reposición), en la MISMA unidad que consume la receta.
--     Cobertura hoy: 241 de 331 insumos consumidos (73%); los sin costo van
--     con COSTO_UNITARIO NULL (la cantidad se informa igual).
--
-- Validado 2026-07-08: Hurlingham 07/07 = 110 servilletas, 68 bolas, 50 panes
-- de papa, 24 LT de barril, 16 kg papas. Consumo valorizado junio (20 locales
-- propios) = $312,6M ≈ 34% de los $918M facturados (CMV teórico razonable).
--
-- REQUIERE que bridge_lectura conserve db_datareader en MAESTRO y
-- MAESTRO_TASTY (GRANT del 08/07): la vista cruza esas bases.
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
Recetas AS (
  SELECT 'D' AS MARCA, COD_ARTICU, COD_INSUMO, CAST(CANTIDAD AS decimal(18,6)) AS CANTIDAD
  FROM MAESTRO.dbo.STA03
  UNION ALL
  SELECT 'T', COD_ARTICU, COD_INSUMO, CAST(CANTIDAD AS decimal(18,6))
  FROM MAESTRO_TASTY.dbo.STA03
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
  SELECT 'D' AS MARCA, a.COD_ARTICU, a.DESCRIPCIO, m.SIGLA_MEDIDA
  FROM MAESTRO.dbo.STA11 a
  LEFT JOIN MAESTRO.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
  UNION ALL
  SELECT 'T', a.COD_ARTICU, a.DESCRIPCIO, m.SIGLA_MEDIDA
  FROM MAESTRO_TASTY.dbo.STA11 a
  LEFT JOIN MAESTRO_TASTY.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
),
Costos AS (
  -- "Precios para costos" de Tango: importe de reposición por insumo.
  SELECT 'D' AS MARCA, COD_ARTICU, CAST(PRECIO_REP AS decimal(18,4)) AS PRECIO_REP
  FROM MAESTRO.dbo.STA12 WHERE PRECIO_REP > 0
  UNION ALL
  SELECT 'T', COD_ARTICU, CAST(PRECIO_REP AS decimal(18,4))
  FROM MAESTRO_TASTY.dbo.STA12 WHERE PRECIO_REP > 0
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
-- Control rápido: Hurlingham (42) el 07/07 ~110 servilletas / 68 bolas /
-- 24 LT de barril, con costo unitario y total en $ para los que tienen
-- reposición cargada.
SELECT TOP 10 COD_ARTICULO, DESCRIPCION, UNIDAD, CANTIDAD, COSTO_UNITARIO, COSTO_TOTAL
FROM dbo.vw_ConsumoInsumos
WHERE FECHA = '2026-07-07' AND ID_SUCURSAL = 42
ORDER BY COSTO_TOTAL DESC;
