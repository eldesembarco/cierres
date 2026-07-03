-- CreateTable: reposiciones del fondo fijo (caja chica) por local.
CREATE TABLE "reposicion_fondo_fijo" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "descripcion" TEXT,
    "creado_por" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reposicion_fondo_fijo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reposicion_fondo_fijo_local_id_idx" ON "reposicion_fondo_fijo"("local_id");
ALTER TABLE "reposicion_fondo_fijo" ADD CONSTRAINT "reposicion_fondo_fijo_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
