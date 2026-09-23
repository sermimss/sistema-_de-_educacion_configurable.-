import Link from "next/link";
import { requerirSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { claseAccesible, clasesDelDocente } from "@/lib/docencia";
import { configBool, configNumero } from "@/lib/configuracion";
import { calcularSugerida, type EscalaBasica } from "@/lib/calificaciones";
import { formatearFecha } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import {
  BotonCerrarPeriodo,
  BotonEliminarActividad,
  BotonEliminarRubro,
  FormularioActividad,
  FormularioExtraordinario,
  FormularioRubro,
  TablaPeriodo,
  TablaPuntos,
} from "./Formularios";
import { alternarCapturaPeriodo } from "./acciones";

export const dynamic = "force-dynamic";

export default async function PaginaCalificaciones({
  searchParams,
}: {
  searchParams: Promise<{ clase?: string; periodo?: string; actividad?: string }>;
}) {
  const sesion = await requerirSesion();
  if (sesion.rol === "ALUMNO") {
    return <Alerta tipo="aviso">Tu consulta de calificaciones llega en la Fase 4.</Alerta>;
  }

  const params = await searchParams;

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

  if (clases.length === 0) {
    return (
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
    );
  }

  const claseId = Number(params.clase) || clases[0].id;
  if (!(await claseAccesible(sesion, claseId))) {
    return <Alerta tipo="error">Esa clase no esta a tu cargo.</Alerta>;
  }

  const clase = await db.clase.findUnique({
    where: { id: claseId },
    include: {
      ciclo: { include: { periodos: { orderBy: { numero: "asc" } } } },
      grupo: true,
      escala: true,
      planMateria: { include: { materia: true } },
      alumnos: { include: { alumno: true }, where: { estado: { not: "BAJA" } } },
      extraordinarios: { include: { alumno: true }, orderBy: { fecha: "desc" } },
    },
  });
  if (!clase) return <Alerta tipo="error">La clase no existe.</Alerta>;

  const periodos = clase.ciclo.periodos;
  const periodoId =
    Number(params.periodo) ||
    periodos.find((periodo) => periodo.capturaAbierta)?.id ||
    periodos[0]?.id;
  const periodo = periodos.find((p) => p.id === periodoId);

  if (!periodo) {
    return <Alerta tipo="aviso">El ciclo no tiene periodos de evaluacion configurados.</Alerta>;
  }

  const escalaBase = clase.escala ?? (await db.escalaCalificacion.findFirst({ where: { predeterminada: true } }));
  const escala: EscalaBasica = {
    valorMinimo: Number(escalaBase?.valorMinimo ?? 0),
    valorMaximo: Number(escalaBase?.valorMaximo ?? 100),
    decimales: escalaBase?.decimales ?? 2,
    redondeo: escalaBase?.redondeo ?? "NINGUNO",
    minimaAprobatoria: Number(escalaBase?.minimaAprobatoria ?? 70),
  };

  const [rubros, actividades, calificacionesPeriodo, maximoExtra, permiteExtra] = await Promise.all([
    db.rubroEvaluacion.findMany({
      where: { claseId, periodoId },
      orderBy: { orden: "asc" },
      include: { _count: { select: { actividades: true } } },
    }),
    db.actividad.findMany({
      where: { claseId, periodoId },
      orderBy: { fechaAsignacion: "asc" },
      include: { calificaciones: true, rubro: true },
    }),
    db.calificacionPeriodo.findMany({ where: { claseId, periodoId } }),
    configNumero("evaluacion.calificacion_maxima_extraordinario", 100),
    configBool("evaluacion.permite_extraordinario", true),
  ]);

  const alumnos = clase.alumnos
    .map((inscripcion) => inscripcion.alumno)
    .sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno));

  const porAlumno = new Map(calificacionesPeriodo.map((c) => [c.alumnoId, c]));
  const pesoAsignado = rubros.reduce((suma, rubro) => suma + Number(rubro.peso), 0);

  // Calificacion sugerida por alumno, a partir de sus capturas en los rubros.
  const sugeridas = new Map<number, number | null>();
  for (const alumno of alumnos) {
    const rubrosConActividades = rubros.map((rubro) => ({
      id: rubro.id,
      nombre: rubro.nombre,
      peso: Number(rubro.peso),
      actividades: actividades
        .filter((actividad) => actividad.rubroId === rubro.id)
        .map((actividad) => ({
          id: actividad.id,
          puntosMaximos: Number(actividad.puntosMaximos),
          calificacion:
            actividad.calificaciones.find((c) => c.alumnoId === alumno.id)?.puntos != null
              ? Number(actividad.calificaciones.find((c) => c.alumnoId === alumno.id)!.puntos)
              : null,
        })),
    }));
    sugeridas.set(alumno.id, calcularSugerida(rubrosConActividades, escala).sugerida);
  }

  const actividadId = Number(params.actividad) || actividades[0]?.id;
  const actividad = actividades.find((a) => a.id === actividadId);
  const cerrado = calificacionesPeriodo.length > 0 && calificacionesPeriodo.every((c) => c.cerrada);
  const capturadas = calificacionesPeriodo.filter((c) => c.calificacion != null).length;
  const reprobados = alumnos.filter((alumno) => {
    const calificacion = porAlumno.get(alumno.id)?.calificacion;
    return calificacion != null && Number(calificacion) < escala.minimaAprobatoria;
  });

  const enlace = (extra: Record<string, string | number>) => {
    const query = new URLSearchParams({
      clase: String(claseId),
      periodo: String(periodoId),
      ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])),
    });
    return `/panel/calificaciones?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Calificaciones</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tu armas los rubros y sus pesos; la calificacion oficial del periodo la confirmas tu.
        </p>
      </header>

      <Tarjeta>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
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
            <label className="etiqueta-campo" htmlFor="periodo">
              Periodo
            </label>
            <select id="periodo" name="periodo" defaultValue={periodoId} className="campo">
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.capturaAbierta ? " (abierto)" : ""}
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

      {!periodo.capturaAbierta && (
        <Alerta tipo="aviso">
          La captura del {periodo.nombre} esta cerrada
          {sesion.rol === "ADMIN" ? ". Puedes abrirla abajo." : ". Pide a direccion que la abra."}
        </Alerta>
      )}

      {sesion.rol === "ADMIN" && (
        <Tarjeta titulo="Captura por periodo" descripcion="Abre o cierra la captura para todo el colegio">
          <ul className="divide-y divide-slate-100">
            {periodos.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{p.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {formatearFecha(p.fechaInicio)} — {formatearFecha(p.fechaFin)}
                  </p>
                </div>
                <form action={alternarCapturaPeriodo} className="flex items-center gap-3">
                  <input type="hidden" name="periodoId" value={p.id} />
                  <Insignia tono={p.capturaAbierta ? "exito" : "neutro"}>
                    {p.capturaAbierta ? "abierta" : "cerrada"}
                  </Insignia>
                  <button
                    type="submit"
                    className="rounded-md px-2 py-1 text-xs font-medium text-marca-600 hover:bg-slate-100"
                  >
                    {p.capturaAbierta ? "Cerrar" : "Abrir"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <Tarjeta
        titulo={`Rubros del ${periodo.nombre}`}
        descripcion={`${pesoAsignado}% asignado de 100%`}
      >
        <div className="space-y-4">
          {rubros.length === 0 ? (
            <EstadoVacio
              titulo="Sin rubros"
              mensaje="Define como se compone la calificacion: examen, tareas, participacion..."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {rubros.map((rubro) => (
                <li key={rubro.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-800">
                    {rubro.nombre}
                    <span className="ml-2 text-xs text-slate-500">
                      {Number(rubro.peso)}% · {rubro._count.actividades} actividad(es)
                    </span>
                  </span>
                  <BotonEliminarRubro rubroId={rubro.id} />
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 pt-4">
            <FormularioRubro claseId={claseId} periodoId={periodoId} pesoAsignado={pesoAsignado} />
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Actividades" descripcion={`${actividades.length} en el ${periodo.nombre}`}>
        <div className="space-y-4">
          {actividades.length === 0 ? (
            <EstadoVacio titulo="Sin actividades" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {actividades.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <Link
                      href={enlace({ actividad: a.id })}
                      className={`font-medium hover:underline ${
                        a.id === actividadId ? "text-marca-600" : "text-slate-800"
                      }`}
                    >
                      {a.nombre}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {a.rubro?.nombre ?? "Sin rubro"} · {Number(a.puntosMaximos)} puntos ·{" "}
                      {a.calificaciones.length} de {alumnos.length} capturados
                      {a.fechaEntrega ? ` · entrega ${formatearFecha(a.fechaEntrega)}` : ""}
                    </p>
                  </div>
                  <BotonEliminarActividad actividadId={a.id} />
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 pt-4">
            <FormularioActividad
              claseId={claseId}
              periodoId={periodoId}
              rubros={rubros.map((r) => ({ id: r.id, nombre: r.nombre }))}
            />
          </div>
        </div>
      </Tarjeta>

      {actividad && alumnos.length > 0 && (
        <Tarjeta
          titulo={`Capturar ${actividad.nombre}`}
          descripcion={`Sobre ${Number(actividad.puntosMaximos)} puntos`}
        >
          <TablaPuntos
            actividad={{
              id: actividad.id,
              nombre: actividad.nombre,
              puntosMaximos: Number(actividad.puntosMaximos),
            }}
            alumnos={alumnos.map((alumno) => {
              const captura = actividad.calificaciones.find((c) => c.alumnoId === alumno.id);
              return {
                id: alumno.id,
                matricula: alumno.matricula,
                nombre: nombreCompleto(alumno),
                puntos: captura?.puntos != null ? String(Number(captura.puntos)) : "",
              };
            })}
          />
        </Tarjeta>
      )}

      <Tarjeta
        titulo={`Calificacion oficial del ${periodo.nombre}`}
        descripcion={`${capturadas} de ${alumnos.length} capturadas`}
        acciones={
          cerrado ? <Insignia tono="exito">Periodo cerrado</Insignia> : undefined
        }
      >
        {alumnos.length === 0 ? (
          <EstadoVacio titulo="La clase no tiene alumnos inscritos" />
        ) : (
          <div className="space-y-4">
            <TablaPeriodo
              claseId={claseId}
              periodoId={periodoId}
              cerrado={cerrado}
              escala={{
                minimo: escala.valorMinimo,
                maximo: escala.valorMaximo,
                minimaAprobatoria: escala.minimaAprobatoria,
                decimales: escala.decimales,
              }}
              alumnos={alumnos.map((alumno) => {
                const registro = porAlumno.get(alumno.id);
                return {
                  id: alumno.id,
                  matricula: alumno.matricula,
                  nombre: nombreCompleto(alumno),
                  sugerida: sugeridas.get(alumno.id) ?? null,
                  oficial: registro?.calificacion != null ? String(Number(registro.calificacion)) : "",
                  observacion: registro?.observaciones ?? "",
                  cerrada: Boolean(registro?.cerrada),
                };
              })}
            />
            <div className="border-t border-slate-100 pt-4">
              <BotonCerrarPeriodo
                claseId={claseId}
                periodoId={periodoId}
                cerrado={cerrado}
                esAdmin={sesion.rol === "ADMIN"}
              />
            </div>
          </div>
        )}
      </Tarjeta>

      {permiteExtra && (
        <Tarjeta
          titulo="Extraordinarios"
          descripcion={`Calificacion maxima permitida: ${maximoExtra}`}
        >
          <div className="space-y-4">
            {clase.extraordinarios.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {clase.extraordinarios.map((extra) => (
                  <li key={extra.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-800">{nombreCompleto(extra.alumno)}</span>
                    <span className="text-xs text-slate-500">
                      {extra.tipo.replace(/_/g, " ").toLowerCase()} · {Number(extra.calificacion)} ·{" "}
                      {formatearFecha(extra.fecha)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <FormularioExtraordinario
              claseId={claseId}
              maximo={maximoExtra}
              alumnos={(reprobados.length > 0 ? reprobados : alumnos).map((alumno) => ({
                id: alumno.id,
                etiqueta: `${alumno.matricula} · ${nombreCompleto(alumno)}`,
              }))}
            />
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
