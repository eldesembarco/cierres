-- CreateEnum
CREATE TYPE "TipoGasto" AS ENUM ('mercaderia', 'descartable', 'limpieza', 'bazar', 'uniformes', 'servicios', 'sueldos', 'mantenimiento', 'marca', 'libreria', 'varios');

-- CreateEnum
CREATE TYPE "FormaPago" AS ENUM ('efectivo', 'tarjeta', 'transferencia', 'otro');

-- DropForeignKey
ALTER TABLE "cierre_turnos" DROP CONSTRAINT "cierre_turnos_cierre_id_fkey";

-- DropTable (subsumido por el cierre-por-turno)
DROP TABLE "cierre_turnos";

-- DropIndex
DROP INDEX "cierre_tarjetas_cierre_id_turno_tipo_key";

-- AlterTable: las tarjetas ahora cuelgan del cierre-turno (sin columna turno)
ALTER TABLE "cierre_tarjetas" DROP COLUMN "turno";

-- AlterEnum: Turno pasa de T1/T2 a manana/tarde (ya no hay columnas que lo usen)
BEGIN;
CREATE TYPE "Turno_new" AS ENUM ('manana', 'tarde');
ALTER TYPE "Turno" RENAME TO "Turno_old";
ALTER TYPE "Turno_new" RENAME TO "Turno";
DROP TYPE "Turno_old";
COMMIT;

-- AlterTable: el cierre pasa a ser por turno; quita gastosTotal, suma montoZ/efectivoDepositado/turno
ALTER TABLE "cierres" DROP COLUMN "gastos_total",
ADD COLUMN     "efectivo_depositado" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "monto_z" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "turno" "Turno" NOT NULL;

-- DropIndex
DROP INDEX "cierres_local_id_fecha_key";

-- CreateTable
CREATE TABLE "cierre_gasto" (
    "id" SERIAL NOT NULL,
    "cierre_id" INTEGER NOT NULL,
    "tipo" "TipoGasto" NOT NULL,
    "forma_pago" "FormaPago" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descripcion" TEXT,
    "comprobante_id" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cierre_gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cierre_tarjetas_cierre_id_tipo_key" ON "cierre_tarjetas"("cierre_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_local_id_fecha_turno_key" ON "cierres"("local_id", "fecha", "turno");

-- AddForeignKey
ALTER TABLE "cierre_gasto" ADD CONSTRAINT "cierre_gasto_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
