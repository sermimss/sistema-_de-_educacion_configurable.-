import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { configNumero } from "@/lib/configuracion";
import { formatearFechaHora } from "@/lib/formato";
import { Boton, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { atenderAlerta } from "../acciones";

export const dynamic = "force-dynamic";

export default async function PaginaAlertas() {
  await requerirRol("ADMIN");
  const umbral = await configNumero("asistencia.faltas_consecutivas_alerta", 3);

  const [pendientes, atendidas] = await Promise.all([
    db.alertaAsistencia.findMany({
      where: { atendida: false },
      orderBy: { fechaDeteccion: "desc" },
      include: {
        alumno: true,
        clase: { include: { planMateria: { include: { materia: true } }, grupo: true } },
      },
    }),
    db.alertaAsistencia.findMany({
      where: { atendida: true },
      orderBy: { fechaDeteccion: "desc" },
      take: 20,
      include: { alumno: true, clase: { include: { planMateria: { include: { materia: true } } } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/asistencia" className="text-sm text-marca-600 hover:underline">
          ← Pase de lista
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Alertas de inasistencia</h1>
        <p className="mt-1 text-sm text-slate-600">
          El sistema avisa cuando un alumno acumula {umbral} faltas consecutivas. El umbral se
          cambia en Configuracion.
        </p>
      </header>

      <Tarjeta titulo="Sin atender" descripcion={`${pendientes.length} alerta(s)`}>
        {pendientes.length === 0 ? (
          <EstadoVacio titulo="Sin alertas pendientes" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pendientes.map((alerta) => (
              <li key={alerta.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/panel/alumnos/${alerta.alumnoId}`}
                      className="font-medium text-slate-800 hover:text-marca-600"
                    >
                      {nombreCompleto(alerta.alumno)}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {alerta.alumno.matricula} ·{" "}
                      {alerta.clase
                        ? `${alerta.clase.planMateria.materia.nombre} (${alerta.clase.grupo.nombre})`
                        : "Faltas por dia completo"}{" "}
                      · {formatearFechaHora(alerta.fechaDeteccion)}
                    </p>
                  </div>
                  <Insignia tono="peligro">{alerta.faltasConsecutivas} faltas seguidas</Insignia>
                </div>
                <form action={atenderAlerta} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="alertaId" value={alerta.id} />
                  <input
                    name="notas"
                    placeholder="Que se hizo (se guarda en la bitacora)"
                    className="campo max-w-md py-1 text-xs"
                    aria-label="Notas de seguimiento"
                  />
                  <Boton type="submit" variante="secundario">
                    Marcar atendida
                  </Boton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {atendidas.length > 0 && (
        <Tarjeta titulo="Atendidas recientemente">
          <ul className="divide-y divide-slate-100">
            {atendidas.map((alerta) => (
              <li key={alerta.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">
                  {nombreCompleto(alerta.alumno)}
                  {alerta.clase && ` · ${alerta.clase.planMateria.materia.nombre}`}
                </span>
                <span className="text-xs text-slate-500">
                  {alerta.notas ?? "Sin notas"} · {formatearFechaHora(alerta.fechaDeteccion)}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
