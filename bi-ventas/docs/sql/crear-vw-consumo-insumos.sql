-- ============================================================
-- vw_ConsumoInsumos: consumo TEÓRICO de insumos por local/día, VALORIZADO.
-- Explota las RECETAS de Tango sobre la venta real por artículo y lo valoriza
-- al PRECIO DE REPOSICIÓN ("Precios para costos"). Correr en SSMS como admin.
-- Idempotente (CREATE OR ALTER).
--
-- REGLA DE MAESTROS (definida con Pablo el 10/07): "todo nace de MAESTRO".
--   * Recetas: SIEMPRE las de MAESTRO Desembarco para todas las marcas
--     (regla de Pablo: "de ahí se toma la información"; MAESTRO_TASTY es una
--     copia desactualizada y no pisa). CMV Tasty validado 39,8%.
--   * Costos: MAESTRO es la fuente (es el panel que mantiene administración);
--     MAESTRO_TASTY solo aporta si el artículo no tiene costo en MAESTRO.
--   * Lo vendido sin receta (gaseosas, latas) cuenta 1:1 como sí mismo.
--     Se excluye COSTO_ENVIO. Explosión recursiva (tope 6 niveles; real: 2).
--
-- REGLA DE FÓRMULAS VARIABLES (definida con Pablo el 15/07): Tango Restô
--   registra las promos variables (Balde Mixto 508041, Toma Sin Límite 508059,
--   Fernet Libre 508053, HH 2x1 501018, Menú Ejecutivo 505009) con la fórmula
--   completa en el padre Y ADEMÁS renglones hijos $0 con lo elegido/servido.
--   Contar ambos duplica el consumo (medido: Toma Sin Límite contaría 7.790
--   medias pintas/mes en vez de 6.750). Regla adoptada:
--   * Si el artículo PADRE tiene fórmula en STA03 -> manda la fórmula (mix
--     promedio/estimado) y los renglones hijos $0 SE IGNORAN. Motivo: los
--     mozos sub-registran refills (1,5 por promo "sin límite" = irreal).
--   * Si el padre NO tiene fórmula -> los hijos computan normal.
--   Por eso el consumo se lee de vw_VentasParaConsumo (detalle) y no de
--   vw_VentasPorArticulo (que agrega hijos sin distinguirlos).
--
-- Validaciones (30 días al 10/07, 20 locales propios):
--   food cost D 38,3% / T 39,8%; Hurlingham 07/07 = 110 servilletas, 68 bolas,
--   24 LT barril. REQUIERE mantener el db_datareader de bridge_lectura en
--   MAESTRO y MAESTRO_TASTY (GRANT del 08/07).
-- ============================================================
USE CENTRAL_ESTADISTICA;
GO
-- AUTO-CALIBRACIÓN (regla 16/07, pedida por Pablo): para cada par
-- (promo padre, componente hijo) medimos qué porcentaje de las ventas de la
-- promo registró renglones hijos $0 de ese componente en los últimos 60 días.
-- Si la cobertura es >= 50%, el registro de los mozos es confiable y el
-- consumo REAL viene de los hijos (ej. Toma Sin Límite: 5,4 medias/promo
-- reales vs 10 estimadas en fórmula); ese renglón de la fórmula se ignora.
-- Componentes con registro pobre siguen tomando la fórmula (mix promedio).
-- Ventana móvil: se recalibra solo, sin tocar fórmulas de Tango.
CREATE OR ALTER VIEW dbo.vw_ComponentesVariables AS
WITH VentasPadre AS (
  SELECT a.COD_ARTICULO AS padre, COUNT(*) AS ventas
  FROM dbo.CTA_DETALLE_COMANDA d
  JOIN dbo.CTA_ENCABEZADO_COMANDA e ON e.ID_CTA_ENCABEZADO_COMANDA = d.ID_CTA_ENCABEZADO_COMANDA
  JOIN dbo.CTA_ARTICULO a ON a.ID_CTA_ARTICULO = d.ID_CTA_ARTICULO
  WHERE e.ESTADO IN ('C','T')
    AND d.ID_CTA_DETALLE_COMANDA_PADRE IS NULL
    AND d.FECHA_COMERCIAL >= DATEADD(day, -60, CAST(GETDATE() AS date))
  GROUP BY a.COD_ARTICULO
),
Pares AS (
  SELECT ap.COD_ARTICULO AS padre, ah.COD_ARTICULO AS hijo,
         COUNT(DISTINCT h.ID_CTA_DETALLE_COMANDA_PADRE) AS ventas_con_hijo
  FROM dbo.CTA_DETALLE_COMANDA h
  JOIN dbo.CTA_DETALLE_COMANDA p ON p.ID_CTA_DETALLE_COMANDA = h.ID_CTA_DETALLE_COMANDA_PADRE
  JOIN dbo.CTA_ARTICULO ah ON ah.ID_CTA_ARTICULO = h.ID_CTA_ARTICULO
  JOIN dbo.CTA_ARTICULO ap ON ap.ID_CTA_ARTICULO = p.ID_CTA_ARTICULO
  WHERE h.FECHA_COMERCIAL >= DATEADD(day, -60, CAST(GETDATE() AS date))
  GROUP BY ap.COD_ARTICULO, ah.COD_ARTICULO
)
SELECT pa.padre AS COD_PADRE, pa.hijo AS COD_HIJO
FROM Pares pa
JOIN VentasPadre vp ON vp.padre = pa.padre
WHERE vp.ventas > 0 AND pa.ventas_con_hijo * 2 >= vp.ventas;
GO
-- Ventas a nivel detalle para consumo. Renglones hijos ($0, colgados de un
-- padre): computan solo si el par (padre, hijo) es confiable según
-- vw_ComponentesVariables (registro denso) o si el padre no tiene fórmula.
-- Si no, se ignoran (la fórmula del padre ya modela ese consumo).
CREATE OR ALTER VIEW dbo.vw_VentasParaConsumo AS
SELECT
  CAST(d.FECHA_COMERCIAL AS date) AS FECHA,
  d.ID_SUCURSAL                   AS ID_SUCURSAL,
  a.COD_ARTICULO                  AS COD_ARTICULO,
  SUM(d.CANTIDAD)                 AS CANTIDAD
