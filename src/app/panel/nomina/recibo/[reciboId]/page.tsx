import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { obtenerInstitucion } from "@/lib/institucion";
import { configTexto } from "@/lib/configuracion";
import { aNumero } from "@/lib/finanzas";
import { sueldoDeRecibo } from "@/lib/nomina";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { Insignia, Tarjeta } from "@/components/ui";
import { BotonImprimir } from "@/app/panel/boletas/Acciones";
import { FormularioCancelarRecibo, FormularioLinea } from "../../Formularios";
import { quitarLineaRecibo } from "../../acciones";

export const dynamic = "force-dynamic";

export default async function PaginaReciboNomina({
  params,
}: {
  params: Promise<{ reciboId: string }>;
}) {
  await requerirRol("ADMIN");
  const { reciboId } = await params;
  const id = Number(reciboId);
  if (!Number.isFinite(id)) notFound();

  const recibo = await db.reciboNomina.findUnique({
    where: { id },
    include: {
      empleado: true,
      periodo: true,
      detalles: { include: { concepto: true }, orderBy: { id: "asc" } },
    },
  });
  if (!recibo) notFound();

  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";
  const leyenda = await configTexto(
    "nomina.leyenda_recibo",
    "Comprobante interno de pago. No sustituye al CFDI de nomina."
  );

  const conceptos = await db.conceptoNomina.findMany({
    where: { activo: true },
    orderBy: { orden: "asc" },
  });

  const lineas = recibo.detalles.map((detalle) => ({
    id: detalle.id,
    nombre: detalle.concepto.nombre,
    tipo: detalle.concepto.tipo,
    cantidad: detalle.cantidad != null ? aNumero(detalle.cantidad) : null,
    importe: aNumero(detalle.importe),
  }));

  const sueldo = sueldoDeRecibo(aNumero(recibo.totalPercepciones), lineas);
  const percepciones = lineas.filter((linea) => linea.tipo !== "DEDUCCION");
  const deducciones = lineas.filter((linea) => linea.tipo === "DEDUCCION");
  const editable = recibo.estado === "BORRADOR";

  return (
    <div className="space-y-4">
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/panel/nomina/${recibo.periodoId}`}
          className="text-sm text-marca-600 hover:underline"
        >
          ← {recibo.periodo.nombre}
        </Link>
        <div className="flex items-center gap-3">
          <Insignia
            tono={
              recibo.estado === "PAGADO"
                ? "exito"
                : recibo.estado === "CANCELADO"
                  ? "peligro"
                  : "alerta"
            }
          >
            {recibo.estado.toLowerCase()}
          </Insignia>
          <BotonImprimir />
        </div>
      </div>

      <article className="hoja-impresion mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="flex items-start justify-between gap-6 border-b border-slate-300 pb-4">
          <div className="flex items-center gap-4">
            {institucion?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={institucion.logoUrl} alt="" className="h-14 w-auto" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-marca-600 text-lg font-bold text-white">
                {(institucion?.nombreCorto ?? institucion?.nombre ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-base font-bold text-slate-900">{institucion?.nombre}</h1>
              {institucion?.rfc && <p className="text-xs text-slate-500">RFC: {institucion.rfc}</p>}
              {institucion?.razonSocial && (
                <p className="text-xs text-slate-500">{institucion.razonSocial}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Recibo de nomina
            </p>
            <p className="font-mono text-sm text-slate-900">{recibo.folio}</p>
            <p className="text-xs text-slate-400">{recibo.periodo.nombre}</p>
          </div>
        </header>

        <section className="grid gap-x-6 gap-y-1 border-b border-slate-200 py-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-slate-500">Empleado: </span>
            <span className="font-medium text-slate-900">{nombreCompleto(recibo.empleado)}</span>
          </p>
          <p>
            <span className="text-slate-500">Numero: </span>
            <span className="font-mono text-slate-900">{recibo.empleado.numeroEmpleado}</span>
          </p>
          <p>
            <span className="text-slate-500">Puesto: </span>
            <span className="text-slate-900">{recibo.empleado.puesto ?? "—"}</span>
          </p>
          <p>
            <span className="text-slate-500">Periodo: </span>
            <span className="text-slate-900">
              {formatearFecha(recibo.periodo.fechaInicio)} —{" "}
              {formatearFecha(recibo.periodo.fechaFin)}
            </span>
          </p>
          {recibo.empleado.rfc && (
            <p>
              <span className="text-slate-500">RFC: </span>
              <span className="font-mono text-slate-900">{recibo.empleado.rfc}</span>
            </p>
          )}
          {recibo.empleado.nss && (
            <p>
              <span className="text-slate-500">NSS: </span>
              <span className="font-mono text-slate-900">{recibo.empleado.nss}</span>
            </p>
          )}
        </section>

        <section className="grid gap-6 py-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 border-b border-slate-200 pb-1 text-xs font-semibold uppercase text-slate-600">
              Percepciones
            </h2>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-1 text-slate-700">Sueldo del periodo</td>
                  <td className="py-1 text-right text-slate-900">
                    {formatearMoneda(sueldo, moneda)}
                  </td>
                </tr>
                {percepciones.map((linea) => (
                  <tr key={linea.id} className="border-b border-slate-100">
                    <td className="py-1 text-slate-700">
                      {linea.nombre}
                      {linea.cantidad != null && (
                        <span className="ml-1 text-xs text-slate-400">({linea.cantidad})</span>
                      )}
                    </td>
                    <td className="py-1 text-right text-slate-900">
                      {formatearMoneda(linea.importe, moneda)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1 text-sm font-semibold text-slate-700">Total</td>
                  <td className="py-1 text-right font-semibold text-slate-900">
                    {formatearMoneda(aNumero(recibo.totalPercepciones), moneda)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="mb-2 border-b border-slate-200 pb-1 text-xs font-semibold uppercase text-slate-600">
              Deducciones
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {deducciones.length === 0 ? (
                  <tr>
                    <td className="py-1 text-slate-400">Sin deducciones</td>
                  </tr>
                ) : (
                  deducciones.map((linea) => (
                    <tr key={linea.id} className="border-b border-slate-100">
                      <td className="py-1 text-slate-700">{linea.nombre}</td>
                      <td className="py-1 text-right text-slate-900">
                        {formatearMoneda(linea.importe, moneda)}
                      </td>
                    </tr>
                  ))
                )}
                <tr>
                  <td className="py-1 text-sm font-semibold text-slate-700">Total</td>
                  <td className="py-1 text-right font-semibold text-slate-900">
                    {formatearMoneda(aNumero(recibo.totalDeducciones), moneda)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex items-center justify-between border-t-2 border-slate-300 py-3">
          <p className="text-sm font-semibold uppercase text-slate-700">Neto a pagar</p>
          <p className="text-2xl font-bold text-slate-900">
            {formatearMoneda(aNumero(recibo.neto), moneda)}
          </p>
        </section>

        <footer className="border-t border-slate-200 pt-3 text-xs text-slate-500">
          <p>{leyenda}</p>
          {recibo.fechaPago && (
            <p className="mt-1">
              Pagado el {formatearFecha(recibo.fechaPago)}
              {recibo.metodoPago ? ` por ${recibo.metodoPago.replace(/_/g, " ").toLowerCase()}` : ""}
            </p>
          )}
          {recibo.observaciones && (
            <p className="mt-1 text-red-600">Observaciones: {recibo.observaciones}</p>
          )}
          <div className="mt-10 grid grid-cols-2 gap-10 text-center">
            <div className="border-t border-slate-400 pt-1">Firma del empleado</div>
            <div className="border-t border-slate-400 pt-1">Por la institucion</div>
          </div>
        </footer>
      </article>

      {editable && (
        <div className="no-imprimir space-y-4">
          <Tarjeta
            titulo="Ajustes de este recibo"
            descripcion="Bonos, prestamos u horas extra que solo aplican a este empleado"
          >
            <div className="space-y-4">
              {lineas.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {lineas.map((linea) => (
                    <li key={linea.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-700">
                        {linea.nombre}
                        <span className="ml-2 text-xs text-slate-400">
                          {linea.tipo === "DEDUCCION" ? "deduccion" : "percepcion"}
                        </span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-900">
                          {formatearMoneda(linea.importe, moneda)}
                        </span>
                        <form action={quitarLineaRecibo}>
                          <input type="hidden" name="detalleId" value={linea.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            quitar
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-slate-100 pt-4">
                <FormularioLinea
                  reciboId={recibo.id}
                  conceptos={conceptos.map((concepto) => ({
                    id: concepto.id,
                    etiqueta: `${concepto.nombre} (${concepto.tipo === "DEDUCCION" ? "deduccion" : "percepcion"})`,
                  }))}
                />
              </div>
            </div>
          </Tarjeta>
        </div>
      )}

      {recibo.estado !== "CANCELADO" && (
        <div className="no-imprimir">
          <Tarjeta titulo="Cancelar recibo">
            <FormularioCancelarRecibo reciboId={recibo.id} />
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
