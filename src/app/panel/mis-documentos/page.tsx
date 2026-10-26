import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { alumnoDeSesion } from "@/lib/alumnoSesion";
import { asegurarCatalogo } from "@/lib/documentos/datos";
import { formatearFechaHora } from "@/lib/formato";
import { Alerta, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { FormularioSolicitud } from "./FormularioSolicitud";

export const dynamic = "force-dynamic";

const TONO = { PENDIENTE: "alerta", ATENDIDA: "exito", RECHAZADA: "peligro" } as const;
const TEXTO = { PENDIENTE: "en espera", ATENDIDA: "lista", RECHAZADA: "no procede" } as const;

export default async function PaginaMisDocumentos() {
  const sesion = await requerirRol("ALUMNO");
  const alumno = await alumnoDeSesion(sesion.usuarioId);
  if (!alumno) return <Alerta tipo="error">Tu usuario no esta ligado a un expediente.</Alerta>;
  await asegurarCatalogo();

  const [disponibles, solicitudes, emitidos] = await Promise.all([
    db.plantillaDocumento.findMany({
      where: { activa: true, alumnoPuedeSolicitar: true, categoria: "ALUMNO" },
      orderBy: { orden: "asc" },
    }),
    db.solicitudDocumento.findMany({
      where: { alumnoId: alumno.id },
      orderBy: { creadaEn: "desc" },
      take: 30,
      include: { plantilla: true, documento: true },
    }),
    db.documentoEmitido.findMany({
      where: { alumnoId: alumno.id, cancelado: false },
      orderBy: { emitidoEn: "desc" },
      take: 30,
      include: { plantilla: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">Mis documentos</h1>
        <p className="mt-1 text-sm text-slate-600">Pide constancias y otros documentos al colegio.</p>
      </header>

      <Tarjeta titulo="Solicitar un documento">
        {disponibles.length === 0 ? (
          <EstadoVacio titulo="Por ahora el colegio no recibe solicitudes en linea" />
        ) : (
          <FormularioSolicitud documentos={disponibles.map((d) => ({ id: d.id, nombre: d.nombre }))} />
        )}
      </Tarjeta>

      <Tarjeta titulo="Mis solicitudes">
        {solicitudes.length === 0 ? (
          <EstadoVacio titulo="Aun no has pedido documentos" />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {solicitudes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium text-slate-800">{s.plantilla.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {formatearFechaHora(s.creadaEn)}
                    {s.respuesta ? ` · ${s.respuesta}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Insignia tono={TONO[s.estado]}>{TEXTO[s.estado]}</Insignia>
                  {s.documento && !s.documento.cancelado && (
                    <Link href={`/panel/documentos/emitidos/${s.documento.id}`} className="text-xs font-medium text-marca-600 hover:underline">
                      Ver e imprimir
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {emitidos.length > 0 && (
        <Tarjeta titulo="Documentos emitidos a mi nombre">
          <ul className="divide-y divide-slate-100 text-sm">
            {emitidos.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2">
                <span>{d.plantilla.nombre} · {d.folio}</span>
                <Link href={`/panel/documentos/emitidos/${d.id}`} className="text-xs font-medium text-marca-600 hover:underline">
                  Ver
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
