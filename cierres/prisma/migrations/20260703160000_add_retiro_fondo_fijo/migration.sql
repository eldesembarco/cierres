-- Efectivo guardado para el fondo fijo (recupero) por turno.
ALTER TABLE "cierres" ADD COLUMN "retiro_fondo_fijo" DECIMAL(14,2) NOT NULL DEFAULT 0;
