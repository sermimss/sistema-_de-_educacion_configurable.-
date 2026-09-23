import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { configBool, configNumero } from "@/lib/configuracion";
import { faltasEfectivas, porcentajeAsistencia } from "@/lib/asistencia";
import { formatearFecha } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PaginaMiAsistencia() {
  const sesion = await requerirRol("ALUMNO");
  const alumno = await alumnoDeSesion(sesion.usuarioId);
  if (!alumno) return <Alerta tipo="error">Tu usuario no esta ligado a un expediente.</Alerta>;

  if (!(await configBool("portales.alumno_ve_asistencia", true))) {
    return <Alerta tipo="aviso">El colegio tiene desactivada esta seccion.</Alerta>;
  }

  const ciclo = await db.cicloEscolar.findFirst({ where: { estado: "ACTIVO" } });
  if (!ciclo) return <Alerta tipo="aviso">No hay un ciclo escolar activo.</Alerta>;

  const [registros, retardosPorFalta] = await Promise.all([
    db.registroAsistencia.findMany({
      where: {
        alumnoId: alumno.id,
        sesion: { OR: [{ clase: { cicloId: ciclo.id } }, { grupo: { cicloId: ciclo.id } }] },
      },
      orderBy: { sesion: { fecha: "desc" } },
      include: {
        sesion: {
          include: { clase: { include: { planMateria: { include: { materia: true } } } } },
        },
      },
    }),
    configNumero("asistencia.retardos_equivalen_falta", 3),
  ]);

  const global = faltasEfectivas(registros, retardosPorFalta);
  const porcentaje = porcentajeAsistencia(registros);

  // Agrupado por materia, o "dia completo" cuando el pase de lista es por dia.
  const porMateria = new Map<string, typeof registros>();
  for (const registro of registros) {
    const llave = registro.sesion.clase?.planMateria.materia.nombre ?? "Dia completo";
    const lista = porMateria.get(llave) ?? [];
    lista.push(registro);
    porMateria.set(llave, lista);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Mi asistencia</h1>
        <p className="mt-1 text-sm text-slate-600">{ciclo.nombre}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="tarjeta px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Asistencia</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {porcentaje != null ? `${porcentaje}%` : "—"}
          </p>
        </div>
        <div className="tarjeta px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Faltas</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{global.ausencias}</p>
        </div>
        <div className="tarjeta px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Retardos</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{global.retardos}</p>
          {retardosPorFalta > 0 && (
            <p className="text-xs text-slate-500">
              {retardosPorFalta} retardos equivalen a una falta
            </p>
          )}
        </div>
      </div>

      {porMateria.size === 0 ? (
        <EstadoVacio titulo="Todavia no hay asistencia registrada" />
      ) : (
        [...porMateria.entries()].map(([materia, lista]) => {
          const resumen = faltasEfectivas(lista, retardosPorFalta);
          const porcentajeMateria = porcentajeAsistencia(lista);
          return (
            <Tarjeta
              key={materia}
              titulo={materia}
              descripcion={`${lista.length} sesion(es) · ${resumen.ausencias} falta(s) · ${resumen.retardos} retardo(s)`}
              acciones={
                <Insignia
                  tono={
                    porcentajeMateria != null && porcentajeMateria < 80 ? "peligro" : "exito"
                  }
                >
                  {porcentajeMateria != null ? `${porcentajeMateria}%` : "—"}
                </Insignia>
              }
            >
              <div className="flex flex-wrap gap-1.5">
                {lista.slice(0, 60).map((registro) => (
                  <span
                    key={registro.id}
                    title={`${formatearFecha(registro.sesion.fecha)}${
                      registro.observacion ? ` · ${registro.observacion}` : ""
                    }`}
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      registro.estado === "PRESENTE"
                        ? "bg-emerald-100 text-emerald-800"
                        : registro.estado === "AUSENTE"
                          ? "bg-red-100 text-red-800"
                          : registro.estado === "RETARDO"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {formatearFecha(registro.sesion.fecha)}
                  </span>
                ))}
              </div>
            </Tarjeta>
          );
        })
      )}
    </div>
  );
}
