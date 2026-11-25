import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { obtenerInstitucion } from "@/lib/institucion";
import { aNumero, resumenDeCuenta } from "@/lib/finanzas";
import { turnoAbierto } from "@/lib/caja";
import { tamanoLegible } from "@/lib/archivosEntrega";
import { referenciaDeAlumno } from "@/lib/referenciaAlumno";
import { fechaHoraLegible } from "@/lib/fechasDia";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { RevisionComprobante } from "./Revision";

export const dynamic = "force-dynamic";

/// Comprobantes que suben los alumnos: verificar contra el banco y confirmar
/// (se registra el pago) o rechazar con motivo.
export default async function PaginaComprobantes() {
  const sesion = await requerirRol("ADMIN", "CAJERO");
  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";
  const zona = institucion?.zonaHoraria ?? "America/Mexico_City";
  const dinero = (n: number) => formatearMoneda(n, moneda);
  const [pendientes, revisados, caja] = await Promise.all([
    db.comprobantePago.findMany({
      where: { estado: "POR_VERIFICAR" },
      orderBy: { creadoEn: "asc" },
      include: { alumno: { include: { plan: true } } },
      omit: { archivoDatos: true },
    }),
    db.comprobantePago.findMany({
      where: { estado: { not: "POR_VERIFICAR" } },
      orderBy: { revisadoEn: "desc" },
      take: 30,
      include: { alumno: true, pago: { select: { folio: true } } },
      omit: { archivoDatos: true },
    }),
    turnoAbierto(sesion.usuarioId),
  ]);
  const saldos = new Map<number, number>();
  for (const c of pendientes) if (!saldos.has(c.alumnoId)) saldos.set(c.alumnoId, (await resumenDeCuenta(c.alumnoId)).saldo);

  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/caja" className="text-sm text-marca-600 hover:underline">← Caja</Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Comprobantes de pago</h1>
        <p className="mt-1 text-sm text-slate-600">
          Transferencias y depositos que reportan los alumnos. Revisa que el dinero este en el banco y confirma: el pago se
          registra en tu caja y el alumno ve su recibo.
        </p>
      </header>
      {!caja && pendientes.length > 0 && (
        <Alerta tipo="aviso">
          Para confirmar comprobantes abre tu caja: cada pago confirmado entra a tu corte.{" "}
          <Link href="/panel/caja" className="font-medium underline">Ir a Caja</Link>
        </Alerta>
      )}
      <Tarjeta titulo="Por verificar" descripcion={`${pendientes.length} comprobante(s)`}>
        {pendientes.length === 0 ? (
          <EstadoVacio titulo="No hay comprobantes por verificar" />
        ) : (
          <div className="space-y-6">
            {pendientes.map((c) => (
              <article key={c.id} className="space-y-3 border-b border-slate-100 pb-6 last:border-0 last:pb-0" data-comprobante-pendiente={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {nombreCompleto(c.alumno)} · <span className="font-mono">{c.alumno.matricula}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.alumno.plan.nombre} · su referencia {referenciaDeAlumno(c.alumno.id)} · debe {dinero(saldos.get(c.alumnoId) ?? 0)} · enviado{" "}
                      {fechaHoraLegible(c.creadoEn, zona)}
                    </p>
                  </div>
                  <Insignia tono="alerta">{c.metodoPago === "DEPOSITO" ? "Deposito" : "Transferencia"}</Insignia>
                </div>
                <dl className="grid gap-1 text-sm sm:grid-cols-[9rem_1fr]">
                  <dt className="text-slate-500">Monto</dt>
                  <dd className="font-medium">{dinero(aNumero(c.monto))}</dd>
                  <dt className="text-slate-500">Fecha del pago</dt>
                  <dd>{formatearFecha(c.fechaPago)}</dd>
                  <dt className="text-slate-500">Referencia</dt>
                  <dd className="font-mono">{c.referencia}{c.banco ? ` · ${c.banco}` : ""}</dd>
                  {c.nota && (
                    <>
                      <dt className="text-slate-500">Nota</dt>
                      <dd>{c.nota}</dd>
                    </>
                  )}
                  <dt className="text-slate-500">Comprobante</dt>
                  <dd>
                    <a href={`/panel/caja/comprobantes/archivo/${c.id}`} target="_blank" rel="noopener noreferrer" className="text-marca-600 hover:underline" data-ver-comprobante>
                      Ver {c.archivoNombre}
                    </a>{" "}
                    <span className="text-xs text-slate-400">({tamanoLegible(c.archivoTamano)})</span>
                  </dd>
                </dl>
                <RevisionComprobante id={c.id} monto={aNumero(c.monto)} referencia={c.referencia} />
              </article>
            ))}
          </div>
        )}
      </Tarjeta>
      <Tarjeta titulo="Revisados">
        {revisados.length === 0 ? (
          <EstadoVacio titulo="Aun no hay comprobantes revisados" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {revisados.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-comprobante-revisado={c.estado}>
                <span>
                  {c.alumno.matricula} {nombreCompleto(c.alumno)} · {dinero(aNumero(c.monto))} · ref {c.referencia}
                  {c.estado === "RECHAZADO" && c.motivoRechazo ? <span className="block text-xs text-red-700">Motivo: {c.motivoRechazo}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <Insignia tono={c.estado === "CONFIRMADO" ? "exito" : "peligro"}>{c.estado === "CONFIRMADO" ? `Pago ${c.pago?.folio ?? ""}` : "Rechazado"}</Insignia>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
