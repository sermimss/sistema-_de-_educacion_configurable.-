-- CreateTable
CREATE TABLE "ArchivoAviso" (
    "id" SERIAL NOT NULL,
    "avisoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivoAviso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivoTarea" (
    "id" SERIAL NOT NULL,
    "tareaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivoTarea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArchivoAviso_avisoId_idx" ON "ArchivoAviso"("avisoId");

-- CreateIndex
CREATE INDEX "ArchivoTarea_tareaId_idx" ON "ArchivoTarea"("tareaId");

-- AddForeignKey
ALTER TABLE "ArchivoAviso" ADD CONSTRAINT "ArchivoAviso_avisoId_fkey" FOREIGN KEY ("avisoId") REFERENCES "Aviso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivoTarea" ADD CONSTRAINT "ArchivoTarea_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

