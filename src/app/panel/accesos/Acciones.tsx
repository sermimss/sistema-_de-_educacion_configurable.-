"use client";

import { useActionState } from "react";
import { Alerta } from "@/components/ui";
import { accionAsignarTemporal, accionDescartarSolicitud, type EstadoAcceso } from "./acciones";

/// Botones de una solicitud. Al asignar, la contrasena temporal se queda en
/// pantalla aunque la solicitud ya no este pendiente: es la unica vez que se ve.
export function AccionesSolicitud({ solicitudId }: { solicitudId: number }) {
  const [asignado, asignar, asignando] = useActionState<EstadoAcceso, FormData>(accionAsignarTemporal, {});
  const [descartado, descartar, descartando] = useActionState<EstadoAcceso, FormData>(accionDescartarSolicitud, {});

  if (asignado.temporal) {
    return (
      <Alerta tipo="exito">
        <p>
          Contrasena temporal de <strong>{asignado.usuario}</strong>:{" "}
          <span className="select-all font-mono text-base font-semibold" data-contrasena-temporal>
            {asignado.temporal}
          </span>
        </p>
        <p className="mt-1 text-xs">
          Entregasela en persona o por telefono. Solo se muestra esta vez; al entrar, el sistema le pedira cambiarla.
        </p>
      </Alerta>
    );
  }
  if (descartado.descartada) return <span className="text-xs text-slate-500">Descartada</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={asignar}>
        <input type="hidden" name="solicitudId" value={solicitudId} />
        <button
          type="submit"
          disabled={asignando}
          className="rounded-lg bg-marca-600 px-3 py-1.5 text-xs font-medium text-marca-contraste hover:bg-marca-700"
        >
          {asignando ? "Asignando..." : "Asignar contrasena temporal"}
        </button>
      </form>
      <form action={descartar}>
        <input type="hidden" name="solicitudId" value={solicitudId} />
        <button type="submit" disabled={descartando} className="text-xs text-slate-600 hover:underline">
          Descartar
        </button>
      </form>
      {(asignado.error || descartado.error) && (
        <span className="text-xs text-red-600">{asignado.error ?? descartado.error}</span>
      )}
    </div>
  );
}
