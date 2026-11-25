"use client";

import { useActionState, useState } from "react";
import { Alerta, Boton, Campo } from "@/components/ui";
import { accionAbrirCaja, accionCerrarCaja, type EstadoCaja } from "./acciones";

export function FormularioAbrirCaja() {
  const [estado, accion, pendiente] = useActionState<EstadoCaja, FormData>(accionAbrirCaja, {});
  return (
    <form action={accion} className="flex flex-wrap items-end gap-3" data-abrir-caja>
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo etiqueta="Fondo inicial en efectivo" name="fondoInicial" type="number" min={0} step="0.01" defaultValue="0" ayuda="El cambio con el que empiezas" />
      <Boton type="submit" disabled={pendiente}>{pendiente ? "Abriendo..." : "Abrir caja"}</Boton>
    </form>
  );
}

export function FormularioCerrarCaja({ esperado, moneda }: { esperado: number; moneda: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoCaja, FormData>(accionCerrarCaja, {});
  const [contado, setContado] = useState("");
  const diferencia = contado.trim() ? Math.round((Number(contado) - esperado) * 100) / 100 : null;
  const formatear = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda }).format(n);
  return (
    <form
      action={accion}
      className="space-y-3"
      data-cerrar-caja
      onSubmit={(e) => {
        if (!confirm("Al cerrar la caja ya no podras cancelar los pagos de este corte. ¿Cerrar?")) e.preventDefault();
      }}
    >
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo
          etiqueta="Efectivo contado en caja"
          name="efectivoContado"
          type="number"
          min={0}
          step="0.01"
          required
          value={contado}
          onChange={(e) => setContado(e.target.value)}
          ayuda={`Esperado: ${formatear(esperado)} (fondo + efectivo cobrado)`}
        />
        <Campo etiqueta="Notas (opcional)" name="notasCierre" maxLength={1000} className="sm:col-span-2" />
      </div>
      {diferencia != null && Number.isFinite(diferencia) && (
        <p className={`text-sm font-medium ${diferencia === 0 ? "text-emerald-700" : "text-red-700"}`} data-diferencia>
          {diferencia === 0 ? "Cuadra exacto." : diferencia > 0 ? `Sobran ${formatear(diferencia)}.` : `Faltan ${formatear(-diferencia)}.`}
        </p>
      )}
      <div className="flex justify-end">
        <Boton type="submit" variante="peligro" disabled={pendiente}>{pendiente ? "Cerrando..." : "Cerrar caja y hacer el corte"}</Boton>
      </div>
    </form>
  );
}
