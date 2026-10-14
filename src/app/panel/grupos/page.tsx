import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { catalogosEscolares, nombreCompleto } from "@/lib/catalogos";
import { formatearDia } from "@/lib/formato";
import { configTexto } from "@/lib/configuracion";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { FormularioNuevoGrupo } from "./Formularios";

export const dynamic = "force-dynamic";

export default async function PaginaGrupos() {
  await requerirRol("ADMIN");
  const catalogos = await catalogosEscolares();
  const sugerencia = await configTexto("academico.nombre_grupo_sugerido", "{GRADO}{LETRA}");

  const [grupos, planes, docentes] = await Promise.all([
    db.grupo.findMany({
      orderBy: [{ ciclo: { fechaInicio: "desc" } }, { nombre: "asc" }],
      include: {
        ciclo: true,
        plan: { include: { nivel: true } },
        grado: true,
        turno: true,
        _count: { select: { clases: true, inscripciones: true } },
      },
    }),
    db.planEstudios.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      include: {
        nivel: true,
        grados: {
          orderBy: { numero: "asc" },
          include: { materias: { include: { materia: true }, orderBy: { orden: "asc" } } },
        },
      },
    }),
    db.empleado.findMany({
      where: { esDocente: true, estado: "ACTIVO" },
      orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
    }),
  ]);

  const hayPlanes = planes.length > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Grupos y clases</h1>
        <p className="mt-1 text-sm text-slate-600">{grupos.length} grupo(s) registrados</p>
      </header>

      {!hayPlanes ? (
        <Alerta tipo="aviso">Para crear grupos necesitas al menos un plan de estudios.</Alerta>
      ) : (
        <Tarjeta titulo="Nuevo grupo">
          <FormularioNuevoGrupo
            sugerencia={sugerencia}
            docentes={docentes.map((d) => ({
              id: d.id,
              etiqueta: `${nombreCompleto(d)} (${d.numeroEmpleado})`,
            }))}
            planteles={catalogos.planteles.map((p) => ({ id: p.id, etiqueta: p.nombre }))}
            turnos={catalogos.turnos.map((t) => ({ id: t.id, etiqueta: t.nombre }))}
            aulas={catalogos.aulas.map((a) => ({ id: a.id, etiqueta: a.nombre }))}
            planes={planes.map((plan) => ({
              id: plan.id,
              nombre: plan.nombre,
              nivel: plan.nivel.nombre,
              grados: plan.grados.map((g) => ({
                id: g.id,
                nombre: g.nombre,
                materias: g.materias.map((m) => ({
                  id: m.id,
                  etiqueta: `${m.materia.clave} · ${m.materia.nombre}`,
                })),
              })),
            }))}
          />
        </Tarjeta>
      )}

      <Tarjeta titulo="Grupos">
        {grupos.length === 0 ? (
          <EstadoVacio titulo="Sin grupos" mensaje="Crea el primer grupo con el formulario de arriba." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Grupo</th>
                  <th className="pb-2 pr-4 font-medium">Clases</th>
                  <th className="pb-2 pr-4 font-medium">Plan y grado</th>
                  <th className="pb-2 pr-4 font-medium">Turno</th>
                  <th className="pb-2 pr-4 font-medium">Materias</th>
                  <th className="pb-2 pr-4 font-medium">Alumnos</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grupos.map((grupo) => (
                  <tr key={grupo.id}>
                    <td className="py-2 pr-4 font-medium text-slate-800">
                      {grupo.nombre}
                      {!grupo.activo && (
                        <span className="ml-2">
                          <Insignia tono="neutro">inactivo</Insignia>
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">
                      {formatearDia(grupo.ciclo.fechaInicio)} — {formatearDia(grupo.ciclo.fechaFin)}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">
                      {grupo.plan.nombre} · {grupo.grado.nombre}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{grupo.turno?.nombre ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{grupo._count.clases}</td>
                    <td className="py-2 pr-4 text-slate-600">
                      {grupo._count.inscripciones}
                      {grupo.cupoMaximo ? ` / ${grupo.cupoMaximo}` : ""}
                    </td>
                    <td className="py-2 text-right">
                      <Link
                        href={`/panel/grupos/${grupo.id}`}
                        className="text-sm font-medium text-marca-600 hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
