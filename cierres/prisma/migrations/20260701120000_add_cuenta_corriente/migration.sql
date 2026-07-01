-- AlterTable
ALTER TABLE "cierre_gasto" ADD COLUMN     "proveedor_id" INTEGER;

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_cta_cte" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "proveedor_id" INTEGER,
    "cierre_id" INTEGER,
    "fecha" DATE NOT NULL,
    "concepto" TEXT NOT NULL,
    "descripcion" TEXT,
    "monto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "pagado_en" TIMESTAMP(3),
    "pagado_por" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_cta_cte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimiento_cta_cte_local_id_pagado_idx" ON "movimiento_cta_cte"("local_id", "pagado");

-- CreateIndex
CREATE INDEX "movimiento_cta_cte_cierre_id_idx" ON "movimiento_cta_cte"("cierre_id");

-- AddForeignKey
ALTER TABLE "cierre_gasto" ADD CONSTRAINT "cierre_gasto_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_cta_cte" ADD CONSTRAINT "movimiento_cta_cte_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_cta_cte" ADD CONSTRAINT "movimiento_cta_cte_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_cta_cte" ADD CONSTRAINT "movimiento_cta_cte_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
