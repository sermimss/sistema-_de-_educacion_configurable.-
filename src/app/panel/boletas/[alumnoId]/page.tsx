import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { obtenerInstitucion } from "@/lib/institucion";
import { configNumero } from "@/lib/configuracion";
import { faltasEfectivas, porcentajeAsistencia } from "@/lib/asistencia";
import { promedioDePeriodos } from "@/lib/calificaciones";
import { formatearFecha } from "@/lib/formato";
import { Alerta } from "@/components/ui";
import { BotonImprimir } from "../Acciones";

export const dynamic = "force-dynamic";

export default async function PaginaBoleta({
  params,
  searchParams,
}: {
  params: Promise<{ alumnoId: string }>;
  searchParams: Promise<{ ciclo?: string }>;
}) {
  await requerirRol("ADMIN", "DOCENTE");
  const { alumnoId } = await params;
  const { ciclo: cicloParam } = await searchParams;
  const id = Number(alumnoId);
  if (!Number.isFinite(id)) notFound();

  const institucion = await obtenerInstitucion();
  const alumno = await db.alumno.findUnique({
    where: { id },
    include: { plan: { include: { nivel: true } }, plantel: true, turno: true },
  });
  if (!alumno) notFound();

  const cicloId =
    Number(cicloParam) ||
    (await db.cicloEscolar.findFirst({ where: { estado: "ACTIVO" } }))?.id ||
    0;

  const [ciclo, inscripcion, escala, retardosPorFalta] = await Promise.all([
    db.cicloEscolar.findUnique({
      where: { id: cicloId },
      include: { periodos: { orderBy: { numero: "asc" } } },
    }),
    db.inscripcion.findUnique({
      where: { alumnoId_cicloId: { alumnoId: id, cicloId } },
      include: { grupo: true, grado: true },
    }),
    db.escalaCalificacion.findFirst({ where: { predeterminada: true } }),
    configNumero("asistencia.retardos_equivalen_falta", 3),
  ]);

  if (!ciclo) return <Alerta tipo="aviso">El ciclo escolar no existe.</Alerta>;

  const escalaBase = {
    valorMinimo: Number(escala?.valorMinimo ?? 0),
    valorMaximo: Number(escala?.valorMaximo ?? 100),
    decimales: escala?.decimales ?? 2,
    redondeo: escala?.redondeo ?? ("NINGUNO" as const),
    minimaAprobatoria: Number(escala?.minimaAprobatoria ?? 70),
  };

  const [clases, promedio, registrosAsistencia] = await Promise.all([
    db.alumnoClase.findMany({
      where: { alumnoId: id, estado: { not: "BAJA" }, clase: { cicloId } },
      include: {
        clase: {
          include: {
            planMateria: { include: { materia: true } },
            docente: true,
            calificaciones: { where: { alumnoId: id } },
            extraordinarios: { where: { alumnoId: id }, orderBy: { fecha: "desc" } },
          },
        },
      },
    }),
    db.promedioCiclo.findUnique({ where: { alumnoId_cicloId: { alumnoId: id, cicloId } } }),
    db.registroAsistencia.findMany({
      where: { alumnoId: id, sesion: { OR: [{ clase: { cicloId } }, { grupo: { cicloId } }] } },
    }),
  ]);

  const pesoPorPeriodo = new Map(ciclo.periodos.map((periodo) => [periodo.id, Number(periodo.peso)]));
  const faltas = faltasEfectivas(registrosAsistencia, retardosPorFalta);
  const asistencia = porcentajeAsistencia(registrosAsistencia);

  const filas = clases
    .map((inscripcionClase) => {
      const clase = inscripcionClase.clase;
      const porPeriodo = new Map(
        clase.calificaciones.map((calificacion) => [
          calificacion.periodoId,
          calificacion.calificacion != null ? Number(calificacion.calificacion) : null,
        ])
      );
      const extraordinario = clase.extraordinarios[0];
      const final =
        inscripcionClase.calificacionFinal != null
          ? Number(inscripcionClase.calificacionFinal)
          : extraordinario
            ? Number(extraordinario.calificacion)
            : promedioDePeriodos(
                clase.calificaciones.map((calificacion) => ({
                  calificacion:
                    calificacion.calificacion != null ? Number(calificacion.calificacion) : null,
                  peso: pesoPorPeriodo.get(calificacion.periodoId) ?? 1,
                })),
                escalaBase
              );

      return {
        materia: clase.planMateria.materia.nombre,
        clave: clase.planMateria.materia.clave,
        docente: nombreCompleto(clase.docente),
        creditos: clase.planMateria.creditos,
        porPeriodo,
        final,
        extraordinario: extraordinario ? Number(extraordinario.calificacion) : null,
        estado: inscripcionClase.estado,
      };
    })
    .sort((a, b) => a.materia.localeCompare(b.materia));

  return (
    <div className="space-y-4">
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-3">
        <Link href="/panel/boletas" className="text-sm text-marca-600 hover:underline">
          ← Boletas
        </Link>
        <BotonImprimir />
      </div>

      <article className="hoja-impresion mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="flex items-start justify-between gap-6 border-b border-slate-300 pb-4">
          <div className="flex items-center gap-4">
            {institucion?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={institucion.logoUrl} alt="" className="h-16 w-auto" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-marca-600 text-xl font-bold text-white">
                {(institucion?.nombreCorto ?? institucion?.nombre ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-slate-900">{institucion?.nombre}</h1>
              {institucion?.lema && <p className="text-xs italic text-slate-500">{institucion.lema}</p>}
              <p className="mt-0.5 text-xs text-slate-500">
                {[institucion?.direccion, institucion?.ciudad, institucion?.telefono]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {institucion?.claveCentroTrabajo && (
                <p className="text-xs text-slate-500">CCT: {institucion.claveCentroTrabajo}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Boleta de calificaciones
            </p>
            <p className="text-xs text-slate-500">{ciclo.nombre}</p>
            <p className="text-xs text-slate-400">Emitida el {formatearFecha(new Date())}</p>
          </div>
        </header>

        <section className="grid gap-x-6 gap-y-1 border-b border-slate-200 py-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-slate-500">Alumno: </span>
            <span className="font-medium text-slate-900">{nombreCompleto(alumno)}</span>
          </p>
          <p>
            <span className="text-slate-500">Matricula: </span>
            <span className="font-mono text-slate-900">{alumno.matricula}</span>
          </p>
          <p>
            <span className="text-slate-500">Plan: </span>
            <span className="text-slate-900">
              {alumno.plan.nivel.nombre} · {alumno.plan.nombre}
            </span>
          </p>
          <p>
            <span className="text-slate-500">Grado y grupo: </span>
            <span className="text-slate-900">
              {inscripcion ? `${inscripcion.grado.nombre} · ${inscripcion.grupo.nombre}` : "Sin inscripcion"}
            </span>
          </p>
          {alumno.curp && (
            <p>
              <span className="text-slate-500">CURP: </span>
              <span className="font-mono text-slate-900">{alumno.curp}</span>
            </p>
          )}
          <p>
            <span className="text-slate-500">Turno: </span>
            <span className="text-slate-900">{alumno.turno?.nombre ?? "—"}</span>
          </p>
        </section>

        <section className="py-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left">
                <th className="py-2 pr-3 text-xs font-semibold uppercase text-slate-600">Materia</th>
                {ciclo.periodos.map((periodo) => (
                  <th
                    key={periodo.id}
                    className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-600"
                  >
                    {periodo.nombre}
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-semibold uppercase text-slate-600">
                  Final
                </th>
                <th className="py-2 pl-2 text-center text-xs font-semibold uppercase text-slate-600">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={ciclo.periodos.length + 3} className="py-6 text-center text-slate-400">
                    El alumno no tiene materias registradas en este ciclo.
                  </td>
                </tr>
              ) : (
                filas.map((fila) => (
                  <tr key={fila.clave} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3">
                      <span className="text-slate-800">{fila.materia}</span>
                      <span className="ml-2 font-mono text-[10px] text-slate-400">{fila.clave}</span>
                    </td>
                    {ciclo.periodos.map((periodo) => {
                      const valor = fila.porPeriodo.get(periodo.id);
                      return (
                        <td key={periodo.id} className="px-2 py-1.5 text-center text-slate-700">
                          {valor ?? "—"}
                        </td>
                      );
                    })}
                    <td
                      className={`px-2 py-1.5 text-center font-semibold ${
                        fila.final != null && fila.final < escalaBase.minimaAprobatoria
                          ? "text-red-700"
                          : "text-slate-900"
                      }`}
                    >
                      {fila.final ?? "—"}
                      {fila.extraordinario != null && (
                        <span className="ml-1 text-[10px] font-normal text-slate-500">(ext)</span>
                      )}
                    </td>
                    <td className="py-1.5 pl-2 text-center text-xs text-slate-600">
                      {fila.estado.replace(/_/g, " ").toLowerCase()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="grid gap-4 border-t border-slate-300 pt-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Promedio del ciclo</p>
            <p className="text-2xl font-bold text-slate-900">
              {promedio ? Number(promedio.promedio) : "—"}
            </p>
            {promedio?.posicionRanking && (
              <p className="text-xs text-slate-500">Lugar {promedio.posicionRanking} del grupo</p>
            )}
            {promedio?.cuadroHonor && (
              <p className="text-xs font-semibold text-emerald-700">Cuadro de honor</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Asistencia</p>
            <p className="text-2xl font-bold text-slate-900">
              {asistencia != null ? `${asistencia}%` : "—"}
            </p>
            <p className="text-xs text-slate-500">
              {faltas.ausencias} falta(s), {faltas.retardos} retardo(s)
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Escala</p>
            <p className="text-sm text-slate-700">
              {escalaBase.valorMinimo} a {escalaBase.valorMaximo}
            </p>
            <p className="text-xs text-slate-500">
              Aprueba con {escalaBase.minimaAprobatoria}
            </p>
          </div>
        </section>

        <footer className="mt-10 grid grid-cols-2 gap-10 text-center text-xs text-slate-500">
          <div className="border-t border-slate-400 pt-1">Direccion escolar</div>
          <div className="border-t border-slate-400 pt-1">Padre, madre o tutor</div>
        </footer>
      </article>
    </div>
  );
}
