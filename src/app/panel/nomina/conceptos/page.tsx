import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { obtenerInstitucion } from "@/lib/institucion";
import { formatearMoneda } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { BotonEliminarConceptoNomina, FormularioConceptoNomina } from "../Formularios";
import { alternarConceptoNomina } from "../acciones";

export const dynamic = "force-dynamic";

const ETIQUETA_TIPO: Record<string, string> = {
  PERCEPCION: "Percepcion",
  DEDUCCION: "Deduccion",
  OTRO_PAGO: "Otro pago",
};

export default async function PaginaConceptosNomina({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  await requerirRol("ADMIN");
  const params = await searchParams;
  const institucion = await obtenerInstitucion();
  const moneda = institucion?.moneda ?? "MXN";

  const conceptos = await db.conceptoNomina.findMany({
    orderBy: [{ activo: "desc" }, { orden: "asc" }],
    include: { _count: { select: { detalles: true } } },
  });

  const editando = conceptos.find((concepto) => concepto.id === Number(params.editar));

  return (
    <div className="space-y-6">
      <header>
        <Link href="/panel/nomina" className="text-sm text-marca-600 hover:underline">
          ← Nomina
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Conceptos de nomina</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cada colegio define sus percepciones y deducciones, con monto fijo o porcentaje del
          sueldo del periodo.
        </p>
      </header>

      <Alerta tipo="info">
        El sistema no calcula las tablas oficiales de ISR ni de seguridad social: los porcentajes o
        montos de cada deduccion los captura el colegio. Para el CFDI de nomina hace falta conectar
        un PAC.
      </Alerta>

      <Tarjeta titulo={`${conceptos.length} concepto(s)`}>
        {conceptos.length === 0 ? (
          <EstadoVacio titulo="Sin conceptos de nomina" mensaje="Crea el primero abajo." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Clave</th>
                  <th className="pb-2 pr-3 font-medium">Nombre</th>
                  <th className="pb-2 pr-3 font-medium">Tipo</th>
                  <th className="pb-2 pr-3 font-medium">Valor</th>
                  <th className="pb-2 pr-3 font-medium">En recibos</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conceptos.map((concepto) => (
                  <tr key={concepto.id} className={concepto.activo ? "" : "opacity-50"}>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-600">{concepto.clave}</td>
                    <td className="py-2 pr-3 font-medium text-slate-800">
                      {concepto.nombre}
                      {!concepto.gravable && (
                        <span className="ml-2 text-xs font-normal text-slate-500">no gravable</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Insignia tono={concepto.tipo === "DEDUCCION" ? "peligro" : "exito"}>
                        {ETIQUETA_TIPO[concepto.tipo]}
                      </Insignia>
                    </td>
                    <td className="py-2 pr-3 text-slate-900">
                      {concepto.tipoCalculo === "PORCENTAJE"
                        ? `${Number(concepto.valor)}%`
                        : formatearMoneda(Number(concepto.valor ?? 0), moneda)}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{concepto._count.detalles}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/panel/nomina/conceptos?editar=${concepto.id}`}
                          className="text-xs font-medium text-marca-600 hover:underline"
                        >
                          editar
                        </Link>
                        <form action={alternarConceptoNomina} className="inline">
                          <input type="hidden" name="conceptoId" value={concepto.id} />
                          <button type="submit" className="text-xs font-medium text-slate-500 hover:underline">
                            {concepto.activo ? "desactivar" : "activar"}
                          </button>
                        </form>
                        {concepto._count.detalles === 0 && (
                          <BotonEliminarConceptoNomina conceptoId={concepto.id} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Tarjeta
        titulo={editando ? `Editar ${editando.nombre}` : "Nuevo concepto"}
        acciones={
          editando ? (
            <Link href="/panel/nomina/conceptos" className="text-sm text-marca-600 hover:underline">
              Cancelar edicion
            </Link>
          ) : undefined
        }
      >
        <FormularioConceptoNomina
          key={editando?.id ?? "nuevo"}
          concepto={
            editando
              ? {
                  id: editando.id,
                  clave: editando.clave,
                  nombre: editando.nombre,
                  tipo: editando.tipo,
                  tipoCalculo: editando.tipoCalculo,
                  valor: String(Number(editando.valor ?? 0)),
                  gravable: editando.gravable,
                  claveSat: editando.claveSat ?? "",
                  activo: editando.activo,
                }
              : undefined
          }
        />
      </Tarjeta>
    </div>
  );
}
