-- Valorización del consumo de insumos: costo de reposición de Tango (STA12).
ALTER TABLE "consumo_insumo_tango" ADD COLUMN "costo_unitario" DECIMAL(14,4);
ALTER TABLE "consumo_insumo_tango" ADD COLUMN "costo_total" DECIMAL(14,2);
