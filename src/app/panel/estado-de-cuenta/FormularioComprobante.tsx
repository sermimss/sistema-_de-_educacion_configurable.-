"use client";

import { useActionState, useEffect, useRef, startTransition } from "react";
import { Alerta, Boton, Campo, Selector } from "@/components/ui";
import { accionSubirComprobante, type EstadoComprobante } from "./acciones";

export function FormularioComprobante({ hoy }: { hoy: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoComprobante, FormData>(accionSubirComprobante, {});
  const formulario = useRef<HTMLFormElement>(null);
  // Solo se limpia al enviarse bien; con un error se conserva lo capturado (y el archivo).
  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);
  return (
    <form
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      className="space-y-3"
      data-subir-comprobante
    >
      {estado.error && <Alerta tipo="error">{estado.error}</Alerta>}
      {estado.ok && estado.mensaje && <Alerta tipo="exito">{estado.mensaje}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Monto que pagaste" name="monto" type="number" min={0.01} step="0.01" required />
        <Selector etiqueta="Como pagaste" name="metodoPago" defaultValue="TRANSFERENCIA">
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="DEPOSITO">Deposito en ventanilla</option>
        </Selector>
        <Campo etiqueta="Fecha del pago" name="fechaPago" type="date" required max={hoy} defaultValue={hoy} />
        <Campo etiqueta="Numero de operacion o clave de rastreo" name="referencia" required maxLength={80} className="sm:col-span-2" />
        <Campo etiqueta="Banco (opcional)" name="banco" maxLength={80} />
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor="archivo-comprobante">Comprobante (foto o PDF, hasta 10 MB)</label>
        <input id="archivo-comprobante" type="file" name="archivo" required accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" className="campo" />
      </div>
      <Campo etiqueta="Nota (opcional)" name="nota" maxLength={500} />
      <div className="flex justify-end">
        <Boton type="submit" disabled={pendiente}>{pendiente ? "Enviando..." : "Enviar comprobante"}</Boton>
      </div>
    </form>
  );
}
