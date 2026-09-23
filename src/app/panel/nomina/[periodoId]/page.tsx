import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { obtenerInstitucion } from "@/lib/institucion";
import { configBool, configNumero } from "@/lib/configuracion";
import { aNumero, centavos } from "@/lib/finanzas";
import { diasDelPeriodo } from "@/lib/nomina";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { BotonAutorizar, BotonCalcular, FormularioPagar } from "../Formularios";

export const dynamic = "force-dynamic";

const TONO_RECIBO: Record<string, "exito" | "alerta" | "neutro" | "peligro"> = {
  BORRADOR: "neutro",
  AUTORIZADO: "alerta",
  PAGADO: "exito",
  CANCELADO: "peligro",
};

export default async function PaginaPeriodoNomina({
  params,
}: {
  params: Promise<{ periodoId: string }>;
}) {
  await requerirRol("ADMIN");
  const { periodoId } = await params;
  const id = Number(periodoId);
  if (!Number.isFinite(id)) notFound();

  const periodo = await db.periodoNomina.findUnique({
    where: { id },
    include: {
      recibos: {
        orderBy: { empleado: { apellidoPaterno: "asc" } },
        include: { empleado: true, detalles: { include: { concepto: true } } },
      },
    },
  });
  if (!periodo) notFound();

  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";
  const [diasBase, prorratea] = await Promise.all([
    configNumero("nomina.dias_base_mes", 30),
    configBool("nomina.prorratea_por_dias", true),
  ]);

  const dias = diasDelPeriodo(periodo.fechaInicio, periodo.fechaFin);
  const vivos = periodo.recibos.filter((recibo) => recibo.estado !== "CANCELADO");
  const totales = {
    percepciones: centavos(vivos.reduce((s, r) => s + aNumero(r.totalPercepciones), 0)),
    deducciones: centavos(vivos.reduce((s, r) => s + aNumero(r.totalDeducciones), 0)),
    neto: centavos(vivos.reduce((s, r) => s + aNumero(r.neto), 0)),
  };
  const borradores = periodo.recibos.filter((r) => r.estado === "BORRADOR").length;
  const autorizados = periodo.recibos.filter((r) => r.estado === "AUTORIZADO").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/panel/nomina" className="text-sm text-marca-600 hover:underline">
            ← Nomina
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{periodo.nombre}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {formatearFecha(periodo.fechaInicio)} — {formatearFecha(periodo.fechaFin)} ({dias} dias)
            · se paga el {formatearFecha(periodo.fechaPago)}
          </p>
        </div>
        <Insignia
          tono={
            periodo.estado === "PAGADO" ? "exito" : periodo.estado === "CALCULADO" ? "alerta" : "neutro"
          }
        >
          {periodo.estado.toLowerCase()}
        </Insignia>
      </header>

      <Alerta tipo="info">
        {prorratea
          ? `El sueldo del periodo se prorratea: salario mensual entre ${diasBase} dias, por los ${dias} dias que cubre.`
          : "El prorrateo esta apagado: cada periodo paga el salario base completo."}{" "}
        Se cambia en Configuracion.
      </Alerta>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Recibos", String(periodo.recibos.length)],
          ["Percepciones", formatearMoneda(totales.percepciones, moneda)],
          ["Deducciones", formatearMoneda(totales.deducciones, moneda)],
          ["Neto a pagar", formatearMoneda(totales.neto, moneda)],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="tarjeta px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{valor}</p>
          </div>
        ))}
      </div>

      {periodo.estado !== "PAGADO" && (
        <Tarjeta titulo="Calcular">
          <BotonCalcular periodoId={periodo.id} />
        </Tarjeta>
      )}

      {periodo.recibos.length > 0 && (
        <>
          <Tarjeta titulo="Autorizar" descripcion={`${borradores} recibo(s) en borrador`}>
            <BotonAutorizar periodoId={periodo.id} borradores={borradores} />
          </Tarjeta>

          <Tarjeta titulo="Pagar" descripcion={`${autorizados} recibo(s) autorizados`}>
            <FormularioPagar
              periodoId={periodo.id}
              fechaPago={periodo.fechaPago.toISOString().slice(0, 10)}
              autorizados={autorizados}
              pagado={periodo.estado === "PAGADO"}
            />
          </Tarjeta>
        </>
      )}

      <Tarjeta titulo="Recibos del periodo">
        {periodo.recibos.length === 0 ? (
          <EstadoVacio
            titulo="Todavia no se calcula la nomina"
            mensaje="Usa el boton de calcular para generar los recibos."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Folio</th>
                  <th className="pb-2 pr-3 font-medium">Empleado</th>
                  <th className="pb-2 pr-3 font-medium">Percepciones</th>
                  <th className="pb-2 pr-3 font-medium">Deducciones</th>
                  <th className="pb-2 pr-3 font-medium">Neto</th>
                  <th className="pb-2 pr-3 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodo.recibos.map((recibo) => (
                  <tr key={recibo.id}>
                    <td className="py-2 pr-3 font-mono text-[11px] text-slate-500">{recibo.folio}</td>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-slate-800">{nombreCompleto(recibo.empleado)}</p>
                      <p className="text-xs text-slate-500">
                        {recibo.empleado.numeroEmpleado}
                        {recibo.empleado.puesto ? ` · ${recibo.empleado.puesto}` : ""}
                      </p>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {formatearMoneda(aNumero(recibo.totalPercepciones), moneda)}
                    </td>
                    <td className="py-2 pr-3 text-red-700">
                      {formatearMoneda(aNumero(recibo.totalDeducciones), moneda)}
                    </td>
                    <td className="py-2 pr-3 font-semibold text-slate-900">
                      {formatearMoneda(aNumero(recibo.neto), moneda)}
                    </td>
                    <td className="py-2 pr-3">
                      <Insignia tono={TONO_RECIBO[recibo.estado] ?? "neutro"}>
                        {recibo.estado.toLowerCase()}
                      </Insignia>
                    </td>
                    <td className="py-2 text-right">
                      <Link
                        href={`/panel/nomina/recibo/${recibo.id}`}
                        className="text-sm font-medium text-marca-600 hover:underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
