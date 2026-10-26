"use client";

import { useActionState, useState } from "react";
import { Alerta } from "@/components/ui";
import { accionRechazarSolicitud, type EstadoDocumentos } from "../acciones";

export function FormularioRechazo({ solicitudId }: { solicitudId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoDocumentos, FormData>(accionRechazarSolicitud, {});
  const [abierto, setAbierto] = useState(false);
  if (estado.ok) return <span className="text-xs text-slate-500">Rechazada</span>;
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-xs font-medium text-red-600 hover:underline">
        Rechazar
      </button>
    );
  }
  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="solicitudId" value={solicitudId} />
      <input name="respuesta" required aria-label="Motivo del rechazo" placeholder="Motivo para el alumno" className="campo w-56 py-1 text-xs" />
      <button type="submit" disabled={pendiente} className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
        {pendiente ? "..." : "Confirmar"}
      </button>
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
    </form>
  );
}
