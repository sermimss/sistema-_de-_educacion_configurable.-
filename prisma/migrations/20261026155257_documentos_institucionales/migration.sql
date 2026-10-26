-- CreateEnum
CREATE TYPE "TipoArchivoInstitucional" AS ENUM ('LOGO', 'FIRMA', 'SELLO');

-- CreateEnum
CREATE TYPE "CategoriaDocumento" AS ENUM ('ALUMNO', 'PERSONAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "EstadoSolicitudDocumento" AS ENUM ('PENDIENTE', 'ATENDIDA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "Institucion" ADD COLUMN     "logoArchivoId" INTEGER;

-- CreateTable
CREATE TABLE "ArchivoInstitucional" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoArchivoInstitucional" NOT NULL,
    "nombre" TEXT,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivoInstitucional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Firmante" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "firmaId" INTEGER,
    "selloId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Firmante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantillaDocumento" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaDocumento" NOT NULL,
    "descripcion" TEXT,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "camposExtra" JSONB NOT NULL DEFAULT '[]',
    "prefijoFolio" TEXT NOT NULL,
    "firmanteId" INTEGER,
    "alumnoPuedeSolicitar" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "delSistema" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantillaDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoEmitido" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "plantillaId" INTEGER NOT NULL,
    "alumnoId" INTEGER,
    "empleadoId" INTEGER,
    "destinatario" TEXT,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "datos" JSONB NOT NULL DEFAULT '{}',
    "firmanteNombre" TEXT,
    "firmanteCargo" TEXT,
    "firmaId" INTEGER,
    "selloId" INTEGER,
    "emitidoPorId" INTEGER NOT NULL,
    "emitidoPorNombre" TEXT NOT NULL,
    "emitidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solicitudId" INTEGER,
    "cancelado" BOOLEAN NOT NULL DEFAULT false,
    "motivoCancelacion" TEXT,

    CONSTRAINT "DocumentoEmitido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudDocumento" (
    "id" SERIAL NOT NULL,
    "plantillaId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "motivo" TEXT,
    "estado" "EstadoSolicitudDocumento" NOT NULL DEFAULT 'PENDIENTE',
    "respuesta" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendidaEn" TIMESTAMP(3),

    CONSTRAINT "SolicitudDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaDocumento_clave_key" ON "PlantillaDocumento"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoEmitido_folio_key" ON "DocumentoEmitido"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoEmitido_solicitudId_key" ON "DocumentoEmitido"("solicitudId");

-- CreateIndex
CREATE INDEX "DocumentoEmitido_alumnoId_idx" ON "DocumentoEmitido"("alumnoId");

-- CreateIndex
CREATE INDEX "DocumentoEmitido_empleadoId_idx" ON "DocumentoEmitido"("empleadoId");

-- CreateIndex
CREATE INDEX "DocumentoEmitido_emitidoEn_idx" ON "DocumentoEmitido"("emitidoEn");

-- CreateIndex
CREATE INDEX "SolicitudDocumento_estado_idx" ON "SolicitudDocumento"("estado");

-- CreateIndex
CREATE INDEX "SolicitudDocumento_alumnoId_idx" ON "SolicitudDocumento"("alumnoId");

-- AddForeignKey
ALTER TABLE "Firmante" ADD CONSTRAINT "Firmante_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "ArchivoInstitucional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firmante" ADD CONSTRAINT "Firmante_selloId_fkey" FOREIGN KEY ("selloId") REFERENCES "ArchivoInstitucional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantillaDocumento" ADD CONSTRAINT "PlantillaDocumento_firmanteId_fkey" FOREIGN KEY ("firmanteId") REFERENCES "Firmante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoEmitido" ADD CONSTRAINT "DocumentoEmitido_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "PlantillaDocumento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoEmitido" ADD CONSTRAINT "DocumentoEmitido_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoEmitido" ADD CONSTRAINT "DocumentoEmitido_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoEmitido" ADD CONSTRAINT "DocumentoEmitido_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudDocumento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudDocumento" ADD CONSTRAINT "SolicitudDocumento_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "PlantillaDocumento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudDocumento" ADD CONSTRAINT "SolicitudDocumento_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
