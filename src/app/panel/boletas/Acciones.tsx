"use client";

import { useActionState } from "react";
import { Alerta, Boton } from "@/components/ui";
import { accionRecalcular, type EstadoBoletas } from "./acciones";

export function BotonRecalcular({ cicloId }: { cicloId: number }) {
  const [estado, accion, pendiente] = useActionState<EstadoBoletas, FormData>(
    accionRecalcular,
    {}
  );
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="cicloId" value={cicloId} />
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <Boton type="submit" disabled={pendiente}>
        {pendiente ? "Calculando..." : "Recalcular promedios y ranking"}
      </Boton>
    </form>
  );
}

export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-imprimir rounded-lg bg-marca-600 px-4 py-2 text-sm font-medium text-white hover:bg-marca-700"
    >
      Imprimir o guardar como PDF
    </button>
  );
}
