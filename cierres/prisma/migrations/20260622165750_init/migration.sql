-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('encargado', 'central', 'admin');

-- CreateEnum
CREATE TYPE "EstadoCierre" AS ENUM ('borrador', 'cerrado');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('T1', 'T2');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('efectivo', 'tarjetas', 'rappi', 'pedidosya', 'mercadopago', 'uber', 'delivery_propio', 'varios');

-- CreateTable
CREATE TABLE "marcas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "marcas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locales" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "marca_id" INTEGER NOT NULL,
    "direccion" TEXT,
    "ciudad" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'AR',
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "fondo_fijo_default" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plataformas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plataformas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_plataforma" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "plataforma_id" INTEGER NOT NULL,
    "restaurant_id_externo" TEXT NOT NULL,
    "nombre_externo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "local_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "local_id" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierres" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "fondo_fijo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gastos_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "nota_credito" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cantidad_tickets" INTEGER,
    "estado" "EstadoCierre" NOT NULL DEFAULT 'borrador',
    "nota" TEXT,
    "creado_por" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    "cerrado_por" INTEGER,
    "cerrado_en" TIMESTAMP(3),

    CONSTRAINT "cierres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_turnos" (
    "id" SERIAL NOT NULL,
    "cierre_id" INTEGER NOT NULL,
    "turno" "Turno" NOT NULL,
    "monto_z" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "cierre_turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierre_ventas" (
    "id" SERIAL NOT NULL,
    "cierre_id" INTEGER NOT NULL,
    "canal" "Canal" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "cierre_ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_app" (
    "id" SERIAL NOT NULL,
    "local_id" INTEGER NOT NULL,
    "plataforma_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "pedidos_efectivo" INTEGER NOT NULL DEFAULT 0,
    "pedidos_online" INTEGER NOT NULL DEFAULT 0,
    "venta_efectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "venta_online" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "importacion_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventas_app_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importaciones" (
    "id" SERIAL NOT NULL,
    "plataforma_id" INTEGER NOT NULL,
    "fecha_reporte" DATE NOT NULL,
    "archivo_nombre" TEXT NOT NULL,
    "filas_total" INTEGER NOT NULL,
    "filas_mapeadas" INTEGER NOT NULL,
    "filas_sin_mapear" INTEGER NOT NULL,
    "subido_por" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacion_sin_mapear" (
    "id" SERIAL NOT NULL,
    "importacion_id" INTEGER NOT NULL,
    "plataforma_id" INTEGER NOT NULL,
    "restaurant_id_externo" TEXT NOT NULL,
    "nombre_externo" TEXT,
    "venta_efectivo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "venta_online" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "importacion_sin_mapear_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marcas_nombre_key" ON "marcas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "plataformas_nombre_key" ON "plataformas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "plataformas_codigo_key" ON "plataformas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "local_plataforma_plataforma_id_restaurant_id_externo_key" ON "local_plataforma"("plataforma_id", "restaurant_id_externo");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_local_id_fecha_key" ON "cierres"("local_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_turnos_cierre_id_turno_key" ON "cierre_turnos"("cierre_id", "turno");

-- CreateIndex
CREATE UNIQUE INDEX "cierre_ventas_cierre_id_canal_key" ON "cierre_ventas"("cierre_id", "canal");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_app_local_id_plataforma_id_fecha_key" ON "ventas_app"("local_id", "plataforma_id", "fecha");

-- AddForeignKey
ALTER TABLE "locales" ADD CONSTRAINT "locales_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "marcas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_plataforma" ADD CONSTRAINT "local_plataforma_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_plataforma" ADD CONSTRAINT "local_plataforma_plataforma_id_fkey" FOREIGN KEY ("plataforma_id") REFERENCES "plataformas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres" ADD CONSTRAINT "cierres_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_turnos" ADD CONSTRAINT "cierre_turnos_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierre_ventas" ADD CONSTRAINT "cierre_ventas_cierre_id_fkey" FOREIGN KEY ("cierre_id") REFERENCES "cierres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_app" ADD CONSTRAINT "ventas_app_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_app" ADD CONSTRAINT "ventas_app_plataforma_id_fkey" FOREIGN KEY ("plataforma_id") REFERENCES "plataformas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_app" ADD CONSTRAINT "ventas_app_importacion_id_fkey" FOREIGN KEY ("importacion_id") REFERENCES "importaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones" ADD CONSTRAINT "importaciones_plataforma_id_fkey" FOREIGN KEY ("plataforma_id") REFERENCES "plataformas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacion_sin_mapear" ADD CONSTRAINT "importacion_sin_mapear_importacion_id_fkey" FOREIGN KEY ("importacion_id") REFERENCES "importaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
