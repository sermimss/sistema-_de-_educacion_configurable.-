import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { obtenerInstitucion } from "@/lib/institucion";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { configTexto } from "@/lib/configuracion";
import { aNumero } from "@/lib/finanzas";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { Alerta } from "@/components/ui";
import { BotonImprimir } from "@/app/panel/boletas/Acciones";

export const dynamic = "force-dynamic";

export default async function PaginaRecibo({ params }: { params: Promise<{ pagoId: string }> }) {
  const sesion = await requerirSesion();
  const { pagoId } = await params;
  const id = Number(pagoId);
  if (!Number.isFinite(id)) notFound();

  const pago = await db.pago.findUnique({
    where: { id },
    include: {
      alumno: { include: { plan: true, tutores: { where: { esResponsableFinanciero: true } } } },
      recibo: true,
      aplicaciones: { include: { cargo: { include: { concepto: true } } } },
    },
  });
  if (!pago) notFound();

  // El alumno solo puede ver sus propios recibos.
  if (sesion.rol === "ALUMNO") {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (!alumno || alumno.id !== pago.alumnoId) {
      return <Alerta tipo="error">Ese recibo no es tuyo.</Alerta>;
    }
  } else if (sesion.rol === "DOCENTE") {
    return <Alerta tipo="error">Los recibos los consulta administracion.</Alerta>;
  }

  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";
  const leyenda = await configTexto(
    "finanzas.leyenda_recibo",
    "Este comprobante no tiene validez fiscal."
  );

  const regreso =
    sesion.rol === "ALUMNO" ? "/panel/estado-de-cuenta" : `/panel/finanzas/alumno/${pago.alumnoId}`;

  return (
    <div className="space-y-4">
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-3">
        <Link href={regreso} className="text-sm text-marca-600 hover:underline">
          ← Estado de cuenta
        </Link>
        <BotonImprimir />
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
              <p className="text-xs text-slate-500">
                {[institucion?.direccion, institucion?.ciudad].filter(Boolean).join(" · ")}
              </p>
              {institucion?.rfc && <p className="text-xs text-slate-500">RFC: {institucion.rfc}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Recibo de pago
            </p>
            <p className="font-mono text-sm text-slate-900">
              {pago.recibo ? `${pago.recibo.serie}-${pago.recibo.folio}` : pago.folio}
            </p>
            <p className="text-xs text-slate-400">{formatearFechaHora(pago.fecha)}</p>
          </div>
        </header>

        <section className="grid gap-x-6 gap-y-1 border-b border-slate-200 py-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-slate-500">Alumno: </span>
            <span className="font-medium text-slate-900">{nombreCompleto(pago.alumno)}</span>
          </p>
          <p>
            <span className="text-slate-500">Matricula: </span>
            <span className="font-mono text-slate-900">{pago.alumno.matricula}</span>
          </p>
          <p>
            <span className="text-slate-500">Plan: </span>
            <span className="text-slate-900">{pago.alumno.plan.nombre}</span>
          </p>
          <p>
            <span className="text-slate-500">Metodo de pago: </span>
            <span className="text-slate-900">
              {pago.metodoPago.replace(/_/g, " ").toLowerCase()}
              {pago.referencia ? ` · ref ${pago.referencia}` : ""}
            </span>
          </p>
          {pago.alumno.rfcFacturacion && (
            <p>
              <span className="text-slate-500">RFC de facturacion: </span>
              <span className="font-mono text-slate-900">{pago.alumno.rfcFacturacion}</span>
            </p>
          )}
          {pago.alumno.tutores[0] && (
            <p>
              <span className="text-slate-500">Responsable de pago: </span>
              <span className="text-slate-900">{pago.alumno.tutores[0].nombre}</span>
            </p>
          )}
        </section>

        <section className="py-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left">
                <th className="py-2 pr-3 text-xs font-semibold uppercase text-slate-600">Concepto</th>
                <th className="px-2 py-2 text-xs font-semibold uppercase text-slate-600">Vencia</th>
                <th className="py-2 pl-2 text-right text-xs font-semibold uppercase text-slate-600">
                  Importe
                </th>
              </tr>
            </thead>
            <tbody>
              {pago.aplicaciones.map((aplicacion) => (
                <tr key={aplicacion.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-800">
                    {aplicacion.cargo.descripcion}
                    <span className="ml-2 font-mono text-[10px] text-slate-400">
                      {aplicacion.cargo.folio}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-slate-500">
                    {formatearFecha(aplicacion.cargo.fechaVencimiento)}
                  </td>
                  <td className="py-1.5 pl-2 text-right text-slate-900">
                    {formatearMoneda(aNumero(aplicacion.monto), moneda)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="py-2 text-right text-sm font-semibold text-slate-700">
                  Total pagado
                </td>
                <td className="py-2 pl-2 text-right text-lg font-bold text-slate-900">
                  {formatearMoneda(aNumero(pago.montoTotal), moneda)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <footer className="border-t border-slate-300 pt-3 text-xs text-slate-500">
          <p>{leyenda}</p>
          {pago.recibo?.estadoCfdi === "NO_APLICA" && (
            <p className="mt-1 text-slate-400">
              Comprobante interno. Los datos fiscales quedan guardados para el timbrado CFDI cuando
              el colegio conecte un PAC.
            </p>
          )}
          {pago.recibo?.uuidCfdi && (
            <p className="mt-1 font-mono text-slate-600">UUID: {pago.recibo.uuidCfdi}</p>
          )}
        </footer>
      </article>
    </div>
  );
}
