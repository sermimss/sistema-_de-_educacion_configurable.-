-- CreateEnum
CREATE TYPE "TipoPrograma" AS ENUM ('CARRERA', 'CERTIFICACION');

-- AlterTable
ALTER TABLE "PlanEstudios" ADD COLUMN     "tipo" "TipoPrograma" NOT NULL DEFAULT 'CARRERA',
ADD COLUMN     "tituloOtorga" TEXT;
