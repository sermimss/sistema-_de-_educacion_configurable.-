import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { configJson } from "@/lib/configuracion";
import { DIAS_SEMANA } from "@/lib/formato";
import { Alerta, EstadoVacio, Tarjeta } from "@/components/ui";
import { BotonQuitarHorario, FormularioHorario } from "./Formularios";

export const dynamic = "force-dynamic";

export default async function PaginaHorarios({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string }>;
}) {
  await requerirRol("ADMIN");
  const params = await searchParams;

  const grupos = await db.grupo.findMany({
    where: { activo: true, ciclo: { estado: "ACTIVO" } },
    orderBy: [{ cicloId: "desc" }, { nombre: "asc" }],
    include: { ciclo: true, grado: true, turno: true, _count: { select: { clases: true } } },
  });

  const grupoId = Number(params.grupo) || grupos[0]?.id;
  const diasHabiles = await configJson<number[]>("horarios.dias_habiles", [1, 2, 3, 4, 5]);
  const dias = DIAS_SEMANA.filter((dia) => diasHabiles.includes(dia.valor));

  const [grupo, modulos, aulas] = await Promise.all([
    grupoId
      ? db.grupo.findUnique({
          where: { id: grupoId },
          include: {
            ciclo: true,
            grado: true,
            aula: true,
            clases: {
              include: {
                planMateria: { include: { materia: true } },
                docente: true,
                aula: true,
                horarios: { include: { aula: true, modulo: true }, orderBy: { horaInicio: "asc" } },
              },
            },
          },
        })
      : null,
    db.moduloHorario.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    db.aula.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
  ]);

  // Celdas del horario indexadas por dia y modulo (o por hora si es manual).
  const celdas = new Map<string, typeof bloques>();
  const bloques: {
    horarioId: number;
    materia: string;
    docente: string;
    aula: string | null;
    horaInicio: string;
    horaFin: string;
  }[] = [];

  for (const clase of grupo?.clases ?? []) {
    for (const horario of clase.horarios) {
      const bloque = {
        horarioId: horario.id,
        materia: clase.planMateria.materia.nombre,
        docente: nombreCompleto(clase.docente),
        aula: horario.aula?.nombre ?? clase.aula?.nombre ?? null,
        horaInicio: horario.horaInicio,
        horaFin: horario.horaFin,
      };
      const llave = `${horario.diaSemana}|${horario.horaInicio}`;
      const lista = celdas.get(llave) ?? [];
      lista.push(bloque);
      celdas.set(llave, lista);
    }
  }

  // Filas del cuadro: los modulos configurados mas cualquier hora manual usada.
  const horasUsadas = new Set(modulos.filter((m) => !m.esReceso).map((m) => m.horaInicio));
  for (const llave of celdas.keys()) horasUsadas.add(llave.split("|")[1]);
  const filas = [...horasUsadas].sort().map((horaInicio) => {
    const modulo = modulos.find((m) => m.horaInicio === horaInicio && !m.esReceso);
    return { horaInicio, etiqueta: modulo ? modulo.nombre : "Horario libre", horaFin: modulo?.horaFin };
  });

  const totalHorarios = grupo?.clases.reduce((suma, clase) => suma + clase.horarios.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Horarios</h1>
        <p className="mt-1 text-sm text-slate-600">
          El sistema impide que un docente, un aula o un grupo queden en dos clases a la vez.
        </p>
      </header>

      {grupos.length === 0 ? (
        <Alerta tipo="aviso">
          No hay grupos activos en un ciclo activo.{" "}
          <Link href="/panel/grupos" className="font-medium underline">
            Crear un grupo
          </Link>
        </Alerta>
      ) : (
        <>
          <Tarjeta>
            <form method="get" className="flex flex-wrap items-end gap-3">
              <div>
                <label className="etiqueta-campo" htmlFor="grupo">
                  Grupo
                </label>
                <select id="grupo" name="grupo" defaultValue={grupoId} className="campo min-w-[16rem]">
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre} · {g.grado.nombre}
                      {g.turno ? ` · ${g.turno.nombre}` : ""} ({g._count.clases} materias)
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Ver horario
              </button>
            </form>
          </Tarjeta>

          {grupo && (
            <>
              <Tarjeta
                titulo={`Horario de ${grupo.nombre}`}
                descripcion={`${grupo.ciclo.nombre} · ${totalHorarios} bloque(s) programados`}
              >
                {filas.length === 0 ? (
                  <EstadoVacio
                    titulo="Horario vacio"
                    mensaje="Agrega bloques con el formulario de abajo."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border-b border-slate-200 pb-2 pr-3 text-left text-xs uppercase tracking-wide text-slate-500">
                            Modulo
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
                        {filas.map((fila) => (
                          <tr key={fila.horaInicio} className="align-top">
                            <td className="border-b border-slate-100 py-2 pr-3">
                              <p className="text-xs font-medium text-slate-700">{fila.etiqueta}</p>
                              <p className="text-[11px] text-slate-400">
                                {fila.horaInicio}
                                {fila.horaFin ? ` - ${fila.horaFin}` : ""}
                              </p>
                            </td>
                            {dias.map((dia) => {
                              const bloquesCelda = celdas.get(`${dia.valor}|${fila.horaInicio}`) ?? [];
                              return (
                                <td key={dia.valor} className="border-b border-slate-100 px-2 py-2">
                                  {bloquesCelda.length === 0 ? (
                                    <span className="text-xs text-slate-300">—</span>
                                  ) : (
                                    <div className="space-y-1">
                                      {bloquesCelda.map((bloque) => (
                                        <div
                                          key={bloque.horarioId}
                                          className="rounded-md bg-marca-50 px-2 py-1"
                                        >
                                          <p className="text-xs font-medium text-marca-900">
                                            {bloque.materia}
                                          </p>
                                          <p className="text-[11px] text-slate-500">
                                            {bloque.docente}
                                            {bloque.aula ? ` · ${bloque.aula}` : ""}
                                          </p>
                                          {/* Es un div y no un p: el boton de quitar
                                              lleva dentro un form, que el navegador
                                              no admite dentro de un parrafo. */}
                                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                            <span>
                                              {bloque.horaInicio}-{bloque.horaFin}
                                            </span>
                                            <BotonQuitarHorario horarioId={bloque.horarioId} />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
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

              <Tarjeta titulo="Agregar bloque al horario">
                {grupo.clases.length === 0 ? (
                  <Alerta tipo="aviso">
                    Este grupo no tiene clases abiertas.{" "}
                    <Link href={`/panel/grupos/${grupo.id}`} className="font-medium underline">
                      Asignar materias y docentes
                    </Link>
                  </Alerta>
                ) : (
                  <FormularioHorario
                    grupoId={grupo.id}
                    dias={dias.map((d) => ({ valor: d.valor, nombre: d.nombre }))}
                    clases={grupo.clases.map((clase) => ({
                      id: clase.id,
                      etiqueta: `${clase.planMateria.materia.nombre} · ${nombreCompleto(clase.docente)}`,
                    }))}
                    modulos={modulos
                      .filter((m) => !m.esReceso)
                      .map((m) => ({
                        id: m.id,
                        etiqueta: m.nombre,
                        horaInicio: m.horaInicio,
                        horaFin: m.horaFin,
                      }))}
                    aulas={aulas.map((a) => ({ id: a.id, etiqueta: a.nombre }))}
                  />
                )}
              </Tarjeta>
            </>
          )}
        </>
      )}
    </div>
  );
}
