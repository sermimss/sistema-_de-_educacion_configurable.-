import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { nombreCompleto } from "@/lib/catalogos";
import { formatearFechaHora } from "@/lib/formato";
import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { Pestanas } from "../Pestanas";
import { FormularioRechazo } from "./FormularioRechazo";

export const dynamic = "force-dynamic";

export default async function PaginaSolicitudes() {
  await requerirRol("ADMIN");
  const [pendientes, recientes] = await Promise.all([
    db.solicitudDocumento.findMany({
      where: { estado: "PENDIENTE" },
      orderBy: { creadaEn: "asc" },
      include: { alumno: true, plantilla: true },
    }),
    db.solicitudDocumento.findMany({
      where: { estado: { not: "PENDIENTE" } },
      orderBy: { atendidaEn: "desc" },
      take: 30,
      include: { alumno: true, plantilla: true, documento: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Documentos</h1>
      </header>
      <Pestanas actual="/panel/documentos/solicitudes" pendientes={pendientes.length} />
      <Tarjeta titulo="Por atender" descripcion="Lo que los alumnos pidieron desde su portal.">
        {pendientes.length === 0 ? (
          <EstadoVacio titulo="Sin solicitudes pendientes" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pendientes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-solicitud={s.id}>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {s.plantilla.nombre} · {nombreCompleto(s.alumno)} ({s.alumno.matricula})
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatearFechaHora(s.creadaEn)}
                    {s.motivo ? ` · "${s.motivo}"` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/panel/documentos/generar/${s.plantillaId}?solicitud=${s.id}`}
                    className="rounded-lg bg-marca-600 px-3 py-1.5 text-xs font-medium text-marca-contraste hover:bg-marca-700"
                  >
                    Generar
                  </Link>
                  <FormularioRechazo solicitudId={s.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
      {recientes.length > 0 && (
        <Tarjeta titulo="Atendidas recientemente">
          <ul className="divide-y divide-slate-100 text-sm">
            {recientes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {s.plantilla.nombre} · {nombreCompleto(s.alumno)}
                  {s.respuesta ? <span className="text-xs text-slate-500"> · {s.respuesta}</span> : null}
                </span>
                {s.documento ? (
                  <Link href={`/panel/documentos/emitidos/${s.documento.id}`} className="text-xs font-medium text-marca-600 hover:underline">
                    {s.documento.folio}
                  </Link>
                ) : (
                  <Insignia tono="peligro">rechazada</Insignia>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
