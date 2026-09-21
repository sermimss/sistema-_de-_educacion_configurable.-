import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { catalogosEscolares, nombreCompleto } from "@/lib/catalogos";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import {
  BotonDarDeBaja,
  BotonEliminarClase,
  FormularioEditarGrupo,
  FormularioInscribir,
  FormularioNuevaClase,
  SelectorDocente,
} from "../Formularios";

export const dynamic = "force-dynamic";

export default async function PaginaGrupo({ params }: { params: Promise<{ id: string }> }) {
  await requerirRol("ADMIN");
  const { id } = await params;
  const grupoId = Number(id);
  if (!Number.isFinite(grupoId)) notFound();

  const grupo = await db.grupo.findUnique({
    where: { id: grupoId },
    include: {
      ciclo: true,
      plan: { include: { nivel: true } },
      grado: true,
      plantel: true,
      turno: true,
      aula: true,
      clases: {
        include: {
          planMateria: { include: { materia: true } },
          docente: true,
          aula: true,
          _count: { select: { alumnos: true, calificaciones: true, sesiones: true } },
        },
      },
      inscripciones: {
        include: { alumno: true },
        orderBy: { fecha: "asc" },
      },
    },
  });
  if (!grupo) notFound();

  const catalogos = await catalogosEscolares();

  const [materiasDelGrado, docentes, alumnosDisponibles] = await Promise.all([
    db.planMateria.findMany({
      where: { planId: grupo.planId, gradoId: grupo.gradoId },
      include: { materia: true },
      orderBy: { orden: "asc" },
    }),
    db.empleado.findMany({
      where: { esDocente: true, estado: "ACTIVO" },
      orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
    }),
    db.alumno.findMany({
      where: {
        estado: "ACTIVO",
        planId: grupo.planId,
        NOT: { inscripciones: { some: { cicloId: grupo.cicloId, estado: "INSCRITO" } } },
      },
      orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
      take: 300,
    }),
  ]);

  const yaAsignadas = new Set(grupo.clases.map((clase) => clase.planMateriaId));
  const materiasPorAsignar = materiasDelGrado.filter((m) => !yaAsignadas.has(m.id));
  const inscritos = grupo.inscripciones.filter((i) => i.estado === "INSCRITO");
  const opcionesDocentes = docentes.map((d) => ({
    id: d.id,
    etiqueta: `${nombreCompleto(d)} (${d.numeroEmpleado})`,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/panel/grupos" className="text-sm text-marca-600 hover:underline">
            ← Grupos
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{grupo.nombre}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {grupo.plan.nivel.nombre} · {grupo.plan.nombre} · {grupo.grado.nombre} ·{" "}
            {grupo.ciclo.nombre}
            {grupo.turno && ` · ${grupo.turno.nombre}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Insignia tono={grupo.activo ? "exito" : "neutro"}>
            {grupo.activo ? "activo" : "inactivo"}
          </Insignia>
          <Insignia>
            {inscritos.length}
            {grupo.cupoMaximo ? ` / ${grupo.cupoMaximo}` : ""} alumnos
          </Insignia>
        </div>
      </header>

      <Tarjeta titulo="Datos del grupo">
        <FormularioEditarGrupo
          grupo={{
            id: grupo.id,
            nombre: grupo.nombre,
            plantelId: grupo.plantelId,
            turnoId: grupo.turnoId,
            aulaId: grupo.aulaId,
            cupoMaximo: grupo.cupoMaximo,
            activo: grupo.activo,
          }}
          planteles={catalogos.planteles.map((p) => ({ id: p.id, etiqueta: p.nombre }))}
          turnos={catalogos.turnos.map((t) => ({ id: t.id, etiqueta: t.nombre }))}
          aulas={catalogos.aulas.map((a) => ({ id: a.id, etiqueta: a.nombre }))}
        />
      </Tarjeta>

      <Tarjeta
        titulo="Materias y docentes"
        descripcion={`${grupo.clases.length} clase(s) abiertas de ${materiasDelGrado.length} materias del grado`}
      >
        <div className="space-y-5">
          {grupo.clases.length === 0 ? (
            <EstadoVacio
              titulo="Sin clases abiertas"
              mensaje="Asigna las materias del grado a sus docentes."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {grupo.clases.map((clase) => (
                <li key={clase.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-[12rem]">
                    <p className="text-sm font-medium text-slate-800">
                      {clase.planMateria.materia.nombre}
                    </p>
                    <p className="text-xs text-slate-500">
                      {clase._count.alumnos} alumno(s)
                      {clase.aula ? ` · ${clase.aula.nombre}` : ""}
                      {clase._count.calificaciones > 0
                        ? ` · ${clase._count.calificaciones} calificacion(es)`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <SelectorDocente
                      claseId={clase.id}
                      grupoId={grupo.id}
                      docenteActual={clase.docenteId}
                      docentes={opcionesDocentes}
                    />
                    <BotonEliminarClase claseId={clase.id} grupoId={grupo.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-slate-100 pt-4">
            {materiasDelGrado.length === 0 ? (
              <Alerta tipo="aviso">
                El grado {grupo.grado.nombre} no tiene materias en el mapa curricular.{" "}
                <Link
                  href={`/panel/materias/plan/${grupo.planId}`}
                  className="font-medium underline"
                >
                  Agregarlas
                </Link>
              </Alerta>
            ) : docentes.length === 0 ? (
              <Alerta tipo="aviso">
                No hay docentes activos.{" "}
                <Link href="/panel/personal/nuevo" className="font-medium underline">
                  Da de alta uno
                </Link>
              </Alerta>
            ) : (
              <FormularioNuevaClase
                grupoId={grupo.id}
                materias={materiasPorAsignar.map((m) => ({
                  id: m.id,
                  etiqueta: `${m.materia.clave} · ${m.materia.nombre}`,
                }))}
                docentes={opcionesDocentes}
                aulas={catalogos.aulas.map((a) => ({ id: a.id, etiqueta: a.nombre }))}
              />
            )}
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Alumnos inscritos" descripcion={`${inscritos.length} alumno(s)`}>
        <div className="space-y-5">
          {grupo.inscripciones.length === 0 ? (
            <EstadoVacio titulo="Sin alumnos inscritos" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Matricula</th>
                    <th className="pb-2 pr-4 font-medium">Alumno</th>
                    <th className="pb-2 pr-4 font-medium">Estado</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grupo.inscripciones.map((inscripcion) => (
                    <tr key={inscripcion.id}>
                      <td className="py-2 pr-4 font-mono text-xs text-slate-600">
                        {inscripcion.alumno.matricula}
                      </td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/panel/alumnos/${inscripcion.alumnoId}`}
                          className="font-medium text-slate-800 hover:text-marca-600"
                        >
                          {nombreCompleto(inscripcion.alumno)}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        <Insignia tono={inscripcion.estado === "INSCRITO" ? "exito" : "neutro"}>
                          {inscripcion.estado.toLowerCase()}
                        </Insignia>
                      </td>
                      <td className="py-2 text-right">
                        {inscripcion.estado === "INSCRITO" && (
                          <BotonDarDeBaja inscripcionId={inscripcion.id} grupoId={grupo.id} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <FormularioInscribir
              grupoId={grupo.id}
              alumnos={alumnosDisponibles.map((alumno) => ({
                id: alumno.id,
                etiqueta: `${alumno.matricula} · ${nombreCompleto(alumno)}`,
              }))}
            />
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}
