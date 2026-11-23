-- CreateTable
CREATE TABLE "Grabacion" (
    "id" SERIAL NOT NULL,
    "claseId" INTEGER NOT NULL,
    "fechaClase" DATE NOT NULL,
    "disponibleHasta" DATE NOT NULL,
    "titulo" TEXT,
    "enlace" TEXT NOT NULL,
    "publicadoPor" INTEGER,
    "autorNombre" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grabacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VistaGrabacion" (
    "id" SERIAL NOT NULL,
    "grabacionId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "veces" INTEGER NOT NULL DEFAULT 1,
    "primeraVez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VistaGrabacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Grabacion_claseId_disponibleHasta_idx" ON "Grabacion"("claseId", "disponibleHasta");

-- CreateIndex
CREATE UNIQUE INDEX "VistaGrabacion_grabacionId_alumnoId_key" ON "VistaGrabacion"("grabacionId", "alumnoId");

-- AddForeignKey
ALTER TABLE "Grabacion" ADD CONSTRAINT "Grabacion_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VistaGrabacion" ADD CONSTRAINT "VistaGrabacion_grabacionId_fkey" FOREIGN KEY ("grabacionId") REFERENCES "Grabacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VistaGrabacion" ADD CONSTRAINT "VistaGrabacion_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
