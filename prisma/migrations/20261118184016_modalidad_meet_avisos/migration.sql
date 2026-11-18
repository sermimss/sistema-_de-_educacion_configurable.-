-- AlterTable
ALTER TABLE "Aviso" ADD COLUMN     "autorNombre" TEXT,
ADD COLUMN     "claseId" INTEGER;

-- AlterTable
ALTER TABLE "Clase" ADD COLUMN     "enlaceReunion" TEXT;

-- AlterTable
ALTER TABLE "PlanEstudios" ADD COLUMN     "modalidad" "TipoPeriodoAcademico" NOT NULL DEFAULT 'SEMESTRE';

-- Los planes que ya existen toman la modalidad de su nivel, que era donde
-- vivia antes.
UPDATE "PlanEstudios" p
   SET "modalidad" = n."tipoPeriodo"
  FROM "NivelEducativo" n
 WHERE p."nivelId" = n."id";
