-- CreateTable
CREATE TABLE "cierre_detalle" (
    "id" SERIAL NOT NULL,
    "cierre_id" INTEGER NOT NULL,
    "canal" "Canal" NOT NULL,
    "referencia" TEXT NOT NULL DEFAULT '',
    "importe" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cierre_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cierre_detalle_cierre_id_canal_idx" ON "cierre_detalle"("cierre_id", "canal");

-- AddForeignKey
ALTER TABLE "cierre_detalle" ADD CONSTRAINT "cierre_detalle_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
