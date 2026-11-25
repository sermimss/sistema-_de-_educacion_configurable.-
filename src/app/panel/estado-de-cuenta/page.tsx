import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { obtenerInstitucion } from "@/lib/institucion";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { configBool } from "@/lib/configuracion";
import { aNumero, resumenDeCuenta } from "@/lib/finanzas";
import { estadoVisible, prepararCuenta, saldoAFavor } from "@/lib/cobranza";
import { configTexto } from "@/lib/configuracion";
import { referenciaDeAlumno } from "@/lib/referenciaAlumno";
import { hoyEnZona } from "@/lib/fechasDia";
import { FormularioComprobante } from "./FormularioComprobante";
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
  // Recargos de hoy y saldo a favor aplicado antes de mostrar.
  await prepararCuenta(alumno.id);
  const aFavor = await saldoAFavor(alumno.id);

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
  const [banco, titular, cuenta, clabe, instrucciones, comprobantes] = await Promise.all([
    configTexto("finanzas.pago_banco", ""),
    configTexto("finanzas.pago_titular", ""),
    configTexto("finanzas.pago_cuenta", ""),
    configTexto("finanzas.pago_clabe", ""),
    configTexto("finanzas.pago_instrucciones", ""),
    db.comprobantePago.findMany({
      where: { alumnoId: alumno.id },
      orderBy: { creadoEn: "desc" },
      take: 20,
      select: { id: true, monto: true, fechaPago: true, referencia: true, estado: true, motivoRechazo: true, pagoId: true },
    }),
  ]);
  const referencia = referenciaDeAlumno(alumno.id);
  const datosBanco = [
    ["Banco", banco],
    ["Titular", titular],
    ["Cuenta", cuenta],
    ["CLABE", clabe],
  ].filter(([, v]) => v);

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
          Tienes {formatearMoneda(resumen.vencido, moneda)} vencidos. Puedes pagar en el colegio o por transferencia (abajo
          estan los datos).
        </Alerta>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Cargado", resumen.totalCargado],
          ["Pagado", resumen.totalPagado],
          ["Saldo", resumen.saldo],
          ...(aFavor > 0 ? [["A favor", aFavor]] : []),
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
                          estadoVisible(cargo, hoy) === "PAGADO"
                            ? "exito"
                            : estadoVisible(cargo, hoy) === "VENCIDO"
                              ? "peligro"
                              : "neutro"
                        }
                      >
                        {estadoVisible(cargo, hoy).toLowerCase()}
                      </Insignia>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Como pagar" descripcion="En el colegio, o por transferencia o deposito">
        <div className="space-y-3 text-sm" data-como-pagar>
          <p>
            Tu referencia de pago: <strong className="font-mono text-base tracking-wider" data-referencia-alumno>{referencia}</strong>
          </p>
          {datosBanco.length > 0 ? (
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {datosBanco.map(([etiqueta, valor]) => (
                <div key={etiqueta} className="flex gap-2">
                  <dt className="text-slate-500">{etiqueta}:</dt>
                  <dd className="font-medium text-slate-900">{valor}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-slate-500">El colegio aun no publica sus datos bancarios; pregunta en la administracion.</p>
          )}
          {instrucciones && <p className="text-slate-600">{instrucciones}</p>}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Ya pague: enviar comprobante" descripcion="El colegio lo verifica y registra tu pago">
        <div className="space-y-4">
          <FormularioComprobante hoy={hoyEnZona(institucion?.zonaHoraria ?? "America/Mexico_City")} />
          {comprobantes.length > 0 && (
            <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
              {comprobantes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-mi-comprobante={c.estado}>
                  <span>
                    {formatearMoneda(aNumero(c.monto), moneda)} · {formatearFecha(c.fechaPago)} · ref {c.referencia}
                    {c.estado === "RECHAZADO" && c.motivoRechazo && (
                      <span className="block text-xs text-red-700">Motivo: {c.motivoRechazo}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <Insignia tono={c.estado === "CONFIRMADO" ? "exito" : c.estado === "RECHAZADO" ? "peligro" : "alerta"}>
                      {c.estado === "CONFIRMADO" ? "Confirmado" : c.estado === "RECHAZADO" ? "Rechazado" : "Por verificar"}
                    </Insignia>
                    {c.pagoId && (
                      <Link href={`/panel/finanzas/recibo/${c.pagoId}`} className="text-xs text-marca-600 hover:underline">Recibo</Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
