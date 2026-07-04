-- BI de ventas (fuente Tango): agregados por hora y por artículo + bitácora de sync.
CREATE TABLE "venta_tango_hora" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" INTEGER NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tickets" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "venta_tango_hora_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "venta_tango_hora_local_id_fecha_hora_key" ON "venta_tango_hora"("local_id", "fecha", "hora");
CREATE INDEX "venta_tango_hora_fecha_idx" ON "venta_tango_hora"("fecha");

ALTER TABLE "venta_tango_hora" ADD CONSTRAINT "venta_tango_hora_local_id_fkey"
    FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "venta_tango_articulo" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "rubro" TEXT,
    "cantidad" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "monto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    CONSTRAINT "venta_tango_articulo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "venta_tango_articulo_local_id_fecha_codigo_key" ON "venta_tango_articulo"("local_id", "fecha", "codigo");
CREATE INDEX "venta_tango_articulo_fecha_idx" ON "venta_tango_articulo"("fecha");

ALTER TABLE "venta_tango_articulo" ADD CONSTRAINT "venta_tango_articulo_local_id_fkey"
    FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "venta_tango_sync" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "filas_horas" INTEGER NOT NULL DEFAULT 0,
    "filas_articulos" INTEGER NOT NULL DEFAULT 0,
    "sincronizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "venta_tango_sync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "venta_tango_sync_fecha_key" ON "venta_tango_sync"("fecha");
