-- Dimensión de sucursales de Tango (propias + franquicias) y re-clave de los
-- hechos Tango por sucursal. localId queda como link opcional a locales propios.

CREATE TABLE "sucursal_tango" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "marca" TEXT NOT NULL DEFAULT 'D',
    "es_propia" BOOLEAN NOT NULL DEFAULT false,
    "local_id" INTEGER,
    CONSTRAINT "sucursal_tango_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sucursal_tango_local_id_key" ON "sucursal_tango"("local_id");

-- Seed de las sucursales PROPIAS desde los locales mapeados de la app cierres.
INSERT INTO "sucursal_tango" ("id", "nombre", "marca", "es_propia", "local_id")
SELECT l."tango_sucursal_id", l."nombre",
       CASE WHEN m."nombre" ILIKE '%tasty%' OR m."nombre" ILIKE '%mila%' THEN 'T' ELSE 'D' END,
       true, l."id"
FROM "locales" l JOIN "marcas" m ON m."id" = l."marca_id"
WHERE l."tango_sucursal_id" IS NOT NULL;

-- Columna sucursal_id + local_id opcional en los 4 hechos.
ALTER TABLE "venta_tango_hora"      ADD COLUMN "sucursal_id" INTEGER, ALTER COLUMN "local_id" DROP NOT NULL;
ALTER TABLE "venta_tango_articulo"  ADD COLUMN "sucursal_id" INTEGER, ALTER COLUMN "local_id" DROP NOT NULL;
ALTER TABLE "consumo_insumo_tango"  ADD COLUMN "sucursal_id" INTEGER, ALTER COLUMN "local_id" DROP NOT NULL;
ALTER TABLE "comanda_anulada_tango" ADD COLUMN "sucursal_id" INTEGER, ALTER COLUMN "local_id" DROP NOT NULL;

-- Backfill: las filas existentes son todas de locales propios.
UPDATE "venta_tango_hora"      f SET "sucursal_id" = st."id" FROM "sucursal_tango" st WHERE st."local_id" = f."local_id";
UPDATE "venta_tango_articulo"  f SET "sucursal_id" = st."id" FROM "sucursal_tango" st WHERE st."local_id" = f."local_id";
UPDATE "consumo_insumo_tango"  f SET "sucursal_id" = st."id" FROM "sucursal_tango" st WHERE st."local_id" = f."local_id";
UPDATE "comanda_anulada_tango" f SET "sucursal_id" = st."id" FROM "sucursal_tango" st WHERE st."local_id" = f."local_id";

-- FKs (opcionales: ON DELETE SET NULL, como genera Prisma para relaciones ?).
ALTER TABLE "venta_tango_hora"      ADD CONSTRAINT "venta_tango_hora_sucursal_id_fkey"      FOREIGN KEY ("sucursal_id") REFERENCES "sucursal_tango"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "venta_tango_articulo"  ADD CONSTRAINT "venta_tango_articulo_sucursal_id_fkey"  FOREIGN KEY ("sucursal_id") REFERENCES "sucursal_tango"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consumo_insumo_tango"  ADD CONSTRAINT "consumo_insumo_tango_sucursal_id_fkey"  FOREIGN KEY ("sucursal_id") REFERENCES "sucursal_tango"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comanda_anulada_tango" ADD CONSTRAINT "comanda_anulada_tango_sucursal_id_fkey" FOREIGN KEY ("sucursal_id") REFERENCES "sucursal_tango"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Uniques nuevos por sucursal (reemplazan a los de local).
DROP INDEX "venta_tango_hora_local_id_fecha_hora_key";
DROP INDEX "venta_tango_articulo_local_id_fecha_codigo_key";
DROP INDEX "consumo_insumo_tango_local_id_fecha_codigo_key";
CREATE UNIQUE INDEX "venta_tango_hora_sucursal_id_fecha_hora_key"     ON "venta_tango_hora"("sucursal_id", "fecha", "hora");
CREATE UNIQUE INDEX "venta_tango_articulo_sucursal_id_fecha_codigo_key" ON "venta_tango_articulo"("sucursal_id", "fecha", "codigo");
CREATE UNIQUE INDEX "consumo_insumo_tango_sucursal_id_fecha_codigo_key" ON "consumo_insumo_tango"("sucursal_id", "fecha", "codigo");
CREATE INDEX "comanda_anulada_tango_sucursal_id_fecha_idx" ON "comanda_anulada_tango"("sucursal_id", "fecha");
