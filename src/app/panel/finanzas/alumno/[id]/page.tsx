import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { obtenerInstitucion } from "@/lib/institucion";
import { configBool } from "@/lib/configuracion";
import { aNumero, resumenDeCuenta } from "@/lib/finanzas";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import {
  BotonCancelarPago,
  BotonEstadoCargo,
  FormularioCargoManual,
  FormularioConvenio,
  FormularioPago,
} from "../../Operaciones";

export const dynamic = "force-dynamic";

const TONO_CARGO: Record<string, "exito" | "alerta" | "peligro" | "neutro"> = {
  PAGADO: "exito",
  PENDIENTE: "neutro",
  PARCIAL: "alerta",
  VENCIDO: "peligro",
  CANCELADO: "neutro",
  CONDONADO: "neutro",
};

export default async function PaginaEstadoCuenta({ params }: { params: Promise<{ id: string }> }) {
  await requerirRol("ADMIN");
  const { id } = await params;
  const alumnoId = Number(id);
  if (!Number.isFinite(alumnoId)) notFound();

  const alumno = await db.alumno.findUnique({
    where: { id: alumnoId },
    include: {
      plan: true,
      tutores: { where: { esResponsableFinanciero: true } },
      descuentos: { where: { activo: true }, include: { descuento: true } },
    },
  });
  if (!alumno) notFound();

  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";

  const [cargos, pagos, convenios, conceptos, resumen, permiteParciales, permiteConvenios] =
    await Promise.all([
      db.cargo.findMany({
        where: { alumnoId },
        orderBy: { fechaVencimiento: "asc" },
        include: { concepto: true, convenio: true },
      }),
      db.pago.findMany({
        where: { alumnoId },
        orderBy: { fecha: "desc" },
        include: { aplicaciones: { include: { cargo: true } }, recibo: true },
      }),
      db.convenioPago.findMany({
        where: { alumnoId },
        orderBy: { fechaInicio: "desc" },
        include: { parcialidades: { orderBy: { numero: "asc" } } },
      }),
      db.conceptoCobro.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
      resumenDeCuenta(alumnoId),
      configBool("finanzas.permite_pagos_parciales", true),
      configBool("finanzas.permite_convenios", true),
    ]);

  const hoy = new Date();
  const pendientes = cargos
    .filter((cargo) => ["PENDIENTE", "PARCIAL", "VENCIDO"].includes(cargo.estado))
    .map((cargo) => ({
      id: cargo.id,
      descripcion: cargo.descripcion,
      saldo: aNumero(cargo.saldo),
      vence: cargo.fechaVencimiento.toISOString().slice(0, 10),
      vencido: cargo.fechaVencimiento < hoy,
    }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/panel/finanzas" className="text-sm text-marca-600 hover:underline">
            ← Finanzas
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{nombreCompleto(alumno)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono">{alumno.matricula}</span> · {alumno.plan.nombre}
            {alumno.tutores[0] && ` · paga: ${alumno.tutores[0].nombre}`}
          </p>
        </div>
        <Link
          href={`/panel/alumnos/${alumno.id}`}
          className="text-sm font-medium text-marca-600 hover:underline"
        >
          Ver expediente
        </Link>
      </header>

      {alumno.tieneAdeudo && (
        <Alerta tipo="aviso">
          Este alumno tiene adeudo vencido por {formatearMoneda(resumen.vencido, moneda)}.
        </Alerta>
      )}

      {alumno.descuentos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alumno.descuentos.map((asignacion) => (
            <Insignia key={asignacion.id} tono="exito">
              {asignacion.descuento.nombre} · {Number(asignacion.descuento.valor)}
              {asignacion.descuento.tipoCalculo === "PORCENTAJE" ? "%" : ""}
            </Insignia>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Cargado", resumen.totalCargado],
          ["Pagado", resumen.totalPagado],
          ["Saldo", resumen.saldo],
          ["Vencido", resumen.vencido],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta as string} className="tarjeta px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{etiqueta as string}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {formatearMoneda(valor as number, moneda)}
            </p>
          </div>
        ))}
      </div>

      <Tarjeta titulo="Cargos" descripcion={`${cargos.length} movimiento(s)`}>
        {cargos.length === 0 ? (
          <EstadoVacio titulo="Sin cargos" mensaje="Genera los cargos del ciclo o agrega uno manual." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Folio</th>
                  <th className="pb-2 pr-3 font-medium">Motivo</th>
                  <th className="pb-2 pr-3 font-medium">Vence</th>
                  <th className="pb-2 pr-3 font-medium">Monto</th>
                  <th className="pb-2 pr-3 font-medium">Beca</th>
                  <th className="pb-2 pr-3 font-medium">Recargo</th>
                  <th className="pb-2 pr-3 font-medium">Saldo</th>
                  <th className="pb-2 pr-3 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargos.map((cargo) => (
                  <tr key={cargo.id}>
                    <td className="py-2 pr-3 font-mono text-[11px] text-slate-500">{cargo.folio}</td>
                    <td className="py-2 pr-3 text-slate-800">
                      {cargo.descripcion}
                      {cargo.convenio && (
                        <span className="ml-2 text-[11px] text-amber-700">
                          convenio {cargo.convenio.folio}
                        </span>
                      )}
                    </td>
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
                      {formatearMoneda(aNumero(cargo.montoOriginal), moneda)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-emerald-700">
                      {aNumero(cargo.montoDescuento) > 0
                        ? `-${formatearMoneda(aNumero(cargo.montoDescuento), moneda)}`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs text-red-700">
                      {aNumero(cargo.montoRecargo) > 0
                        ? `+${formatearMoneda(aNumero(cargo.montoRecargo), moneda)}`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-900">
                      {formatearMoneda(aNumero(cargo.saldo), moneda)}
                    </td>
                    <td className="py-2 pr-3">
                      <Insignia tono={TONO_CARGO[cargo.estado] ?? "neutro"}>
                        {cargo.estado.toLowerCase()}
                      </Insignia>
                    </td>
                    <td className="py-2 text-right">
                      {["PENDIENTE", "VENCIDO"].includes(cargo.estado) && (
                        <BotonEstadoCargo cargoId={cargo.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Registrar pago">
        {pendientes.length === 0 ? (
          <EstadoVacio titulo="Este alumno no tiene saldo pendiente" />
        ) : (
          <FormularioPago
            alumnoId={alumno.id}
            cargos={pendientes}
            permiteParciales={permiteParciales}
            moneda={moneda}
          />
        )}
      </Tarjeta>

      <Tarjeta titulo="Pagos registrados" descripcion={`${pagos.length} pago(s)`}>
        {pagos.length === 0 ? (
          <EstadoVacio titulo="Sin pagos" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pagos.map((pago) => (
              <li key={pago.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {formatearMoneda(aNumero(pago.montoTotal), moneda)}
                      <span className="ml-2 font-mono text-xs text-slate-400">{pago.folio}</span>
                      {pago.estado === "CANCELADO" && (
                        <span className="ml-2">
                          <Insignia tono="peligro">cancelado</Insignia>
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatearFechaHora(pago.fecha)} · {pago.metodoPago.replace(/_/g, " ").toLowerCase()}
                      {pago.referencia ? ` · ref ${pago.referencia}` : ""} ·{" "}
                      {pago.aplicaciones.length} cargo(s)
                    </p>
                    {pago.motivoCancelacion && (
                      <p className="text-xs text-red-600">Motivo: {pago.motivoCancelacion}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {pago.recibo && pago.estado !== "CANCELADO" && (
                      <Link
                        href={`/panel/finanzas/recibo/${pago.id}`}
                        className="text-sm font-medium text-marca-600 hover:underline"
                      >
                        Ver recibo {pago.recibo.serie}-{pago.recibo.folio}
                      </Link>
                    )}
                    {pago.estado !== "CANCELADO" && <BotonCancelarPago pagoId={pago.id} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {permiteConvenios && (
        <Tarjeta titulo="Convenios de pago" descripcion={`${convenios.length} convenio(s)`}>
          <div className="space-y-4">
            {convenios.map((convenio) => (
              <div key={convenio.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800">
                    {convenio.folio} · {formatearMoneda(aNumero(convenio.montoTotal), moneda)} en{" "}
                    {convenio.numeroParcialidades} parcialidades
                  </p>
                  <Insignia tono={convenio.estado === "VIGENTE" ? "alerta" : "neutro"}>
                    {convenio.estado.toLowerCase()}
                  </Insignia>
                </div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {convenio.parcialidades.map((parcialidad) => (
                    <li
                      key={parcialidad.id}
                      className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600"
                    >
                      {parcialidad.numero}. {formatearMoneda(aNumero(parcialidad.monto), moneda)} ·{" "}
                      {formatearFecha(parcialidad.fechaVencimiento)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-4">
              <FormularioConvenio
                alumnoId={alumno.id}
                cargos={pendientes.map((cargo) => ({
                  id: cargo.id,
                  descripcion: cargo.descripcion,
                  saldo: cargo.saldo,
                }))}
              />
            </div>
          </div>
        </Tarjeta>
      )}

      <Tarjeta titulo="Cargo manual" descripcion="Motivo, monto y fecha libres">
        <FormularioCargoManual
          alumnoId={alumno.id}
          conceptos={conceptos.map((concepto) => ({ id: concepto.id, etiqueta: concepto.nombre }))}
        />
      </Tarjeta>
    </div>
  );
}
