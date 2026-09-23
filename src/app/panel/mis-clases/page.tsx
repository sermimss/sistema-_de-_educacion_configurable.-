import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { clasesDelDocente, empleadoDeSesion } from "@/lib/docencia";
import { configBool } from "@/lib/configuracion";
import { DIAS_SEMANA } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import PreferenciasClase from "./PreferenciasClase";

export const dynamic = "force-dynamic";

export default async function PaginaMisClases() {
  const sesion = await requerirRol("DOCENTE", "ADMIN");
  const empleado = await empleadoDeSesion(sesion.usuarioId);

  if (!empleado) {
    return (
      <Alerta tipo="aviso">
        Tu usuario no esta ligado a un registro de personal, asi que no hay clases que mostrar.
      </Alerta>
    );
  }

  const [clases, puedeElegirModo, puedeElegirAfectacion] = await Promise.all([
    clasesDelDocente(sesion.usuarioId),
    configBool("asistencia.docente_decide_modo", true),
    configBool("asistencia.docente_decide_afectacion", true),
  ]);

  const horarios = await db.horarioClase.findMany({
    where: { claseId: { in: clases.map((clase) => clase.id) } },
    orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    include: { aula: true },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Mis clases</h1>
        <p className="mt-1 text-sm text-slate-600">
          {nombreCompleto(empleado)} · {clases.length} clase(s) en el ciclo activo
        </p>
      </header>

      {clases.length === 0 ? (
        <EstadoVacio
          titulo="Sin clases asignadas"
          mensaje="Control escolar asigna las materias desde la pantalla del grupo."
        />
      ) : (
        clases.map((clase) => {
          const horariosClase = horarios.filter((horario) => horario.claseId === clase.id);
          return (
            <Tarjeta
              key={clase.id}
              titulo={`${clase.planMateria.materia.nombre} · ${clase.grupo.nombre}`}
              descripcion={`${clase.grupo.grado.nombre} · ${clase._count.alumnos} alumno(s)${
                clase.aula ? ` · ${clase.aula.nombre}` : ""
              }`}
              acciones={
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/panel/asistencia?clase=${clase.id}`}
                    className="rounded-lg bg-marca-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-marca-700"
                  >
                    Pasar lista
                  </Link>
                  <Link
                    href={`/panel/calificaciones?clase=${clase.id}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Calificaciones
                  </Link>
                </div>
              }
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {horariosClase.length === 0 ? (
                    <span className="text-slate-400">Sin horario asignado</span>
                  ) : (
                    horariosClase.map((horario) => (
                      <Insignia key={horario.id}>
                        {DIAS_SEMANA.find((d) => d.valor === horario.diaSemana)?.corto}{" "}
                        {horario.horaInicio}-{horario.horaFin}
                        {horario.aula ? ` · ${horario.aula.nombre}` : ""}
                      </Insignia>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <PreferenciasClase
                    claseId={clase.id}
                    modoAsistencia={clase.modoAsistencia}
                    afecta={clase.asistenciaAfectaCalificacion}
                    porcentaje={clase.porcentajeAsistencia ? String(clase.porcentajeAsistencia) : ""}
                    puedeElegirModo={puedeElegirModo}
                    puedeElegirAfectacion={puedeElegirAfectacion}
                  />
                </div>
              </div>
            </Tarjeta>
          );
        })
      )}
    </div>
  );
}
