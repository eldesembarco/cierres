-- AlterTable
ALTER TABLE "cierre_tango" ADD COLUMN     "anulaciones_afectan_caja" DECIMAL(14,2),
ADD COLUMN     "anulaciones_total" DECIMAL(14,2),
ADD COLUMN     "devoluciones_total" DECIMAL(14,2);
