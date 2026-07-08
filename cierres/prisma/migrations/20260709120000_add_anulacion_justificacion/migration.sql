-- Justificación de comandas anuladas, cargada por el local. Tabla propia porque
-- comanda_anulada_tango se borra/reinserta en cada resync: la clave natural
-- (local_id, fecha_hora, importe) re-vincula la justificación tras el resync.
CREATE TABLE "anulacion_justificacion" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle" TEXT,
    "creado_por" INTEGER NOT NULL,
    "creado_por_nombre" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anulacion_justificacion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "anulacion_justificacion_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id")
);
CREATE UNIQUE INDEX "anulacion_justificacion_local_id_fecha_hora_importe_key"
    ON "anulacion_justificacion"("local_id", "fecha_hora", "importe");
