-- AlterTable: convertir cierre_gasto.tipo de enum TipoGasto a TEXT preservando los datos.
ALTER TABLE "cierre_gasto" ALTER COLUMN "tipo" TYPE TEXT USING "tipo"::text;

-- DropEnum: el tipo ya no se usa (la columna ahora es TEXT).
DROP TYPE "TipoGasto";

-- CreateTable
CREATE TABLE "cierre_auditoria" (
    "id" SERIAL NOT NULL,
    "cierre_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "usuario_nombre" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "observacion" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierre_auditoria_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cierre_auditoria" ADD CONSTRAINT "cierre_auditoria_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
