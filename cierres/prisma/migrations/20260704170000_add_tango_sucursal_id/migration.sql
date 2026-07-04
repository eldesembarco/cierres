-- Mapeo de cada local propio a su sucursal en Tango (ID_SUCURSAL) para consumir /cobros.
ALTER TABLE "locales" ADD COLUMN "tango_sucursal_id" INTEGER;
CREATE UNIQUE INDEX "locales_tango_sucursal_id_key" ON "locales"("tango_sucursal_id");
