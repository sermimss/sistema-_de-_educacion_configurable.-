import Link from "next/link";
import { requerirSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { claseAccesible, clasesDelDocente } from "@/lib/docencia";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import FormularioAsistencia from "./FormularioAsistencia";

export const dynamic = "force-dynamic";

function hoyEnTexto(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function PaginaAsistencia({
  searchParams,
}: {
  searchParams: Promise<{ clase?: string; fecha?: string }>;
}) {
  const sesion = await requerirSesion();
  if (sesion.rol === "ALUMNO") {
    return <Alerta tipo="aviso">Tu consulta de asistencia llega en la Fase 4.</Alerta>;
  }

  const params = await searchParams;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(params.fecha ?? "") ? params.fecha! : hoyEnTexto();

  const clases =
    sesion.rol === "DOCENTE"
      ? await clasesDelDocente(sesion.usuarioId)
      : await db.clase.findMany({
          where: { ciclo: { estado: "ACTIVO" } },
          orderBy: [{ grupoId: "asc" }, { id: "asc" }],
          include: {
            grupo: { include: { grado: true, turno: true } },
            planMateria: { include: { materia: true } },
            ciclo: true,
            aula: true,
            _count: { select: { alumnos: true } },
          },
        });

  const claseId = Number(params.clase) || clases[0]?.id;
  const permitida = claseId ? await claseAccesible(sesion, claseId) : false;

  const clase =
    claseId && permitida
      ? await db.clase.findUnique({
          where: { id: claseId },
          include: {
            grupo: true,
            docente: true,
            planMateria: { include: { materia: true } },
            alumnos: { include: { alumno: true } },
          },
        })
      : null;

  const porDia = clase?.modoAsistencia === "POR_DIA";
  const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

  // En modo por dia la lista es la del grupo completo; en modo por clase, los
  // alumnos inscritos a esa clase.
  const inscritosGrupo = porDia
    ? await db.inscripcion.findMany({
        where: { grupoId: clase!.grupoId, estado: "INSCRITO" },
        include: { alumno: true },
        orderBy: { alumno: { apellidoPaterno: "asc" } },
      })
    : [];

  const sesionExistente = clase
    ? porDia
      ? await db.sesionAsistencia.findFirst({
          where: { grupoId: clase.grupoId, claseId: null, fecha: fechaDate },
          include: { registros: true },
        })
      : await db.sesionAsistencia.findUnique({
          where: { claseId_fecha: { claseId: clase.id, fecha: fechaDate } },
          include: { registros: true },
        })
    : null;

  const previos = new Map(
    (sesionExistente?.registros ?? []).map((registro) => [registro.alumnoId, registro])
  );

  const lista = clase
    ? (porDia
        ? inscritosGrupo.map((inscripcion) => inscripcion.alumno)
        : clase.alumnos
            .filter((inscripcion) => inscripcion.estado !== "BAJA")
            .map((inscripcion) => inscripcion.alumno)
      )
        .sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno))
        .map((alumno) => ({
          id: alumno.id,
          matricula: alumno.matricula,
          nombre: nombreCompleto(alumno),
          estado: previos.get(alumno.id)?.estado ?? "PRESENTE",
          observacion: previos.get(alumno.id)?.observacion ?? "",
        }))
    : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Pase de lista</h1>
          <p className="mt-1 text-sm text-slate-600">
            {sesion.rol === "DOCENTE"
              ? "Tus clases del ciclo activo."
              : "Todas las clases del ciclo activo."}
          </p>
        </div>
        {sesion.rol === "ADMIN" && (
          <Link
            href="/panel/asistencia/alertas"
            className="text-sm font-medium text-marca-600 hover:underline"
          >
            Ver alertas de inasistencia →
          </Link>
        )}
      </header>

      {clases.length === 0 ? (
        <Alerta tipo="aviso">
          No hay clases asignadas en el ciclo activo.
          {sesion.rol === "ADMIN" && (
            <>
              {" "}
              <Link href="/panel/grupos" className="font-medium underline">
                Abrir clases en un grupo
              </Link>
            </>
          )}
        </Alerta>
      ) : (
        <>
          <Tarjeta>
            <form method="get" className="flex flex-wrap items-end gap-3">
              <div className="min-w-[18rem] flex-1">
                <label className="etiqueta-campo" htmlFor="clase">
                  Clase
                </label>
                <select id="clase" name="clase" defaultValue={claseId} className="campo">
                  {clases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.planMateria.materia.nombre} · {c.grupo.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="etiqueta-campo" htmlFor="fecha">
                  Fecha
                </label>
                <input id="fecha" name="fecha" type="date" defaultValue={fecha} className="campo" />
              </div>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Abrir lista
              </button>
            </form>
          </Tarjeta>

          {!permitida ? (
            <Alerta tipo="error">Esa clase no esta a tu cargo.</Alerta>
          ) : clase ? (
            <Tarjeta
              titulo={`${clase.planMateria.materia.nombre} · ${clase.grupo.nombre}`}
              descripcion={`${fecha} · ${porDia ? "pase de lista por dia" : "pase de lista por clase"}`}
              acciones={
                <div className="flex items-center gap-2">
                  {sesionExistente && <Insignia tono="exito">Ya registrada</Insignia>}
                  <Insignia>{lista.length} alumno(s)</Insignia>
                </div>
              }
            >
              {lista.length === 0 ? (
                <EstadoVacio
                  titulo="Sin alumnos"
                  mensaje="Inscribe alumnos al grupo para poder pasar lista."
                />
              ) : (
                <FormularioAsistencia
                  claseId={clase.id}
                  fecha={fecha}
                  alumnos={lista}
                  cerrada={Boolean(sesionExistente?.cerrada)}
                />
              )}
            </Tarjeta>
          ) : null}
        </>
      )}
    </div>
  );
}
