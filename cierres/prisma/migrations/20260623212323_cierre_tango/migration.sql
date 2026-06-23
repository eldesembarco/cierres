-- CreateTable
CREATE TABLE "cierre_tango" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "turno" "Turno" NOT NULL,
    "ventas" JSONB NOT NULL,
    "monto_z" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cantidad_tickets" INTEGER,
    "recibido_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierre_tango_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cierre_tango_local_id_fecha_turno_key" ON "cierre_tango"("local_id", "fecha", "turno");

-- AddForeignKey
ALTER TABLE "cierre_tango" ADD CONSTRAINT "cierre_tango_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
