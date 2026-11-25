-- CreateEnum
CREATE TYPE "EstadoTurnoCaja" AS ENUM ('ABIERTO', 'CERRADO');

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "registradoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "turnoId" INTEGER;

-- CreateTable
CREATE TABLE "TurnoCaja" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "abiertoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fondoInicial" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoTurnoCaja" NOT NULL DEFAULT 'ABIERTO',
    "cerradoEn" TIMESTAMP(3),
    "efectivoEsperado" DECIMAL(12,2),
    "efectivoContado" DECIMAL(12,2),
    "diferencia" DECIMAL(12,2),
    "notasCierre" TEXT,

    CONSTRAINT "TurnoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TurnoCaja_usuarioId_estado_idx" ON "TurnoCaja"("usuarioId", "estado");

-- CreateIndex
CREATE INDEX "Pago_turnoId_idx" ON "Pago"("turnoId");

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "TurnoCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Los pagos anteriores se capturaron en su fecha.
UPDATE "Pago" SET "registradoEn" = "fecha";
