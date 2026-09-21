import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { catalogosEscolares, nombreCompleto } from "@/lib/catalogos";
import { configBool, configNumero } from "@/lib/configuracion";
import { formatearFecha } from "@/lib/formato";
import { Alerta, Boton, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import FormularioAlumno from "../FormularioAlumno";
import FormularioTutor from "../FormularioTutor";
import { eliminarTutor, reiniciarPasswordAlumno } from "../acciones";

export const dynamic = "force-dynamic";

export default async function PaginaAlumno({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
}) {
  await requerirRol("ADMIN");
  const { id } = await params;
  const { creado } = await searchParams;
  const alumnoId = Number(id);
  if (!Number.isFinite(alumnoId)) notFound();

  const alumno = await db.alumno.findUnique({
    where: { id: alumnoId },
    include: {
      tutores: { orderBy: { id: "asc" } },
      usuario: { select: { usuario: true, debeCambiarPassword: true, ultimoAcceso: true } },
      inscripciones: {
        orderBy: { fecha: "desc" },
        include: { ciclo: true, grupo: true, grado: true },
      },
      clases: {
        include: {
          clase: {
            include: {
              planMateria: { include: { materia: true } },
              docente: true,
            },
          },
        },
      },
    },
  });
  if (!alumno) notFound();

  const catalogos = await catalogosEscolares();
  const exigeCurp = await configBool("expediente.exige_curp", false);
  const muestraMedicos = await configBool("expediente.campos_medicos_visibles", true);
  const minimoTutores = await configNumero("expediente.minimo_tutores", 1);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/panel/alumnos" className="text-sm text-marca-600 hover:underline">
            ← Alumnos
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{nombreCompleto(alumno)}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{alumno.matricula}</p>
        </div>
        <Insignia tono={alumno.estado === "ACTIVO" ? "exito" : "alerta"}>
          {alumno.estado.replace(/_/g, " ").toLowerCase()}
        </Insignia>
      </header>

      {creado === "1" && (
        <Alerta tipo="exito">
          Alumno dado de alta.
          {alumno.usuario &&
            ` Su cuenta de acceso es "${alumno.usuario.usuario}" con la matricula como contrasena temporal.`}
        </Alerta>
      )}

      {alumno.tutores.length < minimoTutores && (
        <Alerta tipo="aviso">
          La configuracion pide al menos {minimoTutores} tutor(es) por alumno y este tiene{" "}
          {alumno.tutores.length}.
        </Alerta>
      )}

      <FormularioAlumno
        catalogos={catalogos}
        exigeCurp={exigeCurp}
        muestraMedicos={muestraMedicos}
        alumno={{
          id: alumno.id,
          matricula: alumno.matricula,
          nombres: alumno.nombres,
          apellidoPaterno: alumno.apellidoPaterno,
          apellidoMaterno: alumno.apellidoMaterno,
          curp: alumno.curp,
          fechaNacimiento: alumno.fechaNacimiento
            ? alumno.fechaNacimiento.toISOString().slice(0, 10)
            : null,
          sexo: alumno.sexo,
          email: alumno.email,
          telefono: alumno.telefono,
          direccion: alumno.direccion,
          ciudad: alumno.ciudad,
          codigoPostal: alumno.codigoPostal,
          planId: alumno.planId,
          plantelId: alumno.plantelId,
          turnoId: alumno.turnoId,
          estado: alumno.estado,
          tipoSangre: alumno.tipoSangre,
          alergias: alumno.alergias,
          padecimientos: alumno.padecimientos,
          rfcFacturacion: alumno.rfcFacturacion,
          tieneUsuario: Boolean(alumno.usuarioId),
        }}
      />

      <Tarjeta titulo="Tutores" descripcion="Consultan con la cuenta del alumno; no tienen acceso propio">
        <div className="space-y-4">
          {alumno.tutores.length === 0 ? (
            <EstadoVacio titulo="Sin tutores registrados" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {alumno.tutores.map((tutor) => (
                <li key={tutor.id} className="flex items-center justify-between gap-4 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{tutor.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {[tutor.parentesco, tutor.telefono, tutor.email].filter(Boolean).join(" · ") ||
                        "Sin datos de contacto"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tutor.esResponsableFinanciero && <Insignia tono="alerta">Paga</Insignia>}
                    {tutor.esContactoEmergencia && <Insignia>Emergencia</Insignia>}
                    <form action={eliminarTutor}>
                      <input type="hidden" name="tutorId" value={tutor.id} />
                      <input type="hidden" name="alumnoId" value={alumno.id} />
                      <button
                        type="submit"
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Quitar
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 pt-4">
            <FormularioTutor alumnoId={alumno.id} />
          </div>
        </div>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Inscripciones">
          {alumno.inscripciones.length === 0 ? (
            <EstadoVacio
              titulo="Sin inscripciones"
              mensaje="Inscribe al alumno desde la pantalla del grupo."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {alumno.inscripciones.map((inscripcion) => (
                <li key={inscripcion.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">
                      {inscripcion.grupo.nombre} · {inscripcion.grado.nombre}
                    </p>
                    <p className="text-xs text-slate-500">
                      {inscripcion.ciclo.nombre} · {formatearFecha(inscripcion.fecha)}
                    </p>
                  </div>
                  <Insignia tono={inscripcion.estado === "INSCRITO" ? "exito" : "neutro"}>
                    {inscripcion.estado.toLowerCase()}
                  </Insignia>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Acceso al sistema">
          {alumno.usuario ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Usuario</span>
                <span className="font-mono text-slate-900">{alumno.usuario.usuario}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Ultimo acceso</span>
                <span className="text-slate-900">
                  {alumno.usuario.ultimoAcceso ? formatearFecha(alumno.usuario.ultimoAcceso) : "Nunca"}
                </span>
              </div>
              {alumno.usuario.debeCambiarPassword && (
                <Alerta tipo="aviso">Debe cambiar su contrasena en el proximo acceso.</Alerta>
              )}
              <form action={reiniciarPasswordAlumno}>
                <input type="hidden" name="alumnoId" value={alumno.id} />
                <Boton type="submit" variante="secundario">
                  Reiniciar contrasena a la matricula
                </Boton>
              </form>
            </div>
          ) : (
            <EstadoVacio
              titulo="Sin cuenta de acceso"
              mensaje="Este alumno no puede entrar al portal."
            />
          )}
        </Tarjeta>
      </div>

      {alumno.clases.length > 0 && (
        <Tarjeta titulo="Materias del alumno">
          <ul className="divide-y divide-slate-100">
            {alumno.clases.map((inscripcion) => (
              <li key={inscripcion.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-800">
                  {inscripcion.clase.planMateria.materia.nombre}
                </span>
                <span className="text-xs text-slate-500">
                  {nombreCompleto(inscripcion.clase.docente)} ·{" "}
                  {inscripcion.estado.replace(/_/g, " ").toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
