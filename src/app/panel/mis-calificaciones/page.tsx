import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { alumnoDeSesion, bloqueoPorAdeudo } from "@/lib/alumnoSesion";
import { configBool } from "@/lib/configuracion";
import { promedioDePeriodos } from "@/lib/calificaciones";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PaginaMisCalificaciones() {
  const sesion = await requerirRol("ALUMNO");
  const alumno = await alumnoDeSesion(sesion.usuarioId);
  if (!alumno) return <Alerta tipo="error">Tu usuario no esta ligado a un expediente.</Alerta>;

  if (!(await configBool("portales.alumno_ve_calificaciones", true))) {
    return <Alerta tipo="aviso">El colegio tiene desactivada esta seccion.</Alerta>;
  }

  const bloqueo = await bloqueoPorAdeudo(alumno.id, "BOLETA");
  if (bloqueo) return <Alerta tipo="aviso">{bloqueo}</Alerta>;

  const ciclo = await db.cicloEscolar.findFirst({
    where: { estado: "ACTIVO" },
    include: { periodos: { orderBy: { numero: "asc" } } },
  });
  if (!ciclo) return <Alerta tipo="aviso">No hay un ciclo escolar activo.</Alerta>;

  const [clases, escala, promedio] = await Promise.all([
    db.alumnoClase.findMany({
      where: { alumnoId: alumno.id, estado: { not: "BAJA" }, clase: { cicloId: ciclo.id } },
      include: {
        clase: {
          include: {
            planMateria: { include: { materia: true } },
            docente: true,
            calificaciones: { where: { alumnoId: alumno.id } },
          },
        },
      },
    }),
    db.escalaCalificacion.findFirst({ where: { predeterminada: true } }),
    db.promedioCiclo.findUnique({
      where: { alumnoId_cicloId: { alumnoId: alumno.id, cicloId: ciclo.id } },
    }),
  ]);

  const escalaBase = {
    valorMinimo: Number(escala?.valorMinimo ?? 0),
    valorMaximo: Number(escala?.valorMaximo ?? 100),
    decimales: escala?.decimales ?? 2,
    redondeo: escala?.redondeo ?? ("NINGUNO" as const),
    minimaAprobatoria: Number(escala?.minimaAprobatoria ?? 70),
  };
  const pesos = new Map(ciclo.periodos.map((periodo) => [periodo.id, Number(periodo.peso)]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Mis calificaciones</h1>
        <p className="mt-1 text-sm text-slate-600">
          {ciclo.nombre} · aprueba con {escalaBase.minimaAprobatoria}
        </p>
      </header>

      {promedio && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="tarjeta px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Promedio</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{Number(promedio.promedio)}</p>
          </div>
          <div className="tarjeta px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Lugar</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {promedio.posicionRanking ?? "—"}
            </p>
          </div>
          <div className="tarjeta px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Reprobadas</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{promedio.materiasReprobadas}</p>
          </div>
        </div>
      )}

      <Tarjeta titulo="Materias">
        {clases.length === 0 ? (
          <EstadoVacio titulo="No tienes materias en este ciclo" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Materia</th>
                  {ciclo.periodos.map((periodo) => (
                    <th key={periodo.id} className="px-2 pb-2 text-center font-medium">
                      {periodo.nombre}
                    </th>
                  ))}
                  <th className="px-2 pb-2 text-center font-medium">Final</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clases.map((inscripcion) => {
                  const clase = inscripcion.clase;
                  const porPeriodo = new Map(
                    clase.calificaciones.map((calificacion) => [
                      calificacion.periodoId,
                      calificacion.calificacion != null ? Number(calificacion.calificacion) : null,
                    ])
                  );
                  const final =
                    inscripcion.calificacionFinal != null
                      ? Number(inscripcion.calificacionFinal)
                      : promedioDePeriodos(
                          clase.calificaciones.map((calificacion) => ({
                            calificacion:
                              calificacion.calificacion != null
                                ? Number(calificacion.calificacion)
                                : null,
                            peso: pesos.get(calificacion.periodoId) ?? 1,
                          })),
                          escalaBase
                        );
                  return (
                    <tr key={inscripcion.id}>
                      <td className="py-2 pr-3">
                        <p className="text-slate-800">{clase.planMateria.materia.nombre}</p>
                        <p className="text-xs text-slate-500">{nombreCompleto(clase.docente)}</p>
                      </td>
                      {ciclo.periodos.map((periodo) => (
                        <td key={periodo.id} className="px-2 py-2 text-center text-slate-700">
                          {porPeriodo.get(periodo.id) ?? "—"}
                        </td>
                      ))}
                      <td
                        className={`px-2 py-2 text-center font-semibold ${
                          final != null && final < escalaBase.minimaAprobatoria
                            ? "text-red-700"
                            : "text-slate-900"
                        }`}
                      >
                        {final ?? "—"}
                      </td>
                      <td className="py-2">
                        <Insignia
                          tono={
                            inscripcion.estado === "APROBADA"
                              ? "exito"
                              : inscripcion.estado === "REPROBADA"
                                ? "peligro"
                                : "neutro"
                          }
                        >
                          {inscripcion.estado.replace(/_/g, " ").toLowerCase()}
                        </Insignia>
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
