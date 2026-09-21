import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { FormularioArea, FormularioMateria } from "./Formularios";
import { cambiarEstadoMateria } from "./acciones";

export const dynamic = "force-dynamic";

export default async function PaginaMaterias() {
  await requerirRol("ADMIN");

  const [materias, areas, planes] = await Promise.all([
    db.materia.findMany({
      orderBy: { clave: "asc" },
      include: { area: true, _count: { select: { planes: true } } },
    }),
    db.area.findMany({ orderBy: { nombre: "asc" } }),
    db.planEstudios.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      include: { nivel: true, _count: { select: { materias: true, grados: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Materias</h1>
        <p className="mt-1 text-sm text-slate-600">
          El catalogo es unico; cada materia se coloca luego en el grado que corresponda de cada
          plan de estudios.
        </p>
      </header>

      <Tarjeta titulo="Mapas curriculares" descripcion="Abre un plan para colocar sus materias">
        {planes.length === 0 ? (
          <EstadoVacio titulo="Sin planes de estudio activos" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {planes.map((plan) => (
              <li key={plan.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{plan.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {plan.nivel.nombre} · {plan._count.grados} grados · {plan._count.materias}{" "}
                    materias asignadas
                  </p>
                </div>
                <Link
                  href={`/panel/materias/plan/${plan.id}`}
                  className="text-sm font-medium text-marca-600 hover:underline"
                >
                  Abrir mapa curricular →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Nueva materia">
        <FormularioMateria areas={areas.map((a) => ({ id: a.id, etiqueta: a.nombre }))} />
      </Tarjeta>

      <Tarjeta titulo={`Catalogo de materias (${materias.length})`}>
        {materias.length === 0 ? (
          <EstadoVacio titulo="Sin materias en el catalogo" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Clave</th>
                  <th className="pb-2 pr-4 font-medium">Nombre</th>
                  <th className="pb-2 pr-4 font-medium">Area</th>
                  <th className="pb-2 pr-4 font-medium">En planes</th>
                  <th className="pb-2 pr-4 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materias.map((materia) => (
                  <tr key={materia.id}>
                    <td className="py-2 pr-4 font-mono text-xs text-slate-600">{materia.clave}</td>
                    <td className="py-2 pr-4 font-medium text-slate-800">{materia.nombre}</td>
                    <td className="py-2 pr-4 text-slate-600">{materia.area?.nombre ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{materia._count.planes}</td>
                    <td className="py-2 pr-4">
                      <Insignia tono={materia.activa ? "exito" : "neutro"}>
                        {materia.activa ? "activa" : "inactiva"}
                      </Insignia>
                    </td>
                    <td className="py-2 text-right">
                      <form action={cambiarEstadoMateria}>
                        <input type="hidden" name="materiaId" value={materia.id} />
                        <button
                          type="submit"
                          className="rounded-md px-2 py-1 text-xs font-medium text-marca-600 hover:bg-slate-100"
                        >
                          {materia.activa ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Areas o departamentos" descripcion="Opcionales; sirven para agrupar materias">
        <div className="space-y-4">
          {areas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {areas.map((area) => (
                <Insignia key={area.id}>{area.nombre}</Insignia>
              ))}
            </div>
          )}
          <FormularioArea />
        </div>
      </Tarjeta>
    </div>
  );
}