FROM dbo.CTA_DETALLE_COMANDA d
JOIN dbo.CTA_ENCABEZADO_COMANDA e ON e.ID_CTA_ENCABEZADO_COMANDA = d.ID_CTA_ENCABEZADO_COMANDA
JOIN dbo.CTA_ARTICULO a           ON a.ID_CTA_ARTICULO = d.ID_CTA_ARTICULO
LEFT JOIN dbo.CTA_DETALLE_COMANDA dp ON dp.ID_CTA_DETALLE_COMANDA = d.ID_CTA_DETALLE_COMANDA_PADRE
LEFT JOIN dbo.CTA_ARTICULO ap        ON ap.ID_CTA_ARTICULO = dp.ID_CTA_ARTICULO
WHERE e.ESTADO IN ('C','T')
  AND (
    d.ID_CTA_DETALLE_COMANDA_PADRE IS NULL
    OR NOT EXISTS (SELECT 1 FROM MAESTRO.dbo.STA03 f WHERE f.COD_ARTICU = ap.COD_ARTICULO)
    OR EXISTS (SELECT 1 FROM dbo.vw_ComponentesVariables cv
               WHERE cv.COD_PADRE = ap.COD_ARTICULO AND cv.COD_HIJO = a.COD_ARTICULO)
  )
