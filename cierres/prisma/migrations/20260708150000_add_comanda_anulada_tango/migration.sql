-- Comandas anuladas en Tango (ESTADO='X') por local, para la solapa de auditoría
-- de anulaciones del BI. Sin clave natural: el resync borra y reinserta por fecha.
CREATE TABLE "comanda_anulada_tango" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tipo_pedido" TEXT,
    "cubiertos" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "comanda_anulada_tango_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "comanda_anulada_tango_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id")
);
CREATE INDEX "comanda_anulada_tango_fecha_idx" ON "comanda_anulada_tango"("fecha");
CREATE INDEX "comanda_anulada_tango_local_id_fecha_idx" ON "comanda_anulada_tango"("local_id", "fecha");

-- Bitácora del sync: contador del dataset nuevo.
ALTER TABLE "venta_tango_sync" ADD COLUMN "filas_anuladas" INTEGER NOT NULL DEFAULT 0;
