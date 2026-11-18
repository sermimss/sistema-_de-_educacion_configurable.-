import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { aceptaNuevoIngreso, etiquetaModalidad } from "@/lib/modalidad";
import { Alerta, Insignia, Tarjeta } from "@/components/ui";
import { FormularioModalidad } from "./FormularioModalidad";

export const dynamic = "force-dynamic";

export default async function PaginaModalidadPlan({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cambiado?: string; anterior?: string }>;
}) {
  await requerirRol("ADMIN");
  const { id } = await params;
  const { cambiado, anterior } = await searchParams;
  const plan = await db.planEstudios.findUnique({
    where: { id: Number(id) || 0 },
    include: {
      nivel: true,
      grados: { orderBy: { numero: "asc" }, include: { _count: { select: { materias: true } } } },
      _count: { select: { grupos: true, alumnos: true, materias: true } },
    },
  });
  if (!plan) notFound();
  const planAnterior = anterior ? await db.planEstudios.findUnique({ where: { id: Number(anterior) || 0 } }) : null;
  const enUso = plan._count.grupos + plan._count.alumnos > 0;

  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/academico" className="text-sm text-marca-600 hover:underline">← Estructura academica</Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          {plan.nombre} <span className="text-slate-400">({plan.clave})</span>
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          {plan.nivel.nombre} · <Insignia>{etiquetaModalidad(plan.modalidad)}</Insignia> {plan.duracionPeriodos} periodos ·{" "}
          {plan._count.materias} materias · {plan._count.alumnos} alumno(s) · {plan._count.grupos} grupo(s)
          {!aceptaNuevoIngreso(plan) && <Insignia tono="alerta">sin nuevo ingreso</Insignia>}
        </p>
      </header>

      {cambiado === "convertido" && (
        <Alerta tipo="exito">
          Plan convertido a {etiquetaModalidad(plan.modalidad).toLowerCase()}.{" "}
          <Link href={`/panel/materias/plan/${plan.id}`} className="font-medium underline">Revisa el mapa curricular</Link>{" "}
          para acomodar las materias en sus periodos.
        </Alerta>
      )}
      {cambiado === "version" && (
        <Alerta tipo="exito">
          Se creo este plan {etiquetaModalidad(plan.modalidad).toLowerCase()}
          {planAnterior ? ` como version nueva de ${planAnterior.clave}` : ""}. Los alumnos de nuevo ingreso ya entran
          aqui; los actuales terminan en su plan.{" "}
          <Link href={`/panel/materias/plan/${plan.id}`} className="font-medium underline">Revisa el mapa curricular</Link>.
        </Alerta>
      )}

      <Tarjeta titulo="Periodos del plan">
        <div className="flex flex-wrap gap-1.5">
          {plan.grados.map((g) => (
            <span key={g.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {g.nombre} · {g._count.materias} materia(s)
            </span>
          ))}
        </div>
      </Tarjeta>

      {aceptaNuevoIngreso(plan) ? (
        <Tarjeta titulo="Cambiar de modalidad" descripcion="Por ejemplo, de semestral a cuatrimestral.">
          <FormularioModalidad
            plan={{
              id: plan.id,
              nombre: plan.nombre,
              clave: plan.clave,
              modalidad: plan.modalidad,
              periodos: plan.duracionPeriodos,
            }}
            enUso={enUso}
          />
        </Tarjeta>
      ) : (
        <Alerta tipo="info">
          Este plan ya fue reemplazado por una version nueva: solo sigue para los alumnos que lo cursan.
        </Alerta>
      )}
    </div>
  );
}
