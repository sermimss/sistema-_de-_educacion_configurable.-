import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { configBool, configJson } from "@/lib/configuracion";
import { DIAS_SEMANA } from "@/lib/formato";
import { Alerta, EstadoVacio, Tarjeta } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PaginaMiHorario() {
  const sesion = await requerirRol("ALUMNO");
  const alumno = await alumnoDeSesion(sesion.usuarioId);
  if (!alumno) return <Alerta tipo="error">Tu usuario no esta ligado a un expediente.</Alerta>;

  if (!(await configBool("portales.alumno_ve_horario", true))) {
    return <Alerta tipo="aviso">El colegio tiene desactivada esta seccion.</Alerta>;
  }

  const ciclo = await db.cicloEscolar.findFirst({ where: { estado: "ACTIVO" } });
  if (!ciclo) return <Alerta tipo="aviso">No hay un ciclo escolar activo.</Alerta>;

  const [clases, diasHabiles] = await Promise.all([
    db.alumnoClase.findMany({
      where: { alumnoId: alumno.id, estado: { not: "BAJA" }, clase: { cicloId: ciclo.id } },
      include: {
        clase: {
          include: {
            planMateria: { include: { materia: true } },
            docente: true,
            aula: true,
            grupo: true,
            horarios: { include: { aula: true }, orderBy: { horaInicio: "asc" } },
          },
        },
      },
    }),
    configJson<number[]>("horarios.dias_habiles", [1, 2, 3, 4, 5]),
  ]);

  const dias = DIAS_SEMANA.filter((dia) => diasHabiles.includes(dia.valor));

  const bloques = clases.flatMap((inscripcion) =>
    inscripcion.clase.horarios.map((horario) => ({
      id: horario.id,
      diaSemana: horario.diaSemana,
      horaInicio: horario.horaInicio,
      horaFin: horario.horaFin,
      materia: inscripcion.clase.planMateria.materia.nombre,
      docente: nombreCompleto(inscripcion.clase.docente),
      aula: horario.aula?.nombre ?? inscripcion.clase.aula?.nombre ?? null,
    }))
  );

  const horas = [...new Set(bloques.map((bloque) => bloque.horaInicio))].sort();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Mi horario</h1>
        <p className="mt-1 text-sm text-slate-600">
          {ciclo.nombre}
          {clases[0]?.clase.grupo && ` · grupo ${clases[0].clase.grupo.nombre}`}
        </p>
      </header>

      <Tarjeta>
        {bloques.length === 0 ? (
          <EstadoVacio
            titulo="Tu horario aun no esta publicado"
            mensaje="Cuando control escolar lo cargue, aparecera aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 pb-2 pr-3 text-left text-xs uppercase tracking-wide text-slate-500">
                    Hora
                  </th>
                  {dias.map((dia) => (
                    <th
                      key={dia.valor}
                      className="border-b border-slate-200 px-2 pb-2 text-left text-xs uppercase tracking-wide text-slate-500"
                    >
                      {dia.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horas.map((hora) => (
                  <tr key={hora} className="align-top">
                    <td className="border-b border-slate-100 py-2 pr-3 text-xs text-slate-500">
                      {hora}
                    </td>
                    {dias.map((dia) => {
                      const enCelda = bloques.filter(
                        (bloque) => bloque.diaSemana === dia.valor && bloque.horaInicio === hora
                      );
                      return (
                        <td key={dia.valor} className="border-b border-slate-100 px-2 py-2">
                          {enCelda.length === 0 ? (
                            <span className="text-xs text-slate-300">—</span>
                          ) : (
                            enCelda.map((bloque) => (
                              <div key={bloque.id} className="rounded-md bg-marca-50 px-2 py-1">
                                <p className="text-xs font-medium text-marca-900">{bloque.materia}</p>
                                <p className="text-[11px] text-slate-500">
                                  {bloque.docente}
                                  {bloque.aula ? ` · ${bloque.aula}` : ""}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {bloque.horaInicio}-{bloque.horaFin}
                                </p>
                              </div>
                            ))
                          )}
                        </td>
                      );
                    })}
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