GROUP BY CAST(d.FECHA_COMERCIAL AS date), d.ID_SUCURSAL, a.COD_ARTICULO;
GO
CREATE OR ALTER VIEW dbo.vw_ConsumoInsumos AS
WITH Sucur AS (
  SELECT ID_SUCURSAL,
         CASE WHEN DESC_SUCURSAL LIKE 'Mrt%' OR DESC_SUCURSAL LIKE 'Casa central Mrt%'
              THEN 'T' ELSE 'D' END AS MARCA
  FROM dbo.SUCURSAL
),
Recetas AS (
  -- REGLA (Pablo 10/07): las recetas se leen SIEMPRE de MAESTRO Desembarco,
  -- para TODAS las marcas ("de ahí se toma la información"). MAESTRO_TASTY es
  -- una copia desactualizada (149 de sus 315 recetas difieren) y NO pisa.
  -- COLLATE DATABASE_DEFAULT: CENTRAL_ESTADISTICA y los maestros tienen
  -- collations distintas (Latin1_General_BIN vs Modern_Spanish_CI_AI);
  -- sin normalizar, el COALESCE/JOIN entre bases revienta (Msg 457).
  SELECT 'D' AS MARCA,
         COD_ARTICU COLLATE DATABASE_DEFAULT AS COD_ARTICU,
         COD_INSUMO COLLATE DATABASE_DEFAULT AS COD_INSUMO,
         CAST(CANTIDAD AS decimal(18,6)) AS CANTIDAD
  FROM MAESTRO.dbo.STA03
  UNION ALL
  SELECT 'T',
         COD_ARTICU COLLATE DATABASE_DEFAULT,
         COD_INSUMO COLLATE DATABASE_DEFAULT,
         CAST(CANTIDAD AS decimal(18,6))
  FROM MAESTRO.dbo.STA03
),
Explosion AS (
  SELECT v.FECHA, v.ID_SUCURSAL, s.MARCA,
         v.COD_ARTICULO COLLATE DATABASE_DEFAULT AS COD_ARTICU,
         CAST(v.CANTIDAD AS decimal(18,6)) AS CANTIDAD, 0 AS NIVEL
  FROM dbo.vw_VentasParaConsumo v
  JOIN Sucur s ON s.ID_SUCURSAL = v.ID_SUCURSAL
  WHERE v.COD_ARTICULO <> 'COSTO_ENVIO'
  UNION ALL
  SELECT e.FECHA, e.ID_SUCURSAL, e.MARCA, r.COD_INSUMO,
         CAST(e.CANTIDAD * r.CANTIDAD AS decimal(18,6)), e.NIVEL + 1
  FROM Explosion e
  JOIN Recetas r ON r.MARCA = e.MARCA AND r.COD_ARTICU = e.COD_ARTICU
  WHERE e.NIVEL < 6
    -- Componente con registro confiable de hijos: NO se explota desde la
    -- fórmula (el consumo real ya entró por los renglones hijos $0).
    AND NOT EXISTS (SELECT 1 FROM dbo.vw_ComponentesVariables cv
                    WHERE cv.COD_PADRE COLLATE DATABASE_DEFAULT = e.COD_ARTICU
                      AND cv.COD_HIJO COLLATE DATABASE_DEFAULT = r.COD_INSUMO)
),
Articulos AS (
  -- Descripción/unidad: por marca, con fallback a MAESTRO para Tasty.
  SELECT 'D' AS MARCA,
         a.COD_ARTICU COLLATE DATABASE_DEFAULT AS COD_ARTICU,
         a.DESCRIPCIO COLLATE DATABASE_DEFAULT AS DESCRIPCIO,
         m.SIGLA_MEDIDA COLLATE DATABASE_DEFAULT AS SIGLA_MEDIDA
  FROM MAESTRO.dbo.STA11 a
  LEFT JOIN MAESTRO.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
  UNION ALL
  SELECT 'T',
         a.COD_ARTICU COLLATE DATABASE_DEFAULT,
         a.DESCRIPCIO COLLATE DATABASE_DEFAULT,
         m.SIGLA_MEDIDA COLLATE DATABASE_DEFAULT
  FROM MAESTRO_TASTY.dbo.STA11 a
  LEFT JOIN MAESTRO_TASTY.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
  UNION ALL
  SELECT 'T',
         a.COD_ARTICU COLLATE DATABASE_DEFAULT,
         a.DESCRIPCIO COLLATE DATABASE_DEFAULT,
         m.SIGLA_MEDIDA COLLATE DATABASE_DEFAULT
  FROM MAESTRO.dbo.STA11 a
  LEFT JOIN MAESTRO.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
  WHERE NOT EXISTS (SELECT 1 FROM MAESTRO_TASTY.dbo.STA11 t
                    WHERE t.COD_ARTICU = a.COD_ARTICU COLLATE Modern_Spanish_CI_AI)
),
CostosBase AS (
  SELECT COD_ARTICU COLLATE DATABASE_DEFAULT AS COD_ARTICU,
         CAST(PRECIO_REP AS decimal(18,4)) AS PRECIO_REP
  FROM MAESTRO.dbo.STA12 WHERE PRECIO_REP > 0
),
Costos AS (
  SELECT 'D' AS MARCA, COD_ARTICU, PRECIO_REP FROM CostosBase
  UNION ALL
  SELECT 'T', COD_ARTICU, PRECIO_REP FROM CostosBase
  UNION ALL
  SELECT 'T',
         t.COD_ARTICU COLLATE DATABASE_DEFAULT,
         CAST(t.PRECIO_REP AS decimal(18,4))
  FROM MAESTRO_TASTY.dbo.STA12 t
  WHERE t.PRECIO_REP > 0
    AND NOT EXISTS (SELECT 1 FROM CostosBase b
                    WHERE b.COD_ARTICU = t.COD_ARTICU COLLATE DATABASE_DEFAULT)
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
