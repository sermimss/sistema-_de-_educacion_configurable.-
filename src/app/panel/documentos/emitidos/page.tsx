import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFechaHora } from "@/lib/formato";
import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { Pestanas } from "../Pestanas";

export const dynamic = "force-dynamic";

export default async function PaginaHistorial({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requerirRol("ADMIN");
  const q = ((await searchParams).q ?? "").trim();
  const [documentos, pendientes] = await Promise.all([
    db.documentoEmitido.findMany({
      where: q
        ? {
            OR: [
              { folio: { contains: q, mode: "insensitive" } },
              { destinatario: { contains: q, mode: "insensitive" } },
              { plantilla: { nombre: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {},
      orderBy: { emitidoEn: "desc" },
      take: 100,
      include: { plantilla: true },
    }),
    db.solicitudDocumento.count({ where: { estado: "PENDIENTE" } }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Documentos</h1>
      </header>
      <Pestanas actual="/panel/documentos/emitidos" pendientes={pendientes} />
      <Tarjeta titulo="Historial" descripcion="Cada documento generado, con su folio. Se pueden reimprimir.">
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} aria-label="Buscar en el historial" placeholder="Folio, nombre o tipo de documento" className="campo max-w-md flex-1" />
          <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Buscar</button>
        </form>
        {documentos.length === 0 ? (
          <EstadoVacio titulo="Sin documentos" mensaje="Los documentos que generes apareceran aqui." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Folio</th>
                  <th className="pb-2 pr-4 font-medium">Documento</th>
                  <th className="pb-2 pr-4 font-medium">Para</th>
                  <th className="pb-2 pr-4 font-medium">Generado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documentos.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2 pr-4 font-mono text-xs">{d.folio}</td>
                    <td className="py-2 pr-4">
                      {d.plantilla.nombre}
                      {d.cancelado && <span className="ml-2"><Insignia tono="peligro">cancelado</Insignia></span>}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{d.destinatario ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-500">{formatearFechaHora(d.emitidoEn)} · {d.emitidoPorNombre}</td>
                    <td className="py-2 text-right">
                      <Link href={`/panel/documentos/emitidos/${d.id}`} className="font-medium text-marca-600 hover:underline">Ver</Link>
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
