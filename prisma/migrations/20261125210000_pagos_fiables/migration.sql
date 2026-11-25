-- AlterTable
ALTER TABLE "AplicacionPago" ADD COLUMN     "aplicadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "claveCaptura" TEXT,
ADD COLUMN     "efectivoRecibido" DECIMAL(12,2);

-- CreateIndex
CREATE UNIQUE INDEX "Pago_claveCaptura_key" ON "Pago"("claveCaptura");


-- Las aplicaciones que ya existian se hicieron al emitir su recibo.
UPDATE "AplicacionPago" a SET "aplicadaEn" = r."fechaEmision" FROM "Recibo" r WHERE r."pagoId" = a."pagoId";
