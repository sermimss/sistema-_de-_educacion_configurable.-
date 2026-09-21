import Link from "next/link";
import { requerirSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { obtenerInstitucion } from "@/lib/institucion";
import { configNumero, configTexto } from "@/lib/configuracion";
import { formatearFecha } from "@/lib/formato";
import { estaDisponible, navegacionPara } from "@/lib/navegacion";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";

export const dynamic = "force-dynamic";

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string | number; detalle?: string }) {
  return (
    <div className="tarjeta px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}

export default async function PaginaPanel() {
  const sesion = await requerirSesion();
  const institucion = await obtenerInstitucion();

  const [alumnos, docentes, grupos, planes, ciclo] = await Promise.all([
    db.alumno.count({ where: { estado: "ACTIVO" } }),
    db.empleado.count({ where: { esDocente: true, estado: "ACTIVO" } }),
    db.grupo.count({ where: { activo: true } }),
    db.planEstudios.count({ where: { activo: true } }),
    db.cicloEscolar.findFirst({
      where: { estado: "ACTIVO" },
      include: { periodos: { orderBy: { numero: "asc" } } },
      orderBy: { fechaInicio: "desc" },
    }),
  ]);

  const escala = await db.escalaCalificacion.findFirst({ where: { predeterminada: true } });
  const faltasAlerta = await configNumero("asistencia.faltas_consecutivas_alerta", 3);
  const diaVencimiento = await configNumero("finanzas.dia_vencimiento_default", 10);
  const modoAsistencia = await configTexto("asistencia.modo_predeterminado", "POR_CLASE");
  const pendientes = navegacionPara(sesion.rol).filter((item) => !estaDisponible(item));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">
          Hola, {sesion.nombre.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {institucion?.nombre}
          {ciclo && ` · ${ciclo.nombre}`}
        </p>
      </header>

      {sesion.rol === "ADMIN" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador etiqueta="Alumnos activos" valor={alumnos} />
            <Indicador etiqueta="Docentes activos" valor={docentes} />
            <Indicador etiqueta="Grupos" valor={grupos} />
            <Indicador etiqueta="Planes de estudio" valor={planes} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta titulo="Ciclo escolar activo">
              {ciclo ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{ciclo.nombre}</span>
                    <Insignia tono="exito">{ciclo.estado}</Insignia>
                  </div>
                  <p className="text-sm text-slate-600">
                    {formatearFecha(ciclo.fechaInicio)} — {formatearFecha(ciclo.fechaFin)}
                  </p>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {ciclo.periodos.map((periodo) => (
                      <li key={periodo.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-slate-700">{periodo.nombre}</span>
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {formatearFecha(periodo.fechaInicio)} — {formatearFecha(periodo.fechaFin)}
                          {periodo.capturaAbierta && <Insignia tono="exito">Captura abierta</Insignia>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <EstadoVacio titulo="No hay un ciclo activo" />
              )}
            </Tarjeta>

            <Tarjeta
              titulo="Reglas vigentes"
              descripcion="Definidas en la instalacion, editables en Configuracion"
            >
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Escala de calificacion</dt>
                  <dd className="font-medium text-slate-900">
                    {escala
                      ? `${Number(escala.valorMinimo)} a ${Number(escala.valorMaximo)}`
                      : "Sin definir"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Minima aprobatoria</dt>
                  <dd className="font-medium text-slate-900">
                    {escala ? Number(escala.minimaAprobatoria) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Redondeo</dt>
                  <dd className="font-medium text-slate-900">{escala?.redondeo ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Asistencia predeterminada</dt>
                  <dd className="font-medium text-slate-900">
                    {modoAsistencia === "POR_DIA" ? "Por dia" : "Por clase"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Alerta por faltas consecutivas</dt>
                  <dd className="font-medium text-slate-900">{faltasAlerta}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Dia de vencimiento de cobros</dt>
                  <dd className="font-medium text-slate-900">Dia {diaVencimiento}</dd>
                </div>
              </dl>
              <Link
                href="/panel/configuracion"
                className="mt-4 inline-block text-sm font-medium text-marca-600 hover:underline"
              >
                Editar configuracion →
              </Link>
            </Tarjeta>
          </div>
        </>
      )}

      {sesion.rol === "DOCENTE" && (
        <Alerta tipo="info">
          Tu portal de docente (pase de lista y captura de calificaciones) se habilita en la Fase 3.
          Mientras tanto ya puedes consultar los grupos en los que te asignaron clases.
        </Alerta>
      )}

      {sesion.rol === "ALUMNO" && (
        <Alerta tipo="info">
          Tu portal (calificaciones, asistencia, horario y estado de cuenta) se habilita en la
          Fase 4.
        </Alerta>
      )}

      {pendientes.length > 0 && (
        <Tarjeta titulo="Modulos en construccion" descripcion="Plan de entrega por fases">
          <ul className="grid gap-2 sm:grid-cols-2">
            {pendientes.map((item) => (
              <li
                key={item.ruta}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{item.etiqueta}</span>
                <Insignia>Fase {item.fase}</Insignia>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
