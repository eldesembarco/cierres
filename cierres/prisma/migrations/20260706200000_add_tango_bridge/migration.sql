-- URL viva del bridge de Tango (auto-registrada por el bridge al levantar el túnel).
CREATE TABLE "tango_bridge" (
    "id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "actualizado_en" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tango_bridge_pkey" PRIMARY KEY ("id")
);
