"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import { accionCancelarDocumento, type EstadoDocumentos } from "../../acciones";

export function FormularioCancelar({ documentoId }: { documentoId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoDocumentos, FormData>(accionCancelarDocumento, {});
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="text-xs text-red-600 hover:underline">
        Cancelar este documento
      </button>
    );
  }
  return (
    <form action={accion} className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <input type="hidden" name="documentoId" value={documentoId} />
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo etiqueta="Motivo de la cancelacion" name="motivo" required />
      <Boton type="submit" variante="peligro" disabled={pendiente}>
        {pendiente ? "Cancelando..." : "Cancelar documento"}
      </Boton>
    </form>
  );
}
