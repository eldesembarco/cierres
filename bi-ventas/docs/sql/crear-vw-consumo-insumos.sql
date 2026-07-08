-- ============================================================
-- vw_ConsumoInsumos: insumos entregados por el CDP a cada local propio.
-- Correr en SSMS (SRVTANGO\AXSQLEXPRESS) como admin. Idempotente.
--
-- Fuente: facturas (y NC) que las empresas El_Desembarco y Mr_Tasty_SRL
-- le emiten a cada cliente-local. El maestro de clientes es compartido
-- entre ambas bases, así que el mapa cliente->sucursal sirve para las dos.
-- Nota: lo facturado por el CDP ≈ lo consumido, con desfase de días
-- (es aprovisionamiento, no consumo por venta).
--
-- Mapeo verificado el 2026-07-08 contra GVA14 (NOM_COM) y SUCURSAL:
--   * VILLA CRESPO tiene 2 clientes activos (1015 y 1088) -> ambos a sucursal 14
--   * PACHECO es 1029 (DESEMBARCO DEL REY SRL); se excluye 1070 "PACHECO 1444 SRL"
--   * VILLA DEVOTO es 1035; se excluye 1074 "DEVOTO" (ALBO GASTRONOMIC, franquicia)
--   * Si se suma un local propio nuevo, agregar su fila al VALUES.
--
-- REQUIERE que bridge_lectura conserve db_datareader en El_Desembarco y
-- Mr_Tasty_SRL (el GRANT del 08/07): la vista cruza esas bases.
-- ============================================================
USE CENTRAL_ESTADISTICA;
GO
CREATE OR ALTER VIEW dbo.vw_ConsumoInsumos AS
WITH Mapa (COD_CLIENT, ID_SUCURSAL) AS (
  SELECT v.c, v.s FROM (VALUES
    ('1001', 4),  -- Boedo
    ('1016', 42), -- Hurlingham
    ('1037', 27), -- Microcentro
    ('1014', 28), -- Moron
    ('1004', 9),  -- Nordelta
    ('1002', 20), -- Nuñez
    ('1018', 43), -- Olivos
    ('1029', 18), -- Pacheco
    ('1049', 69), -- Pacifico
    ('1006', 8),  -- Quilmes
    ('1022', 6),  -- Ramos Mejia
    ('1012', 26), -- Recoleta
    ('1005', 24), -- San Telmo
    ('1015', 14), -- Villa Crespo (cliente historico)
    ('1088', 14), -- Villa Crespo (MABEMA SRL)
    ('1035', 25), -- Villa Devoto
    ('1020', 19), -- Villa Urquiza
    ('2045', 92), -- Mr Tasty Belgrano
    ('2012', 56), -- Mr Tasty Caballito
    ('2018', 64), -- Mr Tasty Florida
    ('2043', 83)  -- Mr Tasty San Fernando
  ) v (c, s)
),
Renglones AS (
  -- FECHA_ANU usa el centinela 1800-01-01 de Tango como "no anulada".
  -- Los codigos '000%' son servicios (sistema, gestion), no insumos.
  SELECT c.COD_CLIENT, c.FECHA_EMIS AS FECHA, r.COD_ARTICU,
         r.CANTIDAD * CASE WHEN c.T_COMP LIKE 'N/C%' THEN -1 ELSE 1 END AS CANTIDAD,
         a.DESCRIPCIO, m.SIGLA_MEDIDA
  FROM El_Desembarco.dbo.GVA12 c
  JOIN El_Desembarco.dbo.GVA53 r ON r.T_COMP = c.T_COMP AND r.N_COMP = c.N_COMP
  JOIN El_Desembarco.dbo.STA11 a ON a.COD_ARTICU = r.COD_ARTICU
  LEFT JOIN El_Desembarco.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
  WHERE c.T_COMP IN ('FAC','N/C') AND c.FECHA_ANU <= '1900-01-01' AND r.COD_ARTICU NOT LIKE '000%'
  UNION ALL
  SELECT c.COD_CLIENT, c.FECHA_EMIS, r.COD_ARTICU,
         r.CANTIDAD * CASE WHEN c.T_COMP LIKE 'N/C%' THEN -1 ELSE 1 END,
         a.DESCRIPCIO, m.SIGLA_MEDIDA
  FROM Mr_Tasty_SRL.dbo.GVA12 c
  JOIN Mr_Tasty_SRL.dbo.GVA53 r ON r.T_COMP = c.T_COMP AND r.N_COMP = c.N_COMP
  JOIN Mr_Tasty_SRL.dbo.STA11 a ON a.COD_ARTICU = r.COD_ARTICU
  LEFT JOIN Mr_Tasty_SRL.dbo.MEDIDA m ON m.ID_MEDIDA = a.ID_MEDIDA_STOCK
  WHERE c.T_COMP IN ('FAC','N/C') AND c.FECHA_ANU <= '1900-01-01' AND r.COD_ARTICU NOT LIKE '000%'
)
SELECT
  CAST(x.FECHA AS date)        AS FECHA,
  mp.ID_SUCURSAL               AS ID_SUCURSAL,
  x.COD_ARTICU                 AS COD_ARTICULO,
  x.DESCRIPCIO                 AS DESCRIPCION,
  CAST(NULL AS varchar(60))    AS RUBRO,
  x.SIGLA_MEDIDA               AS UNIDAD,
  SUM(x.CANTIDAD)              AS CANTIDAD
FROM Renglones x
JOIN Mapa mp ON mp.COD_CLIENT = x.COD_CLIENT
GROUP BY CAST(x.FECHA AS date), mp.ID_SUCURSAL, x.COD_ARTICU, x.DESCRIPCIO, x.SIGLA_MEDIDA;
GO
-- Control rapido: junio deberia mostrar ~18 sucursales con 29-38 insumos c/u.
SELECT ID_SUCURSAL, COUNT(DISTINCT COD_ARTICULO) AS insumos, SUM(CANTIDAD) AS cantidad
FROM dbo.vw_ConsumoInsumos WHERE FECHA BETWEEN '2026-06-01' AND '2026-06-30'
GROUP BY ID_SUCURSAL ORDER BY ID_SUCURSAL;
