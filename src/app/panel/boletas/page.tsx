import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { BotonRecalcular } from "./Acciones";

export const dynamic = "force-dynamic";

export default async function PaginaBoletas({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string; grupo?: string }>;
}) {
  await requerirRol("ADMIN");
  const params = await searchParams;

  const ciclos = await db.cicloEscolar.findMany({ orderBy: { fechaInicio: "desc" } });
  if (ciclos.length === 0) {
    return <Alerta tipo="aviso">No hay ciclos escolares registrados.</Alerta>;
  }

  const cicloId = Number(params.ciclo) || ciclos.find((c) => c.estado === "ACTIVO")?.id || ciclos[0].id;

  const grupos = await db.grupo.findMany({
    where: { cicloId },
    orderBy: { nombre: "asc" },
    include: { grado: true },
  });
  const grupoId = Number(params.grupo) || undefined;

  const inscripciones = await db.inscripcion.findMany({
    where: { cicloId, estado: "INSCRITO", ...(grupoId ? { grupoId } : {}) },
    include: {
      alumno: { include: { promedios: { where: { cicloId } } } },
      grupo: true,
    },
    orderBy: [{ alumno: { apellidoPaterno: "asc" } }],
  });

  const ordenados = [...inscripciones].sort((a, b) => {
    const pa = a.alumno.promedios[0]?.posicionRanking ?? Number.MAX_SAFE_INTEGER;
    const pb = b.alumno.promedios[0]?.posicionRanking ?? Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });

  const enCuadroHonor = ordenados.filter((i) => i.alumno.promedios[0]?.cuadroHonor).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Boletas y promedios</h1>
        <p className="mt-1 text-sm text-slate-600">
          El promedio toma la calificacion de cada materia (o su extraordinario) y respeta el peso
          de cada periodo.
        </p>
      </header>

      <Tarjeta>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="etiqueta-campo" htmlFor="ciclo">
              Ciclo escolar
            </label>
            <select id="ciclo" name="ciclo" defaultValue={cicloId} className="campo min-w-[14rem]">
              {ciclos.map((ciclo) => (
                <option key={ciclo.id} value={ciclo.id}>
                  {ciclo.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor="grupo">
              Grupo
            </label>
            <select id="grupo" name="grupo" defaultValue={grupoId ?? ""} className="campo min-w-[12rem]">
              <option value="">Todos</option>
              {grupos.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>
                  {grupo.nombre} · {grupo.grado.nombre}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver
          </button>
        </form>
      </Tarjeta>

      <Tarjeta titulo="Recalcular" descripcion="Corre esto cuando cierres periodos o registres extraordinarios">
        <BotonRecalcular cicloId={cicloId} />
      </Tarjeta>

      <Tarjeta
        titulo="Alumnos"
        descripcion={`${ordenados.length} inscrito(s) · ${enCuadroHonor} en cuadro de honor`}
      >
        {ordenados.length === 0 ? (
          <EstadoVacio titulo="Sin alumnos inscritos en este ciclo" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Lugar</th>
                  <th className="pb-2 pr-4 font-medium">Matricula</th>
                  <th className="pb-2 pr-4 font-medium">Alumno</th>
                  <th className="pb-2 pr-4 font-medium">Grupo</th>
                  <th className="pb-2 pr-4 font-medium">Promedio</th>
                  <th className="pb-2 pr-4 font-medium">Reprobadas</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordenados.map((inscripcion) => {
                  const promedio = inscripcion.alumno.promedios[0];
                  return (
                    <tr key={inscripcion.id}>
                      <td className="py-2 pr-4 text-slate-600">
                        {promedio?.posicionRanking ?? "—"}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-slate-600">
                        {inscripcion.alumno.matricula}
                      </td>
                      <td className="py-2 pr-4 font-medium text-slate-800">
                        {nombreCompleto(inscripcion.alumno)}
                        {promedio?.cuadroHonor && (
                          <span className="ml-2">
                            <Insignia tono="exito">cuadro de honor</Insignia>
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{inscripcion.grupo.nombre}</td>
                      <td className="py-2 pr-4 font-medium text-slate-900">
                        {promedio ? Number(promedio.promedio) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        {promedio?.materiasReprobadas ?? "—"}
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/panel/boletas/${inscripcion.alumnoId}?ciclo=${cicloId}`}
                          className="text-sm font-medium text-marca-600 hover:underline"
                        >
                          Boleta
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
