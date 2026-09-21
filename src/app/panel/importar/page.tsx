import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFechaHora } from "@/lib/formato";
import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import FormularioImportacion from "./FormularioImportacion";
import { COLUMNAS } from "@/lib/importacion";

export const dynamic = "force-dynamic";

export default async function PaginaImportar({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  await requerirRol("ADMIN");
  const params = await searchParams;
  const tipoInicial = COLUMNAS[params.tipo ?? ""] ? params.tipo! : "alumnos";

  const historial = await db.importacionCsv.findMany({
    orderBy: { fecha: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Importar desde CSV</h1>
        <p className="mt-1 text-sm text-slate-600">
          Carga masiva de alumnos, personal y materias. Las filas con error no detienen al resto.
        </p>
      </header>

      <FormularioImportacion tipoInicial={tipoInicial} columnas={COLUMNAS} />

      <Tarjeta titulo="Importaciones recientes">
        {historial.length === 0 ? (
          <EstadoVacio titulo="Sin importaciones registradas" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {historial.map((importacion) => (
              <li key={importacion.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    {importacion.tipo} · {importacion.nombreArchivo}
                  </p>
                  <p className="text-xs text-slate-500">{formatearFechaHora(importacion.fecha)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Insignia tono="exito">{importacion.exitosos} ok</Insignia>
                  {importacion.fallidos > 0 && (
                    <Insignia tono="peligro">{importacion.fallidos} con error</Insignia>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
