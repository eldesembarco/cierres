-- ============================================================
-- EXPLORACIÓN para diseñar vw_ConsumoInsumos (informe de insumos por local).
-- Solo lectura. Correr en SSMS contra SRVTANGO\AXSQLEXPRESS y pasar los
-- resultados (o autorizar a Claude a consultar directo y lo mira solo).
-- ============================================================

-- 1. ¿Qué bases hay? (las empresas de Tango suelen ser una base cada una)
SELECT name FROM sys.databases ORDER BY name;

-- 2. En CENTRAL_ESTADISTICA: qué tablas/vistas existen (para ver de dónde
--    salen las vistas actuales y si ya hay algo de stock consolidado)
USE CENTRAL_ESTADISTICA;
SELECT s.name AS esquema, o.name AS objeto, o.type_desc
FROM sys.objects o JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type IN ('U','V')
ORDER BY o.type_desc, o.name;

-- 3. Definición de las vistas que ya funcionan (muestran las tablas reales
--    de las que leen; con eso se deduce el esquema para insumos)
SELECT OBJECT_NAME(object_id) AS vista, definition
FROM sys.sql_modules
WHERE OBJECT_NAME(object_id) IN ('vw_VentasPorArticulo','vw_VentasPorHora','vw_CobrosDiarios');

-- 4. Buscar tablas candidatas de STOCK/FÓRMULAS en todas las bases:
--    - movimientos de stock (egresos por venta o remitos)
--    - fórmulas/composición de artículos (explosión de insumos)
--    Tango clásico: STA11 (artículos), STA20/STA22 (movimientos), GVA* (ventas).
EXEC sp_MSforeachdb '
IF DB_ID(''?'') > 4
SELECT ''?'' AS base, name
FROM [?].sys.tables
WHERE name LIKE ''%STA%'' OR name LIKE ''%STOCK%'' OR name LIKE ''%FORMUL%''
   OR name LIKE ''%COMPOS%'' OR name LIKE ''%REMITO%'' OR name LIKE ''%MOVIM%''';
