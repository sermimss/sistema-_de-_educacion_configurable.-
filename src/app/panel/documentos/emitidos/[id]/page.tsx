import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesion } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { obtenerInstitucion } from "@/lib/institucion";
import { formatearFechaHora } from "@/lib/formato";
import { imagenIncrustada, marcaParaHoja } from "@/lib/marca";
import { HojaDocumento, type DatosHoja } from "@/components/HojaDocumento";
import { Alerta } from "@/components/ui";
import { BotonImprimir } from "@/app/panel/boletas/Acciones";
import { FormularioCancelar } from "./FormularioCancelar";

export const dynamic = "force-dynamic";

export default async function PaginaDocumentoEmitido({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirSesion();
  const { id } = await params;
  const documento = await db.documentoEmitido.findUnique({
    where: { id: Number(id) || 0 },
    include: { plantilla: true },
  });
  if (!documento) notFound();

  // El alumno solo ve sus propios documentos; el docente, ninguno.
  if (sesion.rol === "ALUMNO") {
    const alumno = await alumnoDeSesion(sesion.usuarioId);
    if (!alumno || documento.alumnoId !== alumno.id) notFound();
  } else if (sesion.rol !== "ADMIN") {
    notFound();
  }

  const institucion = await obtenerInstitucion();
  const datos = (documento.datos ?? {}) as DatosHoja;
  const esAdmin = sesion.rol === "ADMIN";

  return (
    <div className="space-y-4">
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-3">
        <Link
          href={esAdmin ? "/panel/documentos/emitidos" : "/panel/mis-documentos"}
          className="text-sm text-marca-600 hover:underline"
        >
          ← {esAdmin ? "Historial" : "Mis documentos"}
        </Link>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            {documento.plantilla.nombre} · folio {documento.folio} · {formatearFechaHora(documento.emitidoEn)}
            {esAdmin && ` · por ${documento.emitidoPorNombre}`}
          </span>
          {!documento.cancelado && <BotonImprimir />}
        </div>
      </div>

      {documento.cancelado && (
        <div className="no-imprimir">
          <Alerta tipo="error">Documento cancelado: {documento.motivoCancelacion}</Alerta>
        </div>
      )}

      <div className="overflow-x-auto bg-slate-100 p-4 print:bg-white print:p-0">
        <HojaDocumento
          marca={await marcaParaHoja(institucion)}
          titulo={documento.titulo}
          cuerpo={documento.cuerpo}
          datos={datos}
          firmante={{
            nombre: documento.firmanteNombre,
            cargo: documento.firmanteCargo,
            firma: await imagenIncrustada(documento.firmaId),
            sello: await imagenIncrustada(documento.selloId),
          }}
          folio={documento.folio}
          fechaEmision={formatearFechaHora(documento.emitidoEn)}
          cancelado={documento.cancelado}
        />
      </div>

      {esAdmin && !documento.cancelado && (
        <div className="no-imprimir mx-auto max-w-[216mm]">
          <FormularioCancelar documentoId={documento.id} />
        </div>
      )}
    </div>
  );
}
