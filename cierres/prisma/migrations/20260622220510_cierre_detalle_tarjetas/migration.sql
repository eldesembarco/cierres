-- CreateEnum
CREATE TYPE "TipoTarjeta" AS ENUM ('mastercard', 'maestro', 'visa_credito', 'visa_debito', 'amex');

-- AlterEnum
ALTER TYPE "Canal" ADD VALUE 'mercado_pedidos';

-- AlterTable
ALTER TABLE "cierre_turnos" ADD COLUMN     "efectivo_depositado" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "cierre_tarjetas" (
    "id" SERIAL NOT NULL,
    "cierre_id" INTEGER NOT NULL,
    "turno" "Turno" NOT NULL,
    "tipo" "TipoTarjeta" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lote" TEXT,

    CONSTRAINT "cierre_tarjetas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cierre_tarjetas_cierre_id_turno_tipo_key" ON "cierre_tarjetas"("cierre_id", "turno", "tipo");

-- AddForeignKey
ALTER TABLE "cierre_tarjetas" ADD CONSTRAINT "cierre_tarjetas_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
