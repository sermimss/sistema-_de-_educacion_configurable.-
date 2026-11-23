-- CreateEnum
CREATE TYPE "TipoCambioHorario" AS ENUM ('PERMANENTE', 'UNA_FECHA');

-- CreateEnum
CREATE TYPE "EstadoSolicitudHorario" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "SolicitudHorario" (
    "id" SERIAL NOT NULL,
    "horarioId" INTEGER NOT NULL,
    "tipo" "TipoCambioHorario" NOT NULL,
    "fechaOriginal" DATE,
    "nuevaFecha" DATE,
    "nuevoDia" INTEGER,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "aulaId" INTEGER,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoSolicitudHorario" NOT NULL DEFAULT 'PENDIENTE',
    "respuesta" TEXT,
    "ajustada" BOOLEAN NOT NULL DEFAULT false,
    "solicitadoPor" INTEGER NOT NULL,
    "docenteNombre" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaPor" INTEGER,
    "resueltaEn" TIMESTAMP(3),

    CONSTRAINT "SolicitudHorario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CambioHorarioFecha" (
    "id" SERIAL NOT NULL,
    "horarioId" INTEGER NOT NULL,
    "fechaOriginal" DATE NOT NULL,
    "fechaNueva" DATE NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "aulaId" INTEGER,
    "solicitudId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CambioHorarioFecha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudHorario_estado_idx" ON "SolicitudHorario"("estado");

-- CreateIndex
CREATE INDEX "CambioHorarioFecha_fechaNueva_idx" ON "CambioHorarioFecha"("fechaNueva");

-- CreateIndex
CREATE UNIQUE INDEX "CambioHorarioFecha_horarioId_fechaOriginal_key" ON "CambioHorarioFecha"("horarioId", "fechaOriginal");

-- AddForeignKey
ALTER TABLE "SolicitudHorario" ADD CONSTRAINT "SolicitudHorario_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "HorarioClase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioHorarioFecha" ADD CONSTRAINT "CambioHorarioFecha_horarioId_fkey" FOREIGN KEY ("horarioId") REFERENCES "HorarioClase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
