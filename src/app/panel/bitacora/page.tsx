import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFechaHora } from "@/lib/formato";
import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui";

export const dynamic = "force-dynamic";

const TAMANO_PAGINA = 50;

export default async function PaginaBitacora({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  await requerirRol("ADMIN");
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.pagina ?? 1));

  const [entradas, total] = await Promise.all([
    db.bitacora.findMany({
      orderBy: { fecha: "desc" },
      take: TAMANO_PAGINA,
      skip: (pagina - 1) * TAMANO_PAGINA,
      include: { usuario: { select: { usuario: true } } },
    }),
    db.bitacora.count(),
  ]);

  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Bitacora de auditoria</h1>
        <p className="mt-1 text-sm text-slate-600">
          Quien hizo que y cuando. Obligatoria en calificaciones, finanzas y nomina.
        </p>
      </header>

      <Tarjeta descripcion={`${total} registro(s)`}>
        {entradas.length === 0 ? (
          <EstadoVacio titulo="Sin movimientos registrados" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 pr-4 font-medium">Usuario</th>
                  <th className="pb-2 pr-4 font-medium">Accion</th>
                  <th className="pb-2 pr-4 font-medium">Entidad</th>
                  <th className="pb-2 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entradas.map((entrada) => (
                  <tr key={entrada.id}>
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-600">
                      {formatearFechaHora(entrada.fecha)}
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {entrada.usuario?.usuario ?? "sistema"}
                    </td>
                    <td className="py-2 pr-4">
                      <Insignia
                        tono={
                          entrada.accion === "ELIMINAR" || entrada.accion === "INTENTO_FALLIDO"
                            ? "peligro"
                            : entrada.accion === "CREAR"
                              ? "exito"
                              : "neutro"
                        }
                      >
                        {entrada.accion}
                      </Insignia>
                    </td>
                    <td className="py-2 pr-4 text-slate-700">
                      {entrada.entidad}
                      {entrada.entidadId && (
                        <span className="text-slate-400"> #{entrada.entidadId}</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-500">{entrada.descripcion ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {paginas > 1 && (
          <nav className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <a
              href={`?pagina=${pagina - 1}`}
              className={`rounded-lg px-3 py-1.5 ${pagina <= 1 ? "pointer-events-none text-slate-300" : "text-marca-600 hover:bg-slate-100"}`}
            >
              Anterior
            </a>
            <span className="text-slate-500">
              Pagina {pagina} de {paginas}
            </span>
            <a
              href={`?pagina=${pagina + 1}`}
              className={`rounded-lg px-3 py-1.5 ${pagina >= paginas ? "pointer-events-none text-slate-300" : "text-marca-600 hover:bg-slate-100"}`}
            >
              Siguiente
            </a>
          </nav>
        )}
      </Tarjeta>
    </div>
  );
}
