-- ============================================================
-- GRANT de SOLO LECTURA para bridge_lectura en todas las bases de SRVTANGO.
-- Correr UNA VEZ como admin en SSMS (SRVTANGO\AXSQLEXPRESS).
-- Permite explorar el esquema para diseñar vw_ConsumoInsumos (informe de
-- insumos del BI). No da permisos de escritura en ningún lado.
-- ============================================================

-- 1. Lector en todas las bases de usuario (crea el user si no existe)
EXEC sp_MSforeachdb '
IF DB_ID(''?'') > 4
BEGIN
  USE [?];
  IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = ''bridge_lectura'')
    CREATE USER bridge_lectura FOR LOGIN bridge_lectura;
  ALTER ROLE db_datareader ADD MEMBER bridge_lectura;
END';

-- 2. Poder leer la definición de las vistas existentes (para reusar su lógica)
USE CENTRAL_ESTADISTICA;
GRANT VIEW DEFINITION TO bridge_lectura;
