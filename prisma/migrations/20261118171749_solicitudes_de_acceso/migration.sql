-- CreateEnum
CREATE TYPE "EstadoSolicitudAcceso" AS ENUM ('PENDIENTE', 'ATENDIDA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "SolicitudAcceso" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "mensaje" TEXT,
    "estado" "EstadoSolicitudAcceso" NOT NULL DEFAULT 'PENDIENTE',
    "ip" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendidaEn" TIMESTAMP(3),
    "atendidaPorId" INTEGER,

    CONSTRAINT "SolicitudAcceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudAcceso_estado_idx" ON "SolicitudAcceso"("estado");

-- CreateIndex
CREATE INDEX "SolicitudAcceso_usuarioId_idx" ON "SolicitudAcceso"("usuarioId");

-- AddForeignKey
ALTER TABLE "SolicitudAcceso" ADD CONSTRAINT "SolicitudAcceso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
