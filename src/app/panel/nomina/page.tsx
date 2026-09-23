import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { obtenerInstitucion } from "@/lib/institucion";
import { configBool, configTexto } from "@/lib/configuracion";
import { aNumero, centavos } from "@/lib/finanzas";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { FormularioPeriodo } from "./Formularios";

export const dynamic = "force-dynamic";

const TONO_PERIODO: Record<string, "exito" | "alerta" | "neutro" | "peligro"> = {
  ABIERTO: "neutro",
  CALCULADO: "alerta",
  PAGADO: "exito",
  CANCELADO: "peligro",
};

export default async function PaginaNomina() {
  await requerirRol("ADMIN");

  const activa = await configBool("nomina.activa", true);
  if (!activa) {
    return (
      <Alerta tipo="aviso">
        El modulo de nomina esta desactivado.{" "}
        <Link href="/panel/configuracion" className="font-medium underline">
          Activalo en Configuracion
        </Link>
      </Alerta>
    );
  }

  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";
  const periodicidad = await configTexto("nomina.periodicidad_default", "MENSUAL");

  const [periodos, empleados, conceptos, sinSalario] = await Promise.all([
    db.periodoNomina.findMany({
      orderBy: { fechaInicio: "desc" },
      include: { recibos: true },
    }),
    db.empleado.count({ where: { estado: "ACTIVO" } }),
    db.conceptoNomina.count({ where: { activo: true } }),
    db.empleado.count({ where: { estado: "ACTIVO", salarioBase: null } }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Nomina</h1>
          <p className="mt-1 text-sm text-slate-600">
            {empleados} empleado(s) activos · {conceptos} concepto(s) de nomina
          </p>
        </div>
        <Link
          href="/panel/nomina/conceptos"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Conceptos de nomina
        </Link>
      </header>

      {sinSalario > 0 && (
        <Alerta tipo="aviso">
          Hay {sinSalario} empleado(s) activos sin salario base capturado. Su recibo saldria en
          cero.{" "}
          <Link href="/panel/personal" className="font-medium underline">
            Revisar el personal
          </Link>
        </Alerta>
      )}

      <Tarjeta titulo="Nuevo periodo de nomina">
        <FormularioPeriodo periodicidad={periodicidad} />
      </Tarjeta>

      <Tarjeta titulo="Periodos" descripcion={`${periodos.length} registrado(s)`}>
        {periodos.length === 0 ? (
          <EstadoVacio titulo="Sin periodos de nomina" mensaje="Crea el primero arriba." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Periodo</th>
                  <th className="pb-2 pr-3 font-medium">Cubre</th>
                  <th className="pb-2 pr-3 font-medium">Se paga</th>
                  <th className="pb-2 pr-3 font-medium">Recibos</th>
                  <th className="pb-2 pr-3 font-medium">Neto</th>
                  <th className="pb-2 pr-3 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodos.map((periodo) => {
                  const neto = centavos(
                    periodo.recibos
                      .filter((recibo) => recibo.estado !== "CANCELADO")
                      .reduce((suma, recibo) => suma + aNumero(recibo.neto), 0)
                  );
                  return (
                    <tr key={periodo.id}>
                      <td className="py-2 pr-3 font-medium text-slate-800">{periodo.nombre}</td>
                      <td className="py-2 pr-3 text-xs text-slate-600">
                        {formatearFecha(periodo.fechaInicio)} — {formatearFecha(periodo.fechaFin)}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-600">
                        {formatearFecha(periodo.fechaPago)}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{periodo.recibos.length}</td>
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {formatearMoneda(neto, moneda)}
                      </td>
                      <td className="py-2 pr-3">
                        <Insignia tono={TONO_PERIODO[periodo.estado] ?? "neutro"}>
                          {periodo.estado.toLowerCase()}
                        </Insignia>
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/panel/nomina/${periodo.id}`}
                          className="text-sm font-medium text-marca-600 hover:underline"
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
