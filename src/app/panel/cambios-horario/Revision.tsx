"use client";

import { useActionState } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { DIAS_SEMANA } from "@/lib/formato";
import { accionAprobarCambio, accionRechazarCambio, type EstadoRevision } from "./acciones";

function Errores({ estado }: { estado: EstadoRevision }) {
  if (!estado.error) return null;
  return (
    <Alerta tipo="error">
      {estado.error}
      {estado.detalles && (
        <ul className="mt-1 list-disc pl-5" data-choques>
          {estado.detalles.map((d) => <li key={d}>{d}</li>)}
        </ul>
      )}
    </Alerta>
  );
}

/// Aprobar (con los datos que pidio el docente ya puestos, para ajustarlos si
/// hace falta) o rechazar con un motivo.
export function RevisionSolicitud({
  solicitud,
  aulas,
}: {
  solicitud: {
    id: number;
    tipo: "PERMANENTE" | "UNA_FECHA";
    nuevoDia: number | null;
    nuevaFecha: string | null;
    horaInicio: string;
    horaFin: string;
    aulaActual: string | null;
  };
  aulas: { id: number; nombre: string }[];
}) {
  const [aprobacion, aprobar, aprobando] = useActionState<EstadoRevision, FormData>(accionAprobarCambio, {});
  const [rechazo, rechazar, rechazando] = useActionState<EstadoRevision, FormData>(accionRechazarCambio, {});

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={aprobar} className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3" data-aprobar>
        <input type="hidden" name="solicitudId" value={solicitud.id} />
        <p className="text-sm font-medium text-slate-800">Aprobar (puedes ajustar antes)</p>
        <Errores estado={aprobacion} />
        <div className="grid gap-3 sm:grid-cols-3">
          {solicitud.tipo === "PERMANENTE" ? (
            <Selector etiqueta="Dia" name="nuevoDia" defaultValue={solicitud.nuevoDia ?? 1}>
              {DIAS_SEMANA.map((d) => (
                <option key={d.valor} value={d.valor}>{d.nombre}</option>
              ))}
            </Selector>
          ) : (
            <Campo etiqueta="Fecha" name="nuevaFecha" type="date" required defaultValue={solicitud.nuevaFecha ?? ""} />
          )}
          <Campo etiqueta="Inicio" name="horaInicio" type="time" required defaultValue={solicitud.horaInicio} />
          <Campo etiqueta="Fin" name="horaFin" type="time" required defaultValue={solicitud.horaFin} />
        </div>
        <Selector etiqueta="Aula" name="aulaId" defaultValue="">
          <option value="">{solicitud.aulaActual ? `La misma (${solicitud.aulaActual})` : "Sin cambio"}</option>
          {aulas.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </Selector>
        <Campo etiqueta="Nota para el docente (opcional)" name="nota" maxLength={500} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="avisar" value="1" defaultChecked className="h-4 w-4 rounded border-slate-300" />
          Avisar a los alumnos de la clase
        </label>
        <div className="flex justify-end">
          <Boton type="submit" disabled={aprobando}>{aprobando ? "Aprobando..." : "Aprobar cambio"}</Boton>
        </div>
      </form>

      <form action={rechazar} className="space-y-3 rounded-lg border border-red-200 bg-red-50/40 p-3" data-rechazar>
        <input type="hidden" name="solicitudId" value={solicitud.id} />
        <p className="text-sm font-medium text-slate-800">Rechazar</p>
        <Errores estado={rechazo} />
        <div>
          <label className="etiqueta-campo" htmlFor={`respuesta-${solicitud.id}`}>Motivo del rechazo</label>
          <textarea id={`respuesta-${solicitud.id}`} name="respuesta" rows={3} maxLength={1000} className="campo" placeholder="El docente lo vera" />
        </div>
        <div className="flex justify-end">
          <Boton type="submit" variante="peligro" disabled={rechazando}>{rechazando ? "Rechazando..." : "Rechazar"}</Boton>
        </div>
      </form>
    </div>
  );
}
