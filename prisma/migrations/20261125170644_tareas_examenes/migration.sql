-- CreateEnum
CREATE TYPE "TipoPregunta" AS ENUM ('OPCION_UNICA', 'OPCION_MULTIPLE', 'VERDADERO_FALSO', 'ABIERTA');

-- CreateEnum
CREATE TYPE "MostrarRespuestas" AS ENUM ('NUNCA', 'AL_TERMINAR', 'AL_CERRAR');

-- CreateTable
CREATE TABLE "Tarea" (
    "id" SERIAL NOT NULL,
    "claseId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "instrucciones" TEXT NOT NULL,
    "puntosMaximos" DECIMAL(6,2) NOT NULL DEFAULT 10,
    "fechaLimite" TIMESTAMP(3) NOT NULL,
    "aceptaTardias" BOOLEAN NOT NULL DEFAULT false,
    "creadaPor" INTEGER,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaTarea" (
    "id" SERIAL NOT NULL,
    "tareaId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "texto" TEXT,
    "entregadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tarde" BOOLEAN NOT NULL DEFAULT false,
    "calificacion" DECIMAL(6,2),
    "comentario" TEXT,
    "calificadaEn" TIMESTAMP(3),
    "calificadaPor" INTEGER,

    CONSTRAINT "EntregaTarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivoEntrega" (
    "id" SERIAL NOT NULL,
    "entregaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivoEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Examen" (
    "id" SERIAL NOT NULL,
    "claseId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "instrucciones" TEXT,
    "abreEn" TIMESTAMP(3) NOT NULL,
    "cierraEn" TIMESTAMP(3) NOT NULL,
    "duracionMinutos" INTEGER,
    "aceptaTardios" BOOLEAN NOT NULL DEFAULT false,
    "desordenar" BOOLEAN NOT NULL DEFAULT false,
    "mostrarRespuestas" "MostrarRespuestas" NOT NULL DEFAULT 'NUNCA',
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "creadoPor" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Examen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreguntaExamen" (
    "id" SERIAL NOT NULL,
    "examenId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" "TipoPregunta" NOT NULL,
    "enunciado" TEXT NOT NULL,
    "puntos" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "PreguntaExamen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpcionPregunta" (
    "id" SERIAL NOT NULL,
    "preguntaId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "correcta" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpcionPregunta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentoExamen" (
    "id" SERIAL NOT NULL,
    "examenId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "iniciadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceEn" TIMESTAMP(3),
    "enviadoEn" TIMESTAMP(3),
    "tarde" BOOLEAN NOT NULL DEFAULT false,
    "orden" JSONB NOT NULL,
    "puntaje" DECIMAL(7,2),
    "porRevisar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IntentoExamen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespuestaExamen" (
    "id" SERIAL NOT NULL,
    "intentoId" INTEGER NOT NULL,
    "preguntaId" INTEGER NOT NULL,
    "opciones" INTEGER[],
    "texto" TEXT,
    "puntos" DECIMAL(6,2),
    "comentario" TEXT,

    CONSTRAINT "RespuestaExamen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tarea_claseId_idx" ON "Tarea"("claseId");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaTarea_tareaId_alumnoId_key" ON "EntregaTarea"("tareaId", "alumnoId");

-- CreateIndex
CREATE INDEX "Examen_claseId_idx" ON "Examen"("claseId");

-- CreateIndex
CREATE UNIQUE INDEX "IntentoExamen_examenId_alumnoId_key" ON "IntentoExamen"("examenId", "alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "RespuestaExamen_intentoId_preguntaId_key" ON "RespuestaExamen"("intentoId", "preguntaId");

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaTarea" ADD CONSTRAINT "EntregaTarea_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaTarea" ADD CONSTRAINT "EntregaTarea_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivoEntrega" ADD CONSTRAINT "ArchivoEntrega_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "EntregaTarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreguntaExamen" ADD CONSTRAINT "PreguntaExamen_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpcionPregunta" ADD CONSTRAINT "OpcionPregunta_preguntaId_fkey" FOREIGN KEY ("preguntaId") REFERENCES "PreguntaExamen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentoExamen" ADD CONSTRAINT "IntentoExamen_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentoExamen" ADD CONSTRAINT "IntentoExamen_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespuestaExamen" ADD CONSTRAINT "RespuestaExamen_intentoId_fkey" FOREIGN KEY ("intentoId") REFERENCES "IntentoExamen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespuestaExamen" ADD CONSTRAINT "RespuestaExamen_preguntaId_fkey" FOREIGN KEY ("preguntaId") REFERENCES "PreguntaExamen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
