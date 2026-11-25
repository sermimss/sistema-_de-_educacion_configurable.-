import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { Alerta, Tarjeta } from "@/components/ui";
import { FormularioNuevoPrograma } from "../FormulariosPrograma";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoPrograma({ searchParams }: { searchParams: Promise<{ nivel?: string }> }) {
  await requerirRol("ADMIN");
  const { nivel } = await searchParams;
  const niveles = await db.nivelEducativo.findMany({
    where: { activo: true },
    orderBy: { orden: "asc" },
    select: { id: true, nombre: true, tipoPeriodo: true },
  });
  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/academico" className="text-sm text-marca-600 hover:underline">← Estructura academica</Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Nueva carrera o certificacion</h1>
        <p className="mt-1 text-sm text-slate-600">
          Una carrera es un programa completo; una certificacion, un programa corto como un diplomado o curso. Las dos
          tienen periodos, materias, grupos, calificaciones y cobros.
        </p>
      </header>
      {niveles.length === 0 ? (
        <Alerta tipo="aviso">
          Primero crea un nivel en <Link href="/panel/academico" className="font-medium underline">Estructura academica</Link>.
        </Alerta>
      ) : (
        <Tarjeta>
          <FormularioNuevoPrograma niveles={niveles} nivelInicial={Number(nivel) || undefined} />
        </Tarjeta>
      )}
    </div>
  );
}
