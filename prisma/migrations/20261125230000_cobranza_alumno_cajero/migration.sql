-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('POR_VERIFICAR', 'CONFIRMADO', 'RECHAZADO');

-- AlterEnum
ALTER TYPE "RolUsuario" ADD VALUE 'CAJERO';

-- CreateTable
CREATE TABLE "ComprobantePago" (
    "id" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fechaPago" DATE NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "referencia" TEXT NOT NULL,
    "banco" TEXT,
    "nota" TEXT,
    "archivoNombre" TEXT NOT NULL,
    "archivoMime" TEXT NOT NULL,
    "archivoTamano" INTEGER NOT NULL,
    "archivoDatos" BYTEA NOT NULL,
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'POR_VERIFICAR',
    "motivoRechazo" TEXT,
    "revisadoPor" INTEGER,
    "revisadoEn" TIMESTAMP(3),
    "pagoId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComprobantePago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComprobantePago_pagoId_key" ON "ComprobantePago"("pagoId");

-- CreateIndex
CREATE INDEX "ComprobantePago_estado_idx" ON "ComprobantePago"("estado");

-- AddForeignKey
ALTER TABLE "ComprobantePago" ADD CONSTRAINT "ComprobantePago_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobantePago" ADD CONSTRAINT "ComprobantePago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

