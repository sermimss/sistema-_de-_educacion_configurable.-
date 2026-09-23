import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { obtenerInstitucion } from "@/lib/institucion";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { configBool } from "@/lib/configuracion";
import { aNumero, resumenDeCuenta } from "@/lib/finanzas";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PaginaMiEstadoCuenta() {
  const sesion = await requerirRol("ALUMNO");
  const alumno = await alumnoDeSesion(sesion.usuarioId);
  if (!alumno) return <Alerta tipo="error">Tu usuario no esta ligado a un expediente de alumno.</Alerta>;

  if (!(await configBool("portales.alumno_ve_estado_cuenta", true))) {
    return <Alerta tipo="aviso">El colegio tiene desactivada esta seccion.</Alerta>;
  }

  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";

  const [cargos, pagos, resumen] = await Promise.all([
    db.cargo.findMany({
      where: { alumnoId: alumno.id, estado: { not: "CANCELADO" } },
      orderBy: { fechaVencimiento: "asc" },
    }),
    db.pago.findMany({
      where: { alumnoId: alumno.id, estado: { not: "CANCELADO" } },
      orderBy: { fecha: "desc" },
      include: { recibo: true },
    }),
    resumenDeCuenta(alumno.id),
  ]);

  const hoy = new Date();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Mi estado de cuenta</h1>
        <p className="mt-1 text-sm text-slate-600">
          <span className="font-mono">{alumno.matricula}</span> · {alumno.plan.nombre}
        </p>
      </header>

      {resumen.vencido > 0 && (
        <Alerta tipo="aviso">
          Tienes {formatearMoneda(resumen.vencido, moneda)} vencidos. Acude a la administracion del
          colegio.
        </Alerta>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Cargado", resumen.totalCargado],
          ["Pagado", resumen.totalPagado],
          ["Saldo", resumen.saldo],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta as string} className="tarjeta px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{etiqueta as string}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatearMoneda(valor as number, moneda)}
            </p>
          </div>
        ))}
      </div>

      <Tarjeta titulo="Cargos">
        {cargos.length === 0 ? (
          <EstadoVacio titulo="No tienes cargos registrados" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Motivo</th>
                  <th className="pb-2 pr-3 font-medium">Vence</th>
                  <th className="pb-2 pr-3 font-medium">Total</th>
                  <th className="pb-2 pr-3 font-medium">Saldo</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargos.map((cargo) => (
                  <tr key={cargo.id}>
                    <td className="py-2 pr-3 text-slate-800">{cargo.descripcion}</td>
                    <td
                      className={`py-2 pr-3 text-xs ${
                        cargo.fechaVencimiento < hoy && aNumero(cargo.saldo) > 0
                          ? "text-red-600"
                          : "text-slate-500"
                      }`}
                    >
                      {formatearFecha(cargo.fechaVencimiento)}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {formatearMoneda(aNumero(cargo.montoTotal), moneda)}
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-900">
                      {formatearMoneda(aNumero(cargo.saldo), moneda)}
                    </td>
                    <td className="py-2">
                      <Insignia
                        tono={
                          cargo.estado === "PAGADO"
                            ? "exito"
                            : cargo.estado === "VENCIDO"
                              ? "peligro"
                              : "neutro"
                        }
                      >
                        {cargo.estado.toLowerCase()}
                      </Insignia>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Mis pagos">
        {pagos.length === 0 ? (
          <EstadoVacio titulo="Sin pagos registrados" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pagos.map((pago) => (
              <li key={pago.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    {formatearMoneda(aNumero(pago.montoTotal), moneda)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatearFechaHora(pago.fecha)} ·{" "}
                    {pago.metodoPago.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
                {pago.recibo && (
                  <Link
                    href={`/panel/finanzas/recibo/${pago.id}`}
                    className="text-sm font-medium text-marca-600 hover:underline"
                  >
                    Recibo {pago.recibo.serie}-{pago.recibo.folio}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
