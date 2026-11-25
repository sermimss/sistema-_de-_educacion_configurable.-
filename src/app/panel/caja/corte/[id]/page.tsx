import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { obtenerInstitucion } from "@/lib/institucion";
import { urlLogo } from "@/lib/marca";
import { aNumero } from "@/lib/finanzas";
import { NOMBRE_METODO, resumenTurno } from "@/lib/caja";
import { fechaHoraLegible } from "@/lib/fechasDia";
import { formatearMoneda } from "@/lib/formato";
import { Alerta } from "@/components/ui";
import { BotonImprimir } from "@/app/panel/boletas/Acciones";

export const dynamic = "force-dynamic";

/// Corte de caja imprimible. Con la caja abierta es un corte parcial.
export default async function PaginaCorte({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cerrado?: string }> }) {
  const sesion = await requerirRol("ADMIN", "CAJERO");
  const { cerrado } = await searchParams;
  const turno = await db.turnoCaja.findUnique({
    where: { id: Number((await params).id) || 0 },
    include: { pagos: { orderBy: { registradoEn: "asc" }, include: { alumno: true } } },
  });
  if (!turno || (sesion.rol === "CAJERO" && turno.usuarioId !== sesion.usuarioId)) notFound();
  const institucion = await obtenerInstitucion();
  const logo = await urlLogo(institucion);
  const moneda = institucion?.moneda ?? "MXN";
  const zona = institucion?.zonaHoraria ?? "America/Mexico_City";
  const dinero = (n: number) => formatearMoneda(n, moneda);
  const resumen = await resumenTurno(turno.id);
  const abierto = turno.estado === "ABIERTO";
  const diferencia = aNumero(turno.diferencia);

  return (
    <div className="space-y-4">
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-3">
        <Link href={abierto ? "/panel/caja" : "/panel/caja/cortes"} className="text-sm text-marca-600 hover:underline">
          ← {abierto ? "Caja" : "Cortes de caja"}
        </Link>
        <BotonImprimir />
      </div>
      {cerrado && (
        <div className="no-imprimir">
          <Alerta tipo={diferencia === 0 ? "exito" : "aviso"}>
            Caja cerrada. {diferencia === 0 ? "El efectivo cuadra exacto." : diferencia > 0 ? `Sobran ${dinero(diferencia)}.` : `Faltan ${dinero(-diferencia)}.`}
          </Alerta>
        </div>
      )}

      <article className="hoja-impresion mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm" data-corte>
        <header className="flex items-start justify-between gap-6 border-b border-slate-300 pb-4">
          <div className="flex items-center gap-4">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-12 w-auto" />
            )}
            <div>
              <h1 className="text-base font-bold text-slate-900">{institucion?.nombre}</h1>
              <p className="text-xs text-slate-500">Cajero: {turno.usuarioNombre}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">{abierto ? "Corte parcial" : "Corte de caja"}</p>
            <p className="font-mono text-sm text-slate-900">#{turno.id}</p>
            <p className="text-xs text-slate-500">Apertura: {fechaHoraLegible(turno.abiertoEn, zona)}</p>
            {turno.cerradoEn && <p className="text-xs text-slate-500">Cierre: {fechaHoraLegible(turno.cerradoEn, zona)}</p>}
          </div>
        </header>

        <section className="grid gap-6 py-4 sm:grid-cols-2">
          <table className="w-full text-sm" data-por-metodo>
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
                <th className="py-1">Metodo</th>
                <th className="py-1 text-right">Cobros</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {resumen.porMetodo.map((f) => (
                <tr key={f.metodo} className="border-b border-slate-100">
                  <td className="py-1">{NOMBRE_METODO[f.metodo]}</td>
                  <td className="py-1 text-right">{f.cobros}</td>
                  <td className="py-1 text-right">{dinero(f.total)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1">Total cobrado</td>
                <td className="py-1 text-right">{resumen.cobros}</td>
                <td className="py-1 text-right">{dinero(resumen.totalCobrado)}</td>
              </tr>
              {resumen.cancelados > 0 && (
                <tr className="text-xs text-red-700">
                  <td className="py-1">Cancelados (no cuentan)</td>
                  <td className="py-1 text-right">{resumen.cancelados}</td>
                  <td className="py-1 text-right">{dinero(resumen.montoCancelado)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <dl className="space-y-1 text-sm" data-efectivo>
            <div className="flex justify-between"><dt className="text-slate-500">Fondo inicial</dt><dd>{dinero(aNumero(turno.fondoInicial))}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">+ Efectivo cobrado</dt><dd>{dinero(resumen.efectivoCobrado)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold"><dt>Efectivo esperado</dt><dd>{dinero(abierto ? resumen.efectivoEsperado : aNumero(turno.efectivoEsperado))}</dd></div>
            {!abierto && (
              <>
                <div className="flex justify-between"><dt className="text-slate-500">Efectivo contado</dt><dd>{dinero(aNumero(turno.efectivoContado))}</dd></div>
                <div className={`flex justify-between font-semibold ${diferencia === 0 ? "text-emerald-700" : "text-red-700"}`}>
                  <dt>Diferencia</dt>
                  <dd data-diferencia-corte>{diferencia === 0 ? "Cuadra" : `${diferencia > 0 ? "Sobran" : "Faltan"} ${dinero(Math.abs(diferencia))}`}</dd>
                </div>
              </>
            )}
            {turno.notasCierre && <p className="pt-2 text-xs text-slate-600">Notas: {turno.notasCierre}</p>}
          </dl>
        </section>

        <section className="border-t border-slate-200 pt-3">
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Detalle</p>
          <table className="w-full text-xs">
            <tbody>
              {turno.pagos.map((p) => (
                <tr key={p.id} className={`border-b border-slate-100 ${p.estado === "CANCELADO" ? "text-red-700 line-through" : ""}`} data-pago-corte={p.folio}>
                  <td className="py-1 font-mono">{p.folio}</td>
                  <td className="py-1">{fechaHoraLegible(p.registradoEn, zona)}</td>
                  <td className="py-1">{p.alumno.matricula} {nombreCompleto(p.alumno)}</td>
                  <td className="py-1">{NOMBRE_METODO[p.metodoPago]}{p.referencia ? ` ${p.referencia}` : ""}</td>
                  <td className="py-1 text-right">{dinero(aNumero(p.montoTotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {!abierto && (
          <footer className="mt-10 grid grid-cols-2 gap-10 text-center text-xs text-slate-600">
            <div className="border-t border-slate-400 pt-1">Entrega: {turno.usuarioNombre}</div>
            <div className="border-t border-slate-400 pt-1">Recibe</div>
          </footer>
        )}
      </article>
    </div>
  );
}
