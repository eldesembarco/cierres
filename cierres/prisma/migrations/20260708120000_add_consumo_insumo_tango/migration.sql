-- Informe de insumos del BI: consumo por local/fecha/insumo (desde Tango) +
-- contador de filas en la bitácora de sync.
CREATE TABLE "consumo_insumo_tango" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "rubro" TEXT,
    "unidad" TEXT,
    "cantidad" DECIMAL(14,3) NOT NULL DEFAULT 0,
    CONSTRAINT "consumo_insumo_tango_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consumo_insumo_tango_local_id_fecha_codigo_key" ON "consumo_insumo_tango"("local_id", "fecha", "codigo");
CREATE INDEX "consumo_insumo_tango_fecha_idx" ON "consumo_insumo_tango"("fecha");

ALTER TABLE "consumo_insumo_tango" ADD CONSTRAINT "consumo_insumo_tango_local_id_fkey"
    FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "venta_tango_sync" ADD COLUMN "filas_insumos" INTEGER NOT NULL DEFAULT 0;
