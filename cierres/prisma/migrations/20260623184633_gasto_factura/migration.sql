-- AlterEnum
ALTER TYPE "FormaPago" ADD VALUE 'cuenta_corriente';

-- AlterTable
ALTER TABLE "cierre_gasto" ADD COLUMN     "factura_numero" TEXT,
ADD COLUMN     "factura_total" DECIMAL(14,2);
